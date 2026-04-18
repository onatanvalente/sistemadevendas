/* ══════════════════════════════════════════════════════════════
   MIDDLEWARE: Tenant Resolver
   Resolve o tenant (empresa) a partir de:
   - Subdomínio: mercadinho-bb.seusite.com
   - Path param: /app/mercadinho-bb/...
   - Header: X-Tenant-Slug (para testes locais)
   ══════════════════════════════════════════════════════════════ */

const { Empresa } = require('../models');

// Cache simples em memória (slug → empresa)
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function resolveBySlug(slug) {
  if (!slug) return null;
  slug = slug.toLowerCase().trim();

  // Verificar cache
  const cached = tenantCache.get(slug);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.empresa;
  }

  const empresa = await Empresa.findOne({
    where: { subdominio: slug },
    attributes: ['id', 'nome', 'nome_fantasia', 'tipo_negocio', 'subdominio', 'ativo', 'status',
      'cor_primaria', 'cor_secundaria', 'logo_url', 'plano', 'max_usuarios', 'max_caixas',
      'trial_ate']
  });

  if (empresa) {
    tenantCache.set(slug, { empresa, ts: Date.now() });
  }
  return empresa;
}

/**
 * Middleware para resolver tenant via path param (/app/:slug)
 * Injeta req.tenantEmpresa e req.tenantSlug
 */
function tenantFromPath(req, res, next) {
  const slug = req.params.slug;
  if (!slug) {
    return res.status(404).json({ error: 'Empresa não identificada' });
  }

  resolveBySlug(slug).then(empresa => {
    if (!empresa) {
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
    // §7: Nunca revelar existência — retornar 404 genérico
    if (empresa.status === 'suspenso' || empresa.status === 'cancelado') {
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
    if (!empresa.ativo) {
      return res.status(404).json({ error: 'Recurso não encontrado' });
    }
    req.tenantEmpresa = empresa;
    req.tenantSlug = slug;
    next();
  }).catch(err => {
    console.error('[TenantResolver] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao resolver empresa' });
  });
}

/**
 * Middleware para resolver tenant via subdomínio (hostname)
 * Ex: mercadinho-bb.seusite.com → slug = "mercadinho-bb"
 * Em desenvolvimento local, usa header X-Tenant-Slug como fallback
 */
function tenantFromSubdomain(req, res, next) {
  const hostname = req.hostname || req.headers.host;
  let slug = null;

  // Em produção: extrair subdomínio
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    slug = parts[0]; // mercadinho-bb.varlem.com.br → "mercadinho-bb"
  }

  // Fallback para dev local: header X-Tenant-Slug
  if (!slug) {
    slug = req.headers['x-tenant-slug'];
  }

  if (!slug) {
    return next(); // Sem tenant = continuar (pode ser landing page ou master)
  }

  // Slugs reservados que NÃO são tenants
  if (['master', 'gestao', 'admin', 'www', 'api'].includes(slug)) {
    return next();
  }

  resolveBySlug(slug).then(empresa => {
    if (empresa && empresa.ativo && empresa.status !== 'suspenso' && empresa.status !== 'cancelado') {
      req.tenantEmpresa = empresa;
      req.tenantSlug = slug;
    }
    next();
  }).catch(() => next());
}

/**
 * Invalida o cache de um slug específico (chamar após editar empresa)
 */
function invalidateCache(slug) {
  if (slug) tenantCache.delete(slug.toLowerCase());
}

/**
 * Gera slug único a partir de um nome
 */
function gerarSlug(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')   // troca especiais por hífen
    .replace(/^-|-$/g, '')          // remove hífens no início/fim
    .substring(0, 50);
}

module.exports = { tenantFromPath, tenantFromSubdomain, resolveBySlug, invalidateCache, gerarSlug };
