require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { sequelize } = require('./models');
const { auditMiddleware } = require('./middleware/audit');
const { logSecurityEvent } = require('./middleware/validateTenantAccess');
const { logger, requestLogger } = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway / qualquer proxy reverso injeta X-Forwarded-For — precisa confiar
app.set('trust proxy', 1);

// ── Health check — ANTES de todo middleware (CORS, Helmet, rate limit) ──
// Railway bate neste endpoint para confirmar que o app subiu
let dbReady = false;
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0', db: dbReady ? 'connected' : 'connecting', ts: new Date().toISOString() });
});

/* ══════════════════════════════════════════════════════════════
   SGC v3.0 — Sistema SaaS Multi-Tenant
   
   Estrutura de URLs:
   /                    → Landing page (site de vendas)
   /app/:slug           → Sistema do cliente (ex: /app/mercadinho-bb)
   /master              → Painel admin do SaaS
   /api/master/...      → API do painel master
   /api/landing/...     → API pública (registro, check-slug)
   /api/...             → API do tenant (auth via JWT com empresa_id)
   ══════════════════════════════════════════════════════════════ */

// ── Segurança ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS — origens permitidas via variável de ambiente
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : [];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.warn('CORS_ORIGINS não configurado em produção — permitindo todas as origens. Configure a variável para restringir.');
}

app.use(cors({
  origin: (origin, callback) => {
    // Sem Origin header → navegação direta, server-to-server, Postman → permitir
    if (!origin) return callback(null, true);
    // CORS_ORIGINS não configurado → permitir tudo (com aviso acima)
    if (allowedOrigins.length === 0) return callback(null, true);
    // Checar lista de origens permitidas
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn('CORS bloqueou origem', { origin });
    callback(new Error('Bloqueado pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Impedir manipulação de tenant_id em qualquer body de requisição
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    delete req.body.empresa_id;
    delete req.body.tenant_id;
  }
  next();
});

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      ip: req.ip, route: req.originalUrl, method: req.method,
      user_agent: req.headers['user-agent'],
      action: 'rate_limit_hit', reason: 'Rate limit global atingido'
    });
    res.status(options.statusCode).json(options.message);
  }
});
app.use('/api/', limiter);

// Rate limit reforçado para autenticação (anti brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      ip: req.ip, route: req.originalUrl, method: req.method,
      user_agent: req.headers['user-agent'],
      action: 'rate_limit_hit', reason: 'Rate limit auth atingido (brute force possível)'
    });
    res.status(options.statusCode).json(options.message);
  }
});

// Rate limit para registro de novas contas (anti spam)
const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,                    // 5 registros por hora por IP
  message: { error: 'Muitas tentativas de registro. Tente novamente em 1 hora.' },
  handler: (req, res, next, options) => {
    logSecurityEvent({
      ip: req.ip, route: req.originalUrl, method: req.method,
      user_agent: req.headers['user-agent'],
      action: 'rate_limit_hit', reason: 'Rate limit registro atingido'
    });
    res.status(options.statusCode).json(options.message);
  }
});

// ── Audit middleware ──
app.use(auditMiddleware);

// ── Request logger (logs estruturados) ──
app.use(requestLogger);

// ── Arquivos estáticos (sem servir index.html automaticamente na raiz) ──
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ════════════════════════════════════════════
//  ROTAS PÚBLICAS (Landing Page)
// ════════════════════════════════════════════
const landingRoutes = require('./routes/landing');
app.use('/api/landing/registro', registroLimiter); // Rate limit no registro (antes do router)
app.use('/api/landing', landingRoutes);

// ════════════════════════════════════════════
//  ROTAS MASTER (Painel Admin SaaS)
// ════════════════════════════════════════════
app.post('/api/master/login', authLimiter);
app.use('/api/master', require('./routes/master'));

// ════════════════════════════════════════════
//  ROTAS DO TENANT (API do cliente)
// ════════════════════════════════════════════
const { tenantFromSubdomain } = require('./middleware/tenantResolver');
const { tenantGuard } = require('./middleware/auth');

// ── Middleware global para rotas de tenant: EXIGE X-Tenant-Slug ──
// Garante que toda requisição às rotas de tenant identifique o tenant.
// O middleware `auth` dentro de cada rota já valida que o token JWT
// pertence ao tenant informado (cross-tenant = 404, nunca revelar existência).
const tenantApiRoutes = [
  '/api/auth', '/api/empresas', '/api/usuarios', '/api/categorias',
  '/api/fornecedores', '/api/produtos', '/api/vendas', '/api/caixa',
  '/api/estoque', '/api/financeiro', '/api/dashboard', '/api/clientes',
  '/api/sngpc', '/api/fiscal', '/api/features', '/api/compras',
  '/api/programas', '/api/etiquetas'
];
app.use(tenantApiRoutes, (req, res, next) => {
  const slug = (req.headers['x-tenant-slug'] || '').toLowerCase().trim();
  if (!slug) {
    // Referrer como fallback (navegador envia em SPA)
    const referer = req.headers.referer || req.headers.referrer || '';
    const match = referer.match(/\/app\/([a-z0-9-]+)/i);
    if (!match) {
      return res.status(400).json({ error: 'Requisição inválida' });
    }
  }
  next();
});

app.use('/api/auth/registro', registroLimiter); // Rate limit no registro (antes do router)
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/empresas', require('./routes/empresas'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/fornecedores', require('./routes/fornecedores'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/caixa', require('./routes/caixa'));
app.use('/api/estoque', require('./routes/estoque'));
app.use('/api/financeiro', require('./routes/financeiro'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/sngpc', require('./routes/sngpc'));
app.use('/api/fiscal', require('./routes/fiscal'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/programas', require('./routes/programas'));
app.use('/api/etiquetas', require('./routes/etiquetas'));
app.use('/api/audit', require('./routes/audit'));

// Endpoint para coleta de violações CSP
app.post('/api/csp-report', (req, res) => {
  try {
    const report = req.body?.['csp-report'] || req.body || {};
    logger.warn('CSP violation', {
      blockedUri: report?.['blocked-uri'] || report?.blockedURI,
      violatedDirective: report?.['violated-directive'] || report?.violatedDirective,
      documentUri: report?.['document-uri'] || report?.documentURI,
    });
  } catch (e) { /* ignora erros de parse */ }
  res.status(204).end();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0-saas', timestamp: new Date().toISOString() });
});

// Features endpoint
const { getFeatures } = require('./config/features');
const { auth } = require('./middleware/auth');
app.get('/api/features', auth, (req, res) => {
  const tipo = req.empresa?.tipo_negocio || 'mercado';
  res.json(getFeatures(tipo));
});

// ════════════════════════════════════════════
//  SPA FALLBACK — rotas servem os HTMLs corretos
// ════════════════════════════════════════════

// /master → Painel Master
app.get('/master', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'master.html'));
});
app.get('/master/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'master.html'));
});

// /app/:slug → Sistema do cliente (SPA com tenant)
// ── GUARD: validar slug + JWT ANTES de servir qualquer HTML ──
const { resolveBySlug: resolveSlug } = require('./middleware/tenantResolver');
const jwtLib = require('jsonwebtoken');
const JWT_SECRET_GUARD = process.env.JWT_SECRET || 'sgc_jwt_secret_default';

async function tenantPageGuard(req, res) {
  const slug = (req.params.slug || '').toLowerCase().trim();

  // 1) Slug deve existir no banco
  const empresa = await resolveSlug(slug).catch(() => null);
  if (!empresa) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }

  // 2) Se houver token JWT (cookie ou Authorization), verificar pertencimento
  const authHeader = req.headers.authorization || '';
  const tokenStr = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // Verificar cookie sgc_token como fallback (SPA pode enviar)
  const cookieToken = (req.headers.cookie || '').split(';')
    .map(c => c.trim()).find(c => c.startsWith('sgc_token='));
  const jwt_token = tokenStr || (cookieToken ? cookieToken.split('=')[1] : null);

  if (jwt_token) {
    try {
      const decoded = jwtLib.verify(jwt_token, JWT_SECRET_GUARD);
      // Se o token é de tenant (tem empresa_id) e não bate com o slug → 404
      if (decoded.empresa_id && decoded.empresa_id !== empresa.id) {
        logger.warn('GUARD: Acesso a /app/:slug de outro tenant → 404', {
          tipo: 'tenant_page_guard',
          usuario_id: decoded.id,
          empresa_token: decoded.empresa_id,
          slug_acessado: slug,
          empresa_slug: empresa.id,
          ip: req.ip
        });
        return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
      }
    } catch(e) {
      // Token inválido/expirado: permitir carregar (mostrará login)
    }
  }

  // 3) OK — servir o SPA
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
}

app.get('/app/:slug', tenantPageGuard);
app.get('/app/:slug/*', tenantPageGuard);

// / → Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Fallback geral → Landing
app.get('*', (req, res) => {
  // Se a URL é /404.html, servir a página de erro genérica
  if (req.path === '/404.html') {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// ── Error handler global ──
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message
  });
});

// ── Iniciar servidor ──
async function connectAndSync() {
  const rlsTables = [
    'usuarios', 'clientes', 'categorias', 'fornecedores', 'produtos',
    'produto_sugestoes', 'combos', 'caixa', 'caixa_movimentacoes',
    'vendas', 'estoque_movimentacoes', 'contas_pagar', 'contas_receber',
    'centros_custo', 'contas_bancarias', 'medicamentos_controlados', 'notas_fiscais',
    'historico_precos', 'lotes', 'security_logs',
    'compras', 'compra_itens', 'compra_parcelas',
    'modelos_etiqueta', 'config_impressao',
    'sngpc_configuracao', 'sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes'
  ];
  const policyNames = ['tenant_isolation_select', 'tenant_isolation_insert', 'tenant_isolation_update', 'tenant_isolation_delete'];

  await sequelize.authenticate();
  logger.info('Banco de dados conectado');

  // ── RLS: desabilitar e remover policies antes do sync ──
  for (const t of rlsTables) {
    try {
      for (const p of policyNames) {
        await sequelize.query(`DROP POLICY IF EXISTS "${p}" ON "${t}"`);
      }
      await sequelize.query(`ALTER TABLE "${t}" NO FORCE ROW LEVEL SECURITY`);
      await sequelize.query(`ALTER TABLE "${t}" DISABLE ROW LEVEL SECURITY`);
    } catch(e) { /* tabela pode não existir ainda */ }
  }

  // ── Migração: ENUM → STRING para tipo_medicamento e tipo_receita ──
  try {
    await sequelize.query(`ALTER TABLE "produtos" ALTER COLUMN "tipo_medicamento" TYPE VARCHAR(30) USING "tipo_medicamento"::TEXT`);
    await sequelize.query(`ALTER TABLE "produtos" ALTER COLUMN "tipo_receita" TYPE VARCHAR(30) USING "tipo_receita"::TEXT`);
    await sequelize.query(`DROP TYPE IF EXISTS "enum_produtos_tipo_medicamento" CASCADE`);
    await sequelize.query(`DROP TYPE IF EXISTS "enum_produtos_tipo_receita" CASCADE`);
    logger.info('Migração ENUM → STRING concluída');
  } catch(e) { /* tabela/coluna pode não existir ainda ou já ser STRING */ }

  await sequelize.sync({ alter: true });
  logger.info('Modelos sincronizados (v3.0 — SaaS Multi-Tenant)');

  // ── RLS: recriar policies e reativar após sync ──
  for (const t of rlsTables) {
    try {
      await sequelize.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      await sequelize.query(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
      const rlsCondition = `empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::INTEGER OR current_setting('app.current_empresa_id', true) IS NULL OR current_setting('app.current_empresa_id', true) = ''`;
      await sequelize.query(`CREATE POLICY tenant_isolation_select ON "${t}" FOR SELECT USING (${rlsCondition})`);
      await sequelize.query(`CREATE POLICY tenant_isolation_insert ON "${t}" FOR INSERT WITH CHECK (${rlsCondition})`);
      await sequelize.query(`CREATE POLICY tenant_isolation_update ON "${t}" FOR UPDATE USING (${rlsCondition})`);
      await sequelize.query(`CREATE POLICY tenant_isolation_delete ON "${t}" FOR DELETE USING (${rlsCondition})`);
    } catch(e) { /* ignora se alguma tabela falhar */ }
  }
  logger.info('RLS reativado em ' + rlsTables.length + ' tabelas');

  dbReady = true;
}

async function start() {
  // Validar que JWT_SECRET não é o default em produção
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    const masterSecret = process.env.MASTER_JWT_SECRET;
    if (!jwtSecret || jwtSecret.includes('default') || jwtSecret.includes('change_this')) {
      logger.error('JWT_SECRET não configurado para produção! Abortando.');
      process.exit(1);
    }
    if (!masterSecret || masterSecret.includes('change_this')) {
      logger.error('MASTER_JWT_SECRET não configurado para produção! Abortando.');
      process.exit(1);
    }
  }

  // ── Servidor sobe PRIMEIRO — healthcheck do Railway já pode responder ──
  app.listen(PORT, () => {
    logger.info(`SGC v3.0 SaaS rodando na porta ${PORT}`, {
      landing: `http://localhost:${PORT}`,
      master:  `http://localhost:${PORT}/master`,
      clientes: `http://localhost:${PORT}/app/{slug}`
    });
  });

  // ── Banco conecta em background — sem bloquear o healthcheck ──
  connectAndSync().catch((error) => {
    logger.error('Erro ao conectar/sincronizar banco', { message: error.message });
    // Não mata o processo — healthcheck continua respondendo (db: "connecting")
    // Tenta reconectar após 10 segundos
    setTimeout(() => connectAndSync().catch((e) => {
      logger.error('Reconexão falhou', { message: e.message });
      process.exit(1);
    }), 10000);
  });
}

start();
