/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Rotas: Módulo de Estoque v2.0
   Visão geral | Lotes (FIFO/PEPS) | Ajuste manual c/ justificativa
   Inventário físico | Sugestão de compra | Movimentações
   Governança: Correção → SOMENTE via Estoque
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op } = require('sequelize');
const { EstoqueMovimentacao, Produto, Lote, Fornecedor, Categoria, sequelize } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// ══════════════════════════════════════════
//  GET /  —  Movimentações de estoque (paginado)
// ══════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.produto_id) where.produto_id = req.query.produto_id;
    if (req.query.tipo) where.tipo = req.query.tipo;
    if (req.query.origem) where.origem = req.query.origem;
    if (req.query.busca) {
      where[Op.or] = [
        { motivo: { [Op.iLike]: '%' + req.query.busca + '%' } },
        { referencia: { [Op.iLike]: '%' + req.query.busca + '%' } }
      ];
    }

    if (req.query.data_inicio || req.query.data_fim) {
      where.created_at = {};
      if (req.query.data_inicio) where.created_at[Op.gte] = req.query.data_inicio;
      if (req.query.data_fim) where.created_at[Op.lte] = req.query.data_fim + 'T23:59:59';
    }

    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const { count, rows } = await EstoqueMovimentacao.findAndCountAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'codigo_barras'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'], required: false }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    res.json({ data: rows, total: count, page, pages: Math.ceil(count / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar movimentações' });
  }
});

// ══════════════════════════════════════════
//  GET /visao-geral  —  Dashboard de estoque
// ══════════════════════════════════════════
router.get('/visao-geral', auth, async (req, res) => {
  try {
    const produtos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      attributes: ['id', 'nome', 'codigo_barras', 'estoque_atual', 'estoque_minimo', 'estoque_maximo',
        'estoque_seguranca', 'preco_custo', 'preco_custo_medio', 'preco_venda', 'curva_abc',
        'categoria_id', 'controla_lote', 'controla_validade', 'unidade'],
      include: [{ model: Categoria, attributes: ['id', 'nome'] }],
      order: [['nome', 'ASC']]
    });

    // Métricas
    let totalItens = 0;
    let valorEstoque = 0;
    let abaixoMinimo = 0;
    let semEstoque = 0;
    let acimaMáximo = 0;

    const lista = produtos.map(p => {
      const est = parseFloat(p.estoque_atual) || 0;
      const min = parseFloat(p.estoque_minimo) || 0;
      const max = parseFloat(p.estoque_maximo) || 0;
      const custo = parseFloat(p.preco_custo_medio || p.preco_custo) || 0;

      totalItens += est;
      valorEstoque += est * custo;
      if (est <= 0) semEstoque++;
      else if (est <= min && min > 0) abaixoMinimo++;
      if (max > 0 && est > max) acimaMáximo++;

      let situacao = 'normal';
      if (est <= 0) situacao = 'sem_estoque';
      else if (min > 0 && est <= min) situacao = 'critico';
      else if (max > 0 && est > max) situacao = 'excesso';

      return {
        id: p.id,
        nome: p.nome,
        codigo_barras: p.codigo_barras,
        estoque_atual: est,
        estoque_minimo: min,
        estoque_maximo: max,
        custo_medio: custo,
        valor_estoque: parseFloat((est * custo).toFixed(2)),
        preco_venda: parseFloat(p.preco_venda) || 0,
        curva_abc: p.curva_abc,
        categoria: p.Categorium ? p.Categorium.nome : '-',
        unidade: p.unidade || 'UN',
        controla_lote: p.controla_lote,
        situacao
      };
    });

    res.json({
      metricas: {
        total_produtos: produtos.length,
        total_itens: totalItens,
        valor_estoque: parseFloat(valorEstoque.toFixed(2)),
        sem_estoque: semEstoque,
        abaixo_minimo: abaixoMinimo,
        acima_maximo: acimaMáximo
      },
      produtos: lista
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar visão geral do estoque' });
  }
});

// ══════════════════════════════════════════
//  GET /lotes  —  Estoque por lote
// ══════════════════════════════════════════
router.get('/lotes', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.produto_id) where.produto_id = req.query.produto_id;
    if (req.query.status) where.status = req.query.status;
    if (req.query.apenas_ativos === 'true') where.status = 'ATIVO';

    // Lotes próximos do vencimento
    if (req.query.vencendo_em) {
      const dias = parseInt(req.query.vencendo_em) || 30;
      const limite = new Date();
      limite.setDate(limite.getDate() + dias);
      where.validade = { [Op.lte]: limite.toISOString().split('T')[0], [Op.gte]: new Date().toISOString().split('T')[0] };
      where.status = 'ATIVO';
    }

    // Lotes vencidos
    if (req.query.vencidos === 'true') {
      where.validade = { [Op.lt]: new Date().toISOString().split('T')[0] };
      where.status = { [Op.ne]: 'ESGOTADO' };
    }

    const lotes = await Lote.findAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'unidade'] },
        { model: Fornecedor, attributes: ['id', 'nome'], required: false }
      ],
      order: [['validade', 'ASC'], ['data_entrada', 'ASC']]
    });

    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar lotes' });
  }
});

// ══════════════════════════════════════════
//  POST /ajuste  —  Ajuste manual com justificativa
//  Obrigatório: produto_id, quantidade_nova, justificativa
// ══════════════════════════════════════════
router.post('/ajuste', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { produto_id, quantidade_nova, justificativa, lote_id } = req.body;

    if (!justificativa || justificativa.trim().length < 5) {
      await t.rollback();
      return res.status(400).json({ error: 'Justificativa obrigatória (mínimo 5 caracteres)' });
    }

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) { await t.rollback(); return res.status(404).json({ error: 'Produto não encontrado' }); }

    const estoqueAnterior = parseFloat(produto.estoque_atual) || 0;
    const estoqueNovo = parseFloat(quantidade_nova);
    const diferenca = estoqueNovo - estoqueAnterior;

    // Registrar movimentação
    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      lote_id: lote_id || null,
      tipo: 'ajuste',
      origem: 'AJUSTE',
      quantidade: Math.abs(diferenca),
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoqueNovo,
      motivo: 'Ajuste manual de estoque',
      justificativa: justificativa.trim(),
      usuario_id: req.usuario.id,
      referencia: 'ajuste_manual'
    }, { transaction: t });

    await produto.update({ estoque_atual: estoqueNovo }, { transaction: t });

    // Se ajuste em lote específico
    if (lote_id) {
      const lote = await Lote.findOne({ where: { id: lote_id, empresa_id: req.empresa_id } });
      if (lote) {
        const qtdLoteAnterior = parseFloat(lote.quantidade_atual) || 0;
        const qtdLoteNova = Math.max(0, qtdLoteAnterior + diferenca);
        const novoStatus = qtdLoteNova <= 0 ? 'ESGOTADO' : 'ATIVO';
        await lote.update({ quantidade_atual: qtdLoteNova, status: novoStatus, ativo: qtdLoteNova > 0 }, { transaction: t });
      }
    }

    await t.commit();

    res.json({
      message: 'Ajuste registrado',
      estoque_anterior: estoqueAnterior,
      estoque_atual: estoqueNovo,
      diferenca
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao registrar ajuste' });
  }
});

// ══════════════════════════════════════════
//  POST /perda  —  Registrar perda
// ══════════════════════════════════════════
router.post('/perda', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { produto_id, quantidade, motivo, justificativa, lote_id } = req.body;

    if (!justificativa || justificativa.trim().length < 5) {
      await t.rollback();
      return res.status(400).json({ error: 'Justificativa obrigatória (mínimo 5 caracteres)' });
    }

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) { await t.rollback(); return res.status(404).json({ error: 'Produto não encontrado' }); }

    const qtd = parseFloat(quantidade);
    const estoqueAnterior = parseFloat(produto.estoque_atual);
    const estoqueNovo = Math.max(0, estoqueAnterior - qtd);

    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      lote_id: lote_id || null,
      tipo: 'perda',
      origem: 'AJUSTE',
      quantidade: qtd,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoqueNovo,
      motivo: motivo || 'Perda de mercadoria',
      justificativa: justificativa.trim(),
      usuario_id: req.usuario.id,
      referencia: 'perda_manual'
    }, { transaction: t });

    await produto.update({ estoque_atual: estoqueNovo }, { transaction: t });

    // Consumir do lote se especificado, senão FIFO
    if (lote_id) {
      const lote = await Lote.findOne({ where: { id: lote_id, empresa_id: req.empresa_id } });
      if (lote) {
        const qtdLoteNova = Math.max(0, parseFloat(lote.quantidade_atual) - qtd);
        const novoStatus = qtdLoteNova <= 0 ? 'ESGOTADO' : 'ATIVO';
        await lote.update({ quantidade_atual: qtdLoteNova, status: novoStatus, ativo: qtdLoteNova > 0 }, { transaction: t });
      }
    } else {
      // FIFO: consumir dos lotes mais antigos primeiro
      await consumirLotesFIFO(req.empresa_id, produto_id, qtd, t);
    }

    await t.commit();

    res.json({ message: 'Perda registrada', estoque_atual: estoqueNovo });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao registrar perda' });
  }
});

// ══════════════════════════════════════════
//  POST /inventario  —  Inventário físico (múltiplos produtos)
//  Body: { itens: [{ produto_id, quantidade_contada, justificativa }] }
// ══════════════════════════════════════════
router.post('/inventario', auth, perfil('administrador'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { itens } = req.body;
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Informe os itens do inventário' });
    }

    const resultados = [];

    for (const item of itens) {
      const { produto_id, quantidade_contada, justificativa } = item;
      if (!produto_id) continue;

      const produto = await Produto.findOne({
        where: { id: produto_id, empresa_id: req.empresa_id }
      });
      if (!produto) continue;

      const estoqueAnterior = parseFloat(produto.estoque_atual) || 0;
      const estoqueFisico = parseFloat(quantidade_contada) || 0;
      const diferenca = estoqueFisico - estoqueAnterior;

      if (diferenca === 0) {
        resultados.push({ produto_id, nome: produto.nome, diferenca: 0, status: 'sem_divergencia' });
        continue;
      }

      await EstoqueMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id,
        tipo: 'ajuste',
        origem: 'INVENTARIO',
        quantidade: Math.abs(diferenca),
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoqueFisico,
        motivo: 'Inventário físico - Divergência: ' + diferenca.toFixed(0),
        justificativa: justificativa || 'Contagem física de inventário',
        usuario_id: req.usuario.id,
        referencia: 'inventario_' + new Date().toISOString().split('T')[0]
      }, { transaction: t });

      await produto.update({ estoque_atual: estoqueFisico }, { transaction: t });

      resultados.push({
        produto_id,
        nome: produto.nome,
        estoque_sistema: estoqueAnterior,
        contagem_fisica: estoqueFisico,
        diferenca,
        status: 'ajustado'
      });
    }

    await t.commit();

    const divergencias = resultados.filter(r => r.diferenca !== 0);

    res.json({
      message: 'Inventário processado',
      total_itens: itens.length,
      divergencias: divergencias.length,
      sem_divergencia: itens.length - divergencias.length,
      resultados
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao processar inventário' });
  }
});

// ══════════════════════════════════════════
//  GET /sugestao-compra  —  Sugestão de reposição
// ══════════════════════════════════════════
router.get('/sugestao-compra', auth, async (req, res) => {
  try {
    const produtos = await Produto.findAll({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        estoque_minimo: { [Op.gt]: 0 }
      },
      include: [
        { model: Fornecedor, attributes: ['id', 'nome'] },
        { model: Categoria, attributes: ['id', 'nome'] }
      ],
      order: [['nome', 'ASC']]
    });

    const sugestoes = [];

    for (const p of produtos) {
      const estoque = parseFloat(p.estoque_atual) || 0;
      const minimo = parseFloat(p.estoque_minimo) || 0;
      const maximo = parseFloat(p.estoque_maximo) || 0;
      const seguranca = parseFloat(p.estoque_seguranca) || 0;
      const pontoReposicao = parseFloat(p.ponto_reposicao) || minimo;

      // Precisa repor se estoque <= ponto de reposição
      if (estoque <= pontoReposicao) {
        const qtdSugerida = (maximo > 0 ? maximo : minimo * 2) - estoque;
        const custoEstimado = parseFloat(p.preco_custo_medio || p.preco_custo || 0);

        let urgencia = 'baixa';
        if (estoque <= 0) urgencia = 'critica';
        else if (estoque <= seguranca || estoque <= minimo * 0.3) urgencia = 'alta';
        else if (estoque <= minimo) urgencia = 'media';

        sugestoes.push({
          produto_id: p.id,
          nome: p.nome,
          codigo_barras: p.codigo_barras,
          estoque_atual: estoque,
          estoque_minimo: minimo,
          estoque_maximo: maximo,
          ponto_reposicao: pontoReposicao,
          quantidade_sugerida: Math.max(1, Math.ceil(qtdSugerida)),
          custo_estimado: parseFloat((Math.max(1, Math.ceil(qtdSugerida)) * custoEstimado).toFixed(2)),
          custo_unitario: custoEstimado,
          fornecedor: p.Fornecedor ? { id: p.Fornecedor.id, nome: p.Fornecedor.nome } : null,
          categoria: p.Categorium ? p.Categorium.nome : '-',
          lead_time: parseInt(p.lead_time_padrao || p.prazo_entrega || 0),
          urgencia,
          unidade: p.unidade || 'UN'
        });
      }
    }

    // Ordenar por urgência
    const ordemUrgencia = { critica: 0, alta: 1, media: 2, baixa: 3 };
    sugestoes.sort((a, b) => ordemUrgencia[a.urgencia] - ordemUrgencia[b.urgencia]);

    res.json({
      total: sugestoes.length,
      custo_total_estimado: parseFloat(sugestoes.reduce((s, r) => s + r.custo_estimado, 0).toFixed(2)),
      sugestoes
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar sugestão de compra' });
  }
});

// ══════════════════════════════════════════
//  GET /lotes/vencimento  —  Lotes próximos do vencimento
// ══════════════════════════════════════════
router.get('/lotes/vencimento', auth, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);

    const lotes = await Lote.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'ATIVO',
        quantidade_atual: { [Op.gt]: 0 },
        validade: { [Op.between]: [hoje.toISOString().split('T')[0], limite.toISOString().split('T')[0]] }
      },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'unidade'] }
      ],
      order: [['validade', 'ASC']]
    });

    // Lotes JÁ vencidos com estoque
    const vencidos = await Lote.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['ATIVO', 'VENCIDO'] },
        quantidade_atual: { [Op.gt]: 0 },
        validade: { [Op.lt]: hoje.toISOString().split('T')[0] }
      },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'unidade'] }
      ],
      order: [['validade', 'ASC']]
    });

    res.json({ vencendo: lotes, vencidos });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar vencimentos' });
  }
});

// ══════════════════════════════════════════
//  HELPER: Consumir lotes FIFO (PEPS)
//  Ordem: validade ASC, data_entrada ASC
// ══════════════════════════════════════════
async function consumirLotesFIFO(empresa_id, produto_id, quantidade, transaction) {
  let restante = parseFloat(quantidade);
  if (restante <= 0) return;

  const hoje = new Date().toISOString().split('T')[0];
  const lotes = await Lote.findAll({
    where: {
      empresa_id,
      produto_id,
      status: 'ATIVO',
      quantidade_atual: { [Op.gt]: 0 },
      // Não consumir lotes vencidos automaticamente
      [Op.or]: [
        { validade: null },
        { validade: { [Op.gte]: hoje } }
      ]
    },
    order: [['validade', 'ASC NULLS LAST'], ['data_entrada', 'ASC']],
    transaction
  });

  for (const lote of lotes) {
    if (restante <= 0) break;

    const disponivel = parseFloat(lote.quantidade_atual) || 0;
    const consumir = Math.min(disponivel, restante);
    const qtdLoteNova = disponivel - consumir;

    await lote.update({
      quantidade_atual: qtdLoteNova,
      status: qtdLoteNova <= 0 ? 'ESGOTADO' : 'ATIVO',
      ativo: qtdLoteNova > 0
    }, { transaction });

    restante -= consumir;
  }
}

module.exports = router;
