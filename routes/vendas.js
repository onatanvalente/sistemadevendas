const router = require('express').Router();
const { sequelize, Venda, VendaItem, Produto, Caixa, EstoqueMovimentacao, ContaReceber } = require('../models');
const { auth } = require('../middleware/auth');

// Listar vendas
router.get('/', auth, async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    
    if (req.query.data_inicio && req.query.data_fim) {
      const { Op } = require('sequelize');
      where.created_at = {
        [Op.between]: [new Date(req.query.data_inicio), new Date(req.query.data_fim + 'T23:59:59')]
      };
    }
    if (req.query.status) where.status = req.query.status;

    const vendas = await Venda.findAll({
      where,
      include: [{ model: VendaItem }],
      order: [['created_at', 'DESC']],
      limit: parseInt(req.query.limit) || 100
    });
    res.json(vendas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

// Detalhes de uma venda
router.get('/:id', auth, async (req, res) => {
  try {
    const venda = await Venda.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: VendaItem, include: [{ model: Produto }] }]
    });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json(venda);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

// ═══════════════════════════════════════════════
//  REGISTRAR VENDA (PDV)
// ═══════════════════════════════════════════════
router.post('/', auth, async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { itens, desconto, acrescimo, forma_pagamento, 
            valor_dinheiro, valor_pix, valor_debito, valor_credito,
            cliente_nome, cliente_cpf, observacoes, parcelas } = req.body;

    if (!itens || itens.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Venda deve ter pelo menos um item' });
    }

    // Verificar caixa aberto
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    if (!caixa) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhum caixa aberto. Abra o caixa primeiro.' });
    }

    // Calcular número da venda
    const ultimaVenda = await Venda.findOne({
      where: { empresa_id: req.empresa_id },
      order: [['numero', 'DESC']]
    });
    const numero = (ultimaVenda?.numero || 0) + 1;

    // Calcular subtotal dos itens
    let subtotal = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const produto = await Produto.findOne({
        where: { id: item.produto_id, empresa_id: req.empresa_id, ativo: true }
      });

      if (!produto) {
        await t.rollback();
        return res.status(400).json({ error: `Produto ID ${item.produto_id} não encontrado` });
      }

      const quantidade = parseFloat(item.quantidade);
      
      // Validar estoque
      if (parseFloat(produto.estoque_atual) < quantidade) {
        await t.rollback();
        return res.status(400).json({ 
          error: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque_atual}` 
        });
      }

      const preco = parseFloat(item.preco_unitario || produto.preco_venda);
      const descontoItem = parseFloat(item.desconto_item || 0);
      const subtotalItem = (preco * quantidade) - descontoItem;

      itensProcessados.push({
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade,
        preco_unitario: preco,
        desconto_item: descontoItem,
        subtotal: subtotalItem,
        produto // referência para atualizar estoque
      });

      subtotal += subtotalItem;
    }

    const descontoTotal = parseFloat(desconto || 0);
    const acrescimoTotal = parseFloat(acrescimo || 0);
    const total = subtotal - descontoTotal + acrescimoTotal;

    // Calcular troco
    const totalPago = parseFloat(valor_dinheiro || 0) + parseFloat(valor_pix || 0) + 
                      parseFloat(valor_debito || 0) + parseFloat(valor_credito || 0);
    const troco = totalPago > total ? totalPago - total : 0;

    // Criar venda
    const venda = await Venda.create({
      empresa_id: req.empresa_id,
      caixa_id: caixa.id,
      usuario_id: req.usuario.id,
      numero,
      cliente_nome,
      cliente_cpf,
      subtotal,
      desconto: descontoTotal,
      acrescimo: acrescimoTotal,
      total,
      forma_pagamento: forma_pagamento || 'dinheiro',
      valor_dinheiro: valor_dinheiro || 0,
      valor_pix: valor_pix || 0,
      valor_debito: valor_debito || 0,
      valor_credito: valor_credito || 0,
      troco,
      observacoes
    }, { transaction: t });

    // Criar itens e atualizar estoque
    for (const item of itensProcessados) {
      await VendaItem.create({
        venda_id: venda.id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto_item: item.desconto_item,
        subtotal: item.subtotal
      }, { transaction: t });

      // Atualizar estoque
      const estoqueAnterior = parseFloat(item.produto.estoque_atual);
      const estoqueNovo = estoqueAnterior - item.quantidade;
      
      await Produto.update(
        { estoque_atual: estoqueNovo },
        { where: { id: item.produto_id }, transaction: t }
      );

      // Registrar movimentação
      await EstoqueMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id: item.produto_id,
        tipo: 'saida',
        quantidade: item.quantidade,
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoqueNovo,
        motivo: `Venda #${numero}`,
        usuario_id: req.usuario.id,
        referencia: `venda_${venda.id}`
      }, { transaction: t });
    }

    // Atualizar totais do caixa
    await caixa.update({
      total_vendas: parseFloat(caixa.total_vendas) + total,
      total_dinheiro: parseFloat(caixa.total_dinheiro) + parseFloat(valor_dinheiro || 0),
      total_pix: parseFloat(caixa.total_pix) + parseFloat(valor_pix || 0),
      total_debito: parseFloat(caixa.total_debito) + parseFloat(valor_debito || 0),
      total_credito: parseFloat(caixa.total_credito) + parseFloat(valor_credito || 0)
    }, { transaction: t });

    // Se venda parcelada, criar contas a receber
    if (parcelas && parcelas > 1) {
      const valorParcela = (total / parcelas).toFixed(2);
      for (let i = 1; i <= parcelas; i++) {
        const vencimento = new Date();
        vencimento.setMonth(vencimento.getMonth() + i);
        
        await ContaReceber.create({
          empresa_id: req.empresa_id,
          descricao: `Venda #${numero} - Parcela ${i}/${parcelas}`,
          cliente_nome,
          cliente_cpf,
          valor: valorParcela,
          data_vencimento: vencimento,
          venda_id: venda.id,
          parcela: `${i}/${parcelas}`,
          usuario_id: req.usuario.id
        }, { transaction: t });
      }
    }

    await t.commit();

    // Recarregar venda com itens
    const vendaCompleta = await Venda.findByPk(venda.id, {
      include: [{ model: VendaItem }]
    });

    res.status(201).json(vendaCompleta);
  } catch (error) {
    await t.rollback();
    console.error('Erro na venda:', error);
    res.status(500).json({ error: 'Erro ao registrar venda' });
  }
});

// Cancelar venda
router.put('/:id/cancelar', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const venda = await Venda.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: VendaItem }]
    });
    if (!venda) { await t.rollback(); return res.status(404).json({ error: 'Venda não encontrada' }); }
    if (venda.status === 'cancelada') { await t.rollback(); return res.status(400).json({ error: 'Venda já cancelada' }); }

    // Devolver estoque
    for (const item of venda.VendaItems) {
      const produto = await Produto.findByPk(item.produto_id);
      if (produto) {
        const estoqueAnterior = parseFloat(produto.estoque_atual);
        const estoqueNovo = estoqueAnterior + parseFloat(item.quantidade);
        await produto.update({ estoque_atual: estoqueNovo }, { transaction: t });

        await EstoqueMovimentacao.create({
          empresa_id: req.empresa_id,
          produto_id: item.produto_id,
          tipo: 'entrada',
          quantidade: item.quantidade,
          estoque_anterior: estoqueAnterior,
          estoque_posterior: estoqueNovo,
          motivo: `Cancelamento venda #${venda.numero}`,
          usuario_id: req.usuario.id,
          referencia: `cancelamento_venda_${venda.id}`
        }, { transaction: t });
      }
    }

    // Atualizar caixa
    const caixa = await Caixa.findByPk(venda.caixa_id);
    if (caixa && caixa.status === 'aberto') {
      await caixa.update({
        total_vendas: parseFloat(caixa.total_vendas) - parseFloat(venda.total),
        total_dinheiro: parseFloat(caixa.total_dinheiro) - parseFloat(venda.valor_dinheiro),
        total_pix: parseFloat(caixa.total_pix) - parseFloat(venda.valor_pix),
        total_debito: parseFloat(caixa.total_debito) - parseFloat(venda.valor_debito),
        total_credito: parseFloat(caixa.total_credito) - parseFloat(venda.valor_credito)
      }, { transaction: t });
    }

    await venda.update({ status: 'cancelada' }, { transaction: t });
    await t.commit();
    res.json({ message: 'Venda cancelada com sucesso' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao cancelar venda' });
  }
});

module.exports = router;
