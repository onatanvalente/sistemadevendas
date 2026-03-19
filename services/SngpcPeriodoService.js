/* ══════════════════════════════════════════════════════════════
   SngpcPeriodoService — Gestão de Períodos SNGPC Fase 2
   
   Responsabilidades:
     ✔ Abrir período (com validação de sobreposição)
     ✔ Fechar período (com hash SHA-256 de integridade)
     ✔ Transmitir período (marcar como transmitido)
     ✔ Cancelar período (somente se ABERTO e sem movimentações)
     ✔ Bloqueios imutáveis (FECHADO/TRANSMITIDO → sem alteração)
   
   Regras de estado:
     ABERTO      → Permite movimentar/editar/excluir
     FECHADO     → ❌ INSERT/UPDATE/DELETE bloqueados
     TRANSMITIDO → ❌ Imutabilidade total
     CANCELADO   → ❌ INSERT/UPDATE/DELETE bloqueados
   ══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { Op, Transaction } = require('sequelize');
const {
  sequelize, SngpcPeriodo, SngpcMovimentacao, SngpcEstoque,
  Produto, Lote, Usuario
} = require('../models');
const { logger } = require('../config/logger');

class SngpcPeriodoService {

  // ══════════════════════════════════════════
  //  ABRIR PERÍODO
  // ══════════════════════════════════════════
  static async abrirPeriodo({ empresa_id, data_inicio, data_fim, usuario_id }) {
    if (!data_inicio || !data_fim) {
      throw new Error('Data de início e fim são obrigatórias');
    }
    if (data_inicio >= data_fim) {
      throw new Error('Data de início deve ser anterior à data fim');
    }

    return sequelize.transaction(async (t) => {
      // Verificar se há período aberto
      const aberto = await SngpcPeriodo.findOne({
        where: { empresa_id, status: 'aberto' },
        transaction: t
      });
      if (aberto) {
        throw new Error('Já existe um período aberto (' + aberto.data_inicio + ' a ' + aberto.data_fim + '). Feche-o antes de criar outro.');
      }

      // Verificar sobreposição com qualquer período (exceto cancelados)
      const sobreposicao = await SngpcPeriodo.findOne({
        where: {
          empresa_id,
          status: { [Op.ne]: 'cancelado' },
          [Op.or]: [
            { data_inicio: { [Op.between]: [data_inicio, data_fim] } },
            { data_fim: { [Op.between]: [data_inicio, data_fim] } },
            { [Op.and]: [{ data_inicio: { [Op.lte]: data_inicio } }, { data_fim: { [Op.gte]: data_fim } }] }
          ]
        },
        transaction: t
      });
      if (sobreposicao) {
        throw new Error('Período sobrepõe um período existente: ' + sobreposicao.data_inicio + ' a ' + sobreposicao.data_fim);
      }

      const periodo = await SngpcPeriodo.create({
        empresa_id, data_inicio, data_fim, status: 'aberto'
      }, { transaction: t });

      return periodo;
    });
  }

  // ══════════════════════════════════════════
  //  FECHAR PERÍODO (com hash de integridade)
  // ══════════════════════════════════════════
  static async fecharPeriodo({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!periodo) throw new Error('Período não encontrado');
      if (periodo.status !== 'aberto') {
        throw new Error('Apenas períodos ABERTOS podem ser fechados. Status atual: ' + periodo.status.toUpperCase());
      }

      // 1. Validar que existe pelo menos 1 movimentação
      const movimentacoes = await SngpcMovimentacao.findAll({
        where: {
          empresa_id,
          periodo_id: periodo.id
        },
        order: [['data_movimentacao', 'ASC'], ['id', 'ASC']],
        transaction: t
      });

      if (movimentacoes.length === 0) {
        throw new Error('Não é possível fechar período sem movimentações');
      }

      // 2. Calcular saldo final (para registro)
      const saldos = await SngpcEstoque.findAll({
        where: { empresa_id },
        transaction: t
      });

      // 3. Gerar hash SHA-256 das movimentações ordenadas
      const dadosHash = movimentacoes.map(m => ({
        id: m.id,
        tipo: m.tipo,
        produto_id: m.produto_id,
        lote_id: m.lote_id,
        quantidade: m.quantidade.toString(),
        data_movimentacao: m.data_movimentacao,
        hash_integridade: m.hash_integridade
      }));

      const hashPeriodo = crypto
        .createHash('sha256')
        .update(JSON.stringify(dadosHash))
        .digest('hex');

      // 4. Atualizar período
      await periodo.update({
        status: 'fechado',
        data_fechamento: new Date(),
        hash_integridade: hashPeriodo,
        usuario_fechamento: usuario_id,
        fechado_por: usuario_id,
        fechado_em: new Date()
      }, { transaction: t });

      return {
        periodo: periodo.toJSON(),
        hash_integridade: hashPeriodo,
        total_movimentacoes: movimentacoes.length,
        saldos_regulatorios: saldos.length
      };
    });
  }

  // ══════════════════════════════════════════
  //  TRANSMITIR PERÍODO
  // ══════════════════════════════════════════
  static async transmitirPeriodo({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction(async (t) => {
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!periodo) throw new Error('Período não encontrado');
      if (periodo.status !== 'fechado') {
        throw new Error('Apenas períodos FECHADOS podem ser transmitidos. Status atual: ' + periodo.status.toUpperCase());
      }

      // Marcar movimentações como transmitidas ANTES de mudar status do período
      // (trigger bloqueia UPDATE em movimentações de período TRANSMITIDO)
      await SngpcMovimentacao.update(
        { transmitido: true },
        {
          where: { empresa_id, periodo_id: periodo.id },
          transaction: t
        }
      );

      await periodo.update({ status: 'transmitido' }, { transaction: t });

      return periodo;
    });
  }

  // ══════════════════════════════════════════
  //  CANCELAR PERÍODO
  // ══════════════════════════════════════════
  static async cancelarPeriodo({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction(async (t) => {
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!periodo) throw new Error('Período não encontrado');
      if (periodo.status !== 'aberto') {
        throw new Error('Apenas períodos ABERTOS podem ser cancelados. Status atual: ' + periodo.status.toUpperCase());
      }

      // Verificar se tem movimentações
      const count = await SngpcMovimentacao.count({
        where: { empresa_id, periodo_id: periodo.id },
        transaction: t
      });
      if (count > 0) {
        throw new Error('Período possui ' + count + ' movimentações. Não pode ser cancelado.');
      }

      await periodo.update({ status: 'cancelado' }, { transaction: t });
      return periodo;
    });
  }

  // ══════════════════════════════════════════
  //  VERIFICAR BLOQUEIO (helper público)
  // ══════════════════════════════════════════
  static async verificarBloqueio(empresa_id, periodo_id, transaction) {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: periodo_id, empresa_id },
      transaction
    });

    if (!periodo) throw new Error('Período não encontrado');

    if (['fechado', 'transmitido', 'cancelado'].includes(periodo.status)) {
      throw new Error('Período está ' + periodo.status.toUpperCase() + '. Nenhuma alteração permitida.');
    }

    return periodo;
  }

  // ══════════════════════════════════════════
  //  VALIDAR HASH DE INTEGRIDADE
  // ══════════════════════════════════════════
  static async validarIntegridade(empresa_id, periodo_id) {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: periodo_id, empresa_id }
    });

    if (!periodo) throw new Error('Período não encontrado');
    if (!periodo.hash_integridade) {
      return { valido: false, motivo: 'Período não possui hash de integridade (não foi fechado)' };
    }

    const movimentacoes = await SngpcMovimentacao.findAll({
      where: { empresa_id, periodo_id: periodo.id },
      order: [['data_movimentacao', 'ASC'], ['id', 'ASC']]
    });

    const dadosHash = movimentacoes.map(m => ({
      id: m.id,
      tipo: m.tipo,
      produto_id: m.produto_id,
      lote_id: m.lote_id,
      quantidade: m.quantidade.toString(),
      data_movimentacao: m.data_movimentacao,
      hash_integridade: m.hash_integridade
    }));

    const hashRecalculado = crypto
      .createHash('sha256')
      .update(JSON.stringify(dadosHash))
      .digest('hex');

    return {
      valido: hashRecalculado === periodo.hash_integridade,
      hash_armazenado: periodo.hash_integridade,
      hash_recalculado: hashRecalculado,
      total_movimentacoes: movimentacoes.length
    };
  }
}

module.exports = SngpcPeriodoService;
