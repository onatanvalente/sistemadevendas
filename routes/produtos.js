/* ══════════════════════════════════════════════════════════════
   SGC — Rotas: Produtos v2.0
   CRUD + sugestões inteligentes + combos + curva ABC
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op, fn, col } = require('sequelize');
const { Produto, Categoria, Fornecedor, EstoqueMovimentacao, HistoricoPreco, Lote, ProdutoSugestao, Combo, ComboItem, Usuario, sequelize } = require('../models');
const { auth, perfil } = require('../middleware/auth');
const { logger } = require('../config/logger');

// Helper: valida que uma FK (categoria_id, fornecedor_id) pertence ao tenant
async function validarFKTenant(Model, id, empresa_id, nome, req) {
  if (!id) return true;
  const registro = await Model.findOne({ where: { id, empresa_id } });
  if (!registro) {
    logger.warn('ALERTA: FK IDOR bloqueada - ' + nome + ' de outro tenant', {
      tipo: 'fk_idor_' + nome, usuario_id: req.usuario.id, empresa_id,
      [nome + '_id']: id, ip: req.ip, url: req.originalUrl
    });
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────
//  GET /  —  Listar produtos (paginado, filtros avançados)
// ──────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    
    if (req.query.ativo !== undefined) where.ativo = req.query.ativo === 'true';
    else where.ativo = true;
    
    if (req.query.categoria_id) where.categoria_id = req.query.categoria_id;
    if (req.query.fornecedor_id) where.fornecedor_id = req.query.fornecedor_id;
    if (req.query.controlado) where.controlado = req.query.controlado === 'true';
    if (req.query.curva_abc) where.curva_abc = req.query.curva_abc;
    if (req.query.tipo_medicamento) where.tipo_medicamento = req.query.tipo_medicamento;
    
    if (req.query.busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${req.query.busca}%` } },
        { codigo_barras: { [Op.iLike]: `%${req.query.busca}%` } },
        { codigo_interno: { [Op.iLike]: `%${req.query.busca}%` } },
        { principio_ativo: { [Op.iLike]: `%${req.query.busca}%` } },
        { laboratorio: { [Op.iLike]: `%${req.query.busca}%` } }
      ];
    }

    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 100);
    const offset = (page - 1) * limit;

    const { rows: produtos, count: total } = await Produto.findAndCountAll({
      where,
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ],
      order: [['nome', 'ASC']],
      limit,
      offset
    });

    res.json({ data: produtos, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

// ──────────────────────────────────────────────
//  GET /barcode/:codigo  —  Buscar por código de barras (PDV)
// ──────────────────────────────────────────────
router.get('/barcode/:codigo', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({
      where: { empresa_id: req.empresa_id, codigo_barras: req.params.codigo, ativo: true },
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ]
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// ──────────────────────────────────────────────
//  GET /alertas/estoque-baixo
// ──────────────────────────────────────────────
router.get('/alertas/estoque-baixo', auth, async (req, res) => {
  try {
    const todos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ]
    });
    const baixo = todos.filter(p => parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo) && parseFloat(p.estoque_minimo) > 0);
    res.json(baixo);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estoque baixo' });
  }
});

// ──────────────────────────────────────────────
//  GET /alertas/vencendo  —  Produtos vencendo (30 dias)
// ──────────────────────────────────────────────
router.get('/alertas/vencendo', auth, async (req, res) => {
  try {
    const hoje = new Date();
    const dias = parseInt(req.query.dias || 30);
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);

    const produtos = await Produto.findAll({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        validade: { [Op.between]: [hoje, limite] }
      },
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ],
      order: [['validade', 'ASC']]
    });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos vencendo' });
  }
});

// ──────────────────────────────────────────────
//  GET /sugestoes/:produto_id  —  Sugestões para um produto (PDV inteligente)
// ──────────────────────────────────────────────
router.get('/sugestoes/:produto_id', auth, async (req, res) => {
  try {
    const sugestoes = await ProdutoSugestao.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.produto_id, ativo: true },
      include: [
        { model: Produto, as: 'ProdutoSugerido', attributes: ['id', 'nome', 'preco_venda', 'estoque_atual', 'principio_ativo', 'tipo_medicamento'] }
      ],
      order: [['prioridade', 'DESC']]
    });
    res.json(sugestoes);
  } catch (error) {
    console.error('Erro buscar sugestões:', error);
    res.status(500).json({ error: 'Erro ao buscar sugestões' });
  }
});

// ──────────────────────────────────────────────
//  POST /sugestoes  —  Criar sugestão
// ──────────────────────────────────────────────
router.post('/sugestoes', auth, perfil('administrador', 'gerente', 'farmaceutico'), async (req, res) => {
  try {
    const { produto_id, produto_sugerido_id, tipo, mensagem, prioridade } = req.body;
    if (!produto_id || !produto_sugerido_id) {
      return res.status(400).json({ error: 'produto_id e produto_sugerido_id são obrigatórios' });
    }

    // Validar que ambos os produtos pertencem ao mesmo tenant
    if (!await validarFKTenant(Produto, produto_id, req.empresa_id, 'produto', req)) {
      return res.status(400).json({ error: 'Produto não encontrado' });
    }
    if (!await validarFKTenant(Produto, produto_sugerido_id, req.empresa_id, 'produto_sugerido', req)) {
      return res.status(400).json({ error: 'Produto sugerido não encontrado' });
    }

    const sugestao = await ProdutoSugestao.create({
      empresa_id: req.empresa_id,
      produto_id,
      produto_sugerido_id,
      tipo: tipo || 'complementar',
      mensagem,
      prioridade: prioridade || 1
    });
    res.status(201).json(sugestao);
  } catch (error) {
    console.error('Erro criar sugestão:', error);
    res.status(500).json({ error: 'Erro ao criar sugestão' });
  }
});

// ──────────────────────────────────────────────
//  DELETE /sugestoes/:id  —  Remover sugestão
// ──────────────────────────────────────────────
router.delete('/sugestoes/:id', auth, perfil('administrador', 'gerente', 'farmaceutico'), async (req, res) => {
  try {
    await ProdutoSugestao.destroy({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    res.json({ message: 'Sugestão removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover sugestão' });
  }
});

// ──────────────────────────────────────────────
//  GET /combos  —  Listar combos ativos
// ──────────────────────────────────────────────
router.get('/combos/listar', auth, async (req, res) => {
  try {
    const combos = await Combo.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      include: [{ model: ComboItem, include: [{ model: Produto, attributes: ['id', 'nome', 'preco_venda', 'estoque_atual'] }] }],
      order: [['nome', 'ASC']]
    });
    res.json(combos);
  } catch (error) {
    console.error('Erro listar combos:', error);
    res.status(500).json({ error: 'Erro ao listar combos' });
  }
});

// ──────────────────────────────────────────────
//  POST /combos  —  Criar combo
// ──────────────────────────────────────────────
router.post('/combos', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { nome, descricao, preco, itens, validade_inicio, validade_fim } = req.body;
    if (!nome || !preco || !itens || itens.length === 0) {
      return res.status(400).json({ error: 'Nome, preço e pelo menos um item são obrigatórios' });
    }

    // Calcular preço original (soma dos itens)
    let precoOriginal = 0;
    for (const item of itens) {
      const produto = await Produto.findOne({ where: { id: item.produto_id, empresa_id: req.empresa_id } });
      if (produto) precoOriginal += parseFloat(produto.preco_venda) * (item.quantidade || 1);
    }

    const combo = await Combo.create({
      empresa_id: req.empresa_id,
      nome,
      descricao,
      preco,
      preco_original: precoOriginal,
      economia: precoOriginal - parseFloat(preco),
      validade_inicio,
      validade_fim
    });

    // Criar itens do combo
    for (const item of itens) {
      await ComboItem.create({
        combo_id: combo.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade || 1
      });
    }

    const comboCompleto = await Combo.findByPk(combo.id, {
      include: [{ model: ComboItem, include: [{ model: Produto, attributes: ['id', 'nome', 'preco_venda'] }] }]
    });

    res.status(201).json(comboCompleto);
  } catch (error) {
    console.error('Erro criar combo:', error);
    res.status(500).json({ error: 'Erro ao criar combo' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id  —  Buscar produto por ID
// ──────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ]
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// ──────────────────────────────────────────────
//  POST /  —  Criar produto
// ──────────────────────────────────────────────
router.post('/', auth, perfil('administrador', 'gerente', 'estoquista'), async (req, res) => {
  try {
    const dados = { ...req.body, empresa_id: req.empresa_id };

    // Validar FKs pertencem ao mesmo tenant
    if (dados.categoria_id && !await validarFKTenant(Categoria, dados.categoria_id, req.empresa_id, 'categoria', req)) {
      return res.status(400).json({ error: 'Categoria não encontrada' });
    }
    if (dados.fornecedor_id && !await validarFKTenant(Fornecedor, dados.fornecedor_id, req.empresa_id, 'fornecedor', req)) {
      return res.status(400).json({ error: 'Fornecedor não encontrado' });
    }

    // Calcular margem automática (custo efetivo = custo + despesas)
    const custoBase = parseFloat(dados.preco_custo || 0);
    const despesasBase = parseFloat(dados.despesas_adicionais || 0);
    const custoEfetivoBase = custoBase + despesasBase;
    if (custoEfetivoBase > 0 && dados.preco_venda) {
      dados.margem = (((parseFloat(dados.preco_venda) - custoEfetivoBase) / custoEfetivoBase) * 100).toFixed(2);
    }

    const produto = await Produto.create(dados);

    // Registrar entrada de estoque se houver estoque inicial
    if (parseFloat(dados.estoque_atual) > 0) {
      await EstoqueMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id: produto.id,
        tipo: 'entrada',
        quantidade: dados.estoque_atual,
        estoque_anterior: 0,
        estoque_posterior: dados.estoque_atual,
        motivo: 'Estoque inicial',
        usuario_id: req.usuario.id,
        lote: dados.lote,
        validade: dados.validade
      });
    }

    if (req.audit) await req.audit('criar', 'produtos', produto.id, null, produto.toJSON(), `Produto ${produto.nome} criado`);

    res.status(201).json(produto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id  —  Atualizar produto
// ──────────────────────────────────────────────
router.put('/:id', auth, perfil('administrador', 'gerente', 'estoquista'), async (req, res) => {
  try {
    const produto = await Produto.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const dadosAnteriores = produto.toJSON();
    const dados = { ...req.body };
    delete dados.empresa_id;
    delete dados.id;

    // Validar FKs pertencem ao mesmo tenant
    if (dados.categoria_id && !await validarFKTenant(Categoria, dados.categoria_id, req.empresa_id, 'categoria', req)) {
      return res.status(400).json({ error: 'Categoria não encontrada' });
    }
    if (dados.fornecedor_id && !await validarFKTenant(Fornecedor, dados.fornecedor_id, req.empresa_id, 'fornecedor', req)) {
      return res.status(400).json({ error: 'Fornecedor não encontrado' });
    }

    // Recalcular margem (custo efetivo = custo + despesas)
    const custo = parseFloat(dados.preco_custo || produto.preco_custo);
    const despesas = parseFloat(dados.despesas_adicionais || produto.despesas_adicionais || 0);
    const custoEfetivo = custo + despesas;
    const venda = parseFloat(dados.preco_venda || produto.preco_venda);
    if (custoEfetivo > 0) {
      dados.margem = (((venda - custoEfetivo) / custoEfetivo) * 100).toFixed(2);
    }

    // Registrar histórico de preço se custo ou venda mudaram
    const custoAnterior = parseFloat(produto.preco_custo || 0);
    const vendaAnterior = parseFloat(produto.preco_venda || 0);
    if (custo !== custoAnterior || venda !== vendaAnterior) {
      await HistoricoPreco.create({
        empresa_id: req.empresa_id,
        produto_id: produto.id,
        preco_custo_anterior: custoAnterior,
        preco_custo_novo: custo,
        preco_venda_anterior: vendaAnterior,
        preco_venda_novo: venda,
        margem_anterior: parseFloat(produto.margem || 0),
        margem_nova: parseFloat(dados.margem || produto.margem || 0),
        usuario_id: req.usuario.id
      });
    }

    await produto.update(dados);
    if (req.audit) await req.audit('editar', 'produtos', produto.id, dadosAnteriores, produto.toJSON(), `Produto ${produto.nome} editado`);

    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id/historico-precos  —  Histórico de preços
// ──────────────────────────────────────────────
router.get('/:id/historico-precos', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const historico = await HistoricoPreco.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.id },
      include: [{ model: Usuario, attributes: ['id', 'nome'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });
    res.json(historico);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico de preços' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id/dashboard  —  Mini-dashboard do produto
// ──────────────────────────────────────────────
router.get('/:id/dashboard', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    // Últimas movimentações de estoque
    const movimentacoes = await EstoqueMovimentacao.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.id },
      include: [{ model: Usuario, attributes: ['id', 'nome'] }],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    // Histórico de preços
    const historicoPrecos = await HistoricoPreco.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.id },
      include: [{ model: Usuario, attributes: ['id', 'nome'] }],
      order: [['created_at', 'DESC']],
      limit: 10
    });

    // Lotes ativos
    const lotes = await Lote.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.id, ativo: true },
      include: [{ model: Fornecedor, attributes: ['id', 'nome'] }],
      order: [['validade', 'ASC']]
    });

    // Dias até ruptura estimada
    const estoqueAtual = parseFloat(produto.estoque_atual || 0);
    const vendidoMes = parseFloat(produto.total_vendido_mes || 0);
    const giroDiario = vendidoMes > 0 ? vendidoMes / 30 : 0;
    const diasRuptura = giroDiario > 0 ? Math.round(estoqueAtual / giroDiario) : null;

    // Margem real média (das últimas 10 alterações de preço)
    let margemRealMedia = parseFloat(produto.margem || 0);
    if (historicoPrecos.length > 0) {
      const margens = historicoPrecos.map(h => parseFloat(h.margem_nova || 0));
      margemRealMedia = margens.reduce((a, b) => a + b, 0) / margens.length;
    }

    // KPIs completos
    const kpis = {
      estoque_atual: estoqueAtual,
      estoque_reservado: parseFloat(produto.estoque_reservado || 0),
      preco_custo: parseFloat(produto.preco_custo || 0),
      preco_custo_medio: parseFloat(produto.preco_custo_medio || 0),
      preco_venda: parseFloat(produto.preco_venda || 0),
      margem: parseFloat(produto.margem || 0),
      margem_real_media: parseFloat(margemRealMedia.toFixed(2)),
      total_vendido_mes: parseFloat(produto.total_vendido_mes || 0),
      faturamento_mes: parseFloat(produto.faturamento_mes || 0),
      curva_abc: produto.curva_abc,
      giro_estoque: produto.giro_estoque,
      dias_ruptura: diasRuptura,
      estoque_minimo: parseFloat(produto.estoque_minimo || 0),
      estoque_maximo: parseFloat(produto.estoque_maximo || 0),
      alerta_estoque: estoqueAtual <= parseFloat(produto.estoque_minimo) && parseFloat(produto.estoque_minimo) > 0,
      ultima_venda: produto.ultima_venda || null,
      ultima_compra: produto.ultima_compra || null
    };

    res.json({ kpis, movimentacoes, historicoPrecos, lotes });
  } catch (error) {
    console.error('Erro dashboard produto:', error);
    res.status(500).json({ error: 'Erro ao buscar dashboard do produto' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id/lotes  —  Listar lotes de um produto
// ──────────────────────────────────────────────
router.get('/:id/lotes', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const lotes = await Lote.findAll({
      where: { empresa_id: req.empresa_id, produto_id: req.params.id, ativo: true },
      include: [{ model: Fornecedor, attributes: ['id', 'nome'] }],
      order: [['validade', 'ASC']]
    });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lotes' });
  }
});

// ──────────────────────────────────────────────
//  POST /:id/lotes  —  Cadastrar lote
// ──────────────────────────────────────────────
router.post('/:id/lotes', auth, perfil('administrador', 'gerente', 'estoquista', 'farmaceutico'), async (req, res) => {
  try {
    const produto = await Produto.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const { numero_lote, validade, quantidade, fornecedor_id, custo_unitario } = req.body;
    if (!numero_lote || !quantidade) return res.status(400).json({ error: 'Lote e quantidade são obrigatórios' });

    if (fornecedor_id && !await validarFKTenant(Fornecedor, fornecedor_id, req.empresa_id, 'fornecedor', req)) {
      return res.status(400).json({ error: 'Fornecedor não encontrado' });
    }

    const qtd = parseFloat(quantidade);
    const lote = await Lote.create({
      empresa_id: req.empresa_id,
      produto_id: produto.id,
      numero_lote,
      validade: validade || null,
      quantidade: qtd,
      quantidade_original: qtd,
      fornecedor_id: fornecedor_id || null,
      data_entrada: new Date(),
      custo_unitario: custo_unitario || produto.preco_custo
    });

    // Atualizar estoque do produto
    const estoqueAnterior = parseFloat(produto.estoque_atual);
    const estoqueNovo = estoqueAnterior + qtd;
    await produto.update({ estoque_atual: estoqueNovo, ultima_compra: new Date() });

    // Registrar movimentação
    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id: produto.id,
      tipo: 'entrada',
      quantidade: qtd,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoqueNovo,
      motivo: 'Entrada lote ' + numero_lote,
      usuario_id: req.usuario.id,
      lote: numero_lote,
      validade: validade || null,
      custo_unitario: custo_unitario || produto.preco_custo
    });

    res.status(201).json(lote);
  } catch (error) {
    console.error('Erro criar lote:', error);
    res.status(500).json({ error: 'Erro ao criar lote' });
  }
});

// ──────────────────────────────────────────────
//  DELETE /:id  —  Desativar produto
// ──────────────────────────────────────────────
router.delete('/:id', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const produto = await Produto.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    produto.ativo = false;
    await produto.save();
    if (req.audit) await req.audit('desativar', 'produtos', produto.id, null, null, `Produto ${produto.nome} desativado`);
    res.json({ message: 'Produto desativado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar produto' });
  }
});

module.exports = router;
