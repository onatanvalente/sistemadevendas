const router = require('express').Router();
const { Op } = require('sequelize');
const { Produto, Categoria, Fornecedor, EstoqueMovimentacao, sequelize } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Listar todos os produtos
router.get('/', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    
    if (req.query.ativo !== undefined) where.ativo = req.query.ativo === 'true';
    else where.ativo = true;
    
    if (req.query.categoria_id) where.categoria_id = req.query.categoria_id;
    if (req.query.controlado) where.controlado = req.query.controlado === 'true';
    
    if (req.query.busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${req.query.busca}%` } },
        { codigo_barras: { [Op.iLike]: `%${req.query.busca}%` } }
      ];
    }

    const produtos = await Produto.findAll({
      where,
      include: [
        { model: Categoria, attributes: ['id', 'nome'] },
        { model: Fornecedor, attributes: ['id', 'nome'] }
      ],
      order: [['nome', 'ASC']]
    });
    res.json(produtos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

// Buscar por código de barras (PDV)
router.get('/barcode/:codigo', auth, async (req, res) => {
  try {
    const produto = await Produto.findOne({
      where: { empresa_id: req.empresa_id, codigo_barras: req.params.codigo, ativo: true }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// Produtos com estoque baixo
router.get('/alertas/estoque-baixo', auth, async (req, res) => {
  try {
    const produtos = await Produto.findAll({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        estoque_atual: { [Op.lte]: sequelize.col('estoque_minimo') }
      },
      order: [['estoque_atual', 'ASC']]
    });
    res.json(produtos);
  } catch (error) {
    // Fallback sem sequelize.col
    const todos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, ativo: true }
    });
    const baixo = todos.filter(p => parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo));
    res.json(baixo);
  }
});

// Produtos vencendo (próximos 30 dias)
router.get('/alertas/vencendo', auth, async (req, res) => {
  try {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);

    const produtos = await Produto.findAll({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        validade: { [Op.between]: [hoje, limite] }
      },
      order: [['validade', 'ASC']]
    });
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos vencendo' });
  }
});

// Buscar produto por ID
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

// Criar produto
router.post('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const dados = { ...req.body, empresa_id: req.empresa_id };
    
    // Calcular margem automática
    if (dados.preco_custo && dados.preco_venda && parseFloat(dados.preco_custo) > 0) {
      dados.margem = (((parseFloat(dados.preco_venda) - parseFloat(dados.preco_custo)) / parseFloat(dados.preco_custo)) * 100).toFixed(2);
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
        usuario_id: req.usuario.id
      });
    }

    res.status(201).json(produto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// Atualizar produto
router.put('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    const produto = await Produto.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const dados = { ...req.body };
    delete dados.empresa_id;
    delete dados.id;

    // Recalcular margem
    const custo = parseFloat(dados.preco_custo || produto.preco_custo);
    const venda = parseFloat(dados.preco_venda || produto.preco_venda);
    if (custo > 0) {
      dados.margem = (((venda - custo) / custo) * 100).toFixed(2);
    }

    await produto.update(dados);
    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// Desativar produto
router.delete('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    await Produto.update({ ativo: false }, {
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    res.json({ message: 'Produto desativado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar produto' });
  }
});

module.exports = router;
