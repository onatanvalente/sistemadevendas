/* ══════════════════════════════════════════════════════════════
   SNGPC — Fase 1 + Fase 2 (Motor Regulatório Completo)
   Sistema Nacional de Gerenciamento de Produtos Controlados
   
   Fase 1:
     ✔ Configuração da drogaria
     ✔ Movimentações imutáveis (entrada, saída, ajuste, inventário)
     ✔ Períodos de controle
     ✔ Geração de XML padrão ANVISA
     ✔ Transmissão manual (registro)
     ✔ Relatórios obrigatórios
     ✔ Validação pré-XML
     ✔ Hash SHA-256 de integridade
     ✔ Bloqueio pós-fechamento
   
   Fase 2:
     ✔ Motor de movimentações regulatório (SERIALIZABLE)
     ✔ Estoque regulatório separado (sngpc_estoque)
     ✔ Gestão de períodos (abrir/fechar/transmitir/cancelar)
     ✔ Fechamento com hash SHA-256 de integridade
     ✔ Bloqueios imutáveis pós-fechamento
     ✔ Services: SngpcMovimentacaoService + SngpcPeriodoService
   
   Regras:
     🚨 Movimentações são IMUTÁVEIS (somente INSERT)
     🚨 Estoque regulatório NUNCA negativo
     🚨 Período fechado/transmitido/cancelado → sem retroativo
     🚨 Transaction SERIALIZABLE em toda movimentação
     🚨 Acesso restrito: farmacêutico + administrador
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const { auth, perfil } = require('../middleware/auth');
const {
  sequelize, Produto, Lote, Venda, Compra, Usuario, Empresa, Fornecedor,
  SngpcConfiguracao, SngpcMovimentacao, SngpcPeriodo, SngpcTransmissao,
  SngpcEstoque, SngpcArquivo, SngpcAuditoria,
  MedicamentoControlado, EstoqueMovimentacao, CompraItem
} = require('../models');
const { logger } = require('../config/logger');
const SngpcMovimentacaoService = require('../services/SngpcMovimentacaoService');
const SngpcPeriodoService = require('../services/SngpcPeriodoService');
const SngpcArquivoService = require('../services/SngpcArquivoService');
const SngpcTransmissaoService = require('../services/SngpcTransmissaoService');
const SngpcAuditoriaService = require('../services/SngpcAuditoriaService');

// ── Helpers ──────────────────────────────────────────────────

// Middleware: só farmacêutico ou admin podem executar ações críticas
const perfilSngpc = perfil('administrador', 'farmaceutico');

/**
 * Gerar hash SHA-256 de integridade para movimentação SNGPC
 * Composto por: produto + lote + quantidade + data + cpf + crm
 */
function gerarHash(dados) {
  const str = [
    dados.produto_id,
    dados.lote_id,
    dados.quantidade,
    dados.data_movimentacao,
    dados.cpf_paciente || '',
    dados.crm_medico || ''
  ].join('|');
  return crypto.createHash('sha256').update(str).digest('hex');
}

/** Escape XML characters */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Traduzir tipo de movimentação para o XML SNGPC */
function traduzirTipoSngpc(tipo) {
  const map = { entrada: 'ENTRADA', saida: 'SAIDA', ajuste: 'AJUSTE', inventario: 'INVENTARIO' };
  return map[tipo] || tipo.toUpperCase();
}

// Todas as rotas exigem autenticação
router.use(auth);

// ══════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO SNGPC
// ══════════════════════════════════════════════════════════════

// GET /configuracao — Obter configuração SNGPC da empresa
router.get('/configuracao', async (req, res) => {
  try {
    let config = await SngpcConfiguracao.findOne({
      where: { empresa_id: req.empresa_id }
    });
    res.json(config || { configurado: false });
  } catch (error) {
    logger.error('Erro ao buscar configuração SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

// POST /configuracao — Criar ou atualizar configuração SNGPC
router.post('/configuracao', perfilSngpc, async (req, res) => {
  try {
    const { cnpj, razao_social, numero_afe, responsavel_tecnico_nome,
            responsavel_tecnico_crf, responsavel_tecnico_uf, data_inicio_controle } = req.body;

    if (!cnpj || !razao_social || !responsavel_tecnico_nome ||
        !responsavel_tecnico_crf || !responsavel_tecnico_uf || !data_inicio_controle) {
      return res.status(400).json({ error: 'Campos obrigatórios: cnpj, razao_social, responsavel_tecnico_nome, responsavel_tecnico_crf, responsavel_tecnico_uf, data_inicio_controle' });
    }

    let config = await SngpcConfiguracao.findOne({ where: { empresa_id: req.empresa_id } });
    if (config) {
      await config.update({
        cnpj, razao_social, numero_afe, responsavel_tecnico_nome,
        responsavel_tecnico_crf, responsavel_tecnico_uf, data_inicio_controle
      });
    } else {
      config = await SngpcConfiguracao.create({
        empresa_id: req.empresa_id,
        cnpj, razao_social, numero_afe, responsavel_tecnico_nome,
        responsavel_tecnico_crf, responsavel_tecnico_uf, data_inicio_controle,
        ambiente: 'producao', ativo: true
      });
    }

    if (req.audit) await req.audit('configurar', 'sngpc_configuracao', config.id, null, config.toJSON(), 'Configuração SNGPC atualizada');
    res.json(config);
  } catch (error) {
    logger.error('Erro ao salvar configuração SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

// ══════════════════════════════════════════════════════════════
//  DASHBOARD SNGPC
// ══════════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const empresa_id = req.empresa_id;
    const hoje = new Date().toISOString().split('T')[0];
    const inicioMes = hoje.substring(0, 7) + '-01';

    // Total de movimentações no mês
    const totalMes = await SngpcMovimentacao.count({
      where: { empresa_id, data_movimentacao: { [Op.gte]: inicioMes } }
    });

    // Pendentes de transmissão
    const pendentesTransmissao = await SngpcMovimentacao.count({
      where: { empresa_id, transmitido: false }
    });

    // Produtos controlados ativos
    const totalControlados = await Produto.count({
      where: { empresa_id, controlado: true, ativo: true }
    });

    // Lotes vencidos
    const lotesVencidos = await Lote.count({
      where: { empresa_id, status: 'ATIVO', validade: { [Op.lt]: hoje } },
      include: [{ model: Produto, where: { controlado: true }, attributes: [] }]
    });

    // Lotes próximos ao vencimento (30 dias)
    const treintaDias = new Date();
    treintaDias.setDate(treintaDias.getDate() + 30);
    const lotesProximoVencer = await Lote.count({
      where: {
        empresa_id, status: 'ATIVO',
        validade: { [Op.gte]: hoje, [Op.lte]: treintaDias.toISOString().split('T')[0] }
      },
      include: [{ model: Produto, where: { controlado: true }, attributes: [] }]
    });

    // Período aberto atual
    const periodoAberto = await SngpcPeriodo.findOne({
      where: { empresa_id, status: 'aberto' },
      order: [['data_inicio', 'DESC']]
    });

    // Últimas transmissões
    const ultimasTransmissoes = await SngpcTransmissao.findAll({
      where: { empresa_id },
      order: [['created_at', 'DESC']],
      limit: 5,
      include: [{ model: SngpcPeriodo, attributes: ['data_inicio', 'data_fim'] }]
    });

    // Movimentações por tipo no mês
    const porTipo = await SngpcMovimentacao.findAll({
      where: { empresa_id, data_movimentacao: { [Op.gte]: inicioMes } },
      attributes: ['tipo', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['tipo'],
      raw: true
    });

    // Configuração
    const configurado = await SngpcConfiguracao.findOne({ where: { empresa_id } });

    res.json({
      totalMes,
      pendentesTransmissao,
      totalControlados,
      lotesVencidos,
      lotesProximoVencer,
      periodoAberto,
      ultimasTransmissoes,
      porTipo,
      configurado: !!configurado
    });
  } catch (error) {
    logger.error('Erro dashboard SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// ══════════════════════════════════════════════════════════════
//  MOVIMENTAÇÕES (IMUTÁVEIS — somente INSERT)
// ══════════════════════════════════════════════════════════════

// GET /movimentacoes — Listar movimentações com filtros
router.get('/movimentacoes', async (req, res) => {
  try {
    const { tipo, produto_id, lote_id, data_inicio, data_fim, transmitido, page, limit: lim } = req.query;
    const where = { empresa_id: req.empresa_id };
    if (tipo) where.tipo = tipo;
    if (produto_id) where.produto_id = produto_id;
    if (lote_id) where.lote_id = lote_id;
    if (transmitido !== undefined) where.transmitido = transmitido === 'true';
    if (data_inicio || data_fim) {
      where.data_movimentacao = {};
      if (data_inicio) where.data_movimentacao[Op.gte] = data_inicio;
      if (data_fim) where.data_movimentacao[Op.lte] = data_fim;
    }

    const limit = Math.min(parseInt(lim) || 50, 200);
    const offset = ((parseInt(page) || 1) - 1) * limit;

    const { count, rows } = await SngpcMovimentacao.findAndCountAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'principio_ativo', 'classe_controlado'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual'] },
        { model: Usuario, attributes: ['id', 'nome'] }
      ],
      order: [['data_movimentacao', 'DESC'], ['created_at', 'DESC']],
      limit, offset
    });

    res.json({ data: rows, total: count, page: parseInt(page) || 1, pages: Math.ceil(count / limit) });
  } catch (error) {
    logger.error('Erro listar movimentações SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao listar movimentações' });
  }
});

// POST /movimentacoes/ajuste — Registrar ajuste manual (perda, vencimento, quebra, correção)
router.post('/movimentacoes/ajuste', perfilSngpc, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { produto_id, lote_id, quantidade, motivo_ajuste, observacao } = req.body;

    if (!produto_id || !lote_id || !quantidade || !motivo_ajuste) {
      await t.rollback();
      return res.status(400).json({ error: 'Campos obrigatórios: produto_id, lote_id, quantidade, motivo_ajuste' });
    }

    const motivosValidos = ['perda', 'vencimento', 'quebra', 'correcao_inventario'];
    if (!motivosValidos.includes(motivo_ajuste)) {
      await t.rollback();
      return res.status(400).json({ error: 'Motivo inválido. Valores aceitos: ' + motivosValidos.join(', ') });
    }

    // Validar produto controlado
    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id, controlado: true },
      transaction: t
    });
    if (!produto) { await t.rollback(); return res.status(404).json({ error: 'Produto controlado não encontrado' }); }

    // Validar lote
    const lote = await Lote.findOne({
      where: { id: lote_id, produto_id, empresa_id: req.empresa_id },
      lock: t.LOCK.UPDATE,
      transaction: t
    });
    if (!lote) { await t.rollback(); return res.status(404).json({ error: 'Lote não encontrado' }); }

    const qtd = Math.abs(parseFloat(quantidade));

    // Verificar bloqueio de período
    const bloqueio = await verificarBloqueioPeriodo(req.empresa_id, new Date().toISOString().split('T')[0]);
    if (bloqueio) { await t.rollback(); return res.status(400).json({ error: bloqueio }); }

    // Ajuste de saída (perda, vencimento, quebra): validar estoque
    if (['perda', 'vencimento', 'quebra'].includes(motivo_ajuste)) {
      if (parseFloat(lote.quantidade_atual) < qtd) {
        await t.rollback();
        return res.status(400).json({ error: 'Estoque insuficiente no lote. Disponível: ' + lote.quantidade_atual });
      }
      // Deduzir do lote
      const novaQtd = parseFloat(lote.quantidade_atual) - qtd;
      await lote.update({
        quantidade_atual: novaQtd,
        status: novaQtd <= 0 ? 'ESGOTADO' : 'ATIVO'
      }, { transaction: t });

      // Atualizar estoque do produto
      await produto.update({
        estoque_atual: Math.max(0, parseFloat(produto.estoque_atual) - qtd)
      }, { transaction: t });

      // Movimentação de estoque geral
      await EstoqueMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id,
        lote_id,
        tipo: motivo_ajuste === 'vencimento' ? 'vencimento' : 'perda',
        origem: 'SNGPC_AJUSTE',
        quantidade: qtd,
        estoque_anterior: parseFloat(produto.estoque_atual) + qtd,
        estoque_posterior: parseFloat(produto.estoque_atual),
        motivo: 'SNGPC Ajuste: ' + motivo_ajuste + (observacao ? ' - ' + observacao : ''),
        usuario_id: req.usuario.id,
        referencia: 'sngpc_ajuste',
        lote: lote.numero_lote,
        validade: lote.validade
      }, { transaction: t });
    }

    // Se correção de inventário positiva: aumentar lote
    if (motivo_ajuste === 'correcao_inventario') {
      const qtdAtual = parseFloat(lote.quantidade_atual);
      // Pode ser positivo ou negativo — o sinal vem do frontend
      const qtdComSinal = parseFloat(quantidade);
      const novaQtd = qtdAtual + qtdComSinal;
      if (novaQtd < 0) {
        await t.rollback();
        return res.status(400).json({ error: 'Correção resultaria em estoque negativo' });
      }
      await lote.update({
        quantidade_atual: novaQtd,
        status: novaQtd <= 0 ? 'ESGOTADO' : 'ATIVO'
      }, { transaction: t });
      await produto.update({
        estoque_atual: Math.max(0, parseFloat(produto.estoque_atual) + qtdComSinal)
      }, { transaction: t });
    }

    // Criar movimentação SNGPC imutável
    const hashData = {
      produto_id, lote_id, quantidade: qtd,
      data_movimentacao: new Date().toISOString().split('T')[0]
    };

    const mov = await SngpcMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      lote_id,
      tipo: 'ajuste',
      quantidade: qtd,
      data_movimentacao: new Date().toISOString().split('T')[0],
      motivo_ajuste,
      observacao,
      usuario_id: req.usuario.id,
      hash_integridade: gerarHash(hashData)
    }, { transaction: t });

    await t.commit();

    if (req.audit) await req.audit('ajuste_sngpc', 'sngpc_movimentacoes', mov.id, null, mov.toJSON(), 
      'Ajuste SNGPC: ' + motivo_ajuste + ' - ' + produto.nome + ' (Lote ' + lote.numero_lote + ') Qtd: ' + qtd);

    res.status(201).json(mov);
  } catch (error) {
    await t.rollback();
    logger.error('Erro ajuste SNGPC:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao registrar ajuste' });
  }
});

// ══════════════════════════════════════════════════════════════
//  INVENTÁRIO INICIAL
// ══════════════════════════════════════════════════════════════

// GET /inventario — Verificar status do inventário
router.get('/inventario', async (req, res) => {
  try {
    // Verificar se já existe inventário
    const inventarioExistente = await SngpcMovimentacao.count({
      where: { empresa_id: req.empresa_id, tipo: 'inventario' }
    });

    // Buscar produtos controlados com lotes
    const produtos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, controlado: true, ativo: true },
      include: [{
        model: Lote,
        where: { status: 'ATIVO', quantidade_atual: { [Op.gt]: 0 } },
        required: false,
        attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual', 'quantidade_inicial', 'nota_fiscal_compra']
      }],
      attributes: ['id', 'nome', 'codigo_barras', 'principio_ativo', 'classe_controlado', 'registro_anvisa', 'tipo_receita'],
      order: [['nome', 'ASC']]
    });

    // Verificar se já houve transmissão
    const jaTransmitiu = await SngpcTransmissao.count({ where: { empresa_id: req.empresa_id } });

    res.json({
      inventarioRealizado: inventarioExistente > 0,
      podeRealizarInventario: inventarioExistente === 0 && jaTransmitiu === 0,
      produtos,
      totalProdutos: produtos.length,
      totalLotes: produtos.reduce((sum, p) => sum + (p.Lotes ? p.Lotes.length : 0), 0)
    });
  } catch (error) {
    logger.error('Erro inventário SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao buscar inventário' });
  }
});

// POST /inventario — Realizar inventário inicial (UMA VEZ antes da primeira transmissão)
router.post('/inventario', perfilSngpc, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Verificar se já existe inventário
    const inventarioExistente = await SngpcMovimentacao.count({
      where: { empresa_id: req.empresa_id, tipo: 'inventario' },
      transaction: t
    });
    if (inventarioExistente > 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Inventário inicial já foi realizado. Não é possível fazer novamente.' });
    }

    // Verificar se já houve transmissão
    const jaTransmitiu = await SngpcTransmissao.count({ where: { empresa_id: req.empresa_id }, transaction: t });
    if (jaTransmitiu > 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Já existe transmissão registrada. Inventário inicial só pode ser feito antes da primeira transmissão.' });
    }

    // Buscar todos os lotes ativos de produtos controlados
    const lotes = await Lote.findAll({
      where: { empresa_id: req.empresa_id, status: 'ATIVO', quantidade_atual: { [Op.gt]: 0 } },
      include: [{ model: Produto, where: { controlado: true }, attributes: ['id', 'nome'] }],
      transaction: t
    });

    if (lotes.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhum lote ativo de produto controlado para inventariar' });
    }

    const dataHoje = new Date().toISOString().split('T')[0];
    const movimentacoes = [];

    for (const lote of lotes) {
      const hashData = {
        produto_id: lote.produto_id,
        lote_id: lote.id,
        quantidade: parseFloat(lote.quantidade_atual),
        data_movimentacao: dataHoje
      };

      const mov = await SngpcMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id: lote.produto_id,
        lote_id: lote.id,
        tipo: 'inventario',
        quantidade: parseFloat(lote.quantidade_atual),
        data_movimentacao: dataHoje,
        numero_documento: 'INV-INICIAL-' + dataHoje,
        observacao: 'Inventário inicial SNGPC',
        usuario_id: req.usuario.id,
        hash_integridade: gerarHash(hashData)
      }, { transaction: t });

      movimentacoes.push(mov);
    }

    await t.commit();

    if (req.audit) await req.audit('inventario_sngpc', 'sngpc_movimentacoes', null, null, 
      { total_lotes: lotes.length, data: dataHoje },
      'Inventário inicial SNGPC realizado: ' + lotes.length + ' lotes');

    res.status(201).json({
      message: 'Inventário inicial realizado com sucesso',
      total_lotes: lotes.length,
      movimentacoes: movimentacoes.length
    });
  } catch (error) {
    await t.rollback();
    logger.error('Erro inventário inicial SNGPC:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao realizar inventário inicial' });
  }
});

// ══════════════════════════════════════════════════════════════
//  PERÍODOS DE CONTROLE
// ══════════════════════════════════════════════════════════════

// GET /periodos — Listar períodos
router.get('/periodos', async (req, res) => {
  try {
    const periodos = await SngpcPeriodo.findAll({
      where: { empresa_id: req.empresa_id },
      include: [
        { model: SngpcTransmissao, attributes: ['id', 'status', 'protocolo_anvisa', 'data_envio'] }
      ],
      order: [['data_inicio', 'DESC']]
    });
    res.json(periodos);
  } catch (error) {
    logger.error('Erro listar períodos SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao listar períodos' });
  }
});

// POST /periodos — Criar novo período
router.post('/periodos', perfilSngpc, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.body;
    if (!data_inicio || !data_fim) {
      return res.status(400).json({ error: 'Data de início e fim são obrigatórias' });
    }
    if (data_inicio >= data_fim) {
      return res.status(400).json({ error: 'Data de início deve ser anterior à data fim' });
    }

    // Verificar sobreposição
    const sobreposicao = await SngpcPeriodo.findOne({
      where: {
        empresa_id: req.empresa_id,
        [Op.or]: [
          { data_inicio: { [Op.between]: [data_inicio, data_fim] } },
          { data_fim: { [Op.between]: [data_inicio, data_fim] } },
          { [Op.and]: [{ data_inicio: { [Op.lte]: data_inicio } }, { data_fim: { [Op.gte]: data_fim } }] }
        ]
      }
    });
    if (sobreposicao) {
      return res.status(400).json({ error: 'Período sobrepõe um período existente' });
    }

    // Verificar se há período aberto
    const aberto = await SngpcPeriodo.findOne({
      where: { empresa_id: req.empresa_id, status: 'aberto' }
    });
    if (aberto) {
      return res.status(400).json({ error: 'Já existe um período aberto. Feche-o antes de criar outro.' });
    }

    const periodo = await SngpcPeriodo.create({
      empresa_id: req.empresa_id,
      data_inicio, data_fim, status: 'aberto'
    });

    if (req.audit) await req.audit('criar', 'sngpc_periodos', periodo.id, null, periodo.toJSON(), 
      'Período SNGPC criado: ' + data_inicio + ' a ' + data_fim);

    res.status(201).json(periodo);
  } catch (error) {
    logger.error('Erro criar período SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro ao criar período' });
  }
});

// PUT /periodos/:id/fechar — Fechar período
router.put('/periodos/:id/fechar', perfilSngpc, async (req, res) => {
  try {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!periodo) return res.status(404).json({ error: 'Período não encontrado' });
    if (periodo.status !== 'aberto') {
      return res.status(400).json({ error: 'Apenas períodos abertos podem ser fechados' });
    }

    await periodo.update({
      status: 'fechado',
      fechado_por: req.usuario.id,
      fechado_em: new Date()
    });

    if (req.audit) await req.audit('fechar', 'sngpc_periodos', periodo.id, null, null, 
      'Período SNGPC fechado: ' + periodo.data_inicio + ' a ' + periodo.data_fim);

    res.json(periodo);
  } catch (error) {
    logger.error('Erro fechar período:', { message: error.message });
    res.status(500).json({ error: 'Erro ao fechar período' });
  }
});

// ══════════════════════════════════════════════════════════════
//  VALIDAÇÃO PRÉ-XML
// ══════════════════════════════════════════════════════════════

router.get('/validar-periodo/:periodo_id', perfilSngpc, async (req, res) => {
  try {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: req.params.periodo_id, empresa_id: req.empresa_id }
    });
    if (!periodo) return res.status(404).json({ error: 'Período não encontrado' });

    const erros = [];
    const avisos = [];

    // 1. Período deve estar fechado
    if (periodo.status !== 'fechado') {
      erros.push('O período deve estar fechado para gerar XML');
    }

    // 2. Verificar configuração SNGPC
    const config = await SngpcConfiguracao.findOne({ where: { empresa_id: req.empresa_id } });
    if (!config) {
      erros.push('Configuração SNGPC não encontrada. Configure antes de gerar XML.');
    } else {
      if (!config.cnpj) erros.push('CNPJ não configurado');
      if (!config.responsavel_tecnico_crf) erros.push('CRF do responsável técnico não configurado');
    }

    // 3. Buscar movimentações do período
    const movimentacoes = await SngpcMovimentacao.findAll({
      where: {
        empresa_id: req.empresa_id,
        data_movimentacao: { [Op.between]: [periodo.data_inicio, periodo.data_fim] },
        transmitido: false
      },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'registro_anvisa', 'classe_controlado'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual'] }
      ]
    });

    if (movimentacoes.length === 0) {
      avisos.push('Nenhuma movimentação não-transmitida encontrada no período');
    }

    // 4. Verificar campos obrigatórios das movimentações de saída
    for (const mov of movimentacoes) {
      if (mov.tipo === 'saida') {
        if (!mov.cpf_paciente) erros.push('Movimentação #' + mov.id + ': CPF do paciente ausente');
        if (!mov.nome_paciente) erros.push('Movimentação #' + mov.id + ': Nome do paciente ausente');
        if (!mov.crm_medico) erros.push('Movimentação #' + mov.id + ': CRM do médico ausente');
        if (!mov.numero_receita) erros.push('Movimentação #' + mov.id + ': Número da receita ausente');
      }
      if (!mov.Produto?.registro_anvisa) {
        avisos.push('Produto "' + (mov.Produto?.nome || mov.produto_id) + '": registro ANVISA ausente');
      }
    }

    // 5. Verificar se já existem movimentações transmitidas no período
    const jaTransmitidas = await SngpcMovimentacao.count({
      where: {
        empresa_id: req.empresa_id,
        data_movimentacao: { [Op.between]: [periodo.data_inicio, periodo.data_fim] },
        transmitido: true
      }
    });
    if (jaTransmitidas > 0) {
      avisos.push(jaTransmitidas + ' movimentações já foram transmitidas neste período');
    }

    res.json({
      valido: erros.length === 0,
      erros,
      avisos,
      totalMovimentacoes: movimentacoes.length,
      jaTransmitidas
    });
  } catch (error) {
    logger.error('Erro validar período SNGPC:', { message: error.message });
    res.status(500).json({ error: 'Erro na validação' });
  }
});

// ══════════════════════════════════════════════════════════════
//  GERAÇÃO DE XML (padrão SNGPC ANVISA)
// ══════════════════════════════════════════════════════════════

router.post('/transmissoes/gerar-xml/:periodo_id', perfilSngpc, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: req.params.periodo_id, empresa_id: req.empresa_id },
      transaction: t
    });
    if (!periodo) { await t.rollback(); return res.status(404).json({ error: 'Período não encontrado' }); }
    if (periodo.status !== 'fechado') {
      await t.rollback();
      return res.status(400).json({ error: 'O período deve estar fechado para gerar XML' });
    }

    const config = await SngpcConfiguracao.findOne({ where: { empresa_id: req.empresa_id }, transaction: t });
    if (!config) {
      await t.rollback();
      return res.status(400).json({ error: 'Configure o SNGPC antes de gerar XML' });
    }

    // Buscar movimentações do período NÃO transmitidas
    const movimentacoes = await SngpcMovimentacao.findAll({
      where: {
        empresa_id: req.empresa_id,
        data_movimentacao: { [Op.between]: [periodo.data_inicio, periodo.data_fim] },
        transmitido: false
      },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'registro_anvisa', 'principio_ativo', 'classe_controlado'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'] }
      ],
      order: [['data_movimentacao', 'ASC'], ['created_at', 'ASC']],
      transaction: t
    });

    if (movimentacoes.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhuma movimentação pendente no período' });
    }

    // ── Gerar XML no padrão SNGPC ──
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<mensagem_sngpc xmlns="http://www.anvisa.gov.br/sngpc">\n';
    xml += '  <cabecalho>\n';
    xml += '    <cnpj_farmacia>' + escapeXml(config.cnpj.replace(/\D/g, '')) + '</cnpj_farmacia>\n';
    xml += '    <razao_social>' + escapeXml(config.razao_social) + '</razao_social>\n';
    xml += '    <numero_afe>' + escapeXml(config.numero_afe || '') + '</numero_afe>\n';
    xml += '    <responsavel_tecnico>\n';
    xml += '      <nome>' + escapeXml(config.responsavel_tecnico_nome) + '</nome>\n';
    xml += '      <crf>' + escapeXml(config.responsavel_tecnico_crf) + '</crf>\n';
    xml += '      <uf>' + escapeXml(config.responsavel_tecnico_uf) + '</uf>\n';
    xml += '    </responsavel_tecnico>\n';
    xml += '    <periodo_inicio>' + periodo.data_inicio + '</periodo_inicio>\n';
    xml += '    <periodo_fim>' + periodo.data_fim + '</periodo_fim>\n';
    xml += '    <data_geracao>' + new Date().toISOString() + '</data_geracao>\n';
    xml += '  </cabecalho>\n';
    xml += '  <movimentacoes total="' + movimentacoes.length + '">\n';

    for (const mov of movimentacoes) {
      xml += '    <movimentacao>\n';
      xml += '      <tipo>' + traduzirTipoSngpc(mov.tipo) + '</tipo>\n';
      xml += '      <data>' + mov.data_movimentacao + '</data>\n';
      xml += '      <medicamento>\n';
      xml += '        <registro_anvisa>' + escapeXml(mov.Produto?.registro_anvisa || '') + '</registro_anvisa>\n';
      xml += '        <nome>' + escapeXml(mov.Produto?.nome || '') + '</nome>\n';
      xml += '        <principio_ativo>' + escapeXml(mov.Produto?.principio_ativo || '') + '</principio_ativo>\n';
      xml += '        <classe>' + escapeXml(mov.Produto?.classe_controlado || '') + '</classe>\n';
      xml += '      </medicamento>\n';
      xml += '      <lote>\n';
      xml += '        <numero>' + escapeXml(mov.Lote?.numero_lote || '') + '</numero>\n';
      xml += '        <validade>' + (mov.Lote?.validade || '') + '</validade>\n';
      xml += '      </lote>\n';
      xml += '      <quantidade>' + mov.quantidade + '</quantidade>\n';

      if (mov.tipo === 'saida') {
        xml += '      <dispensacao>\n';
        xml += '        <cpf_comprador>' + escapeXml(mov.cpf_paciente || '') + '</cpf_comprador>\n';
        xml += '        <nome_comprador>' + escapeXml(mov.nome_paciente || '') + '</nome_comprador>\n';
        xml += '        <prescritor>\n';
        xml += '          <nome>' + escapeXml(mov.nome_medico || '') + '</nome>\n';
        xml += '          <conselho>CRM</conselho>\n';
        xml += '          <numero_registro>' + escapeXml(mov.crm_medico || '') + '</numero_registro>\n';
        xml += '          <uf>' + escapeXml(mov.uf_crm || '') + '</uf>\n';
        xml += '        </prescritor>\n';
        xml += '        <receita>\n';
        xml += '          <numero>' + escapeXml(mov.numero_receita || '') + '</numero>\n';
        xml += '          <data>' + (mov.data_receita || '') + '</data>\n';
        xml += '        </receita>\n';
        xml += '      </dispensacao>\n';
      }

      if (mov.tipo === 'ajuste') {
        xml += '      <ajuste>\n';
        xml += '        <motivo>' + escapeXml(mov.motivo_ajuste || '') + '</motivo>\n';
        xml += '        <observacao>' + escapeXml(mov.observacao || '') + '</observacao>\n';
        xml += '      </ajuste>\n';
      }

      if (mov.tipo === 'entrada') {
        xml += '      <entrada>\n';
        xml += '        <numero_documento>' + escapeXml(mov.numero_documento || '') + '</numero_documento>\n';
        xml += '      </entrada>\n';
      }

      xml += '      <hash_integridade>' + mov.hash_integridade + '</hash_integridade>\n';
      xml += '    </movimentacao>\n';
    }

    xml += '  </movimentacoes>\n';
    xml += '</mensagem_sngpc>\n';

    // Criar registro de transmissão
    const transmissao = await SngpcTransmissao.create({
      empresa_id: req.empresa_id,
      periodo_id: periodo.id,
      xml_conteudo: xml,
      status: 'gerado',
      gerado_por: req.usuario.id
    }, { transaction: t });

    // Marcar movimentações como transmitidas
    for (const mov of movimentacoes) {
      await SngpcMovimentacao.update(
        { transmitido: true, transmissao_id: transmissao.id },
        { where: { id: mov.id }, transaction: t }
      );
    }

    await t.commit();

    if (req.audit) await req.audit('gerar_xml', 'sngpc_transmissoes', transmissao.id, null, 
      { periodo_id: periodo.id, movimentacoes: movimentacoes.length },
      'XML SNGPC gerado: ' + movimentacoes.length + ' movimentações');

    res.status(201).json({
      message: 'XML gerado com sucesso',
      transmissao_id: transmissao.id,
      movimentacoes: movimentacoes.length,
      tamanho_xml: xml.length
    });
  } catch (error) {
    await t.rollback();
    logger.error('Erro gerar XML SNGPC:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao gerar XML' });
  }
});

// ══════════════════════════════════════════════════════════════
//  TRANSMISSÕES — Gerenciamento manual
// ══════════════════════════════════════════════════════════════

// GET /transmissoes — Listar transmissões
router.get('/transmissoes', async (req, res) => {
  try {
    const transmissoes = await SngpcTransmissao.findAll({
      where: { empresa_id: req.empresa_id },
      include: [
        { model: SngpcPeriodo, attributes: ['data_inicio', 'data_fim', 'status'] },
        { model: Usuario, as: 'SngpcGeradoPor', attributes: ['id', 'nome'] },
        { model: Usuario, as: 'SngpcEnviadoPor', attributes: ['id', 'nome'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(transmissoes);
  } catch (error) {
    logger.error('Erro listar transmissões:', { message: error.message });
    res.status(500).json({ error: 'Erro ao listar transmissões' });
  }
});

// GET /transmissoes/:id/download-xml — Download do XML
router.get('/transmissoes/:id/download-xml', perfilSngpc, async (req, res) => {
  try {
    const transmissao = await SngpcTransmissao.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: SngpcPeriodo, attributes: ['data_inicio', 'data_fim'] }]
    });
    if (!transmissao) return res.status(404).json({ error: 'Transmissão não encontrada' });
    if (!transmissao.xml_conteudo) return res.status(404).json({ error: 'XML não disponível' });

    const nomeArquivo = 'sngpc_' + (transmissao.SngpcPeriodo?.data_inicio || '') + '_' +
                        (transmissao.SngpcPeriodo?.data_fim || '') + '.xml';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="' + nomeArquivo + '"');
    res.send(transmissao.xml_conteudo);
  } catch (error) {
    logger.error('Erro download XML:', { message: error.message });
    res.status(500).json({ error: 'Erro ao baixar XML' });
  }
});

// PUT /transmissoes/:id/registrar-envio — Registrar envio manual ao ANVISA
router.put('/transmissoes/:id/registrar-envio', perfilSngpc, async (req, res) => {
  try {
    const transmissao = await SngpcTransmissao.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!transmissao) return res.status(404).json({ error: 'Transmissão não encontrada' });
    if (transmissao.status !== 'gerado') {
      return res.status(400).json({ error: 'Transmissão já foi enviada ou processada' });
    }

    await transmissao.update({
      status: 'enviado',
      data_envio: new Date(),
      enviado_por: req.usuario.id
    });

    if (req.audit) await req.audit('envio_sngpc', 'sngpc_transmissoes', transmissao.id, null, null, 
      'Envio SNGPC registrado para transmissão #' + transmissao.id);

    res.json(transmissao);
  } catch (error) {
    logger.error('Erro registrar envio:', { message: error.message });
    res.status(500).json({ error: 'Erro ao registrar envio' });
  }
});

// PUT /transmissoes/:id/registrar-retorno — Registrar retorno do ANVISA
router.put('/transmissoes/:id/registrar-retorno', perfilSngpc, async (req, res) => {
  try {
    const { status, protocolo_anvisa, mensagem_retorno } = req.body;
    if (!status || !['aceito', 'rejeitado'].includes(status)) {
      return res.status(400).json({ error: 'Status deve ser "aceito" ou "rejeitado"' });
    }

    const transmissao = await SngpcTransmissao.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!transmissao) return res.status(404).json({ error: 'Transmissão não encontrada' });
    if (transmissao.status === 'aceito') {
      return res.status(400).json({ error: 'Transmissão já aceita, não pode ser alterada' });
    }

    await transmissao.update({
      status,
      protocolo_anvisa: protocolo_anvisa || transmissao.protocolo_anvisa,
      data_retorno: new Date(),
      mensagem_retorno: mensagem_retorno || null
    });

    // Se aceito, marcar período como transmitido
    if (status === 'aceito') {
      await SngpcPeriodo.update(
        { status: 'transmitido' },
        { where: { id: transmissao.periodo_id, empresa_id: req.empresa_id } }
      );
    }

    // Se rejeitado, permitir reenvio: reverter movimentações para não-transmitidas
    if (status === 'rejeitado') {
      await SngpcMovimentacao.update(
        { transmitido: false, transmissao_id: null },
        { where: { transmissao_id: transmissao.id, empresa_id: req.empresa_id } }
      );
      // Reabrir período para correção
      await SngpcPeriodo.update(
        { status: 'fechado' },
        { where: { id: transmissao.periodo_id, empresa_id: req.empresa_id } }
      );
    }

    if (req.audit) await req.audit('retorno_sngpc', 'sngpc_transmissoes', transmissao.id, null, 
      { status, protocolo_anvisa },
      'Retorno ANVISA: ' + status + (protocolo_anvisa ? ' - Protocolo: ' + protocolo_anvisa : ''));

    res.json(transmissao);
  } catch (error) {
    logger.error('Erro registrar retorno:', { message: error.message });
    res.status(500).json({ error: 'Erro ao registrar retorno' });
  }
});

// ══════════════════════════════════════════════════════════════
//  RELATÓRIOS OBRIGATÓRIOS
// ══════════════════════════════════════════════════════════════

// Relatório 1 — Estoque controlado atual
router.get('/relatorios/estoque-controlado', async (req, res) => {
  try {
    const produtos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, controlado: true, ativo: true },
      attributes: ['id', 'nome', 'codigo_barras', 'principio_ativo', 'classe_controlado',
                   'registro_anvisa', 'tipo_receita', 'estoque_atual'],
      order: [['nome', 'ASC']]
    });
    res.json(produtos);
  } catch (error) {
    logger.error('Erro relatório estoque:', { message: error.message });
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório 2 — Estoque por lote
router.get('/relatorios/estoque-por-lote', async (req, res) => {
  try {
    const lotes = await Lote.findAll({
      where: { empresa_id: req.empresa_id },
      include: [{
        model: Produto,
        where: { controlado: true },
        attributes: ['id', 'nome', 'principio_ativo', 'classe_controlado', 'registro_anvisa']
      }],
      attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual', 'quantidade_inicial',
                   'status', 'nota_fiscal_compra', 'data_entrada'],
      order: [[Produto, 'nome', 'ASC'], ['validade', 'ASC']]
    });
    res.json(lotes);
  } catch (error) {
    logger.error('Erro relatório estoque por lote:', { message: error.message });
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório 3 — Movimentações por período
router.get('/relatorios/movimentacoes', async (req, res) => {
  try {
    const { data_inicio, data_fim, tipo } = req.query;
    if (!data_inicio || !data_fim) {
      return res.status(400).json({ error: 'Informe data_inicio e data_fim' });
    }

    const where = {
      empresa_id: req.empresa_id,
      data_movimentacao: { [Op.between]: [data_inicio, data_fim] }
    };
    if (tipo) where.tipo = tipo;

    const movimentacoes = await SngpcMovimentacao.findAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'principio_ativo', 'classe_controlado', 'registro_anvisa'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'] },
        { model: Usuario, attributes: ['id', 'nome'] }
      ],
      order: [['data_movimentacao', 'ASC'], ['created_at', 'ASC']]
    });

    res.json({
      periodo: { inicio: data_inicio, fim: data_fim },
      total: movimentacoes.length,
      movimentacoes
    });
  } catch (error) {
    logger.error('Erro relatório movimentações:', { message: error.message });
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório 4 — Histórico de transmissões
router.get('/relatorios/transmissoes', async (req, res) => {
  try {
    const transmissoes = await SngpcTransmissao.findAll({
      where: { empresa_id: req.empresa_id },
      include: [
        { model: SngpcPeriodo, attributes: ['data_inicio', 'data_fim'] },
        { model: Usuario, as: 'SngpcGeradoPor', attributes: ['id', 'nome'] }
      ],
      attributes: ['id', 'status', 'protocolo_anvisa', 'data_envio', 'data_retorno',
                   'mensagem_retorno', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.json(transmissoes);
  } catch (error) {
    logger.error('Erro relatório transmissões:', { message: error.message });
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// Relatório 5 — Produtos vencidos ou próximos ao vencimento
router.get('/relatorios/vencidos', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const { dias } = req.query;
    const diasAlerta = parseInt(dias) || 30;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + diasAlerta);

    const lotes = await Lote.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'ATIVO',
        quantidade_atual: { [Op.gt]: 0 },
        validade: { [Op.lte]: dataLimite.toISOString().split('T')[0] }
      },
      include: [{
        model: Produto,
        where: { controlado: true },
        attributes: ['id', 'nome', 'principio_ativo', 'classe_controlado']
      }],
      attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual'],
      order: [['validade', 'ASC']]
    });

    const vencidos = lotes.filter(l => l.validade < hoje);
    const proximoVencer = lotes.filter(l => l.validade >= hoje);

    res.json({ vencidos, proximoVencer, diasAlerta });
  } catch (error) {
    logger.error('Erro relatório vencidos:', { message: error.message });
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// ══════════════════════════════════════════════════════════════
//  FASE 2 — MOTOR REGULATÓRIO SNGPC
//  Movimentações via Service com transaction SERIALIZABLE
//  Estoque regulatório separado (sngpc_estoque)
// ══════════════════════════════════════════════════════════════

// ── MOTOR DE MOVIMENTAÇÕES ────────────────────────────────────

// POST /v2/movimentacoes/entrada — Registrar entrada regulatória
router.post('/v2/movimentacoes/entrada', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcMovimentacaoService.registrarEntrada({
      ...req.body,
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      data_movimentacao: req.body.data_movimentacao || new Date().toISOString().split('T')[0],
      profissional_responsavel: req.body.profissional_responsavel || req.usuario.nome
    });

    if (req.audit) await req.audit('entrada_sngpc_v2', 'sngpc_movimentacoes', result.movimentacao.id, null,
      result.movimentacao.toJSON(), 'Entrada SNGPC v2 - Qtd: ' + result.movimentacao.quantidade);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Erro entrada SNGPC v2:', { message: error.message, stack: error.stack });
    const status = error.message.includes('não encontrad') || error.message.includes('não é controlado') ? 404
      : error.message.includes('bloqueada') || error.message.includes('insuficiente') || error.message.includes('negativo')
        || error.message.includes('ABERTO') || error.message.includes('inválido') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /v2/movimentacoes/dispensacao — Registrar dispensação regulatória
router.post('/v2/movimentacoes/dispensacao', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcMovimentacaoService.registrarDispensacao({
      ...req.body,
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      data_movimentacao: req.body.data_movimentacao || new Date().toISOString().split('T')[0],
      profissional_responsavel: req.body.profissional_responsavel || req.usuario.nome
    });

    if (req.audit) await req.audit('dispensacao_sngpc_v2', 'sngpc_movimentacoes', result.movimentacao.id, null,
      result.movimentacao.toJSON(), 'Dispensação SNGPC v2 - Qtd: ' + result.movimentacao.quantidade);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Erro dispensação SNGPC v2:', { message: error.message, stack: error.stack });
    const status = error.message.includes('não encontrad') || error.message.includes('não é controlado') ? 404
      : error.message.includes('bloqueada') || error.message.includes('insuficiente') || error.message.includes('negativo')
        || error.message.includes('receita') || error.message.includes('vencido') || error.message.includes('ABERTO')
        || error.message.includes('inválido') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /v2/movimentacoes/perda — Registrar perda regulatória
router.post('/v2/movimentacoes/perda', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcMovimentacaoService.registrarPerda({
      ...req.body,
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      data_movimentacao: req.body.data_movimentacao || new Date().toISOString().split('T')[0],
      profissional_responsavel: req.body.profissional_responsavel || req.usuario.nome
    });

    if (req.audit) await req.audit('perda_sngpc_v2', 'sngpc_movimentacoes', result.movimentacao.id, null,
      result.movimentacao.toJSON(), 'Perda SNGPC v2 - Qtd: ' + result.movimentacao.quantidade);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Erro perda SNGPC v2:', { message: error.message, stack: error.stack });
    const status = error.message.includes('não encontrad') || error.message.includes('não é controlado') ? 404
      : error.message.includes('bloqueada') || error.message.includes('insuficiente') || error.message.includes('negativo')
        || error.message.includes('ABERTO') || error.message.includes('inválido') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /v2/movimentacoes/ajuste — Registrar ajuste (positivo ou negativo)
router.post('/v2/movimentacoes/ajuste', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcMovimentacaoService.registrarAjuste({
      ...req.body,
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      data_movimentacao: req.body.data_movimentacao || new Date().toISOString().split('T')[0],
      profissional_responsavel: req.body.profissional_responsavel || req.usuario.nome
    });

    if (req.audit) await req.audit('ajuste_sngpc_v2', 'sngpc_movimentacoes', result.movimentacao.id, null,
      result.movimentacao.toJSON(), 'Ajuste SNGPC v2 (' + result.movimentacao.tipo + ') - Qtd: ' + result.movimentacao.quantidade);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Erro ajuste SNGPC v2:', { message: error.message, stack: error.stack });
    const status = error.message.includes('não encontrad') || error.message.includes('não é controlado') ? 404
      : error.message.includes('bloqueada') || error.message.includes('insuficiente') || error.message.includes('negativo')
        || error.message.includes('ABERTO') || error.message.includes('inválido') || error.message.includes('zero') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// ── ESTOQUE REGULATÓRIO ───────────────────────────────────────

// GET /v2/estoque — Consultar saldo regulatório
router.get('/v2/estoque', async (req, res) => {
  try {
    const { produto_id, lote_id } = req.query;
    const saldos = await SngpcMovimentacaoService.consultarSaldo(req.empresa_id, produto_id, lote_id);
    res.json(saldos);
  } catch (error) {
    logger.error('Erro consultar estoque regulatório:', { message: error.message });
    res.status(500).json({ error: 'Erro ao consultar estoque regulatório' });
  }
});

// GET /v2/estoque/verificar — Verificar consistência saldo calculado vs armazenado
router.get('/v2/estoque/verificar', perfilSngpc, async (req, res) => {
  try {
    const { produto_id, lote_id } = req.query;
    if (!produto_id || !lote_id) {
      return res.status(400).json({ error: 'produto_id e lote_id são obrigatórios' });
    }

    const saldoDinamico = await SngpcMovimentacaoService.calcularSaldoDinamico(
      req.empresa_id, produto_id, lote_id
    );

    const saldoArmazenado = await SngpcEstoque.findOne({
      where: { empresa_id: req.empresa_id, produto_id, lote_id }
    });

    const consistente = saldoArmazenado
      ? Math.abs(parseFloat(saldoArmazenado.saldo_atual) - saldoDinamico) < 0.001
      : saldoDinamico === 0;

    res.json({
      saldo_calculado: saldoDinamico,
      saldo_armazenado: saldoArmazenado ? parseFloat(saldoArmazenado.saldo_atual) : null,
      consistente
    });
  } catch (error) {
    logger.error('Erro verificar estoque:', { message: error.message });
    res.status(500).json({ error: 'Erro ao verificar consistência' });
  }
});

// ── GESTÃO DE PERÍODOS v2 ─────────────────────────────────────

// POST /v2/periodos — Abrir novo período
router.post('/v2/periodos', perfilSngpc, async (req, res) => {
  try {
    const periodo = await SngpcPeriodoService.abrirPeriodo({
      empresa_id: req.empresa_id,
      data_inicio: req.body.data_inicio,
      data_fim: req.body.data_fim,
      usuario_id: req.usuario.id
    });

    if (req.audit) await req.audit('abrir_periodo_v2', 'sngpc_periodos', periodo.id, null,
      periodo.toJSON(), 'Período aberto: ' + periodo.data_inicio + ' a ' + periodo.data_fim);

    res.status(201).json(periodo);
  } catch (error) {
    logger.error('Erro abrir período v2:', { message: error.message });
    const status = error.message.includes('obrigatóri') || error.message.includes('anterior')
      || error.message.includes('sobrepõe') || error.message.includes('Já existe') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /v2/periodos/:id/fechar — Fechar período com hash
router.put('/v2/periodos/:id/fechar', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcPeriodoService.fecharPeriodo({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.id),
      usuario_id: req.usuario.id
    });

    if (req.audit) await req.audit('fechar_periodo_v2', 'sngpc_periodos', req.params.id, null,
      result, 'Período fechado com hash: ' + result.hash_integridade.substring(0, 16) + '...');

    res.json(result);
  } catch (error) {
    logger.error('Erro fechar período v2:', { message: error.message });
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('ABERTOS') || error.message.includes('sem movimentações') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /v2/periodos/:id/transmitir — Marcar período como transmitido
router.put('/v2/periodos/:id/transmitir', perfilSngpc, async (req, res) => {
  try {
    const periodo = await SngpcPeriodoService.transmitirPeriodo({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.id),
      usuario_id: req.usuario.id
    });

    if (req.audit) await req.audit('transmitir_periodo_v2', 'sngpc_periodos', req.params.id, null,
      periodo.toJSON(), 'Período transmitido');

    res.json(periodo);
  } catch (error) {
    logger.error('Erro transmitir período v2:', { message: error.message });
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('FECHADOS') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /v2/periodos/:id/cancelar — Cancelar período (apenas ABERTO sem movimentações)
router.put('/v2/periodos/:id/cancelar', perfilSngpc, async (req, res) => {
  try {
    const periodo = await SngpcPeriodoService.cancelarPeriodo({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.id),
      usuario_id: req.usuario.id
    });

    if (req.audit) await req.audit('cancelar_periodo_v2', 'sngpc_periodos', req.params.id, null,
      periodo.toJSON(), 'Período cancelado');

    res.json(periodo);
  } catch (error) {
    logger.error('Erro cancelar período v2:', { message: error.message });
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('ABERTOS') || error.message.includes('movimentações') ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /v2/periodos/:id/integridade — Validar hash de integridade
router.get('/v2/periodos/:id/integridade', perfilSngpc, async (req, res) => {
  try {
    const result = await SngpcPeriodoService.validarIntegridade(
      req.empresa_id, parseInt(req.params.id)
    );
    res.json(result);
  } catch (error) {
    logger.error('Erro validar integridade:', { message: error.message });
    res.status(error.message.includes('não encontrado') ? 404 : 500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  FASE 3 — ENCERRAMENTO DO MÓDULO SNGPC
//  Geração de Arquivo Oficial, Controle de Transmissão,
//  Imutabilidade Pós-Transmissão, Auditoria Regulatória
// ══════════════════════════════════════════════════════════════

// ── ARQUIVO OFICIAL ───────────────────────────────────────────

// POST /v3/arquivos/:periodo_id/gerar — Gerar arquivo TXT oficial
router.post('/v3/arquivos/:periodo_id/gerar', perfilSngpc, async (req, res) => {
  try {
    const resultado = await SngpcArquivoService.gerarArquivoCompleto({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      usuario_id: req.usuario.id
    });

    await SngpcAuditoriaService.registrar({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      acao: 'GERAR_ARQUIVO',
      dados_novos: { arquivo_id: resultado.arquivo.id, hash: resultado.arquivo.hash_arquivo },
      usuario_id: req.usuario.id,
      usuario_nome: req.usuario.nome,
      ip_address: req.ip,
      detalhes: `Arquivo ${resultado.arquivo.nome_arquivo} gerado com hash ${resultado.arquivo.hash_arquivo}`
    });

    res.status(201).json(resultado);
  } catch (error) {
    logger.error('Erro gerar arquivo SNGPC:', { message: error.message });
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('Período deve estar FECHADO') ? 422
      : error.message.includes('Já existe') ? 409
      : error.message.includes('negativo') ? 422
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// POST /v3/arquivos/:periodo_id/regenerar — Regenerar arquivo (após rejeição)
router.post('/v3/arquivos/:periodo_id/regenerar', perfilSngpc, async (req, res) => {
  try {
    const resultado = await SngpcArquivoService.regenerarArquivo({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      usuario_id: req.usuario.id
    });

    await SngpcAuditoriaService.registrar({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      acao: 'GERAR_ARQUIVO',
      dados_novos: { arquivo_id: resultado.arquivo.id, hash: resultado.arquivo.hash_arquivo, regenerado: true },
      usuario_id: req.usuario.id,
      usuario_nome: req.usuario.nome,
      ip_address: req.ip,
      detalhes: `Arquivo regenerado: ${resultado.arquivo.nome_arquivo}`
    });

    res.status(201).json(resultado);
  } catch (error) {
    logger.error('Erro regenerar arquivo SNGPC:', { message: error.message });
    const status = error.message.includes('não encontrado') ? 404
      : error.message.includes('FECHADO') ? 422
      : error.message.includes('ACEITA') ? 409
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /v3/arquivos/:periodo_id — Obter arquivo gerado
router.get('/v3/arquivos/:periodo_id', async (req, res) => {
  try {
    const arquivo = await SngpcArquivo.findOne({
      where: {
        empresa_id: req.empresa_id,
        periodo_id: parseInt(req.params.periodo_id)
      }
    });
    if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado para este período' });
    res.json(arquivo);
  } catch (error) {
    logger.error('Erro consultar arquivo SNGPC:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /v3/arquivos/:periodo_id/download — Download do arquivo TXT
router.get('/v3/arquivos/:periodo_id/download', async (req, res) => {
  try {
    const arquivo = await SngpcArquivo.findOne({
      where: {
        empresa_id: req.empresa_id,
        periodo_id: parseInt(req.params.periodo_id)
      }
    });
    if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome_arquivo}"`);
    res.send(arquivo.conteudo);
  } catch (error) {
    logger.error('Erro download arquivo SNGPC:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ── TRANSMISSÃO ───────────────────────────────────────────────

// POST /v3/transmissoes/:periodo_id — Registrar transmissão
router.post('/v3/transmissoes/:periodo_id', perfilSngpc, async (req, res) => {
  try {
    const { protocolo } = req.body;
    if (!protocolo) return res.status(400).json({ error: 'Protocolo é obrigatório' });

    const resultado = await SngpcTransmissaoService.registrarTransmissao({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      protocolo,
      usuario_id: req.usuario.id
    });

    await SngpcAuditoriaService.registrar({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      acao: 'TRANSMITIR',
      dados_novos: { transmissao_id: resultado.transmissao.id, protocolo },
      usuario_id: req.usuario.id,
      usuario_nome: req.usuario.nome,
      ip_address: req.ip,
      detalhes: `Transmissão registrada com protocolo ${protocolo}`
    });

    res.status(201).json(resultado);
  } catch (error) {
    logger.error('Erro registrar transmissão SNGPC:', { message: error.message });
    const msg = error.message.toLowerCase();
    const status = msg.includes('não encontrado') ? 404
      : msg.includes('fechado') ? 422
      : msg.includes('não gerado') ? 422
      : msg.includes('protocolo') ? 409
      : msg.includes('aceita') ? 409
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /v3/transmissoes/:id/status — Atualizar status (aceito/rejeitado)
router.put('/v3/transmissoes/:id/status', perfilSngpc, async (req, res) => {
  try {
    const { status, mensagem } = req.body;
    if (!status || !['aceito', 'rejeitado'].includes(status)) {
      return res.status(400).json({ error: 'Status deve ser aceito ou rejeitado' });
    }

    const resultado = await SngpcTransmissaoService.atualizarStatusTransmissao({
      empresa_id: req.empresa_id,
      transmissao_id: parseInt(req.params.id),
      status,
      mensagem: mensagem || null,
      usuario_id: req.usuario.id
    });

    const acao = status === 'rejeitado' ? 'REJEITAR' : 'TRANSMITIR';
    await SngpcAuditoriaService.registrar({
      empresa_id: req.empresa_id,
      periodo_id: resultado.transmissao.periodo_id,
      acao,
      dados_anteriores: { status_anterior: 'enviado' },
      dados_novos: { status_novo: status, mensagem },
      usuario_id: req.usuario.id,
      usuario_nome: req.usuario.nome,
      ip_address: req.ip,
      detalhes: `Status atualizado para ${status}${mensagem ? ': ' + mensagem : ''}`
    });

    res.json(resultado);
  } catch (error) {
    logger.error('Erro atualizar status transmissão:', { message: error.message });
    const status = error.message.includes('não encontrada') ? 404
      : error.message.includes('pendente') ? 422
      : 500;
    res.status(status).json({ error: error.message });
  }
});

// PUT /v3/transmissoes/:periodo_id/cancelar — Cancelar transmissão pendente
router.put('/v3/transmissoes/:periodo_id/cancelar', perfilSngpc, async (req, res) => {
  try {
    const resultado = await SngpcTransmissaoService.cancelarTransmissao({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      usuario_id: req.usuario.id
    });

    await SngpcAuditoriaService.registrar({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id),
      acao: 'CANCELAR',
      dados_novos: { transmissao_id: resultado.transmissao.id },
      usuario_id: req.usuario.id,
      usuario_nome: req.usuario.nome,
      ip_address: req.ip,
      detalhes: 'Transmissão cancelada pelo usuário'
    });

    res.json(resultado);
  } catch (error) {
    logger.error('Erro cancelar transmissão:', { message: error.message });
    const status = error.message.includes('pendente') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /v3/transmissoes/:periodo_id — Listar transmissões de um período
router.get('/v3/transmissoes/:periodo_id', async (req, res) => {
  try {
    const transmissoes = await SngpcTransmissao.findAll({
      where: {
        empresa_id: req.empresa_id,
        periodo_id: parseInt(req.params.periodo_id)
      },
      order: [['created_at', 'DESC']]
    });
    res.json(transmissoes);
  } catch (error) {
    logger.error('Erro listar transmissões:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /v3/transmissoes/:periodo_id/imutabilidade — Verificar se período é imutável
router.get('/v3/transmissoes/:periodo_id/imutabilidade', async (req, res) => {
  try {
    const imutavel = await SngpcTransmissaoService.verificarImutabilidadeDefinitiva(
      req.empresa_id, parseInt(req.params.periodo_id)
    );
    res.json({ periodo_id: parseInt(req.params.periodo_id), imutavel });
  } catch (error) {
    logger.error('Erro verificar imutabilidade:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ── AUDITORIA ─────────────────────────────────────────────────

// GET /v3/auditoria — Consultar registros de auditoria
router.get('/v3/auditoria', async (req, res) => {
  try {
    const { periodo_id, acao, limit, offset } = req.query;
    const registros = await SngpcAuditoriaService.consultar({
      empresa_id: req.empresa_id,
      periodo_id: periodo_id ? parseInt(periodo_id) : undefined,
      acao: acao || undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(registros);
  } catch (error) {
    logger.error('Erro consultar auditoria:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// GET /v3/auditoria/periodo/:periodo_id — Auditoria por período
router.get('/v3/auditoria/periodo/:periodo_id', async (req, res) => {
  try {
    const registros = await SngpcAuditoriaService.consultar({
      empresa_id: req.empresa_id,
      periodo_id: parseInt(req.params.periodo_id)
    });
    res.json(registros);
  } catch (error) {
    logger.error('Erro consultar auditoria por período:', { message: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  PRODUTOS CONTROLADOS — busca dedicada para SNGPC
// ══════════════════════════════════════════════════════════════

router.get('/produtos-controlados', async (req, res) => {
  try {
    const { busca } = req.query;
    const where = { empresa_id: req.empresa_id, controlado: true, ativo: true };
    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: '%' + busca + '%' } },
        { principio_ativo: { [Op.iLike]: '%' + busca + '%' } },
        { codigo_barras: busca }
      ];
    }
    const produtos = await Produto.findAll({
      where,
      attributes: ['id', 'nome', 'codigo_barras', 'principio_ativo', 'classe_controlado',
                   'registro_anvisa', 'tipo_receita', 'necessita_receita', 'estoque_atual'],
      include: [{
        model: Lote,
        where: { status: 'ATIVO', quantidade_atual: { [Op.gt]: 0 } },
        required: false,
        attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual']
      }],
      order: [['nome', 'ASC']],
      limit: 20
    });
    res.json(produtos);
  } catch (error) {
    logger.error('Erro buscar produtos controlados:', { message: error.message });
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// GET /lotes/:produto_id — Lotes disponíveis de um produto controlado
router.get('/lotes/:produto_id', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const lotes = await Lote.findAll({
      where: {
        empresa_id: req.empresa_id,
        produto_id: req.params.produto_id,
        status: 'ATIVO',
        quantidade_atual: { [Op.gt]: 0 },
        [Op.or]: [
          { validade: null },
          { validade: { [Op.gte]: hoje } }
        ]
      },
      attributes: ['id', 'numero_lote', 'validade', 'quantidade_atual'],
      order: [['validade', 'ASC NULLS LAST']]
    });
    res.json(lotes);
  } catch (error) {
    logger.error('Erro buscar lotes:', { message: error.message });
    res.status(500).json({ error: 'Erro ao buscar lotes' });
  }
});

// ══════════════════════════════════════════════════════════════
//  DISPENSAÇÃO MANUAL (registrar saída c/ receita)
// ══════════════════════════════════════════════════════════════

router.post('/dispensacao', perfilSngpc, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { produto_id, lote_id, quantidade, cpf_paciente, nome_paciente,
            nome_medico, crm_medico, uf_crm, numero_receita, data_receita } = req.body;

    // Validações obrigatórias
    if (!produto_id || !lote_id || !quantidade) {
      await t.rollback();
      return res.status(400).json({ error: 'produto_id, lote_id e quantidade são obrigatórios' });
    }

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id, controlado: true },
      transaction: t
    });
    if (!produto) { await t.rollback(); return res.status(404).json({ error: 'Produto controlado não encontrado' }); }

    // Validar receita obrigatória
    if (produto.necessita_receita) {
      if (!cpf_paciente || !nome_paciente || !nome_medico || !crm_medico || !uf_crm || !numero_receita || !data_receita) {
        await t.rollback();
        return res.status(400).json({ error: 'Produto exige receita. Campos obrigatórios: cpf_paciente, nome_paciente, nome_medico, crm_medico, uf_crm, numero_receita, data_receita' });
      }
    }

    const lote = await Lote.findOne({
      where: { id: lote_id, produto_id, empresa_id: req.empresa_id, status: 'ATIVO' },
      lock: t.LOCK.UPDATE,
      transaction: t
    });
    if (!lote) { await t.rollback(); return res.status(404).json({ error: 'Lote não encontrado ou esgotado' }); }

    const qtd = Math.abs(parseFloat(quantidade));
    
    // Validar validade
    const hoje = new Date().toISOString().split('T')[0];
    if (lote.validade && lote.validade < hoje) {
      await t.rollback();
      return res.status(400).json({ error: 'Lote vencido! Validade: ' + lote.validade });
    }

    // Validar estoque
    if (parseFloat(lote.quantidade_atual) < qtd) {
      await t.rollback();
      return res.status(400).json({ error: 'Estoque insuficiente no lote. Disponível: ' + lote.quantidade_atual });
    }

    // Verificar bloqueio de período
    const bloqueio = await verificarBloqueioPeriodo(req.empresa_id, hoje);
    if (bloqueio) { await t.rollback(); return res.status(400).json({ error: bloqueio }); }

    // Deduzir lote
    const novaQtdLote = parseFloat(lote.quantidade_atual) - qtd;
    await lote.update({
      quantidade_atual: novaQtdLote,
      status: novaQtdLote <= 0 ? 'ESGOTADO' : 'ATIVO'
    }, { transaction: t });

    // Atualizar estoque do produto
    await produto.update({
      estoque_atual: Math.max(0, parseFloat(produto.estoque_atual) - qtd)
    }, { transaction: t });

    // Movimentação de estoque geral
    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id, lote_id,
      tipo: 'saida',
      origem: 'SNGPC_DISPENSACAO',
      quantidade: qtd,
      estoque_anterior: parseFloat(produto.estoque_atual) + qtd,
      estoque_posterior: parseFloat(produto.estoque_atual),
      motivo: 'Dispensação SNGPC - Receita ' + (numero_receita || 'S/N'),
      usuario_id: req.usuario.id,
      referencia: 'sngpc_dispensacao',
      lote: lote.numero_lote,
      validade: lote.validade
    }, { transaction: t });

    // Criar movimentação SNGPC imutável
    const hashData = {
      produto_id, lote_id, quantidade: qtd,
      data_movimentacao: hoje, cpf_paciente, crm_medico
    };

    const mov = await SngpcMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id, lote_id,
      tipo: 'saida',
      quantidade: qtd,
      data_movimentacao: hoje,
      cpf_paciente, nome_paciente, nome_medico,
      crm_medico, uf_crm, numero_receita, data_receita,
      usuario_id: req.usuario.id,
      hash_integridade: gerarHash(hashData)
    }, { transaction: t });

    // Backward compat: criar MedicamentoControlado legado
    await MedicamentoControlado.create({
      empresa_id: req.empresa_id,
      venda_id: null, // dispensação avulsa (sem venda associada)
      produto_id,
      cliente_cpf: cpf_paciente || '',
      cliente_nome: nome_paciente || '',
      medico_nome: nome_medico,
      medico_crm: crm_medico,
      medico_uf: uf_crm,
      numero_receita,
      data_receita,
      tipo_receita: produto.tipo_receita || 'branca',
      farmaceutico_id: req.usuario.id,
      quantidade_dispensada: qtd,
      lote: lote.numero_lote,
      data_venda: hoje
    }, { transaction: t });

    await t.commit();

    if (req.audit) await req.audit('dispensacao_sngpc', 'sngpc_movimentacoes', mov.id, null, mov.toJSON(),
      'Dispensação SNGPC: ' + produto.nome + ' - Lote ' + lote.numero_lote + ' - Qtd: ' + qtd);

    res.status(201).json(mov);
  } catch (error) {
    await t.rollback();
    logger.error('Erro dispensação SNGPC:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao registrar dispensação' });
  }
});

// ══════════════════════════════════════════════════════════════
//  ENTRADA MANUAL (registrar entrada de compra)
// ══════════════════════════════════════════════════════════════

router.post('/entrada', perfilSngpc, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { produto_id, lote_id, quantidade, numero_documento, compra_id } = req.body;

    if (!produto_id || !lote_id || !quantidade) {
      await t.rollback();
      return res.status(400).json({ error: 'produto_id, lote_id e quantidade são obrigatórios' });
    }

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id, controlado: true },
      transaction: t
    });
    if (!produto) { await t.rollback(); return res.status(404).json({ error: 'Produto controlado não encontrado' }); }

    const lote = await Lote.findOne({
      where: { id: lote_id, produto_id, empresa_id: req.empresa_id },
      transaction: t
    });
    if (!lote) { await t.rollback(); return res.status(404).json({ error: 'Lote não encontrado' }); }

    // Verificar bloqueio de período
    const bloqueio = await verificarBloqueioPeriodo(req.empresa_id, new Date().toISOString().split('T')[0]);
    if (bloqueio) { await t.rollback(); return res.status(400).json({ error: bloqueio }); }

    const qtd = Math.abs(parseFloat(quantidade));
    const hashData = {
      produto_id, lote_id, quantidade: qtd,
      data_movimentacao: new Date().toISOString().split('T')[0]
    };

    const mov = await SngpcMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id, lote_id,
      tipo: 'entrada',
      quantidade: qtd,
      data_movimentacao: new Date().toISOString().split('T')[0],
      numero_documento: numero_documento || null,
      compra_id: compra_id || null,
      usuario_id: req.usuario.id,
      hash_integridade: gerarHash(hashData)
    }, { transaction: t });

    // Atualizar estoque do lote
    const novaQtdLote = parseFloat(lote.quantidade_atual) + qtd;
    await lote.update({
      quantidade_atual: novaQtdLote,
      status: novaQtdLote > 0 ? 'ATIVO' : lote.status
    }, { transaction: t });

    // Atualizar estoque do produto
    await produto.update({
      estoque_atual: parseFloat(produto.estoque_atual) + qtd
    }, { transaction: t });

    // Movimentação de estoque geral
    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id, lote_id,
      tipo: 'entrada',
      origem: 'SNGPC_ENTRADA',
      quantidade: qtd,
      estoque_anterior: parseFloat(produto.estoque_atual) - qtd,
      estoque_posterior: parseFloat(produto.estoque_atual),
      motivo: 'Entrada SNGPC - Doc ' + (numero_documento || 'S/N'),
      usuario_id: req.usuario.id,
      referencia: 'sngpc_entrada',
      lote: lote.numero_lote,
      validade: lote.validade
    }, { transaction: t });

    await t.commit();

    if (req.audit) await req.audit('entrada_sngpc', 'sngpc_movimentacoes', mov.id, null, mov.toJSON(),
      'Entrada SNGPC: ' + produto.nome + ' - Lote ' + lote.numero_lote + ' - Qtd: ' + qtd);

    res.status(201).json(mov);
  } catch (error) {
    await t.rollback();
    logger.error('Erro entrada SNGPC:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao registrar entrada' });
  }
});

// ══════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ══════════════════════════════════════════════════════════════

/**
 * Verificar se a data cai em um período fechado ou transmitido
 * Impede movimentações retroativas em períodos já encerrados
 */
async function verificarBloqueioPeriodo(empresa_id, data) {
  const periodoFechado = await SngpcPeriodo.findOne({
    where: {
      empresa_id,
      status: { [Op.in]: ['fechado', 'transmitido'] },
      data_inicio: { [Op.lte]: data },
      data_fim: { [Op.gte]: data }
    }
  });

  if (periodoFechado) {
    return 'Data cai no período ' + periodoFechado.data_inicio + ' a ' + periodoFechado.data_fim +
           ' que está ' + periodoFechado.status + '. Movimentação retroativa bloqueada.';
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
//  LEGACY — Compatibilidade com rotas antigas (MedicamentoControlado)
// ══════════════════════════════════════════════════════════════

// GET / — Listar dispensações legado (MedicamentoControlado)
router.get('/', async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const where = { empresa_id: req.empresa_id };
    if (data_inicio && data_fim) {
      where.data_venda = { [Op.between]: [data_inicio, data_fim] };
    }
    const registros = await MedicamentoControlado.findAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'principio_ativo', 'tipo_receita'] },
        { model: Usuario, as: 'Farmaceutico', attributes: ['id', 'nome'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json(registros);
  } catch (error) {
    logger.error('Erro listar SNGPC legado:', { message: error.message });
    res.status(500).json({ error: 'Erro ao listar registros' });
  }
});

// POST / — Criar dispensação legado (redireciona para novo fluxo internamente)
router.post('/', async (req, res) => {
  try {
    // Compatibilidade — cria MedicamentoControlado diretamente
    const data = req.body;
    const produto = await Produto.findOne({
      where: { id: data.produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const registro = await MedicamentoControlado.create({
      empresa_id: req.empresa_id,
      venda_id: data.venda_id || 0,
      produto_id: data.produto_id,
      cliente_cpf: data.cliente_cpf || '',
      cliente_nome: data.cliente_nome || '',
      cliente_endereco: data.cliente_endereco,
      cliente_telefone: data.cliente_telefone,
      medico_nome: data.medico_nome,
      medico_crm: data.medico_crm,
      medico_uf: data.medico_uf,
      numero_receita: data.numero_receita,
      data_receita: data.data_receita,
      tipo_receita: data.tipo_receita || produto.tipo_receita || 'branca',
      farmaceutico_id: req.usuario.id,
      quantidade_dispensada: data.quantidade || 1,
      lote: data.lote,
      data_venda: new Date()
    });

    res.status(201).json(registro);
  } catch (error) {
    logger.error('Erro criar dispensação legado:', { message: error.message });
    res.status(500).json({ error: 'Erro ao registrar dispensação' });
  }
});

module.exports = router;
