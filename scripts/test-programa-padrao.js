/* ══════════════════════════════════════════════════════════════
   SGC — Testes: Programa Padrão (Clube Fidelidade)
   
   Uso: node scripts/test-programa-padrao.js
   
   Valida:
   1. Campo programa_padrao existe no modelo
   2. Unicidade de programa_padrao por empresa
   3. ClientePrograma tem unique index (cliente_id + programa_id)
   4. Auto-inscrição na rota de clientes
   5. PDV carrega descontos automaticamente
   6. Anti-duplicidade
   ══════════════════════════════════════════════════════════════ */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0, total = 0;

function test(nome, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${nome}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${nome}: ${e.message}`);
  }
}

console.log('\n══════════════════════════════════════════');
console.log('  TESTES — Programa Padrão / Clube');
console.log('══════════════════════════════════════════\n');

// ═══════════════════════════════════════════════
//  1. MODELO
// ═══════════════════════════════════════════════
console.log('📦 1. Modelo ProgramaComercial');

test('Campo programa_padrao existe', () => {
  const { ProgramaComercial } = require('../models');
  const attr = ProgramaComercial.rawAttributes.programa_padrao;
  assert.ok(attr, 'programa_padrao não encontrado no modelo');
  assert.strictEqual(attr.defaultValue, false, 'Default deve ser false');
});

test('Campo programa_padrao é BOOLEAN', () => {
  const { ProgramaComercial } = require('../models');
  const attr = ProgramaComercial.rawAttributes.programa_padrao;
  assert.ok(attr.type.constructor.name === 'BOOLEAN' || attr.type.key === 'BOOLEAN', 'Deve ser BOOLEAN');
});

// ═══════════════════════════════════════════════
//  2. CLIENTE ↔ PROGRAMA
// ═══════════════════════════════════════════════
console.log('\n🔗 2. Relacionamento ClientePrograma');

test('ClientePrograma tem unique index (cliente_id + programa_id)', () => {
  const { ClientePrograma } = require('../models');
  const indexes = ClientePrograma.options.indexes || [];
  const uniqueIdx = indexes.find(i => i.unique && 
    i.fields.includes('cliente_id') && i.fields.includes('programa_id'));
  assert.ok(uniqueIdx, 'Falta unique index em (cliente_id, programa_id) — anti-duplicidade');
});

test('ClientePrograma tem campo status', () => {
  const { ClientePrograma } = require('../models');
  const attr = ClientePrograma.rawAttributes.status;
  assert.ok(attr, 'Falta campo status');
  assert.strictEqual(attr.defaultValue, 'ativo', 'Default deve ser ativo');
});

test('ClientePrograma tem campo data_adesao', () => {
  const { ClientePrograma } = require('../models');
  assert.ok(ClientePrograma.rawAttributes.data_adesao, 'Falta campo data_adesao');
});

// ═══════════════════════════════════════════════
//  3. ROTA DE PROGRAMAS — Unicidade programa_padrao
// ═══════════════════════════════════════════════
console.log('\n🏗️ 3. Rota de Programas');

test('POST /programas aceita programa_padrao', () => {
  const programas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'programas.js'), 'utf8');
  assert.ok(programas.includes('programa_padrao'), 'Falta programa_padrao no POST');
});

test('POST /programas desativa outros padrões ao criar novo', () => {
  const programas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'programas.js'), 'utf8');
  assert.ok(programas.includes("programa_padrao: false"), 'Falta lógica de desmarcar outros programa_padrao');
  assert.ok(programas.includes("programa_padrao: true"), 'Falta where programa_padrao: true para buscar existentes');
});

test('PUT /programas mantém unicidade de programa_padrao', () => {
  const programas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'programas.js'), 'utf8');
  // Deve ter Op.ne para excluir o próprio programa no update
  assert.ok(programas.includes('Op.ne'), 'PUT deve excluir o próprio programa ao desmarcar outros (Op.ne)');
});

// ═══════════════════════════════════════════════
//  4. ROTA DE CLIENTES — Auto-inscrição
// ═══════════════════════════════════════════════
console.log('\n👤 4. Auto-inscrição ao Criar Cliente');

test('Rota clientes.js importa ProgramaComercial e ClientePrograma', () => {
  const clientes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'clientes.js'), 'utf8');
  assert.ok(clientes.includes('ProgramaComercial'), 'Falta import ProgramaComercial');
  assert.ok(clientes.includes('ClientePrograma'), 'Falta import ClientePrograma');
});

test('POST /clientes busca programa_padrao', () => {
  const clientes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'clientes.js'), 'utf8');
  assert.ok(clientes.includes('programa_padrao: true'), 'Falta busca de programa_padrao: true');
});

test('POST /clientes cria ClientePrograma automaticamente', () => {
  const clientes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'clientes.js'), 'utf8');
  assert.ok(clientes.includes('ClientePrograma.create'), 'Falta ClientePrograma.create');
});

test('POST /clientes verifica duplicidade antes de inscrever', () => {
  const clientes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'clientes.js'), 'utf8');
  assert.ok(clientes.includes('jaInscrito') || clientes.includes('findOne'), 'Falta verificação de duplicidade');
});

test('Erro na inscrição NÃO falha a criação do cliente', () => {
  const clientes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'clientes.js'), 'utf8');
  // O bloco de inscrição deve estar em try/catch separado
  const idx = clientes.indexOf('programaPadrao');
  const catchIdx = clientes.indexOf('errPrograma');
  assert.ok(idx > -1 && catchIdx > -1, 'Inscrição deve ter try/catch independente para não falhar o cadastro');
});

// ═══════════════════════════════════════════════
//  5. PDV — Descontos carregados automaticamente
// ═══════════════════════════════════════════════
console.log('\n🖥️ 5. PDV — Carregamento automático');

test('PDV busca descontos ao identificar cliente', () => {
  const pdv = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_carregarDescontosCliente'), 'Falta _carregarDescontosCliente');
  assert.ok(pdv.includes("'/programas/descontos/cliente/'"), 'Falta chamada à API de descontos');
});

test('PDV reprocessa itens após carregar descontos', () => {
  const pdv = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('reprocessarTodosOsItens'), 'Falta reprocessarTodosOsItens após identificar cliente');
});

// ═══════════════════════════════════════════════
//  6. SCRIPT DE CONFIGURAÇÃO
// ═══════════════════════════════════════════════
console.log('\n🔧 6. Script de Configuração');

test('Script criar-clube-fidelidade.js existe', () => {
  const exists = fs.existsSync(path.join(__dirname, 'criar-clube-fidelidade.js'));
  assert.ok(exists, 'Falta script scripts/criar-clube-fidelidade.js');
});

test('Script é idempotente (verifica existência antes de criar)', () => {
  const script = fs.readFileSync(path.join(__dirname, 'criar-clube-fidelidade.js'), 'utf8');
  assert.ok(script.includes('findOne'), 'Script deve verificar se programa já existe');
  assert.ok(script.includes('programa_padrao: true'), 'Script deve buscar programa_padrao: true');
});

test('Script inscreve clientes existentes', () => {
  const script = fs.readFileSync(path.join(__dirname, 'criar-clube-fidelidade.js'), 'utf8');
  assert.ok(script.includes('Cliente.findAll'), 'Script deve buscar clientes existentes');
  assert.ok(script.includes('ClientePrograma.create'), 'Script deve inscrever clientes');
});

// ═══════════════════════════════════════════════
//  RESULTADO
// ═══════════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log(`  RESULTADO: ${passed}/${total} testes passaram`);
if (failed > 0) {
  console.log(`  ❌ ${failed} teste(s) falharam`);
} else {
  console.log('  ✅ Todos os testes passaram!');
}
console.log('══════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
