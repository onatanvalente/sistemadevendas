/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Rotas: Fornecedores v2.0
   CRUD + Ranking estratégico + métricas de compras
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op, fn, col } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Fornecedor, Produto, ContaPagar, EstoqueMovimentacao } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// ──────────────────────────────────────────────
//  GET /  —  Listar fornecedores
// ──────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { busca, ativo, ranking_min, order_by } = req.query;
    const where = { empresa_id: req.empresa_id };

    if (ativo !== undefined) where.ativo = ativo === 'true';
    else where.ativo = true;

    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${busca}%` } },
        { cnpj_cpf: { [Op.iLike]: `%${busca}%` } },
        { contato: { [Op.iLike]: `%${busca}%` } }
      ];
    }

    if (ranking_min) {
      where.ranking = { [Op.gte]: parseInt(ranking_min) };
    }

    let order = [['nome', 'ASC']];
    if (order_by === 'ranking') order = [['ranking', 'DESC'], ['nome', 'ASC']];
    if (order_by === 'compras') order = [['total_compras', 'DESC']];
    if (order_by === 'recente') order = [['ultima_compra', 'DESC NULLS LAST']];

    const fornecedores = await Fornecedor.findAll({ where, order });
    res.json(fornecedores);
  } catch (error) {
    console.error('Erro listar fornecedores:', error);
    res.status(500).json({ error: 'Erro ao listar fornecedores' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id  —  Detalhe do fornecedor + stats
// ──────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!fornecedor) return res.status(404).json({ error: 'Fornecedor não encontrado' });

    // Produtos deste fornecedor
    const produtos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, fornecedor_id: fornecedor.id, ativo: true },
      attributes: ['id', 'nome', 'estoque_atual', 'estoque_minimo', 'preco_custo', 'preco_venda'],
      order: [['nome', 'ASC']]
    });

    // Contas a pagar deste fornecedor
    const contas = await ContaPagar.findAll({
      where: { empresa_id: req.empresa_id, fornecedor_id: fornecedor.id, status: 'pendente' },
      order: [['data_vencimento', 'ASC']]
    });
    const totalDevido = contas.reduce((s, c) => s + parseFloat(c.valor), 0);

    // Últimas entradas de estoque deste fornecedor
    const produtoIds = produtos.map(p => p.id);
    let ultimasEntradas = [];
    if (produtoIds.length > 0) {
      ultimasEntradas = await EstoqueMovimentacao.findAll({
        where: { empresa_id: req.empresa_id, produto_id: { [Op.in]: produtoIds }, tipo: 'entrada' },
        include: [{ model: Produto, attributes: ['id', 'nome'] }],
        order: [['created_at', 'DESC']],
        limit: 10
      });
    }

    res.json({
      fornecedor,
      produtos,
      contas_pendentes: contas,
      total_devido: totalDevido,
      ultimas_entradas: ultimasEntradas,
      total_produtos: produtos.length,
      produtos_estoque_baixo: produtos.filter(p => parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo)).length
    });
  } catch (error) {
    console.error('Erro detalhe fornecedor:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedor' });
  }
});

// ──────────────────────────────────────────────
//  POST /  —  Criar fornecedor
// ──────────────────────────────────────────────
router.post('/', auth, perfil('administrador', 'gerente', 'financeiro'), [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ max: 200 }).escape(),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('cnpj_cpf').optional({ values: 'falsy' }).trim().isLength({ max: 18 }).escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { nome, cnpj_cpf, contato, telefone, email, endereco, cidade, estado, cep, observacoes, prazo_entrega, condicoes_pagamento } = req.body;
    const fornecedor = await Fornecedor.create({
      nome, cnpj_cpf, contato, telefone, email, endereco, cidade, estado, cep, observacoes, prazo_entrega, condicoes_pagamento,
      empresa_id: req.empresa_id
    });
    if (req.audit) await req.audit('criar', 'fornecedores', fornecedor.id, null, fornecedor.toJSON(), `Fornecedor ${fornecedor.nome} criado`);
    res.status(201).json(fornecedor);
  } catch (error) {
    console.error('Erro criar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id  —  Atualizar fornecedor
// ──────────────────────────────────────────────
router.put('/:id', auth, perfil('administrador', 'gerente', 'financeiro'), async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!f) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    const dadosAnteriores = f.toJSON();
    const { nome, cnpj_cpf, contato, telefone, email, endereco, cidade, estado, cep, observacoes, prazo_entrega, condicoes_pagamento, ativo } = req.body;
    await f.update({ nome, cnpj_cpf, contato, telefone, email, endereco, cidade, estado, cep, observacoes, prazo_entrega, condicoes_pagamento, ativo });
    if (req.audit) await req.audit('editar', 'fornecedores', f.id, dadosAnteriores, f.toJSON(), `Fornecedor ${f.nome} editado`);
    res.json(f);
  } catch (error) {
    console.error('Erro atualizar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id/ranking  —  Atualizar ranking
// ──────────────────────────────────────────────
router.put('/:id/ranking', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { ranking } = req.body;
    if (!ranking || ranking < 1 || ranking > 5) {
      return res.status(400).json({ error: 'Ranking deve ser de 1 a 5' });
    }
    const f = await Fornecedor.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!f) return res.status(404).json({ error: 'Fornecedor não encontrado' });

    f.ranking = ranking;
    await f.save();
    res.json(f);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar ranking' });
  }
});

// ──────────────────────────────────────────────
//  DELETE /:id  —  Desativar fornecedor
// ──────────────────────────────────────────────
router.delete('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!f) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    f.ativo = false;
    await f.save();
    if (req.audit) await req.audit('desativar', 'fornecedores', f.id, null, null, `Fornecedor ${f.nome} desativado`);
    res.json({ message: 'Fornecedor desativado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar fornecedor' });
  }
});

module.exports = router;
