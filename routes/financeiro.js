const router = require('express').Router();
const { Op } = require('sequelize');
const { ContaPagar, ContaReceber, Fornecedor } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// ═══════════════════════════════════════════════
//  CONTAS A PAGAR
// ═══════════════════════════════════════════════

router.get('/pagar', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.status) where.status = req.query.status;

    const contas = await ContaPagar.findAll({
      where,
      include: [{ model: Fornecedor, attributes: ['id', 'nome'] }],
      order: [['data_vencimento', 'ASC']]
    });
    res.json(contas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar contas a pagar' });
  }
});

router.post('/pagar', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const conta = await ContaPagar.create({
      empresa_id: req.empresa_id,
      ...req.body,
      usuario_id: req.usuario.id
    });
    res.status(201).json(conta);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta a pagar' });
  }
});

router.put('/pagar/:id', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const conta = await ContaPagar.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
    await conta.update(req.body);
    res.json(conta);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

// Marcar como pago
router.put('/pagar/:id/quitar', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const conta = await ContaPagar.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
    
    await conta.update({ 
      status: 'pago', 
      data_pagamento: req.body.data_pagamento || new Date().toISOString().split('T')[0] 
    });
    res.json({ message: 'Conta quitada', conta });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao quitar conta' });
  }
});

router.delete('/pagar/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    await ContaPagar.update(
      { status: 'cancelado' },
      { where: { id: req.params.id, empresa_id: req.empresa_id } }
    );
    res.json({ message: 'Conta cancelada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar conta' });
  }
});

// ═══════════════════════════════════════════════
//  CONTAS A RECEBER
// ═══════════════════════════════════════════════

router.get('/receber', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.status) where.status = req.query.status;

    const contas = await ContaReceber.findAll({
      where,
      order: [['data_vencimento', 'ASC']]
    });
    res.json(contas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar contas a receber' });
  }
});

router.post('/receber', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const conta = await ContaReceber.create({
      empresa_id: req.empresa_id,
      ...req.body,
      usuario_id: req.usuario.id
    });
    res.status(201).json(conta);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar conta a receber' });
  }
});

router.put('/receber/:id/quitar', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const conta = await ContaReceber.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
    
    await conta.update({ 
      status: 'recebido',
      data_recebimento: req.body.data_recebimento || new Date().toISOString().split('T')[0]
    });
    res.json({ message: 'Recebimento registrado', conta });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar recebimento' });
  }
});

// ═══════════════════════════════════════════════
//  FLUXO DE CAIXA / DRE
// ═══════════════════════════════════════════════

router.get('/fluxo', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const hoje = new Date();
    const inicio = req.query.inicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = req.query.fim || hoje.toISOString().split('T')[0];

    const recebidas = await ContaReceber.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'recebido',
        data_recebimento: { [Op.between]: [inicio, fim] }
      }
    });

    const pagas = await ContaPagar.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'pago',
        data_pagamento: { [Op.between]: [inicio, fim] }
      }
    });

    const totalEntradas = recebidas.reduce((s, c) => s + parseFloat(c.valor), 0);
    const totalSaidas = pagas.reduce((s, c) => s + parseFloat(c.valor), 0);

    res.json({
      periodo: { inicio, fim },
      entradas: totalEntradas,
      saidas: totalSaidas,
      saldo: totalEntradas - totalSaidas,
      detalhes: { recebidas, pagas }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar fluxo de caixa' });
  }
});

module.exports = router;
