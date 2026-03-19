require('dotenv').config();
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

const indexes = [
  // medicamentos_controlados
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_empresa_produto ON medicamentos_controlados (empresa_id, produto_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_empresa_data ON medicamentos_controlados (empresa_id, data_venda)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_empresa_cpf ON medicamentos_controlados (empresa_id, cliente_cpf)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_venda ON medicamentos_controlados (venda_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_farmaceutico ON medicamentos_controlados (farmaceutico_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_med_ctrl_produto ON medicamentos_controlados (produto_id)',

  // sngpc_movimentacoes — FKs individuais
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_mov_produto ON sngpc_movimentacoes (produto_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_mov_lote ON sngpc_movimentacoes (lote_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_mov_usuario ON sngpc_movimentacoes (usuario_id)',

  // sngpc_periodos
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_per_fechado_por ON sngpc_periodos (fechado_por)',

  // sngpc_transmissoes
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_trans_gerado_por ON sngpc_transmissoes (gerado_por)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sngpc_trans_enviado_por ON sngpc_transmissoes (enviado_por)',

  // lotes — FKs individuais
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lotes_produto ON lotes (produto_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lotes_fornecedor ON lotes (fornecedor_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lotes_compra_item ON lotes (compra_item_id)',

  // estoque_movimentacoes — FKs individuais
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_est_mov_produto ON estoque_movimentacoes (produto_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_est_mov_lote ON estoque_movimentacoes (lote_id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_est_mov_usuario ON estoque_movimentacoes (usuario_id)',
];

const uniques = [
  // hash de integridade SNGPC deve ser único
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sngpc_mov_hash_unique ON sngpc_movimentacoes (hash_integridade)',

  // período empresa+datas deve ser único (evita períodos sobrepostos)
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sngpc_periodo_empresa_datas_unique ON sngpc_periodos (empresa_id, data_inicio, data_fim)',

  // lote + produto + empresa deve ser único (não pode ter 2 "LOTE-A" pro mesmo produto)
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS lotes_empresa_produto_lote_unique ON lotes (empresa_id, produto_id, numero_lote)',

  // protocolo Anvisa único por empresa (quando preenchido)
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sngpc_trans_protocolo_unique ON sngpc_transmissoes (empresa_id, protocolo_anvisa) WHERE protocolo_anvisa IS NOT NULL',

  // codigo_barras único por empresa (quando preenchido)
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_produtos_codigo_barras_empresa ON produtos (empresa_id, codigo_barras) WHERE codigo_barras IS NOT NULL AND codigo_barras != \'\'',

  // registro_anvisa único por empresa (quando preenchido)
  'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_produtos_registro_anvisa_empresa ON produtos (empresa_id, registro_anvisa) WHERE registro_anvisa IS NOT NULL AND registro_anvisa != \'\'',
];

(async () => {
  let ok = 0, fail = 0;

  console.log('=== CRIANDO ÍNDICES ===\n');
  for (const sql of indexes) {
    try {
      await s.query(sql);
      const name = sql.match(/IF NOT EXISTS (\S+)/)[1];
      console.log('  ✅ ' + name);
      ok++;
    } catch (err) {
      const name = sql.match(/IF NOT EXISTS (\S+)/)?.[1] || sql;
      if (err.message.includes('already exists') || err.message.includes('já existe')) {
        console.log('  ⏭️  ' + name + ' (já existe)');
        ok++;
      } else {
        console.log('  ❌ ' + name + ': ' + err.message.split('\n')[0]);
        fail++;
      }
    }
  }

  console.log('\n=== CRIANDO UNIQUE CONSTRAINTS ===\n');
  for (const sql of uniques) {
    try {
      await s.query(sql);
      const name = sql.match(/IF NOT EXISTS (\S+)/)[1];
      console.log('  ✅ ' + name);
      ok++;
    } catch (err) {
      const name = sql.match(/IF NOT EXISTS (\S+)/)?.[1] || sql;
      if (err.message.includes('already exists') || err.message.includes('já existe')) {
        console.log('  ⏭️  ' + name + ' (já existe)');
        ok++;
      } else {
        console.log('  ❌ ' + name + ': ' + err.message.split('\n')[0]);
        fail++;
      }
    }
  }

  // Verificação final
  console.log('\n=== VERIFICAÇÃO FINAL ===\n');

  // FKs sem índice
  const [missing] = await s.query(`
    WITH fk_columns AS (
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
          'sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes', 'sngpc_configuracao',
          'medicamentos_controlados', 'lotes', 'estoque_movimentacoes'
        )
    ),
    indexed_columns AS (
      SELECT t.relname AS table_name, a.attname AS column_name
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid
      WHERE a.attnum = ix.indkey[0]
        AND t.relname IN (
          'sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes', 'sngpc_configuracao',
          'medicamentos_controlados', 'lotes', 'estoque_movimentacoes'
        )
    )
    SELECT fk.table_name, fk.column_name
    FROM fk_columns fk
    LEFT JOIN indexed_columns ic ON fk.table_name = ic.table_name AND fk.column_name = ic.column_name
    WHERE ic.column_name IS NULL
    ORDER BY fk.table_name, fk.column_name;
  `);

  if (missing.length === 0) {
    console.log('  ✅ Todas as FKs críticas possuem índice');
  } else {
    for (const m of missing) {
      console.log('  🔴 ' + m.table_name + '.' + m.column_name + ' — AINDA SEM ÍNDICE');
    }
  }

  // Unique constraints
  const [uniqueCheck] = await s.query(`
    SELECT i.relname AS index_name, t.relname AS table_name, ix.indisunique
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relname IN ('sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes', 'lotes', 'produtos')
      AND ix.indisunique = true
      AND ix.indisprimary = false
    ORDER BY t.relname, i.relname;
  `);

  console.log('\n  Unique constraints ativas:');
  for (const u of uniqueCheck) {
    console.log('    ✅ ' + u.table_name + ': ' + u.index_name);
  }

  console.log('\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
  console.log('  OK: ' + ok + ' | FALHOU: ' + fail);
  if (fail === 0) {
    console.log('  🟢 TODOS OS ÍNDICES E CONSTRAINTS APLICADOS');
  } else {
    console.log('  🔴 FALHAS — verificar acima');
  }
  console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');

  await s.close();
  process.exit(fail > 0 ? 1 : 0);
})();
