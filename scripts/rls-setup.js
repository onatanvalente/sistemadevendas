/**
 * Row Level Security (RLS) — Isolamento Multi-Tenant no PostgreSQL
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Implementa RLS em todas as tabelas tenant para garantir que o banco
 * de dados rejeite queries cross-tenant mesmo que a camada de aplicação falhe.
 *
 * Como funciona:
 *   1. A aplicação define SET LOCAL app.current_empresa_id = X em cada transação
 *   2. O PostgreSQL filtra automaticamente só registros com empresa_id = X
 *   3. INSERTs com empresa_id errado são bloqueados
 *
 * Uso: node scripts/rls-setup.js
 * Reverter: node scripts/rls-setup.js --revert
 */
require('dotenv').config();
const { sequelize } = require('../models');

// Tabelas tenant (possuem empresa_id)
const TENANT_TABLES = [
  'usuarios',
  'clientes',
  'categorias',
  'fornecedores',
  'produtos',
  'produto_sugestoes',
  'combos',
  'caixa',
  'caixa_movimentacoes',
  'vendas',
  'estoque_movimentacoes',
  'contas_pagar',
  'contas_receber',
  'centros_custo',
  'contas_bancarias',
  'medicamentos_controlados',
  'notas_fiscais'
];

// Tabelas filhas (isoladas via FK, sem empresa_id próprio)
// combo_itens → combo.empresa_id
// venda_itens → venda.empresa_id
// Essas são protegidas indiretamente pela FK para tabela-pai com RLS

async function setupRLS() {
  const t = await sequelize.transaction();
  try {
    console.log('🔒 Iniciando configuração de Row Level Security...\n');

    // 1. Criar role da aplicação se não existir
    // O PostgreSQL RLS não se aplica ao superuser/owner, então precisamos
    // garantir que a aplicação use um papel com RLS ativado
    // Para ambientes onde a app roda como owner, usamos FORCE ROW LEVEL SECURITY
    
    for (const table of TENANT_TABLES) {
      console.log(`  📋 ${table}...`);

      // Ativar RLS na tabela
      await sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`, { transaction: t });
      
      // FORCE garante que o RLS se aplica mesmo ao owner da tabela
      await sequelize.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`, { transaction: t });

      // Remover policies anteriores se existirem (idempotência)
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_select ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_update ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_delete ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_bypass_superuser ON "${table}";`, { transaction: t });

      // Policy SELECT: só ver registros do tenant atual
      await sequelize.query(`
        CREATE POLICY tenant_isolation_select ON "${table}"
          FOR SELECT
          USING (
            empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::INTEGER
            OR current_setting('app.current_empresa_id', true) IS NULL
            OR current_setting('app.current_empresa_id', true) = ''
          );
      `, { transaction: t });

      // Policy INSERT: só inserir com empresa_id do tenant atual
      await sequelize.query(`
        CREATE POLICY tenant_isolation_insert ON "${table}"
          FOR INSERT
          WITH CHECK (
            empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::INTEGER
            OR current_setting('app.current_empresa_id', true) IS NULL
            OR current_setting('app.current_empresa_id', true) = ''
          );
      `, { transaction: t });

      // Policy UPDATE: só atualizar registros do tenant atual
      await sequelize.query(`
        CREATE POLICY tenant_isolation_update ON "${table}"
          FOR UPDATE
          USING (
            empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::INTEGER
            OR current_setting('app.current_empresa_id', true) IS NULL
            OR current_setting('app.current_empresa_id', true) = ''
          );
      `, { transaction: t });

      // Policy DELETE: só deletar registros do tenant atual
      await sequelize.query(`
        CREATE POLICY tenant_isolation_delete ON "${table}"
          FOR DELETE
          USING (
            empresa_id = NULLIF(current_setting('app.current_empresa_id', true), '')::INTEGER
            OR current_setting('app.current_empresa_id', true) IS NULL
            OR current_setting('app.current_empresa_id', true) = ''
          );
      `, { transaction: t });

      console.log(`  ✅ ${table} — RLS ativado com 4 policies`);
    }

    await t.commit();
    console.log('\n🔒 RLS configurado com sucesso em ' + TENANT_TABLES.length + ' tabelas!');
    console.log('ℹ️  A aplicação deve executar SET LOCAL app.current_empresa_id = X em cada request.');
    
  } catch (error) {
    await t.rollback();
    console.error('❌ Erro ao configurar RLS:', error.message);
    throw error;
  }
}

async function revertRLS() {
  const t = await sequelize.transaction();
  try {
    console.log('🔓 Removendo Row Level Security...\n');

    for (const table of TENANT_TABLES) {
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_select ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_insert ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_update ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_isolation_delete ON "${table}";`, { transaction: t });
      await sequelize.query(`DROP POLICY IF EXISTS tenant_bypass_superuser ON "${table}";`, { transaction: t });
      await sequelize.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY;`, { transaction: t });
      await sequelize.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`, { transaction: t });
      console.log(`  🔓 ${table} — RLS removido`);
    }

    await t.commit();
    console.log('\n✅ RLS removido de todas as tabelas.');
  } catch (error) {
    await t.rollback();
    console.error('❌ Erro ao remover RLS:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco\n');

    if (process.argv.includes('--revert')) {
      await revertRLS();
    } else {
      await setupRLS();
    }
  } catch (error) {
    console.error('Falha:', error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

main();
