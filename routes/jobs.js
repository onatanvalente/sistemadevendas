const router = require('express').Router();
const { Op } = require('sequelize');
const { ContaPagar, ContaReceber, Lote, Produto, sequelize } = require('../models');
const { auth, perfil } = require('../middleware/auth');
const { logger } = require('../config/logger');

// =========================================================
//  JOB: Marcar contas vencidas automaticamente
//  Pode ser chamado por scheduler externo ou manualmente
// =========================================================
router.post('/vencimentos', auth, perfil('administrador'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const hoje = new Date().toISOString().split('T')[0];

    // Contas a pagar vencidas
    const [pagarCount] = await ContaPagar.update(
      { status: 'vencido' },
      {
        where: {
          empresa_id: req.empresa_id,
          status: 'pendente',
          data_vencimento: { [Op.lt]: hoje }
        },
        transaction: t
      }
    );

    // Contas a receber vencidas
    const [receberCount] = await ContaReceber.update(
      { status: 'vencido' },
      {
        where: {
          empresa_id: req.empresa_id,
          status: 'pendente',
          data_vencimento: { [Op.lt]: hoje }
        },
        transaction: t
      }
    );

    // Lotes vencidos
    const [lotesCount] = await Lote.update(
      { status: 'VENCIDO' },
      {
        where: {
          empresa_id: req.empresa_id,
          status: 'ATIVO',
          validade: { [Op.lt]: hoje }
        },
        transaction: t
      }
    );

    await t.commit();

    logger.info('Job vencimentos executado', {
      empresa_id: req.empresa_id,
      contas_pagar_vencidas: pagarCount,
      contas_receber_vencidas: receberCount,
      lotes_vencidos: lotesCount
    });

    res.json({
      message: 'Vencimentos processados',
      resultado: {
        contas_pagar_vencidas: pagarCount,
        contas_receber_vencidas: receberCount,
        lotes_vencidos: lotesCount
      }
    });
  } catch (error) {
    await t.rollback();
    logger.error('Erro no job de vencimentos', { error: error.message });
    res.status(500).json({ error: 'Erro ao processar vencimentos' });
  }
});

// =========================================================
//  JOB: Gerar contas recorrentes
//  Ao quitar uma conta com recorrente=true, gera a proxima
// =========================================================
router.post('/recorrentes', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Busca contas recorrentes que foram pagas mas nao geraram proxima
    const contasPagas = await ContaPagar.findAll({
      where: {
        empresa_id: req.empresa_id,
        status: 'pago',
        recorrente: true
      },
      transaction: t
    });

    let geradas = 0;
    for (const conta of contasPagas) {
      // Verificar se ja existe proxima conta com mesma descricao e vencimento futuro
      const proximoVencimento = calcularProximoVencimento(conta.data_vencimento, conta.periodo_recorrencia);

      const jaExiste = await ContaPagar.findOne({
        where: {
          empresa_id: req.empresa_id,
          descricao: conta.descricao,
          data_vencimento: proximoVencimento,
          status: { [Op.ne]: 'cancelado' }
        },
        transaction: t
      });

      if (!jaExiste) {
        await ContaPagar.create({
          empresa_id: req.empresa_id,
          descricao: conta.descricao,
          fornecedor_id: conta.fornecedor_id,
          centro_custo_id: conta.centro_custo_id,
          conta_bancaria_id: conta.conta_bancaria_id,
          valor: conta.valor,
          data_vencimento: proximoVencimento,
          forma_pagamento: conta.forma_pagamento,
          categoria: conta.categoria,
          recorrente: true,
          periodo_recorrencia: conta.periodo_recorrencia,
          observacoes: conta.observacoes,
          usuario_id: req.usuario.id
        }, { transaction: t });
        geradas++;
      }
    }

    await t.commit();

    res.json({
      message: 'Contas recorrentes processadas',
      resultado: {
        contas_verificadas: contasPagas.length,
        novas_geradas: geradas
      }
    });
  } catch (error) {
    await t.rollback();
    logger.error('Erro no job de recorrentes', { error: error.message });
    res.status(500).json({ error: 'Erro ao processar contas recorrentes' });
  }
});

// =========================================================
//  JOB: Alertas de vencimento proximo
// =========================================================
router.get('/alertas', auth, async (req, res) => {
  try {
    const hoje = new Date();
    const em30dias = new Date(hoje);
    em30dias.setDate(em30dias.getDate() + 30);
    const hojeStr = hoje.toISOString().split('T')[0];
    const em30Str = em30dias.toISOString().split('T')[0];

    // Contas a pagar vencendo em 7 dias
    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);
    const em7Str = em7dias.toISOString().split('T')[0];

    const contasVencendo = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'pendente',
        data_vencimento: { [Op.between]: [hojeStr, em7Str] }
      }
    });

    // Contas ja vencidas
    const contasVencidas = await ContaPagar.count({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['pendente', 'vencido'] },
        data_vencimento: { [Op.lt]: hojeStr }
      }
    });

    // Lotes vencendo em 30 dias
    const lotesVencendo = await Lote.count({
      where: {
        empresa_id: req.empresa_id,
        status: 'ATIVO',
        validade: { [Op.between]: [hojeStr, em30Str] }
      }
    });

    // Produtos com estoque critico
    const estoqueCritico = await Produto.count({
      where: {
        empresa_id: req.empresa_id,
        ativo: true,
        estoque_minimo: { [Op.gt]: 0 },
        estoque_atual: { [Op.lte]: sequelize.col('estoque_minimo') }
      }
    });

    // Contas a receber vencidas
    const receberVencidas = await ContaReceber.count({
      where: {
        empresa_id: req.empresa_id,
        status: { [Op.in]: ['pendente', 'vencido'] },
        data_vencimento: { [Op.lt]: hojeStr }
      }
    });

    res.json({
      alertas: [
        contasVencidas > 0 ? { tipo: 'danger', icone: 'alert-circle', titulo: 'Contas vencidas', mensagem: contasVencidas + ' conta(s) a pagar vencida(s)', link: 'financeiro' } : null,
        contasVencendo > 0 ? { tipo: 'warning', icone: 'clock', titulo: 'Contas vencendo', mensagem: contasVencendo + ' conta(s) vencem nos proximos 7 dias', link: 'financeiro' } : null,
        receberVencidas > 0 ? { tipo: 'warning', icone: 'alert-triangle', titulo: 'Recebimentos atrasados', mensagem: receberVencidas + ' conta(s) a receber vencida(s)', link: 'financeiro' } : null,
        lotesVencendo > 0 ? { tipo: 'warning', icone: 'calendar', titulo: 'Lotes vencendo', mensagem: lotesVencendo + ' lote(s) vencem em 30 dias', link: 'estoque' } : null,
        estoqueCritico > 0 ? { tipo: 'info', icone: 'package', titulo: 'Estoque critico', mensagem: estoqueCritico + ' produto(s) abaixo do minimo', link: 'estoque' } : null
      ].filter(Boolean)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
});

// Helper: calcular proximo vencimento baseado no periodo
function calcularProximoVencimento(dataAtual, periodo) {
  const data = new Date(dataAtual + 'T12:00:00');
  switch (periodo) {
    case 'semanal': data.setDate(data.getDate() + 7); break;
    case 'quinzenal': data.setDate(data.getDate() + 15); break;
    case 'mensal': data.setMonth(data.getMonth() + 1); break;
    case 'bimestral': data.setMonth(data.getMonth() + 2); break;
    case 'trimestral': data.setMonth(data.getMonth() + 3); break;
    case 'semestral': data.setMonth(data.getMonth() + 6); break;
    case 'anual': data.setFullYear(data.getFullYear() + 1); break;
    default: data.setMonth(data.getMonth() + 1); break;
  }
  return data.toISOString().split('T')[0];
}

module.exports = router;
