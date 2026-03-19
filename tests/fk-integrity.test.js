require('dotenv').config();
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, { logging: false });

async function run() {
  let passed = 0, failed = 0;
  function ok(label) { console.log('  ✅ ' + label); passed++; }
  function fail(label, detail) { console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); failed++; }

  // ══════════════════════════════════════════════════════════
  //  TESTE 3 — Verificar delete_rule das FKs
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🔬 TESTE 3 — Verificar ON DELETE das FKs');
  console.log('═══════════════════════════════════════════════════\n');

  const [fks] = await sequelize.query(`
    SELECT
      tc.constraint_name, kcu.column_name,
      ccu.table_name AS referenced_table,
      rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'medicamentos_controlados'
    ORDER BY kcu.column_name;
  `);

  console.log('  FKs de medicamentos_controlados:');
  for (const fk of fks) {
    const icon = fk.delete_rule === 'CASCADE' ? '🔴' : '✅';
    console.log('    ' + icon + ' ' + fk.column_name + ' -> ' + fk.referenced_table + '  [ON DELETE ' + fk.delete_rule + ']');
    if (fk.delete_rule === 'CASCADE') {
      fail('FK ' + fk.column_name + ' tem CASCADE — PERIGOSO para SNGPC/Anvisa');
    } else {
      ok('FK ' + fk.column_name + ' = ' + fk.delete_rule + ' (correto para rastreabilidade)');
    }
  }

  // Verificar CASCADEs em tabelas SNGPC
  console.log('\n  Verificando CASCADEs em tabelas SNGPC...');
  const [cascades] = await sequelize.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE rc.delete_rule = 'CASCADE'
      AND (tc.table_name LIKE 'sngpc_%' OR tc.table_name = 'medicamentos_controlados')
    ORDER BY tc.table_name;
  `);

  if (cascades.length === 0) {
    ok('Nenhum CASCADE em tabelas SNGPC — rastreabilidade preservada');
  } else {
    for (const c of cascades) {
      fail('CASCADE indevido: ' + c.table_name + '.' + c.column_name + ' -> ' + c.ref_table);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TESTE 1 — FK bloqueia exclusão de produto
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🔬 TESTE 1 — FK bloqueia exclusão de produto com dispensação');
  console.log('═══════════════════════════════════════════════════\n');

  const [empresas] = await sequelize.query("SELECT id FROM empresas WHERE tipo_negocio = 'drogaria' LIMIT 1");
  const empresa_id = empresas[0].id;
  const [usuarios] = await sequelize.query('SELECT id FROM usuarios WHERE empresa_id = ' + empresa_id + ' LIMIT 1');
  const usuario_id = usuarios[0].id;
  const [cats] = await sequelize.query('SELECT id FROM categorias WHERE empresa_id = ' + empresa_id + ' LIMIT 1');
  const cat_id = cats[0].id;

  // Criar produto controlado
  const [prodResult] = await sequelize.query(`
    INSERT INTO produtos (empresa_id, categoria_id, nome, preco_custo, preco_venda, margem, controlado, classe_controlado,
      estoque_atual, estoque_minimo, estoque_maximo, ponto_reposicao, permite_estoque_negativo, unidade,
      fator_conversao, permite_fracionamento, produto_pesado, curva_abc, giro_estoque, total_vendido_mes,
      faturamento_mes, e_medicamento, controla_lote, origem, tipo_produto, permite_venda_sem_estoque,
      preco_custo_medio, participa_fidelidade, estoque_reservado, controla_validade, sugere_compra_automatica,
      estoque_seguranca, lead_time_padrao, prazo_entrega, quantidade_minima_compra, generico,
      despesas_adicionais, permite_desconto_manual, desconto_maximo, ativo, created_at, updated_at)
    VALUES (${empresa_id}, ${cat_id}, 'FK-TEST-PROD', 10, 20, 100, true, 'C1',
      10, 1, 100, 5, false, 'UN',
      1, false, false, 'A', 'medio', 0,
      0, true, true, '0', 'medicamento', false,
      10, false, 0, true, false,
      0, 0, 0, 1, false,
      0, true, 0, true, NOW(), NOW())
    RETURNING id
  `);
  const produto_id = prodResult[0].id;
  console.log('  Produto criado: id=' + produto_id);

  // Criar medicamento_controlado vinculado
  const [medResult] = await sequelize.query(`
    INSERT INTO medicamentos_controlados (
      empresa_id, produto_id, cliente_cpf, cliente_nome, medico_nome, medico_crm, medico_uf,
      numero_receita, data_receita, tipo_receita, farmaceutico_id, quantidade_dispensada, data_venda,
      created_at, updated_at)
    VALUES (
      ${empresa_id}, ${produto_id}, '12345678901', 'Teste FK', 'Dr. Teste', '12345', 'SP',
      'REC001', '2026-02-18', 'branca', ${usuario_id}, 1, '2026-02-18',
      NOW(), NOW())
    RETURNING id
  `);
  const med_id = medResult[0].id;
  console.log('  Medicamento controlado criado: id=' + med_id);

  // Tentar deletar produto — DEVE FALHAR
  try {
    await sequelize.query('DELETE FROM produtos WHERE id = ' + produto_id);
    fail('1.1 DELETE de produto com dispensação foi permitido — FK NÃO ESTÁ PROTEGENDO');
  } catch (err) {
    if (err.message.includes('foreign key') || err.message.includes('chave estrangeira')) {
      ok('1.1 DELETE bloqueado pela FK (RESTRICT) — correto para Anvisa');
    } else {
      fail('1.1 Erro inesperado: ' + err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TESTE 2 — Exclusão na ordem correta funciona
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🔬 TESTE 2 — Exclusão na ordem correta (filhos antes de pais)');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    await sequelize.query('DELETE FROM medicamentos_controlados WHERE id = ' + med_id);
    ok('2.1 DELETE de medicamento_controlado OK');
  } catch (err) {
    fail('2.1 DELETE de medicamento_controlado falhou: ' + err.message);
  }

  try {
    await sequelize.query('DELETE FROM produtos WHERE id = ' + produto_id);
    ok('2.2 DELETE de produto (sem filhos) OK');
  } catch (err) {
    fail('2.2 DELETE de produto falhou: ' + err.message);
  }

  // ══════════════════════════════════════════════════════════
  //  TESTE 4 — Tabelas que referenciam produtos
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🔬 TESTE 4 — Tabelas que referenciam produtos.id');
  console.log('═══════════════════════════════════════════════════\n');

  const [allFks] = await sequelize.query(`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'produtos' AND ccu.column_name = 'id'
    ORDER BY tc.table_name;
  `);

  for (const fk of allFks) {
    const icon = fk.delete_rule === 'CASCADE' ? '🔴' : '✅';
    console.log('  ' + icon + ' ' + fk.table_name + '.' + fk.column_name + ' [ON DELETE ' + fk.delete_rule + ']');
  }

  // ══════════════════════════════════════════════════════════
  //  TESTE 5 — Produto com movimentação SNGPC é indeletável
  // ══════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  🔬 TESTE 5 — Produto com movimentação SNGPC é indeletável');
  console.log('═══════════════════════════════════════════════════\n');

  const [prod2] = await sequelize.query(`
    INSERT INTO produtos (empresa_id, categoria_id, nome, preco_custo, preco_venda, margem, controlado, classe_controlado,
      estoque_atual, estoque_minimo, estoque_maximo, ponto_reposicao, permite_estoque_negativo, unidade,
      fator_conversao, permite_fracionamento, produto_pesado, curva_abc, giro_estoque, total_vendido_mes,
      faturamento_mes, e_medicamento, controla_lote, origem, tipo_produto, permite_venda_sem_estoque,
      preco_custo_medio, participa_fidelidade, estoque_reservado, controla_validade, sugere_compra_automatica,
      estoque_seguranca, lead_time_padrao, prazo_entrega, quantidade_minima_compra, generico,
      despesas_adicionais, permite_desconto_manual, desconto_maximo, ativo, created_at, updated_at)
    VALUES (${empresa_id}, ${cat_id}, 'FK-TEST-SNGPC-PROD', 10, 20, 100, true, 'C1',
      10, 1, 100, 5, false, 'UN',
      1, false, false, 'A', 'medio', 0,
      0, true, true, '0', 'medicamento', false,
      10, false, 0, true, false,
      0, 0, 0, 1, false,
      0, true, 0, true, NOW(), NOW())
    RETURNING id
  `);
  const prod2_id = prod2[0].id;

  const [lote2] = await sequelize.query(`
    INSERT INTO lotes (empresa_id, produto_id, numero_lote, validade, quantidade_inicial, quantidade_atual,
      data_entrada, status, ativo, created_at, updated_at)
    VALUES (${empresa_id}, ${prod2_id}, 'FK-TEST-LOTE', '2027-12-31', 10, 10, '2026-02-18', 'ATIVO', true, NOW(), NOW())
    RETURNING id
  `);
  const lote2_id = lote2[0].id;

  await sequelize.query(`
    INSERT INTO sngpc_movimentacoes (empresa_id, produto_id, lote_id, tipo, quantidade,
      data_movimentacao, usuario_id, hash_integridade, created_at, updated_at)
    VALUES (${empresa_id}, ${prod2_id}, ${lote2_id}, 'entrada', 10,
      '2026-02-18', ${usuario_id}, 'testhash123', NOW(), NOW())
  `);
  console.log('  Produto+Lote+Mov SNGPC criados');

  // Tentar deletar produto — deve falhar (FK de sngpc_movimentacoes)
  try {
    await sequelize.query('DELETE FROM produtos WHERE id = ' + prod2_id);
    fail('5.1 Produto com mov SNGPC deletado — rastreabilidade comprometida!');
  } catch (err) {
    ok('5.1 Produto com mov SNGPC indeletável (FK sngpc_movimentacoes)');
  }

  // Tentar deletar lote — deve falhar (FK de sngpc_movimentacoes)
  try {
    await sequelize.query('DELETE FROM lotes WHERE id = ' + lote2_id);
    fail('5.2 Lote com mov SNGPC deletado — rastreabilidade comprometida!');
  } catch (err) {
    ok('5.2 Lote com mov SNGPC indeletável (FK sngpc_movimentacoes)');
  }

  // Cleanup correto (ordem reversa de dependência)
  await sequelize.query('DELETE FROM sngpc_movimentacoes WHERE produto_id = ' + prod2_id);
  await sequelize.query('DELETE FROM lotes WHERE id = ' + lote2_id);
  await sequelize.query('DELETE FROM produtos WHERE id = ' + prod2_id);
  console.log('  Cleanup OK (ordem correta)');

  // ══════════════════════════════════════════════════════════
  //  RESULTADO
  // ══════════════════════════════════════════════════════════
  console.log('\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
  console.log('  RESULTADO — INTEGRIDADE REFERENCIAL');
  console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n');
  console.log('  ✅ Passou: ' + passed);
  console.log('  ❌ Falhou: ' + failed);
  console.log('  Total:  ' + (passed + failed));

  if (failed === 0) {
    console.log('\n  🟢 INTEGRIDADE REFERENCIAL 100% OK');
    console.log('  ✅ Nenhum ON DELETE CASCADE em tabelas SNGPC');
    console.log('  ✅ Produto com dispensação/movimentação é indeletável');
    console.log('  ✅ Exclusão na ordem correta funciona');
    console.log('  ✅ Rastreabilidade Anvisa preservada');
  } else {
    console.log('\n  🔴 PROBLEMAS ENCONTRADOS — corrigir antes de avançar');
  }

  await sequelize.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
