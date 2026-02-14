const router = require('express').Router();
const { Op } = require('sequelize');
const { sequelize, Venda, VendaItem, Produto, ContaPagar, ContaReceber, Caixa } = require('../models');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

    // Vendas do dia
    const vendasHoje = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.between]: [inicioHoje, fimHoje] }
      }
    });

    const faturamentoHoje = vendasHoje.reduce((s, v) => s + parseFloat(v.total), 0);
    const ticketMedio = vendasHoje.length > 0 ? faturamentoHoje / vendasHoje.length : 0;

    // Vendas do mês
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const vendasMes = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.gte]: inicioMes }
      }
    });
    const faturamentoMes = vendasMes.reduce((s, v) => s + parseFloat(v.total), 0);

    // Produtos mais vendidos (mês)
    const itensVendidos = await VendaItem.findAll({
      attributes: [
        'produto_nome',
        [sequelize.fn('SUM', sequelize.col('VendaItem.quantidade')), 'total_vendido'],
        [sequelize.fn('SUM', sequelize.col('VendaItem.subtotal')), 'total_faturado']
      ],
      include: [{
        model: Venda,
        attributes: [],
        where: {
          empresa_id: req.empresa_id,
          status: 'finalizada',
          created_at: { [Op.gte]: inicioMes }
        }
      }],
      group: ['produto_nome'],
      order: [[sequelize.fn('SUM', sequelize.col('VendaItem.quantidade')), 'DESC']],
      limit: 10
    });

    // Estoque crítico
    const todosProdutos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, ativo: true }
    });
    const estoqueCritico = todosProdutos.filter(p => 
      parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo)
    ).length;

    // Produtos vencendo (30 dias)
    const limite30 = new Date();
    limite30.setDate(limite30.getDate() + 30);
    const produtosVencendo = await Produto.count({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        validade: { [Op.between]: [hoje, limite30] }
      }
    });

    // Contas vencendo (próximos 7 dias)
    const limite7 = new Date();
    limite7.setDate(limite7.getDate() + 7);
    const contasVencendo = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'pendente',
        data_vencimento: { [Op.between]: [hoje.toISOString().split('T')[0], limite7.toISOString().split('T')[0]] }
      }
    });

    // Contas vencidas
    const contasVencidas = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'pendente',
        data_vencimento: { [Op.lt]: hoje.toISOString().split('T')[0] }
      }
    });

    // Recebíveis pendentes
    const recebiveis = await ContaReceber.findAll({
      where: { empresa_id: req.empresa_id, status: 'pendente' }
    });
    const totalReceber = recebiveis.reduce((s, c) => s + parseFloat(c.valor), 0);

    res.json({
      faturamento_hoje: faturamentoHoje,
      vendas_hoje: vendasHoje.length,
      ticket_medio: ticketMedio,
      faturamento_mes: faturamentoMes,
      vendas_mes: vendasMes.length,
      produtos_mais_vendidos: itensVendidos,
      estoque_critico: estoqueCritico,
      produtos_vencendo: produtosVencendo,
      contas_vencendo: contasVencendo,
      contas_vencidas: contasVencidas,
      total_receber: totalReceber
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

module.exports = router;
