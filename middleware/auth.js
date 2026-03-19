const jwt = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');
const { resolveBySlug } = require('./tenantResolver');
const { logger } = require('../config/logger');
const { logSecurityEvent } = require('./validateTenantAccess');
const { tenantContext } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'sgc_jwt_secret_default';

// ── Helper: extrai o slug do tenant da requisição ──
// Prioridade: 1) header X-Tenant-Slug  2) Referer /app/:slug
function extractTenantSlug(req) {
  // Header explícito (enviado pelo frontend)
  const headerSlug = req.headers['x-tenant-slug'];
  if (headerSlug) return headerSlug.toLowerCase().trim();

  // Fallback: extrair do Referer (navegador envia automaticamente)
  const referer = req.headers.referer || req.headers.referrer || '';
  const match = referer.match(/\/app\/([a-z0-9-]+)/i);
  if (match) return match[1].toLowerCase();

  return null;
}

// Middleware de autenticação via JWT
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const usuario = await Usuario.findByPk(decoded.id, {
      include: [{ model: Empresa, attributes: ['id', 'nome', 'tipo_negocio', 'ativo', 'subdominio'] }]
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    if (!usuario.Empresa || !usuario.Empresa.ativo) {
      return res.status(401).json({ error: 'Empresa inativa' });
    }

    // ── ISOLAMENTO MULTI-TENANT: validar que o token pertence ao tenant da requisição ──
    const slug = extractTenantSlug(req);
    if (slug) {
      const tenantEmpresa = await resolveBySlug(slug);
      if (!tenantEmpresa) {
        return res.status(404).json({ error: 'Recurso não encontrado' });
      }
      if (tenantEmpresa.id !== usuario.empresa_id) {
        // ⚠ Tentativa de acesso cruzado — logar e bloquear com 404 (não revelar existência)
        logger.warn('ALERTA: Tentativa de acesso cross-tenant bloqueada', {
          tipo: 'cross_tenant_access',
          usuario_id: usuario.id,
          usuario_email: usuario.email,
          empresa_usuario: usuario.empresa_id,
          tenant_acessado: slug,
          tenant_acessado_id: tenantEmpresa.id,
          ip: req.ip,
          url: req.originalUrl,
          method: req.method
        });
        // Persistir no banco (security_logs)
        logSecurityEvent({
          empresa_id: usuario.empresa_id,
          usuario_id: usuario.id,
          route: req.originalUrl,
          method: req.method,
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          action: 'cross_tenant_access',
          reason: 'Token de empresa ' + usuario.empresa_id + ' tentou acessar tenant ' + slug,
          metadata: { tenant_slug: slug, tenant_id: tenantEmpresa.id }
        });
        return res.status(404).json({ error: 'Recurso não encontrado' });
      }
    }

    req.usuario = usuario;
    req.empresa_id = usuario.empresa_id;
    req.empresa = usuario.Empresa;

    // ── RLS: propagar empresa_id via AsyncLocalStorage para o hook beforeQuery ──
    tenantContext.run({ empresa_id: usuario.empresa_id }, () => {
      next();
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Middleware para verificar perfil de acesso (RBAC)
function perfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

// Middleware para filtrar por empresa (multi-tenant)
function tenant(req, res, next) {
  if (!req.empresa_id) {
    return res.status(400).json({ error: 'Empresa não identificada' });
  }
  // Adiciona filtro automático de empresa
  req.tenantFilter = { empresa_id: req.empresa_id };
  next();
}

/**
 * Middleware de guarda de tenant (tenantGuard)
 * OBRIGATÓRIO em todas as rotas /api/* de tenant.
 * Exige header X-Tenant-Slug e valida contra o empresa_id do usuário autenticado.
 * Deve ser usado APÓS auth().
 */
async function tenantGuard(req, res, next) {
  const slug = extractTenantSlug(req);

  if (!slug) {
    return res.status(400).json({ error: 'Requisição inválida' });
  }

  const tenantEmpresa = await resolveBySlug(slug);
  if (!tenantEmpresa) {
    return res.status(404).json({ error: 'Recurso não encontrado' });
  }

  // Se há usuário autenticado, validar pertencimento
  if (req.usuario && req.empresa_id) {
    if (tenantEmpresa.id !== req.empresa_id) {
      logger.warn('ALERTA: tenantGuard bloqueou acesso cross-tenant', {
        tipo: 'cross_tenant_guard',
        usuario_id: req.usuario.id,
        empresa_usuario: req.empresa_id,
        tenant_slug: slug,
        tenant_id: tenantEmpresa.id,
        ip: req.ip,
        url: req.originalUrl
      });
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
  }

  req.tenantEmpresa = tenantEmpresa;
  req.tenantSlug = slug;
  next();
}

module.exports = { auth, perfil, tenant, tenantGuard, extractTenantSlug };
