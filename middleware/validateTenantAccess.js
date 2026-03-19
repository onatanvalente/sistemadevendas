/* ══════════════════════════════════════════════════════════════
   MIDDLEWARE: validateTenantAccess
   Regra Absoluta de Segurança (Doc §4, §6, §7):
   - Toda requisição autenticada deve ter company_id validado
   - Cross-tenant → 404 (nunca 403, nunca revelar existência)
   - Eventos de segurança persistidos no banco (security_logs)
   ══════════════════════════════════════════════════════════════ */

const { SecurityLog } = require('../models');
const { logger } = require('../config/logger');

/**
 * Persiste um evento de segurança no banco de dados.
 * Nunca bloqueia o fluxo principal (erros silenciados).
 */
async function logSecurityEvent({ empresa_id, usuario_id, route, method, ip, user_agent, action, reason, metadata }) {
  try {
    await SecurityLog.create({
      empresa_id: empresa_id || null,
      usuario_id: usuario_id || null,
      route: (route || '').substring(0, 500),
      method: (method || '').substring(0, 10),
      ip: (ip || '').substring(0, 50),
      user_agent: (user_agent || '').substring(0, 500),
      action,
      reason: (reason || '').substring(0, 500),
      metadata: metadata || null
    });
  } catch (err) {
    // Nunca bloquear o fluxo por falha de log
    logger.error('Falha ao persistir security_log', { action, error: err.message });
  }
}

/**
 * Middleware validateTenantAccess()
 * Deve ser usado APÓS auth() em rotas que manipulam recursos por ID.
 * Garante que o recurso acessado pertence ao tenant do token JWT.
 * 
 * Uso como wrapper para verificação:
 *   validateTenantAccess.check(req, resourceEmpresaId) → boolean
 * 
 * Se retorna false, a resposta 404 já foi enviada.
 */
function validateTenantAccess() {
  return (req, res, next) => {
    // auth() já validou JWT e cross-tenant via slug
    // Este middleware adiciona validação extra + logging persistido
    if (!req.empresa_id) {
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
    next();
  };
}

/**
 * Verifica se um recurso pertence ao tenant do usuário autenticado.
 * Retorna false e envia 404 se houver divergência.
 * Persiste o evento de segurança no banco.
 */
validateTenantAccess.check = async function(req, res, resourceEmpresaId) {
  if (resourceEmpresaId && resourceEmpresaId !== req.empresa_id) {
    await logSecurityEvent({
      empresa_id: req.empresa_id,
      usuario_id: req.usuario?.id,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      action: 'cross_tenant_access',
      reason: 'Tentativa de acessar recurso de outro tenant via ID',
      metadata: {
        empresa_token: req.empresa_id,
        empresa_recurso: resourceEmpresaId
      }
    });
    res.status(404).json({ error: 'Recurso não encontrado' });
    return false;
  }
  return true;
};

module.exports = { validateTenantAccess, logSecurityEvent };
