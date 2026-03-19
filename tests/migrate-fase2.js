/* ══════════════════════════════════════════════════════════════
   SNGPC Fase 2 — Migração SQL
   Aplica alterações de schema para o motor regulatório
   ══════════════════════════════════════════════════════════════ */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

const migrations = [
  // 1. Criar tabela sngpc_estoque
  `CREATE TABLE IF NOT EXISTS sngpc_estoque (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    lote_id INTEGER NOT NULL REFERENCES lotes(id) ON DELETE RESTRICT,
    saldo_atual DECIMAL(10,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // 2. Unique constraint sngpc_estoque
  `CREATE UNIQUE INDEX IF NOT EXISTS sngpc_estoque_empresa_produto_lote_unique
   ON sngpc_estoque (empresa_id, produto_id, lote_id)`,

  // 3. Indexes sngpc_estoque
  `CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_produto ON sngpc_estoque (produto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sngpc_estoque_lote ON sngpc_estoque (lote_id)`,

  // 4. Add periodo_id to sngpc_movimentacoes
  `ALTER TABLE sngpc_movimentacoes ADD COLUMN IF NOT EXISTS periodo_id INTEGER REFERENCES sngpc_periodos(id) ON DELETE RESTRICT`,

  // 5. Add documento_referencia to sngpc_movimentacoes
  `ALTER TABLE sngpc_movimentacoes ADD COLUMN IF NOT EXISTS documento_referencia VARCHAR(200)`,

  // 6. Add profissional_responsavel to sngpc_movimentacoes
  `ALTER TABLE sngpc_movimentacoes ADD COLUMN IF NOT EXISTS profissional_responsavel VARCHAR(200)`,

  // 7. Add Phase 2 ENUM values to tipo column
  // PostgreSQL ALTER TYPE ... ADD VALUE is not transactional, must run individually
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_movimentacoes_tipo" ADD VALUE IF NOT EXISTS 'ENTRADA'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_movimentacoes_tipo" ADD VALUE IF NOT EXISTS 'DISPENSACAO'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_movimentacoes_tipo" ADD VALUE IF NOT EXISTS 'PERDA'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_movimentacoes_tipo" ADD VALUE IF NOT EXISTS 'AJUSTE_POSITIVO'; EXCEPTION WHEN duplicate_object THEN null; END $$`,
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_movimentacoes_tipo" ADD VALUE IF NOT EXISTS 'AJUSTE_NEGATIVO'; EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // 8. Add 'cancelado' to sngpc_periodos status ENUM
  `DO $$ BEGIN ALTER TYPE "enum_sngpc_periodos_status" ADD VALUE IF NOT EXISTS 'cancelado'; EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // 9. Add Phase 2 columns to sngpc_periodos
  `ALTER TABLE sngpc_periodos ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ`,
  `ALTER TABLE sngpc_periodos ADD COLUMN IF NOT EXISTS hash_integridade VARCHAR(64)`,
  `ALTER TABLE sngpc_periodos ADD COLUMN IF NOT EXISTS usuario_fechamento INTEGER REFERENCES usuarios(id) ON DELETE SET NULL`,

  // 10. Indexes for Phase 2
  `CREATE INDEX IF NOT EXISTS idx_sngpc_mov_empresa_periodo ON sngpc_movimentacoes (empresa_id, periodo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sngpc_mov_produto_lote ON sngpc_movimentacoes (produto_id, lote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sngpc_mov_periodo ON sngpc_movimentacoes (periodo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sngpc_periodos_usuario_fech ON sngpc_periodos (usuario_fechamento)`,

  // 11. RLS policy for sngpc_estoque (same pattern as other sngpc tables)
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sngpc_estoque' AND policyname = 'sngpc_estoque_tenant_policy') THEN
      ALTER TABLE sngpc_estoque ENABLE ROW LEVEL SECURITY;
      CREATE POLICY sngpc_estoque_tenant_policy ON sngpc_estoque
        USING (empresa_id = current_setting('app.current_tenant_id', true)::INTEGER)
        WITH CHECK (empresa_id = current_setting('app.current_tenant_id', true)::INTEGER);
    END IF;
  END $$`
];

(async () => {
  let ok = 0, fail = 0;

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  SNGPC Fase 2 — Migração SQL                       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  for (const sql of migrations) {
    try {
      await s.query(sql);
      const label = sql.substring(0, 80).replace(/\s+/g, ' ').trim();
      console.log('  ✅ ' + label + '...');
      ok++;
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('já existe')
          || err.message.includes('duplicate')) {
        const label = sql.substring(0, 60).replace(/\s+/g, ' ').trim();
        console.log('  ⏭️  ' + label + '... (já existe)');
        ok++;
      } else {
        console.log('  ❌ ' + err.message.split('\n')[0]);
        console.log('     SQL: ' + sql.substring(0, 100).replace(/\s+/g, ' '));
        fail++;
      }
    }
  }

  // Verificação
  console.log('\n=== VERIFICAÇÃO ===\n');

  // Check sngpc_estoque exists
  const [tables] = await s.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name = 'sngpc_estoque' AND table_schema = 'public'
  `);
  console.log('  sngpc_estoque tabela: ' + (tables.length > 0 ? '✅' : '❌'));

  // Check periodo_id column
  const [cols] = await s.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'sngpc_movimentacoes' AND column_name IN ('periodo_id', 'documento_referencia', 'profissional_responsavel')
    ORDER BY column_name
  `);
  console.log('  Novas colunas movimentacoes: ' + cols.map(c => c.column_name).join(', '));

  // Check ENUM values
  const [enums] = await s.query(`
    SELECT unnest(enum_range(NULL::enum_sngpc_movimentacoes_tipo)) AS val
  `);
  console.log('  ENUM tipo movimentação: ' + enums.map(e => e.val).join(', '));

  // Check periodo columns
  const [pcols] = await s.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'sngpc_periodos' AND column_name IN ('data_fechamento', 'hash_integridade', 'usuario_fechamento')
    ORDER BY column_name
  `);
  console.log('  Novas colunas periodos: ' + pcols.map(c => c.column_name).join(', '));

  const [penums] = await s.query(`
    SELECT unnest(enum_range(NULL::enum_sngpc_periodos_status)) AS val
  `);
  console.log('  ENUM status período: ' + penums.map(e => e.val).join(', '));

  console.log('\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
  console.log('  OK: ' + ok + ' | FALHOU: ' + fail);
  if (fail === 0) {
    console.log('  🟢 MIGRAÇÃO FASE 2 APLICADA COM SUCESSO');
  } else {
    console.log('  🔴 FALHAS — verificar acima');
  }
  console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');

  await s.close();
  process.exit(fail > 0 ? 1 : 0);
})();
