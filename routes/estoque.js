const router = require('express').Router();
const { EstoqueMovimentacao, Produto } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Histórico de movimentações
router.get('/', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.produto_id) where.produto_id = req.query.produto_id;
    if (req.query.tipo) where.tipo = req.query.tipo;

    const movimentacoes = await EstoqueMovimentacao.findAll({
      where,
      include: [{ model: Produto, attributes: ['id', 'nome', 'codigo_barras'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(req.query.limit) || 200
    });
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar movimentações' });
  }
});

// Entrada de estoque (compra)
router.post('/entrada', auth, perfil('administrador'), async (req, res) => {
  try {
    const { produto_id, quantidade, motivo, preco_custo } = req.body;
    
    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const qtd = parseFloat(quantidade);
    const estoqueAnterior = parseFloat(produto.estoque_atual);
    const estoqueNovo = estoqueAnterior + qtd;

    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      tipo: 'entrada',
      quantidade: qtd,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoqueNovo,
      motivo: motivo || 'Entrada de mercadoria',
      usuario_id: req.usuario.id
    });

    const atualizacao = { estoque_atual: estoqueNovo };
    if (preco_custo) {
      atualizacao.preco_custo = preco_custo;
      // Recalcular margem
      const venda = parseFloat(produto.preco_venda);
      const custo = parseFloat(preco_custo);
      if (custo > 0) atualizacao.margem = (((venda - custo) / custo) * 100).toFixed(2);
    }

    await produto.update(atualizacao);

    res.json({ message: 'Entrada registrada', estoque_atual: estoqueNovo });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar entrada' });
  }
});

// Ajuste manual
router.post('/ajuste', auth, perfil('administrador'), async (req, res) => {
  try {
    const { produto_id, quantidade_nova, motivo } = req.body;

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const estoqueAnterior = parseFloat(produto.estoque_atual);
    const estoqueNovo = parseFloat(quantidade_nova);

    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      tipo: 'ajuste',
      quantidade: Math.abs(estoqueNovo - estoqueAnterior),
      estoque_anterior: estoqueAnterior,
      estoque_posterior: estoqueNovo,
      motivo: motivo || 'Ajuste de inventário',
      usuario_id: req.usuario.id
    });

    await produto.update({ estoque_atual: estoqueNovo });

    res.json({ message: 'Ajuste registrado', estoque_anterior: estoqueAnterior, estoque_atual: estoqueNovo });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar ajuste' });
  }
});

// Registrar perda
router.post('/perda', auth, perfil('administrador'), async (req, res) => {
  try {
    const { produto_id, quantidade, motivo } = req.body;

    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const qtd = parseFloat(quantidade);
    const estoqueAnterior = parseFloat(produto.estoque_atual);
    const estoqueNovo = estoqueAnterior - qtd;

    await EstoqueMovimentacao.create({
      empresa_id: req.empresa_id,
      produto_id,
      tipo: 'perda',
      quantidade: qtd,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: Math.max(0, estoqueNovo),
      motivo: motivo || 'Perda de mercadoria',
      usuario_id: req.usuario.id
    });

    await produto.update({ estoque_atual: Math.max(0, estoqueNovo) });

    res.json({ message: 'Perda registrada', estoque_atual: Math.max(0, estoqueNovo) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar perda' });
  }
});

module.exports = router;
