/* ══════════════════════════════════════════════════════════════
   SGC — Dashboard v2.0
   Métricas avançadas: margem, curva ABC, crescimento,
   alertas por segmento (mercado|drogaria), metas
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Venda, VendaItem, Produto, ContaPagar, ContaReceber, Caixa, Meta, MedicamentoControlado, Fornecedor, Cliente } = require('../models');
const { auth, perfil } = require('../middleware/auth');
const { getFeatures } = require('../config/features');

// ─────────────────────────────────────────────
//  GET /  —  Dashboard principal (completo)
//  Restrito a administrador e gerente
// ─────────────────────────────────────────────
router.get('/', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const hojeStr = hoje.toISOString().split('T')[0];

    const tipo_negocio = req.empresa?.tipo_negocio || 'mercado';
    const features = getFeatures(tipo_negocio);

    // ── VENDAS DO DIA ──
    const vendasHoje = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.between]: [inicioHoje, fimHoje] }
      }
    });

    const faturamentoHoje = vendasHoje.reduce((s, v) => s + parseFloat(v.total), 0);
    const custoHoje = vendasHoje.reduce((s, v) => s + parseFloat(v.custo_total || 0), 0);
    const lucroHoje = vendasHoje.reduce((s, v) => s + parseFloat(v.lucro_estimado || 0), 0);
    const ticketMedio = vendasHoje.length > 0 ? faturamentoHoje / vendasHoje.length : 0;

    // ── VENDAS DO MÊS ──
    const vendasMes = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.gte]: inicioMes }
      }
    });
    const faturamentoMes = vendasMes.reduce((s, v) => s + parseFloat(v.total), 0);
    const custoMes = vendasMes.reduce((s, v) => s + parseFloat(v.custo_total || 0), 0);
    const lucroMes = vendasMes.reduce((s, v) => s + parseFloat(v.lucro_estimado || 0), 0);
    const margemMes = faturamentoMes > 0 ? ((lucroMes / faturamentoMes) * 100).toFixed(1) : 0;

    // ── CRESCIMENTO (comparar com mês anterior) ──
    const mesAnteriorInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const mesAnteriorFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
    const vendasMesAnterior = await Venda.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.between]: [mesAnteriorInicio, mesAnteriorFim] }
      },
      attributes: ['total']
    });
    const faturamentoMesAnterior = vendasMesAnterior.reduce((s, v) => s + parseFloat(v.total), 0);
    const crescimento = faturamentoMesAnterior > 0 
      ? (((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100).toFixed(1) 
      : 0;

    // ── PRODUTOS MAIS VENDIDOS (mês) ──
    const itensVendidos = await VendaItem.findAll({
      attributes: [
        'produto_nome', 'produto_id',
        [fn('SUM', col('VendaItem.quantidade')), 'total_vendido'],
        [fn('SUM', col('VendaItem.subtotal')), 'total_faturado']
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
      group: ['produto_nome', 'produto_id'],
      order: [[fn('SUM', col('VendaItem.subtotal')), 'DESC']],
      limit: 10
    });

    // ── ESTOQUE CRÍTICO ──
    const todosProdutos = await Produto.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      attributes: ['id', 'nome', 'estoque_atual', 'estoque_minimo', 'estoque_maximo', 'preco_venda', 'preco_custo', 'curva_abc', 'validade']
    });
    const estoqueCritico = todosProdutos.filter(p => 
      parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo) && parseFloat(p.estoque_minimo) > 0
    ).length;

    // ── PRODUTOS VENCENDO (30 dias) ──
    const limite30 = new Date();
    limite30.setDate(limite30.getDate() + 30);
    const produtosVencendo = await Produto.count({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        validade: { [Op.between]: [hojeStr, limite30.toISOString().split('T')[0]] }
      }
    });

    // ── CONTAS ──
    const limite7 = new Date();
    limite7.setDate(limite7.getDate() + 7);
    const contasVencendo = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'pendente',
        data_vencimento: { [Op.between]: [hojeStr, limite7.toISOString().split('T')[0]] }
      }
    });
    const contasVencidas = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'pendente',
        data_vencimento: { [Op.lt]: hojeStr }
      }
    });
    const recebiveis = await ContaReceber.findAll({
      where: { empresa_id: req.empresa_id, status: 'pendente' },
      attributes: ['valor']
    });
    const totalReceber = recebiveis.reduce((s, c) => s + parseFloat(c.valor), 0);
    const totalPagar = await ContaPagar.sum('valor', {
      where: { empresa_id: req.empresa_id, status: 'pendente' }
    }) || 0;

    // ── CURVA ABC (estoque) ──
    const curvaABC = {
      A: todosProdutos.filter(p => p.curva_abc === 'A').length,
      B: todosProdutos.filter(p => p.curva_abc === 'B').length,
      C: todosProdutos.filter(p => p.curva_abc === 'C').length
    };

    // ── TOTAL CLIENTES ──
    const totalClientes = await Cliente.count({
      where: { empresa_id: req.empresa_id, ativo: true }
    });

    // ── DADOS POR FORMA DE PAGAMENTO (hoje) ──
    const pagamentosHoje = {
      dinheiro: vendasHoje.reduce((s, v) => s + parseFloat(v.valor_dinheiro || 0), 0),
      pix: vendasHoje.reduce((s, v) => s + parseFloat(v.valor_pix || 0), 0),
      debito: vendasHoje.reduce((s, v) => s + parseFloat(v.valor_debito || 0), 0),
      credito: vendasHoje.reduce((s, v) => s + parseFloat(v.valor_credito || 0), 0)
    };

    // ── MONTAR RESPOSTA ──
    const response = {
      // Básico
      faturamento_hoje: faturamentoHoje,
      vendas_hoje: vendasHoje.length,
      ticket_medio: ticketMedio,
      faturamento_mes: faturamentoMes,
      vendas_mes: vendasMes.length,
      // Lucro & margem
      custo_hoje: custoHoje,
      lucro_hoje: lucroHoje,
      custo_mes: custoMes,
      lucro_mes: lucroMes,
      margem_mes: parseFloat(margemMes),
      crescimento: parseFloat(crescimento),
      // Pagamentos
      pagamentos_hoje: pagamentosHoje,
      // Produtos
      produtos_mais_vendidos: itensVendidos,
      estoque_critico: estoqueCritico,
      produtos_vencendo: produtosVencendo,
      total_produtos: todosProdutos.length,
      curva_abc: curvaABC,
      // Financeiro
      contas_vencendo: contasVencendo,
      contas_vencidas: contasVencidas,
      total_receber: totalReceber,
      total_pagar: totalPagar,
      // Clientes
      total_clientes: totalClientes,
      // Meta
      tipo_negocio,
      features: features.modulos
    };

    // ── DADOS ESPECÍFICOS DROGARIA ──
    if (tipo_negocio === 'drogaria') {
      try {
        const sngpcPendentes = await MedicamentoControlado.count({
          where: { empresa_id: req.empresa_id, exportado_sngpc: false }
        });
        response.sngpc_pendentes = sngpcPendentes;

        // Controlados vendidos hoje
        const controladosHoje = await MedicamentoControlado.count({
          where: { empresa_id: req.empresa_id, data_venda: hojeStr }
        });
        response.controlados_hoje = controladosHoje;
      } catch (e) {
        // Se tabela não existir ainda, ok
        response.sngpc_pendentes = 0;
        response.controlados_hoje = 0;
      }
    }

    // ── META ATIVA ──
    try {
      const metaAtiva = await Meta.findOne({
        where: {
          empresa_id: req.empresa_id,
          ativo: true,
          data_inicio: { [Op.lte]: hojeStr },
          data_fim: { [Op.gte]: hojeStr }
        },
        order: [['created_at', 'DESC']]
      });
      if (metaAtiva) {
        response.meta = {
          tipo: metaAtiva.tipo,
          valor_meta: parseFloat(metaAtiva.valor_meta),
          valor_atual: metaAtiva.tipo === 'faturamento' ? faturamentoMes : vendasMes.length,
          percentual: metaAtiva.tipo === 'faturamento' 
            ? ((faturamentoMes / parseFloat(metaAtiva.valor_meta)) * 100).toFixed(1)
            : ((vendasMes.length / parseFloat(metaAtiva.valor_meta)) * 100).toFixed(1)
        };
      }
    } catch (e) {
      // Meta não obrigatória
    }

    res.json(response);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// ──────────────────────────────────────────────
//  GET /vendas-por-dia  —  Gráfico de vendas (últimos 30 dias)
// ──────────────────────────────────────────────
router.get('/vendas-por-dia', auth, async (req, res) => {
  try {
    const dias = parseInt(req.query.dias || 30);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);

    const vendas = await Venda.findAll({
      attributes: [
        [fn('DATE', col('created_at')), 'data'],
        [fn('COUNT', col('id')), 'total_vendas'],
        [fn('SUM', col('total')), 'faturamento'],
        [fn('SUM', col('lucro_estimado')), 'lucro']
      ],
      where: {
        empresa_id: req.empresa_id,
        status: 'finalizada',
        created_at: { [Op.gte]: inicio }
      },
      group: [fn('DATE', col('created_at'))],
      order: [[fn('DATE', col('created_at')), 'ASC']],
      raw: true
    });

    res.json(vendas);
  } catch (err) {
    console.error('Erro vendas por dia:', err);
    res.status(500).json({ error: 'Erro ao buscar vendas por dia' });
  }
});

// ──────────────────────────────────────────────
//  GET /ranking-fornecedores  —  Top fornecedores
// ──────────────────────────────────────────────
router.get('/ranking-fornecedores', auth, async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      attributes: ['id', 'nome', 'ranking', 'prazo_medio_entrega', 'total_compras', 'quantidade_compras', 'ultima_compra'],
      order: [['ranking', 'DESC'], ['total_compras', 'DESC']],
      limit: 10
    });
    res.json(fornecedores);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ranking de fornecedores' });
  }
});

module.exports = router;
