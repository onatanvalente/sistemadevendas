/* ══════════════════════════════════════════════════════════════
   SngpcTransmissaoService — Controle de Transmissão Fase 3
   
   Responsabilidades:
     ✔ Registrar transmissão (protocolo ÚNICO)
     ✔ Atualizar status de transmissão (PENDENTE→ACEITO/REJEITADO)
     ✔ Cancelar transmissão
     ✔ Rejeição: período volta para FECHADO, permite nova geração
     ✔ Imutabilidade pós-transmissão (ACEITO)
     ✔ Transaction SERIALIZABLE
   
   Status possíveis: PENDENTE → ACEITO | REJEITADO | CANCELADO
   
   Regras:
     🚨 período.status DEVE ser FECHADO para transmitir
     🚨 Arquivo já gerado obrigatório
     🚨 Não pode existir transmissão ACEITA anterior
     🚨 Protocolo é UNIQUE
     🚨 REJEITADO → período volta para FECHADO
   ══════════════════════════════════════════════════════════════ */

const { Op, Transaction } = require('sequelize');
const {
  sequelize, SngpcPeriodo, SngpcMovimentacao, SngpcTransmissao,
  SngpcArquivo, SngpcAuditoria
} = require('../models');
const { logger } = require('../config/logger');

class SngpcTransmissaoService {

  // ══════════════════════════════════════════
  //  REGISTRAR TRANSMISSÃO
  // ══════════════════════════════════════════
  static async registrarTransmissao({ empresa_id, periodo_id, protocolo, usuario_id }) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // 1. Validar período
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      if (!periodo) throw new Error('Período não encontrado');
      if (periodo.status !== 'fechado') {
        throw new Error('Apenas períodos FECHADOS podem ser transmitidos. Status atual: ' + periodo.status.toUpperCase());
      }

      // 2. Arquivo já gerado?
      const arquivo = await SngpcArquivo.findOne({
        where: { periodo_id, empresa_id },
        transaction: t
      });
      if (!arquivo) {
        throw new Error('Arquivo SNGPC não gerado para este período. Gere o arquivo antes de transmitir.');
      }

      // 3. Não pode existir transmissão ACEITA anterior para este período
      const aceita = await SngpcTransmissao.findOne({
        where: {
          periodo_id,
          empresa_id,
          status: 'aceito'
        },
        transaction: t
      });
      if (aceita) {
        throw new Error('Já existe transmissão ACEITA para este período (protocolo: ' + aceita.protocolo_anvisa + ')');
      }

      // 4. Protocolo deve ser único
      if (protocolo) {
        const protocoloDup = await SngpcTransmissao.findOne({
          where: { empresa_id, protocolo_anvisa: protocolo },
          transaction: t
        });
        if (protocoloDup) {
          throw new Error('Protocolo ' + protocolo + ' já está registrado em outra transmissão');
        }
      }

      // 5. Criar transmissão
      const transmissao = await SngpcTransmissao.create({
        empresa_id,
        periodo_id,
        status: 'enviado',
        protocolo_anvisa: protocolo || null,
        data_envio: new Date(),
        gerado_por: usuario_id,
        enviado_por: usuario_id,
        arquivo_xml_path: arquivo.nome_arquivo
      }, { transaction: t });

      // 6. Marcar movimentações como transmitidas ANTES de mudar status do período
      //    (trigger bloqueia UPDATE em movimentações de período TRANSMITIDO)
      await SngpcMovimentacao.update(
        { transmitido: true, transmissao_id: transmissao.id },
        {
          where: { empresa_id, periodo_id },
          transaction: t
        }
      );

      // 7. Atualizar período para TRANSMITIDO (após movimentações atualizadas)
      await periodo.update({ status: 'transmitido' }, { transaction: t });

      return { transmissao };
    });
  }

  // ══════════════════════════════════════════
  //  ATUALIZAR STATUS DA TRANSMISSÃO
  // ══════════════════════════════════════════
  static async atualizarStatusTransmissao({ empresa_id, transmissao_id, status, mensagem, usuario_id }) {
    const statusPermitidos = ['aceito', 'rejeitado'];
    if (!statusPermitidos.includes(status)) {
      throw new Error('Status inválido. Permitidos: ' + statusPermitidos.join(', '));
    }

    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      const transmissao = await SngpcTransmissao.findOne({
        where: { id: transmissao_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      if (!transmissao) throw new Error('Transmissão não encontrada');

      if (transmissao.status !== 'enviado' && transmissao.status !== 'gerado') {
        throw new Error('Transmissão já possui status definitivo: ' + transmissao.status.toUpperCase());
      }

      const periodo = await SngpcPeriodo.findOne({
        where: { id: transmissao.periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      // Atualizar transmissão
      await transmissao.update({
        status,
        data_retorno: new Date(),
        mensagem_retorno: mensagem || null
      }, { transaction: t });

      if (status === 'rejeitado') {
        // REJEIÇÃO: período volta para FECHADO
        if (periodo) {
          await periodo.update({ status: 'fechado' }, { transaction: t });
        }

        // Desmarcar movimentações como não transmitidas
        await SngpcMovimentacao.update(
          { transmitido: false, transmissao_id: null },
          {
            where: { empresa_id, periodo_id: transmissao.periodo_id },
            transaction: t
          }
        );

        // Deletar arquivo para permitir regeneração
        await SngpcArquivo.destroy({
          where: { periodo_id: transmissao.periodo_id, empresa_id },
          transaction: t
        });
      }

      // Se aceito, período permanece TRANSMITIDO (imutabilidade garantida)

      return { transmissao };
    });
  }

  // ══════════════════════════════════════════
  //  CANCELAR TRANSMISSÃO
  // ══════════════════════════════════════════
  static async cancelarTransmissao({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // Buscar última transmissão do período
      const transmissao = await SngpcTransmissao.findOne({
        where: { periodo_id, empresa_id, status: { [Op.in]: ['enviado', 'gerado'] } },
        order: [['id', 'DESC']],
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!transmissao) {
        throw new Error('Nenhuma transmissão pendente encontrada para este período');
      }

      // Atualizar status
      await transmissao.update({
        status: 'rejeitado',
        mensagem_retorno: 'Cancelado pelo usuário',
        data_retorno: new Date()
      }, { transaction: t });

      // Período volta para FECHADO
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        lock: t.LOCK.UPDATE,
        transaction: t
      });
      if (periodo && periodo.status === 'transmitido') {
        await periodo.update({ status: 'fechado' }, { transaction: t });
      }

      // Desmarcar movimentações
      await SngpcMovimentacao.update(
        { transmitido: false, transmissao_id: null },
        {
          where: { empresa_id, periodo_id },
          transaction: t
        }
      );

      return { transmissao };
    });
  }

  // ══════════════════════════════════════════
  //  VERIFICAR IMUTABILIDADE PÓS-TRANSMISSÃO
  //  Retorna true se período está ACEITO (imutável definitivo)
  // ══════════════════════════════════════════
  static async verificarImutabilidadeDefinitiva(empresa_id, periodo_id, transaction) {
    const transmissaoAceita = await SngpcTransmissao.findOne({
      where: {
        empresa_id,
        periodo_id,
        status: 'aceito'
      },
      transaction
    });

    return !!transmissaoAceita;
  }
}

module.exports = SngpcTransmissaoService;
