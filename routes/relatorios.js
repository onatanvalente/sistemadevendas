const router = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const { Venda, VendaItem, Produto, ContaPagar, ContaReceber, Caixa, CaixaMovimentacao, Fornecedor, Cliente } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// =========================================================
//  RELATORIO: Vendas por periodo
// =========================================================
router.get('/vendas', auth, perfil('administrador', 'gerente', 'financeiro'), async (req, res) => {
  try {
    const hoje = new Date();
    const inicio = req.query.inicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = req.query.fim || hoje.toISOString().split('T')[0];

    const vendas = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        createdAt: { [Op.between]: [inicio + ' 00:00:00', fim + ' 23:59:59'] }
      },
      include: [
        { model: VendaItem, attributes: ['produto_nome', 'quantidade', 'preco_unitario', 'subtotal', 'preco_custo'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    const total = vendas.reduce((s, v) => s + parseFloat(v.total), 0);
    const custoTotal = vendas.reduce((s, v) => s + parseFloat(v.custo_total || 0), 0);
    const lucro = vendas.reduce((s, v) => s + parseFloat(v.lucro_estimado || 0), 0);
    const ticketMedio = vendas.length > 0 ? total / vendas.length : 0;
    const descontos = vendas.reduce((s, v) => s + parseFloat(v.desconto || 0), 0);

    // Vendas por forma de pagamento
    const porPagamento = {};
    vendas.forEach(v => {
      const fp = v.forma_pagamento || 'outros';
      if (!porPagamento[fp]) porPagamento[fp] = { quantidade: 0, valor: 0 };
      porPagamento[fp].quantidade++;
      porPagamento[fp].valor += parseFloat(v.total);
    });

    // Vendas por dia
    const porDia = {};
    vendas.forEach(v => {
      const dia = new Date(v.createdAt).toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = { quantidade: 0, valor: 0 };
      porDia[dia].quantidade++;
      porDia[dia].valor += parseFloat(v.total);
    });

    res.json({
      periodo: { inicio, fim },
      resumo: {
        total_vendas: vendas.length,
        faturamento: total,
        custo_total: custoTotal,
        lucro_bruto: lucro,
        margem: total > 0 ? ((lucro / total) * 100) : 0,
        ticket_medio: ticketMedio,
        descontos: descontos
      },
      por_pagamento: porPagamento,
      por_dia: porDia,
      vendas: vendas.map(v => ({
        id: v.id, numero: v.numero, data: v.createdAt,
        cliente: v.cliente_nome || '-', total: v.total,
        forma_pagamento: v.forma_pagamento, itens: (v.VendaItems || []).length,
        lucro: v.lucro_estimado
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatorio de vendas' });
  }
});

// =========================================================
//  RELATORIO: Produtos mais vendidos
// =========================================================
router.get('/produtos-ranking', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const hoje = new Date();
    const inicio = req.query.inicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = req.query.fim || hoje.toISOString().split('T')[0];

    const itens = await VendaItem.findAll({
      attributes: [
        'produto_id', 'produto_nome',
        [fn('SUM', col('quantidade')), 'total_quantidade'],
        [fn('SUM', col('subtotal')), 'total_faturamento'],
        [fn('COUNT', col('VendaItem.id')), 'total_ocorrencias']
      ],
      include: [{
        model: Venda,
        attributes: [],
        where: {
          empresa_id: req.empresa_id,
          status: 'finalizada',
          createdAt: { [Op.between]: [inicio + ' 00:00:00', fim + ' 23:59:59'] }
        }
      }],
      group: ['produto_id', 'produto_nome'],
      order: [[fn('SUM', col('subtotal')), 'DESC']],
      limit: parseInt(req.query.limit) || 50,
      raw: true
    });

    res.json({
      periodo: { inicio, fim },
      produtos: itens.map((i, idx) => ({
        posicao: idx + 1,
        produto_id: i.produto_id,
        nome: i.produto_nome,
        quantidade: parseFloat(i.total_quantidade),
        faturamento: parseFloat(i.total_faturamento),
        ocorrencias: parseInt(i.total_ocorrencias)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar ranking de produtos' });
  }
});

// =========================================================
//  RELATORIO: Fechamento de caixa
// =========================================================
router.get('/fechamento-caixa/:id', auth, perfil('administrador', 'gerente', 'caixa'), async (req, res) => {
  try {
    const caixa = await Caixa.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: CaixaMovimentacao }]
    });
    if (!caixa) return res.status(404).json({ error: 'Caixa nao encontrado' });

    const vendas = await Venda.findAll({
      where: { caixa_id: caixa.id, empresa_id: req.empresa_id, status: 'finalizada' },
      order: [['createdAt', 'ASC']]
    });

    const canceladas = await Venda.count({
      where: { caixa_id: caixa.id, empresa_id: req.empresa_id, status: 'cancelada' }
    });

    const esperado = parseFloat(caixa.valor_abertura) + parseFloat(caixa.total_vendas) +
      parseFloat(caixa.total_suprimento) - parseFloat(caixa.total_sangria);

    res.json({
      caixa: {
        id: caixa.id,
        numero_caixa: caixa.numero_caixa,
        data_abertura: caixa.data_abertura,
        data_fechamento: caixa.data_fechamento,
        status: caixa.status
      },
      valores: {
        abertura: parseFloat(caixa.valor_abertura),
        total_vendas: parseFloat(caixa.total_vendas),
        dinheiro: parseFloat(caixa.total_dinheiro),
        pix: parseFloat(caixa.total_pix),
        debito: parseFloat(caixa.total_debito),
        credito: parseFloat(caixa.total_credito),
        sangrias: parseFloat(caixa.total_sangria),
        suprimentos: parseFloat(caixa.total_suprimento),
        esperado: esperado,
        fechamento: caixa.valor_fechamento ? parseFloat(caixa.valor_fechamento) : null,
        diferenca: parseFloat(caixa.diferenca)
      },
      vendas_qtd: vendas.length,
      canceladas: canceladas,
      movimentacoes: (caixa.CaixaMovimentacaos || []).map(m => ({
        tipo: m.tipo, valor: parseFloat(m.valor), motivo: m.motivo, data: m.createdAt
      })),
      vendas: vendas.map(v => ({
        numero: v.numero, total: parseFloat(v.total),
        forma_pagamento: v.forma_pagamento, hora: v.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatorio do caixa' });
  }
});

// =========================================================
//  RELATORIO: Contas pendentes (pagar + receber)
// =========================================================
router.get('/contas-pendentes', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const pagar = await ContaPagar.findAll({
      where: { empresa_id: req.empresa_id, status: { [Op.in]: ['pendente', 'vencido'] } },
      include: [{ model: Fornecedor, attributes: ['id', 'nome'] }],
      order: [['data_vencimento', 'ASC']]
    });

    const receber = await ContaReceber.findAll({
      where: { empresa_id: req.empresa_id, status: { [Op.in]: ['pendente', 'vencido'] } },
      include: [{ model: Cliente, attributes: ['id', 'nome'] }],
      order: [['data_vencimento', 'ASC']]
    });

    const totalPagar = pagar.reduce((s, c) => s + parseFloat(c.valor), 0);
    const totalReceber = receber.reduce((s, c) => s + parseFloat(c.valor), 0);

    const hoje = new Date().toISOString().split('T')[0];
    const vencidasPagar = pagar.filter(c => c.data_vencimento < hoje);
    const vencidasReceber = receber.filter(c => c.data_vencimento < hoje);

    res.json({
      resumo: {
        total_pagar: totalPagar,
        total_receber: totalReceber,
        saldo: totalReceber - totalPagar,
        vencidas_pagar: vencidasPagar.length,
        vencidas_receber: vencidasReceber.length
      },
      contas_pagar: pagar.map(c => ({
        id: c.id, descricao: c.descricao, valor: parseFloat(c.valor),
        vencimento: c.data_vencimento, status: c.status, categoria: c.categoria,
        fornecedor: c.Fornecedor ? c.Fornecedor.nome : '-'
      })),
      contas_receber: receber.map(c => ({
        id: c.id, descricao: c.descricao, valor: parseFloat(c.valor),
        vencimento: c.data_vencimento, status: c.status,
        cliente: c.Cliente ? c.Cliente.nome : (c.cliente_nome || '-')
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar relatorio de contas' });
  }
});

// =========================================================
//  CUPOM NAO-FISCAL - gera dados para impressao
// =========================================================
router.get('/cupom/:venda_id', auth, async (req, res) => {
  try {
    const venda = await Venda.findOne({
      where: { id: req.params.venda_id, empresa_id: req.empresa_id },
      include: [
        { model: VendaItem },
        { model: require('../models').Usuario, attributes: ['nome'] },
        { model: require('../models').Empresa, attributes: ['nome', 'nome_fantasia', 'cnpj', 'endereco', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'telefone'] }
      ]
    });
    if (!venda) return res.status(404).json({ error: 'Venda nao encontrada' });

    // Se tem snapshot, retorna ele (fidelidade historica)
    if (venda.snapshot_cupom) {
      return res.json({ cupom: venda.snapshot_cupom, tipo: 'snapshot' });
    }

    // Gera cupom a partir dos dados atuais
    const emp = venda.Empresa;
    const cupom = {
      empresa: {
        nome: emp.nome_fantasia || emp.nome,
        cnpj: emp.cnpj,
        endereco: [emp.endereco, emp.numero, emp.bairro, emp.cidade, emp.estado].filter(Boolean).join(', '),
        telefone: emp.telefone
      },
      venda: {
        numero: venda.numero,
        data: venda.createdAt,
        operador: venda.operador_nome || (venda.Usuario ? venda.Usuario.nome : '-'),
        cliente: venda.cliente_nome || null,
        cpf: venda.cliente_cpf || null
      },
      itens: (venda.VendaItems || []).map(i => ({
        nome: i.produto_nome,
        qtd: parseFloat(i.quantidade),
        unitario: parseFloat(i.preco_unitario),
        subtotal: parseFloat(i.subtotal)
      })),
      totais: {
        subtotal: parseFloat(venda.subtotal),
        desconto: parseFloat(venda.desconto || 0),
        acrescimo: parseFloat(venda.acrescimo || 0),
        total: parseFloat(venda.total),
        troco: parseFloat(venda.troco || 0)
      },
      pagamento: {
        forma: venda.forma_pagamento,
        dinheiro: parseFloat(venda.valor_dinheiro || 0),
        pix: parseFloat(venda.valor_pix || 0),
        debito: parseFloat(venda.valor_debito || 0),
        credito: parseFloat(venda.valor_credito || 0)
      }
    };

    res.json({ cupom, tipo: 'gerado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar cupom' });
  }
});

// =========================================================
//  DRE - Demonstrativo de Resultado do Exercicio
// =========================================================
router.get('/dre', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const hoje = new Date();
    const inicio = req.query.inicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const fim = req.query.fim || hoje.toISOString().split('T')[0];

    // Receita bruta: vendas finalizadas
    const vendas = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        createdAt: { [Op.between]: [inicio + ' 00:00:00', fim + ' 23:59:59'] }
      },
      attributes: ['total', 'custo_total', 'lucro_estimado', 'desconto']
    });

    // Cancelamentos/devolvidas no periodo
    const canceladas = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['cancelada', 'devolvida'] },
        cancelado_em: { [Op.between]: [inicio + ' 00:00:00', fim + ' 23:59:59'] }
      },
      attributes: ['total']
    });

    const receitaBruta = vendas.reduce((s, v) => s + parseFloat(v.total), 0);
    const devolucoes = canceladas.reduce((s, v) => s + parseFloat(v.total), 0);
    const descontos = vendas.reduce((s, v) => s + parseFloat(v.desconto || 0), 0);
    const receitaLiquida = receitaBruta - devolucoes;
    const cmv = vendas.reduce((s, v) => s + parseFloat(v.custo_total || 0), 0);
    const lucroBruto = receitaLiquida - cmv;

    // Despesas do periodo (contas pagas)
    const despesas = await ContaPagar.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'pago',
        data_pagamento: { [Op.between]: [inicio, fim] }
      },
      attributes: ['valor', 'categoria']
    });

    const totalDespesas = despesas.reduce((s, d) => s + parseFloat(d.valor), 0);
    const lucroOperacional = lucroBruto - totalDespesas;

    // Despesas por categoria
    const despesasPorCategoria = {};
    despesas.forEach(d => {
      const cat = d.categoria || 'outros';
      despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + parseFloat(d.valor);
    });

    res.json({
      periodo: { inicio, fim },
      dre: {
        receita_bruta: receitaBruta,
        devolucoes: devolucoes,
        descontos_concedidos: descontos,
        receita_liquida: receitaLiquida,
        cmv: cmv,
        lucro_bruto: lucroBruto,
        margem_bruta: receitaLiquida > 0 ? ((lucroBruto / receitaLiquida) * 100) : 0,
        despesas_operacionais: totalDespesas,
        despesas_por_categoria: despesasPorCategoria,
        lucro_operacional: lucroOperacional,
        margem_operacional: receitaLiquida > 0 ? ((lucroOperacional / receitaLiquida) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar DRE' });
  }
});

// =========================================================
//  PREVISAO DE FLUXO DE CAIXA (30/60/90 dias)
// =========================================================
router.get('/fluxo-projetado', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const hoje = new Date();
    const dias = parseInt(req.query.dias) || 90;
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + dias);
    const limiteStr = limite.toISOString().split('T')[0];
    const hojeStr = hoje.toISOString().split('T')[0];

    // Contas a pagar pendentes futuras
    const pagar = await ContaPagar.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['pendente', 'vencido'] },
        data_vencimento: { [Op.between]: [hojeStr, limiteStr] }
      },
      order: [['data_vencimento', 'ASC']]
    });

    // Contas a receber pendentes futuras
    const receber = await ContaReceber.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['pendente', 'vencido'] },
        data_vencimento: { [Op.between]: [hojeStr, limiteStr] }
      },
      order: [['data_vencimento', 'ASC']]
    });

    // Projecao por periodo (30, 60, 90 dias)
    const projecao = [];
    for (let i = 30; i <= dias; i += 30) {
      const dLimite = new Date(hoje);
      dLimite.setDate(dLimite.getDate() + i);
      const dStr = dLimite.toISOString().split('T')[0];

      const entradas = receber.filter(c => c.data_vencimento <= dStr)
        .reduce((s, c) => s + parseFloat(c.valor), 0);
      const saidas = pagar.filter(c => c.data_vencimento <= dStr)
        .reduce((s, c) => s + parseFloat(c.valor), 0);

      projecao.push({
        periodo: i + ' dias',
        data_limite: dStr,
        entradas_previstas: entradas,
        saidas_previstas: saidas,
        saldo_projetado: entradas - saidas
      });
    }

    // Fluxo diario detalhado
    const fluxoDiario = {};
    pagar.forEach(c => {
      const d = c.data_vencimento;
      if (!fluxoDiario[d]) fluxoDiario[d] = { entradas: 0, saidas: 0 };
      fluxoDiario[d].saidas += parseFloat(c.valor);
    });
    receber.forEach(c => {
      const d = c.data_vencimento;
      if (!fluxoDiario[d]) fluxoDiario[d] = { entradas: 0, saidas: 0 };
      fluxoDiario[d].entradas += parseFloat(c.valor);
    });

    res.json({
      periodo: { inicio: hojeStr, fim: limiteStr, dias },
      projecao,
      total_pagar: pagar.reduce((s, c) => s + parseFloat(c.valor), 0),
      total_receber: receber.reduce((s, c) => s + parseFloat(c.valor), 0),
      fluxo_diario: fluxoDiario
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar previsao de fluxo' });
  }
});

module.exports = router;
