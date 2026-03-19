/* ══════════════════════════════════════════════════════════════
   SngpcAuditoriaService — Auditoria Regulatória Fase 3
   
   Responsabilidades:
     ✔ Registrar toda ação regulatória em log permanente
     ✔ Nunca permitir exclusão de logs
     ✔ Rastreabilidade completa: quem, quando, o quê 
   
   Ações rastreadas:
     ABRIR_PERIODO, FECHAR_PERIODO, GERAR_ARQUIVO,
     TRANSMITIR, REJEITAR, CANCELAR,
     MOVIMENTACAO, VALIDAR_INTEGRIDADE
   ══════════════════════════════════════════════════════════════ */

const { SngpcAuditoria } = require('../models');
const { logger } = require('../config/logger');

class SngpcAuditoriaService {

  /**
   * Registrar ação no log de auditoria regulatória
   * @param {Object} dados - { empresa_id, periodo_id, acao, dados_anteriores, dados_novos, usuario_id, usuario_nome, ip_address, detalhes }
   */
  static async registrar(dados) {
    try {
      const registro = await SngpcAuditoria.create({
        empresa_id: dados.empresa_id,
        periodo_id: dados.periodo_id || null,
        acao: dados.acao,
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: dados.dados_novos || null,
        usuario_id: dados.usuario_id,
        usuario_nome: dados.usuario_nome || null,
        ip_address: dados.ip_address || null,
        detalhes: dados.detalhes || null,
        timestamp: new Date()
      });
      return registro;
    } catch (error) {
      // Auditoria nunca deve impedir a operação principal
      logger.error('Falha ao registrar auditoria SNGPC:', { message: error.message, dados });
      return null;
    }
  }

  /**
   * Consultar logs de auditoria
   */
  static async consultar({ empresa_id, periodo_id, acao, limit, offset }) {
    const where = { empresa_id };
    if (periodo_id) where.periodo_id = periodo_id;
    if (acao) where.acao = acao;

    const { count, rows } = await SngpcAuditoria.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: limit || 50,
      offset: offset || 0
    });

    return { total: count, registros: rows };
  }
}

module.exports = SngpcAuditoriaService;
