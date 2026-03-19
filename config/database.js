const { Sequelize } = require('sequelize');
const { AsyncLocalStorage } = require('async_hooks');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:senha@localhost:5432/sgc_db';

// AsyncLocalStorage para propagar empresa_id do request para as queries
const tenantContext = new AsyncLocalStorage();

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: { require: true, rejectUnauthorized: false }
  } : {},
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// ═══════════════════════════════════════════════════════════════
//  RLS Integration: define app.current_empresa_id em cada query
//  O hook beforeQuery recebe (options, query) — query.connection
//  é o pg.Client real, permitindo SET sem recursão no Sequelize.
// ═══════════════════════════════════════════════════════════════
sequelize.addHook('beforeQuery', async (options, query) => {
  try {
    if (!query || !query.connection) return;

    // Pular SET para queries de sistema (sync, authenticate, etc.)
    const sql = typeof options === 'string' ? options : (options?.sql || '');
    if (typeof sql === 'string' && (sql.includes('pg_') || sql.includes('information_schema') || sql.includes('SELECT 1+1'))) return;

    const store = tenantContext.getStore();
    const empresaId = store?.empresa_id ? parseInt(store.empresa_id) : null;

    if (empresaId && !isNaN(empresaId)) {
      // Define o tenant atual na conexão — RLS filtra automaticamente
      await query.connection.query(`SET app.current_empresa_id = '${empresaId}'`);
    } else {
      // Sem tenant: limpa para que policies com fallback permitam acesso
      await query.connection.query(`RESET app.current_empresa_id`);
    }
  } catch (err) {
    // Não bloquear a query se o SET falhar (RLS pode não estar ativado ainda)
  }
});

module.exports = { sequelize, tenantContext };
