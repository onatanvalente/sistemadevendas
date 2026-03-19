/* ══════════════════════════════════════════════════════════════
   SGC — Testes de Auditoria v1.0
   Prioridade 5: Proteção contra fraude interna
   
   Testes:
   1. Modelos (LogDesconto, LogPdv) — campos e validações
   2. Snapshot de venda — campos de integridade
   3. Limite de desconto — regras por perfil
   4. Cancelamento — soft delete + motivo obrigatório
   5. Vigência de regra — data_inicio/data_fim
   6. Anti-exclusão — sem DELETE route
   7. Rastreabilidade — trilha completa de uma venda
   ══════════════════════════════════════════════════════════════ */

const assert = require('assert');
let passed = 0;
let failed = 0;
let total = 0;

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
console.log('  TESTES DE AUDITORIA — Prioridade 5');
console.log('══════════════════════════════════════════\n');

// ═══════════════════════════════════════════════
//  1. MODELOS — Verificar que todos os models exportam corretamente
// ═══════════════════════════════════════════════
console.log('📦 1. Modelos de Auditoria');

test('LogDesconto model existe e é exportado', () => {
  const { LogDesconto } = require('../models');
  assert.ok(LogDesconto, 'LogDesconto não encontrado');
  assert.strictEqual(LogDesconto.tableName, 'log_descontos');
});

test('LogPdv model existe e é exportado', () => {
  const { LogPdv } = require('../models');
  assert.ok(LogPdv, 'LogPdv não encontrado');
  assert.strictEqual(LogPdv.tableName, 'log_pdv');
});

test('LogDesconto tem todos os campos obrigatórios', () => {
  const { LogDesconto } = require('../models');
  const attrs = LogDesconto.rawAttributes;
  const camposObrigatorios = ['id', 'empresa_id', 'tipo_desconto', 'valor_original', 
    'valor_desconto', 'valor_final', 'usuario_id', 'data_hora'];
  for (const campo of camposObrigatorios) {
    assert.ok(attrs[campo], `Campo ${campo} não encontrado em LogDesconto`);
  }
});

test('LogDesconto tem campos de rastreabilidade', () => {
  const { LogDesconto } = require('../models');
  const attrs = LogDesconto.rawAttributes;
  const camposRastreio = ['venda_id', 'item_venda_id', 'regra_id', 'programa_id', 
    'produto_id', 'gerente_autorizador_id', 'motivo', 'ip', 'percentual_desconto'];
  for (const campo of camposRastreio) {
    assert.ok(attrs[campo], `Campo de rastreabilidade ${campo} não encontrado em LogDesconto`);
  }
});

test('LogDesconto tipo_desconto aceita automatico, manual, manual_gerente', () => {
  const { LogDesconto } = require('../models');
  const attr = LogDesconto.rawAttributes.tipo_desconto;
  assert.ok(attr.type.values.includes('automatico'), 'Falta tipo automatico');
  assert.ok(attr.type.values.includes('manual'), 'Falta tipo manual');
  assert.ok(attr.type.values.includes('manual_gerente'), 'Falta tipo manual_gerente');
});

test('LogPdv tem todos os campos obrigatórios', () => {
  const { LogPdv } = require('../models');
  const attrs = LogPdv.rawAttributes;
  const camposObrigatorios = ['id', 'empresa_id', 'usuario_id', 'acao', 'data_hora'];
  for (const campo of camposObrigatorios) {
    assert.ok(attrs[campo], `Campo ${campo} não encontrado em LogPdv`);
  }
});

test('LogPdv tem campos de estado e detalhes', () => {
  const { LogPdv } = require('../models');
  const attrs = LogPdv.rawAttributes;
  assert.ok(attrs.estado_anterior, 'Falta estado_anterior');
  assert.ok(attrs.estado_novo, 'Falta estado_novo');
  assert.ok(attrs.detalhes, 'Falta detalhes (JSONB)');
  assert.ok(attrs.ip, 'Falta ip');
  assert.ok(attrs.venda_id, 'Falta venda_id');
});

// ═══════════════════════════════════════════════
//  2. SNAPSHOT DE VENDA — Campos de integridade
// ═══════════════════════════════════════════════
console.log('\n📊 2. Snapshot de Venda');

test('Venda tem campo subtotal_bruto', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.subtotal_bruto, 'subtotal_bruto não encontrado');
});

test('Venda tem campo desconto_automatico_total', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.desconto_automatico_total, 'desconto_automatico_total não encontrado');
});

test('Venda tem campo desconto_manual_total', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.desconto_manual_total, 'desconto_manual_total não encontrado');
});

test('Venda tem campo versao_sistema', () => {
  const { Venda } = require('../models');
  const attr = Venda.rawAttributes.versao_sistema;
  assert.ok(attr, 'versao_sistema não encontrado');
  assert.strictEqual(attr.defaultValue, '5.0', 'Default deve ser 5.0');
});

test('Venda tem campo ip_terminal', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.ip_terminal, 'ip_terminal não encontrado');
});

// ═══════════════════════════════════════════════
//  3. LIMITE DE DESCONTO — Regras por perfil
// ═══════════════════════════════════════════════
console.log('\n🔐 3. Limite de Desconto');

test('Usuario tem campo limite_desconto_percentual', () => {
  const { Usuario } = require('../models');
  const attr = Usuario.rawAttributes.limite_desconto_percentual;
  assert.ok(attr, 'limite_desconto_percentual não encontrado');
  assert.strictEqual(parseFloat(attr.defaultValue), 5.00, 'Default deve ser 5%');
});

test('Limite default é restritivo (5%)', () => {
  const { Usuario } = require('../models');
  const attr = Usuario.rawAttributes.limite_desconto_percentual;
  assert.ok(parseFloat(attr.defaultValue) <= 10, 'Limite default deve ser ≤ 10%');
});

// ═══════════════════════════════════════════════
//  4. CANCELAMENTO — Soft delete + motivo + rastreio
// ═══════════════════════════════════════════════
console.log('\n🚫 4. Cancelamento Protegido');

test('Venda tem campo motivo_cancelamento', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.motivo_cancelamento, 'motivo_cancelamento não encontrado');
});

test('Venda tem campo cancelado_por', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.cancelado_por, 'cancelado_por não encontrado');
});

test('Venda tem campo cancelado_em', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.cancelado_em, 'cancelado_em não encontrado');
});

test('Venda tem campo venda_referenciada_id', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.venda_referenciada_id, 'venda_referenciada_id não encontrado');
});

test('Venda status inclui finalizada e cancelada', () => {
  const { Venda } = require('../models');
  const statusValues = Venda.rawAttributes.status.type.values;
  assert.ok(statusValues.includes('finalizada'), 'Falta status finalizada');
  assert.ok(statusValues.includes('cancelada'), 'Falta status cancelada');
});

// ═══════════════════════════════════════════════
//  5. VIGÊNCIA DE REGRA — data_inicio/data_fim
// ═══════════════════════════════════════════════
console.log('\n📅 5. Vigência de Regra');

test('RegraDesconto tem campo data_inicio', () => {
  const { RegraDesconto } = require('../models');
  assert.ok(RegraDesconto.rawAttributes.data_inicio, 'data_inicio não encontrado');
});

test('RegraDesconto tem campo data_fim', () => {
  const { RegraDesconto } = require('../models');
  assert.ok(RegraDesconto.rawAttributes.data_fim, 'data_fim não encontrado');
});

test('RegraDesconto mantém campo ativo', () => {
  const { RegraDesconto } = require('../models');
  assert.ok(RegraDesconto.rawAttributes.ativo, 'ativo não encontrado');
});

// ═══════════════════════════════════════════════
//  6. ANTI-EXCLUSÃO — Sem DELETE de vendas/logs
// ═══════════════════════════════════════════════
console.log('\n🛡️ 6. Anti-Exclusão');

test('Rota de vendas NÃO tem DELETE handler', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(!vendas.includes('router.delete'), 'Encontrado router.delete em vendas.js — PROIBIDO');
});

test('Rota de audit NÃO tem DELETE handler', () => {
  const fs = require('fs');
  const audit = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'audit.js'), 'utf8');
  assert.ok(!audit.includes('router.delete'), 'Encontrado router.delete em audit.js — PROIBIDO');
});

// ═══════════════════════════════════════════════
//  7. RASTREABILIDADE — Rotas de consulta
// ═══════════════════════════════════════════════
console.log('\n🔍 7. Rastreabilidade');

test('Rota audit.js exporta router', () => {
  const audit = require('../routes/audit');
  assert.ok(audit, 'routes/audit.js não exporta nada');
});

test('Rota audit.js tem endpoints de consulta', () => {
  const fs = require('fs');
  const audit = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'audit.js'), 'utf8');
  assert.ok(audit.includes("'/log-pdv'"), 'Falta endpoint log-pdv');
  assert.ok(audit.includes("'/log-desconto'"), 'Falta endpoint log-desconto');
  assert.ok(audit.includes("'/validar-gerente'"), 'Falta endpoint validar-gerente');
  assert.ok(audit.includes("'/limite-desconto'"), 'Falta endpoint limite-desconto');
  assert.ok(audit.includes('/trilha'), 'Falta endpoint trilha');
  assert.ok(audit.includes('/dashboard'), 'Falta endpoint dashboard');
});

test('Rota audit.js tem proteção de perfil nos GETs', () => {
  const fs = require('fs');
  const audit = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'audit.js'), 'utf8');
  assert.ok(audit.includes("perfil('administrador', 'gerente')"), 'Falta proteção de perfil nos GETs');
});

// ═══════════════════════════════════════════════
//  8. ASSOCIAÇÕES — Relacionamentos corretos
// ═══════════════════════════════════════════════
console.log('\n🔗 8. Associações');

test('LogDesconto associado a Usuario como Operador', () => {
  const { LogDesconto } = require('../models');
  const associations = LogDesconto.associations;
  assert.ok(associations.Operador, 'Associação Operador não encontrada');
});

test('LogDesconto associado a Usuario como GerenteAutorizador', () => {
  const { LogDesconto } = require('../models');
  const associations = LogDesconto.associations;
  assert.ok(associations.GerenteAutorizador, 'Associação GerenteAutorizador não encontrada');
});

test('LogPdv associado a Empresa e Usuario', () => {
  const { LogPdv } = require('../models');
  const associations = LogPdv.associations;
  assert.ok(associations.Empresa, 'Associação Empresa não encontrada');
  assert.ok(associations.Usuario, 'Associação Usuario não encontrada');
});

test('Venda auto-referencia para cancelamento', () => {
  const { Venda } = require('../models');
  assert.ok(Venda.rawAttributes.venda_referenciada_id, 'venda_referenciada_id não existe');
});

// ═══════════════════════════════════════════════
//  9. INTEGRIDADE DO PDV FRONTEND
// ═══════════════════════════════════════════════
console.log('\n🖥️ 9. PDV Frontend');

test('PDV.js tem _logAcaoPDV', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_logAcaoPDV'), 'Falta função _logAcaoPDV');
});

test('PDV.js tem _flushLogBuffer', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_flushLogBuffer'), 'Falta função _flushLogBuffer');
});

test('PDV.js tem _verificarLimiteDesconto', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_verificarLimiteDesconto'), 'Falta função _verificarLimiteDesconto');
});

test('PDV.js tem _mostrarModalSenhaGerente', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_mostrarModalSenhaGerente'), 'Falta modal de senha gerente');
});

test('PDV.js tem _validarSenhaGerente', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_validarSenhaGerente'), 'Falta função _validarSenhaGerente');
});

test('PDV.js tem _confirmarCancelamento com motivo', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('_confirmarCancelamento'), 'Falta função _confirmarCancelamento');
  assert.ok(pdv.includes('motivoCancelamento'), 'Falta campo de motivo no cancelamento');
});

test('PDV.js envia desconto_automatico_total na venda', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  assert.ok(pdv.includes('desconto_automatico_total'), 'Falta envio de desconto_automatico_total');
  assert.ok(pdv.includes('desconto_manual_total'), 'Falta envio de desconto_manual_total');
  assert.ok(pdv.includes('gerente_autorizador_id'), 'Falta envio de gerente_autorizador_id');
});

test('PDV.js loga transições de estado', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  // Verificar que transitarEstado chama _logAcaoPDV
  const transitarIdx = pdv.indexOf('transitarEstado(novoStatus)');
  const logIdx = pdv.indexOf('_logAcaoPDV(\'TRANSICAO_ESTADO\'');
  assert.ok(transitarIdx > -1 && logIdx > -1, 'transitarEstado deve chamar _logAcaoPDV');
  assert.ok(logIdx > transitarIdx, '_logAcaoPDV deve ser chamado dentro de transitarEstado');
});

test('PDV.js loga ações críticas', () => {
  const fs = require('fs');
  const pdv = fs.readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'pdv.js'), 'utf8');
  const acoesLogadas = [
    'INICIAR_VENDA', 'IDENTIFICAR_CLIENTE', 'INICIAR_PAGAMENTO', 
    'FINALIZAR_VENDA', 'CANCELAR_VENDA', 'LIMPAR_CLIENTE',
    'DESCONTO_MANUAL', 'AUTORIZACAO_GERENTE'
  ];
  for (const acao of acoesLogadas) {
    assert.ok(pdv.includes("'" + acao + "'"), `Falta log da ação ${acao} no PDV`);
  }
});

// ═══════════════════════════════════════════════
//  10. BACKEND — Vendas.js tem auditoria
// ═══════════════════════════════════════════════
console.log('\n🔧 10. Backend Vendas.js');

test('Vendas.js importa LogDesconto e LogPdv', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('LogDesconto'), 'Falta import de LogDesconto');
  assert.ok(vendas.includes('LogPdv'), 'Falta import de LogPdv');
});

test('Vendas.js chama req.audit na criação', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes("req.audit('criar', 'vendas'"), 'Falta req.audit na criação de venda');
});

test('Vendas.js chama req.audit no cancelamento', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes("req.audit('cancelar', 'vendas'"), 'Falta req.audit no cancelamento de venda');
});

test('Vendas.js registra LogDesconto no POST', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('LogDesconto.bulkCreate'), 'Falta LogDesconto.bulkCreate no POST');
});

test('Vendas.js registra LogPdv na finalização', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('FINALIZAR_VENDA'), 'Falta log FINALIZAR_VENDA no POST');
});

test('Vendas.js registra LogPdv no cancelamento', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('CANCELAR_VENDA'), 'Falta log CANCELAR_VENDA no PUT cancel');
});

test('Vendas.js salva motivo_cancelamento', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('motivo_cancelamento'), 'Falta campo motivo_cancelamento no cancelamento');
  assert.ok(vendas.includes('cancelado_por'), 'Falta campo cancelado_por');
  assert.ok(vendas.includes('cancelado_em'), 'Falta campo cancelado_em');
});

test('Vendas.js salva snapshot de integridade', () => {
  const fs = require('fs');
  const vendas = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'vendas.js'), 'utf8');
  assert.ok(vendas.includes('subtotal_bruto'), 'Falta subtotal_bruto no snapshot');
  assert.ok(vendas.includes('desconto_automatico_total'), 'Falta desconto_automatico_total no snapshot');
  assert.ok(vendas.includes('desconto_manual_total'), 'Falta desconto_manual_total no snapshot');
  assert.ok(vendas.includes('versao_sistema'), 'Falta versao_sistema no snapshot');
  assert.ok(vendas.includes('ip_terminal'), 'Falta ip_terminal no snapshot');
});

test('Auth.js inclui limite_desconto_percentual no login', () => {
  const fs = require('fs');
  const auth = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'auth.js'), 'utf8');
  assert.ok(auth.includes('limite_desconto_percentual'), 'Falta limite_desconto_percentual no response de login');
});

test('Server.js registra rota /api/audit', () => {
  const fs = require('fs');
  const server = fs.readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.ok(server.includes("'/api/audit'"), 'Falta registro de /api/audit no server.js');
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
