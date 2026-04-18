/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Middleware de Auditoria (Audit Log)
   Registra todas as ações relevantes no sistema
   ══════════════════════════════════════════════════════════════ */

const { AuditLog } = require('../models');

/**
 * Registra ação no audit log
 * Pode ser chamado diretamente em qualquer route handler
 */
async function registrarAudit({
  empresa_id,
  usuario_id,
  usuario_nome,
  acao,
  tabela,
  registro_id,
  dados_anteriores,
  dados_novos,
  descricao,
  ip,
  user_agent
}) {
  try {
    await AuditLog.create({
      empresa_id,
      usuario_id,
      usuario_nome,
      acao,
      tabela,
      registro_id,
      dados_anteriores: dados_anteriores || null,
      dados_novos: dados_novos || null,
      descricao,
      ip,
      user_agent
    });
  } catch (err) {
    // Audit log nunca deve impedir o fluxo principal
    console.error('[AuditLog] Erro ao registrar:', err.message);
  }
}

/**
 * Middleware Express que captura informações da request
 * e anexa helper de audit no req
 * Uso: app.use(auditMiddleware) — antes das rotas
 */
function auditMiddleware(req, res, next) {
  // Extrai IP real (considerando proxy reverso)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.connection?.remoteAddress 
    || req.ip;
  
  /**
   * Helper p/ registrar audit de dentro dos route handlers
   * Uso: await req.audit('criar', 'produtos', produto.id, null, produto.toJSON(), 'Produto criado')
   */
  req.audit = async (acao, tabela, registro_id, dados_anteriores, dados_novos, descricao) => {
    await registrarAudit({
      empresa_id: req.usuario?.empresa_id,
      usuario_id: req.usuario?.id,
      usuario_nome: req.usuario?.nome,
      acao,
      tabela,
      registro_id,
      dados_anteriores,
      dados_novos,
      descricao,
      ip,
      user_agent: req.headers['user-agent']
    });
  };

  next();
}

/**
 * Middleware factory p/ auto-auditar operações CUD em rotas REST.
 * Intercepta res.json para capturar o dado retornado.
 * Uso: router.post('/', autoAudit('criar', 'produtos'), async (req, res) => { ... })
 */
function autoAudit(acao, tabela) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Só registra em respostas de sucesso (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const registro_id = data?.id || data?.data?.id;
        registrarAudit({
          empresa_id: req.usuario?.empresa_id,
          usuario_id: req.usuario?.id,
          usuario_nome: req.usuario?.nome,
          acao,
          tabela,
          registro_id,
          dados_anteriores: acao === 'editar' ? req._dadosAnteriores : null,
          dados_novos: acao !== 'excluir' ? (data?.data || data) : null,
          descricao: `${acao} em ${tabela}`,
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          user_agent: req.headers['user-agent']
        });
      }
      return originalJson(data);
    };

    next();
  };
}

module.exports = { registrarAudit, auditMiddleware, autoAudit };
