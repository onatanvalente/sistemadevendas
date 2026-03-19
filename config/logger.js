/* ══════════════════════════════════════════════════════════════
   SGC — Logger Estruturado
   Logs em formato JSON para fácil ingestão em serviços de monitoramento
   (Railway logs, CloudWatch, Datadog, etc.)
   ══════════════════════════════════════════════════════════════ */

const isDev = process.env.NODE_ENV !== 'production';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || (isDev ? 'debug' : 'info')];

function formatLog(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  // Em dev, formato legível; em prod, JSON puro
  if (isDev) {
    const icon = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🐛' }[level] || '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${icon} [${level.toUpperCase()}] ${message}${metaStr}`;
  }
  return JSON.stringify(entry);
}

const logger = {
  error(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatLog('error', message, meta));
    }
  },
  warn(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  info(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatLog('info', message, meta));
    }
  },
  debug(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatLog('debug', message, meta));
    }
  },

  // Helper para logar requisições HTTP
  request(req, res, durationMs) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs}ms`,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    };
    if (req.usuario) {
      meta.userId = req.usuario.id;
      meta.empresaId = req.empresa_id;
    }
    if (res.statusCode >= 400) {
      this.warn('HTTP request', meta);
    } else {
      this.info('HTTP request', meta);
    }
  }
};

/**
 * Middleware Express para logar todas as requisições
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    // Não logar health checks e assets estáticos
    if (!req.originalUrl.includes('/api/health') && !req.originalUrl.match(/\.(js|css|png|jpg|ico|svg|woff)/)) {
      logger.request(req, res, duration);
    }
    originalEnd.apply(res, args);
  };

  next();
}

module.exports = { logger, requestLogger };
