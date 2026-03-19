require('dotenv').config();
const { Sequelize } = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

(async () => {
  // 1. Índices existentes em tabelas críticas
  const [indexes] = await s.query(`
    SELECT t.relname AS table_name, i.relname AS index_name, 
           array_to_string(array_agg(a.attname ORDER BY x.n), ', ') AS columns,
           ix.indisunique AS is_unique,
           ix.indisprimary AS is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid
    JOIN generate_subscripts(ix.indkey, 1) AS x(n) ON a.attnum = ix.indkey[x.n]
    WHERE t.relname IN (
      'sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes', 'sngpc_configuracao',
      'medicamentos_controlados', 'lotes', 'estoque_movimentacoes'
    )
    GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary
    ORDER BY t.relname, i.relname;
  `);

  console.log('=== 1. ÍNDICES EXISTENTES ===\n');
  let currentTable = '';
  for (const idx of indexes) {
    if (idx.table_name !== currentTable) {
      currentTable = idx.table_name;
      console.log('  📋 ' + currentTable);
    }
    const flags = [];
    if (idx.is_primary) flags.push('PK');
    if (idx.is_unique && !idx.is_primary) flags.push('UNIQUE');
    console.log('    ' + (flags.length ? '['+flags.join(',')+'] ' : '') + idx.index_name + ': (' + idx.columns + ')');
  }

  // 2. FKs sem índice
  console.log('\n=== 2. FKs SEM ÍNDICE (risco de performance) ===\n');
  const [fksWithoutIndex] = await s.query(`
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

  if (fksWithoutIndex.length === 0) {
    console.log('  ✅ Todas as FKs possuem índice');
  } else {
    for (const fk of fksWithoutIndex) {
      console.log('  🔴 ' + fk.table_name + '.' + fk.column_name + ' — SEM INDICE');
    }
  }

  // 3. Unique constraints
  console.log('\n=== 3. UNIQUE CONSTRAINTS EXISTENTES ===\n');
  const [uniques] = await s.query(`
    SELECT tc.table_name, tc.constraint_name,
           string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_name IN (
        'sngpc_movimentacoes', 'sngpc_periodos', 'sngpc_transmissoes', 'sngpc_configuracao',
        'medicamentos_controlados', 'lotes', 'produtos'
      )
    GROUP BY tc.table_name, tc.constraint_name
    ORDER BY tc.table_name;
  `);

  if (uniques.length === 0) {
    console.log('  ⚠️  Nenhuma UNIQUE constraint encontrada');
  } else {
    for (const u of uniques) {
      console.log('  ' + u.table_name + ': (' + u.columns + ') — ' + u.constraint_name);
    }
  }

  // 4. Verificar se registro_anvisa e codigo_barras têm unique
  console.log('\n=== 4. CAMPOS QUE DEVERIAM SER UNIQUE ===\n');
  const [prodUniques] = await s.query(`
    SELECT i.relname AS index_name, a.attname AS column_name, ix.indisunique
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ix.indkey[0]
    WHERE t.relname = 'produtos'
      AND a.attname IN ('registro_anvisa', 'codigo_barras', 'registro_ms')
  `);

  const checkedFields = ['registro_anvisa', 'codigo_barras', 'registro_ms'];
  for (const f of checkedFields) {
    const found = prodUniques.find(u => u.column_name === f);
    if (found && found.indisunique) {
      console.log('  ✅ produtos.' + f + ' — UNIQUE');
    } else if (found) {
      console.log('  ⚠️  produtos.' + f + ' — Indexado mas NÃO unique');
    } else {
      console.log('  ⚠️  produtos.' + f + ' — Sem índice');
    }
  }

  await s.close();
})();
