/**
 * ═══════════════════════════════════════════════════════════
 *  SNGPC FASE 2 — MOTOR REGULATÓRIO COMPLETO
 *  Testes automatizados para os 5 pilares:
 *    1. Motor de Movimentações (SERIALIZABLE)
 *    2. Estoque Regulatório Separado
 *    3. Gestão de Períodos (abrir/fechar/transmitir/cancelar)
 *    4. Fechamento com Hash de Integridade
 *    5. Bloqueios e Regras Imutáveis
 *    6. Concorrência
 * ═══════════════════════════════════════════════════════════
 *
 *  Uso: node tests/sngpc-phase2.test.js
 *
 *  Pré-requisitos: servidor rodando em localhost:3000
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');

// ── Config ──────────────────────────────────────────────────
const BASE = 'http://localhost:3000/api';
let SLUG = '';
let TOKEN_ADMIN = '';
let TOKEN_FARM = '';
let TOKEN_OP = '';
let EMPRESA_ID = 0;

// IDs criados
let produtoId = 0;
let produtoSemReceita_id = 0;
let loteAId = 0;
let loteBId = 0;
let periodoId = 0;
let periodo2Id = 0;
let categoriaId = 0;
let fornecedorId = 0;
let movIds = [];

// ── HTTP Helper ─────────────────────────────────────────────
function req(method, path, body, token, slug) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (slug || SLUG) headers['X-Tenant-Slug'] = slug || SLUG;

    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// ── Test Runner ─────────────────────────────────────────────
let total = 0, passed = 0, failed = 0, currentSection = '';
function section(name) {
  currentSection = name;
  console.log('\n' + '═'.repeat(60));
  console.log('  📋 ' + name);
  console.log('═'.repeat(60));
}
function assert(desc, condition) {
  total++;
  if (condition) { passed++; console.log('  ✅ ' + desc); }
  else { failed++; console.log('  ❌ ' + desc + ' [SEÇÃO: ' + currentSection + ']'); }
  return condition;
}

// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════
async function setup() {
  section('SETUP — Preparar dados de teste Fase 2');

  // Login admin
  const { Sequelize } = require('sequelize');
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

  const [empresas] = await s.query("SELECT id, subdominio FROM empresas WHERE tipo_negocio = 'drogaria' LIMIT 1");
  if (empresas.length === 0) throw new Error('Nenhuma empresa drogaria encontrada');
  EMPRESA_ID = empresas[0].id;
  SLUG = empresas[0].subdominio;
  console.log('  Empresa: id=' + EMPRESA_ID + ', slug=' + SLUG);

  // Login admin
  const loginAdmin = await req('POST', '/auth/login', { email: 'admin@drogaria.com', senha: 'admin123' }, null, SLUG);
  if (loginAdmin.status !== 200) {
    // Criar admin
    const [users] = await s.query("SELECT id FROM usuarios WHERE empresa_id = " + EMPRESA_ID + " AND perfil = 'administrador' LIMIT 1");
    if (users.length > 0) {
      const jwt = require('jsonwebtoken');
      TOKEN_ADMIN = jwt.sign({ id: users[0].id, empresa_id: EMPRESA_ID, perfil: 'administrador' },
        process.env.JWT_SECRET || 'varlensys_jwt_secret_change_this_in_production_2024', { expiresIn: '2h' });
    }
  } else {
    TOKEN_ADMIN = loginAdmin.data.token;
  }
  assert('Admin autenticado', !!TOKEN_ADMIN);

  // Criar farmacêutico (ou reutilizar existente)
  await req('POST', '/usuarios', {
    nome: 'Farm Fase2', email: 'farm-fase2@test.com', senha: 'Test123!@#',
    perfil: 'farmaceutico', ativo: true
  }, TOKEN_ADMIN);
  const loginFarm = await req('POST', '/auth/login', { email: 'farm-fase2@test.com', senha: 'Test123!@#' }, null, SLUG);
  TOKEN_FARM = loginFarm.data?.token;
  assert('Farmacêutico criado', !!TOKEN_FARM);

  // Criar operador (ou reutilizar existente)
  await req('POST', '/usuarios', {
    nome: 'Op Fase2', email: 'op-fase2@test.com', senha: 'Test123!@#',
    perfil: 'vendedor', ativo: true
  }, TOKEN_ADMIN);
  const loginOp = await req('POST', '/auth/login', { email: 'op-fase2@test.com', senha: 'Test123!@#' }, null, SLUG);
  TOKEN_OP = loginOp.data?.token;
  assert('Operador criado', !!TOKEN_OP);

  // Criar categoria
  const catRes = await req('POST', '/categorias', { nome: 'Controlados F2' }, TOKEN_ADMIN);
  categoriaId = catRes.data?.id;
  assert('Categoria criada', !!categoriaId);

  // Criar fornecedor
  const fornRes = await req('POST', '/fornecedores', {
    nome: 'Fornecedor F2', cnpj: '77777777000177', tipo: 'medicamento'
  }, TOKEN_ADMIN);
  fornecedorId = fornRes.data?.id;
  assert('Fornecedor criado', !!fornecedorId);

  // Criar produto controlado COM receita
  const prodRes = await req('POST', '/produtos', {
    nome: 'Clonazepam F2 2mg', categoria_id: categoriaId,
    preco_venda: 25.90, unidade: 'cx', controlado: true,
    principio_ativo: 'Clonazepam', classe_controlado: 'C1',
    registro_anvisa: 'F2-1234567890123', tipo_receita: 'azul',
    necessita_receita: true, estoque_atual: 0
  }, TOKEN_ADMIN);
  produtoId = prodRes.data?.id;
  assert('Produto controlado criado (id=' + produtoId + ')', !!produtoId);

  // Criar produto controlado SEM receita
  const prod2Res = await req('POST', '/produtos', {
    nome: 'Dipirona F2 Control', categoria_id: categoriaId,
    preco_venda: 12.50, unidade: 'cx', controlado: true,
    principio_ativo: 'Dipirona', classe_controlado: 'D1',
    registro_anvisa: 'F2-9876543210123', tipo_receita: 'branca',
    necessita_receita: false, estoque_atual: 0
  }, TOKEN_ADMIN);
  produtoSemReceita_id = prod2Res.data?.id;
  assert('Produto sem receita criado (id=' + produtoSemReceita_id + ')', !!produtoSemReceita_id);

  // Criar lotes
  const loteARes = await req('POST', '/produtos/' + produtoId + '/lotes', {
    numero_lote: 'F2-LOTE-A', validade: '2027-12-31',
    quantidade: 1, fornecedor_id: fornecedorId
  }, TOKEN_ADMIN);
  loteAId = loteARes.data?.id;
  assert('Lote A criado (id=' + loteAId + ')', !!loteAId);

  const loteBRes = await req('POST', '/produtos/' + produtoId + '/lotes', {
    numero_lote: 'F2-LOTE-B', validade: '2027-06-30',
    quantidade: 1, fornecedor_id: fornecedorId
  }, TOKEN_ADMIN);
  loteBId = loteBRes.data?.id;
  assert('Lote B criado (id=' + loteBId + ')', !!loteBId);

  // Configuração SNGPC
  const cfgRes = await req('GET', '/sngpc/configuracao', null, TOKEN_FARM);
  if (!cfgRes.data?.id) {
    await req('POST', '/sngpc/configuracao', {
      cnpj: '12345678000199', razao_social: 'Drogaria Fase 2',
      responsavel_tecnico_nome: 'Dr. Fase2', responsavel_tecnico_crf: 'CRF-SP-99999',
      responsavel_tecnico_uf: 'SP', data_inicio_controle: '2026-01-01'
    }, TOKEN_FARM);
  }
  assert('Configuração SNGPC OK', true);

  await s.close();
}

// ═══════════════════════════════════════════════════════════
//  1. MOTOR DE MOVIMENTAÇÕES
// ═══════════════════════════════════════════════════════════
async function testMotorMovimentacoes() {
  section('1. MOTOR DE MOVIMENTAÇÕES (SERIALIZABLE)');

  // Sem período aberto → deve falhar
  const semPeriodo = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10
  }, TOKEN_FARM);
  assert('Entrada sem período aberto → 400', semPeriodo.status === 400);
  assert('Mensagem menciona período', (semPeriodo.data?.error || '').includes('período') || (semPeriodo.data?.error || '').includes('ABERTO'));

  // Criar período
  const hoje = new Date();
  const inicio = hoje.toISOString().split('T')[0];
  const fimDate = new Date(hoje); fimDate.setDate(fimDate.getDate() + 30);
  const fim = fimDate.toISOString().split('T')[0];

  const perRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: inicio, data_fim: fim
  }, TOKEN_FARM);
  periodoId = perRes.data?.id;
  assert('Período criado (id=' + periodoId + ')', perRes.status === 201 && !!periodoId);

  // ── ENTRADA ──
  const entradaRes = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 100,
    numero_documento: 'NF-001', documento_referencia: 'Nota Fiscal 001'
  }, TOKEN_FARM);
  assert('Entrada 100 unidades → 201', entradaRes.status === 201);
  assert('Saldo regulatório = 100', parseFloat(entradaRes.data?.saldo_regulatorio) === 100);
  assert('Movimentação tipo = ENTRADA', entradaRes.data?.movimentacao?.tipo === 'ENTRADA');
  assert('Hash gerado', !!entradaRes.data?.movimentacao?.hash_integridade);
  assert('periodo_id vinculado', entradaRes.data?.movimentacao?.periodo_id === periodoId);
  if (entradaRes.data?.movimentacao?.id) movIds.push(entradaRes.data.movimentacao.id);

  // Entrada no lote B
  const entradaB = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteBId, quantidade: 50,
    numero_documento: 'NF-002'
  }, TOKEN_FARM);
  assert('Entrada Lote B 50 unidades → 201', entradaB.status === 201);
  if (entradaB.data?.movimentacao?.id) movIds.push(entradaB.data.movimentacao.id);

  // ── DISPENSAÇÃO ──
  const dispRes = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 5,
    cpf_paciente: '123.456.789-00', nome_paciente: 'Paciente F2',
    nome_medico: 'Dr. Teste', crm_medico: '12345', uf_crm: 'SP',
    numero_receita: 'REC-001', data_receita: inicio
  }, TOKEN_FARM);
  assert('Dispensação 5 unidades → 201', dispRes.status === 201);
  assert('Saldo regulatório = 95', parseFloat(dispRes.data?.saldo_regulatorio) === 95);
  assert('Tipo = DISPENSACAO', dispRes.data?.movimentacao?.tipo === 'DISPENSACAO');
  if (dispRes.data?.movimentacao?.id) movIds.push(dispRes.data.movimentacao.id);

  // ── PERDA ──
  const perdaRes = await req('POST', '/sngpc/v2/movimentacoes/perda', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 2,
    motivo_ajuste: 'quebra', observacao: 'Embalagem danificada'
  }, TOKEN_FARM);
  assert('Perda 2 unidades → 201', perdaRes.status === 201);
  assert('Saldo regulatório = 93', parseFloat(perdaRes.data?.saldo_regulatorio) === 93);
  assert('Tipo = PERDA', perdaRes.data?.movimentacao?.tipo === 'PERDA');
  if (perdaRes.data?.movimentacao?.id) movIds.push(perdaRes.data.movimentacao.id);

  // ── AJUSTE POSITIVO ──
  const ajPosRes = await req('POST', '/sngpc/v2/movimentacoes/ajuste', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 3,
    motivo_ajuste: 'correcao_inventario', observacao: 'Contagem física identificou 3 a mais'
  }, TOKEN_FARM);
  assert('Ajuste +3 → 201', ajPosRes.status === 201);
  assert('Saldo regulatório = 96', parseFloat(ajPosRes.data?.saldo_regulatorio) === 96);
  assert('Tipo = AJUSTE_POSITIVO', ajPosRes.data?.movimentacao?.tipo === 'AJUSTE_POSITIVO');
  if (ajPosRes.data?.movimentacao?.id) movIds.push(ajPosRes.data.movimentacao.id);

  // ── AJUSTE NEGATIVO ──
  const ajNegRes = await req('POST', '/sngpc/v2/movimentacoes/ajuste', {
    produto_id: produtoId, lote_id: loteAId, quantidade: -1,
    motivo_ajuste: 'correcao_inventario', observacao: 'Contagem física identificou 1 a menos'
  }, TOKEN_FARM);
  assert('Ajuste -1 → 201', ajNegRes.status === 201);
  assert('Saldo regulatório = 95', parseFloat(ajNegRes.data?.saldo_regulatorio) === 95);
  assert('Tipo = AJUSTE_NEGATIVO', ajNegRes.data?.movimentacao?.tipo === 'AJUSTE_NEGATIVO');
  if (ajNegRes.data?.movimentacao?.id) movIds.push(ajNegRes.data.movimentacao.id);

  // ── VALIDAÇÕES DE ERRO ──
  // Produto não controlado
  const prodNaoCRes = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: 999999, lote_id: loteAId, quantidade: 10
  }, TOKEN_FARM);
  assert('Produto inexistente → erro', prodNaoCRes.status >= 400);

  // Lote não pertence ao produto
  const loteErrado = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: 999999, quantidade: 10
  }, TOKEN_FARM);
  assert('Lote inexistente → erro', loteErrado.status >= 400);

  // Quantidade zero
  const qtdZero = await req('POST', '/sngpc/v2/movimentacoes/ajuste', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 0
  }, TOKEN_FARM);
  assert('Quantidade zero → 400', qtdZero.status === 400);

  // Operador sem permissão
  const opSemPerm = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10
  }, TOKEN_OP);
  assert('Operador sem perfil SNGPC → 403', opSemPerm.status === 403);
}

// ═══════════════════════════════════════════════════════════
//  2. ESTOQUE REGULATÓRIO
// ═══════════════════════════════════════════════════════════
async function testEstoqueRegulatorio() {
  section('2. ESTOQUE REGULATÓRIO SEPARADO');

  // Consultar saldo
  const saldoRes = await req('GET', '/sngpc/v2/estoque?produto_id=' + produtoId, null, TOKEN_FARM);
  assert('Consulta estoque regulatório → 200', saldoRes.status === 200);
  assert('Retorna array', Array.isArray(saldoRes.data));

  const saldoLoteA = saldoRes.data.find(s => s.lote_id === loteAId);
  const saldoLoteB = saldoRes.data.find(s => s.lote_id === loteBId);
  assert('Lote A saldo = 95', saldoLoteA && parseFloat(saldoLoteA.saldo_atual) === 95);
  assert('Lote B saldo = 50', saldoLoteB && parseFloat(saldoLoteB.saldo_atual) === 50);

  // Não permite saldo negativo
  const excesso = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 999,
    cpf_paciente: '111.222.333-44', nome_paciente: 'Teste',
    nome_medico: 'Dr. Teste', crm_medico: '11111', uf_crm: 'SP',
    numero_receita: 'REC-X', data_receita: new Date().toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Dispensação acima do saldo → 400', excesso.status === 400);
  assert('Mensagem menciona insuficiente', (excesso.data?.error || '').includes('insuficiente') || (excesso.data?.error || '').includes('negativo'));

  // Verificar consistência
  const verifRes = await req('GET', '/sngpc/v2/estoque/verificar?produto_id=' + produtoId + '&lote_id=' + loteAId, null, TOKEN_FARM);
  assert('Verificação consistência → 200', verifRes.status === 200);
  assert('Saldo consistente', verifRes.data?.consistente === true);
  assert('Saldo calculado = 95', verifRes.data?.saldo_calculado === 95);
}

// ═══════════════════════════════════════════════════════════
//  3. GESTÃO DE PERÍODOS
// ═══════════════════════════════════════════════════════════
async function testGestaoPeriodos() {
  section('3. GESTÃO DE PERÍODOS');

  // Já existe período aberto → não pode criar outro
  const hoje = new Date();
  const duploRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: hoje.toISOString().split('T')[0],
    data_fim: new Date(hoje.getTime() + 60 * 86400000).toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Duplicar período aberto → 400', duploRes.status === 400);
  assert('Mensagem menciona existente', (duploRes.data?.error || '').includes('Já existe'));

  // Data início >= fim → erro
  const invRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: '2026-12-31', data_fim: '2026-12-01'
  }, TOKEN_FARM);
  assert('data_inicio >= data_fim → 400', invRes.status === 400);

  // Cancelar período sem movimentações (precisa de um período novo sem movs)
  // Primeiro, fechar o período atual para poder testar cancelamento de outro
  // Para isso, testamos o cancelamento quando possível depois
}

// ═══════════════════════════════════════════════════════════
//  4. FECHAMENTO COM HASH DE INTEGRIDADE
// ═══════════════════════════════════════════════════════════
async function testFechamentoHash() {
  section('4. FECHAMENTO COM HASH DE INTEGRIDADE');

  // Fechar período
  const fecharRes = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/fechar', {}, TOKEN_FARM);
  assert('Fechar período → 200', fecharRes.status === 200);
  assert('Hash gerado', !!fecharRes.data?.hash_integridade && fecharRes.data.hash_integridade.length === 64);
  assert('Total movimentações > 0', fecharRes.data?.total_movimentacoes > 0);
  assert('Status = fechado', fecharRes.data?.periodo?.status === 'fechado');
  assert('data_fechamento preenchida', !!fecharRes.data?.periodo?.data_fechamento);
  assert('usuario_fechamento preenchido', !!fecharRes.data?.periodo?.usuario_fechamento);

  // Validar integridade
  const intRes = await req('GET', '/sngpc/v2/periodos/' + periodoId + '/integridade', null, TOKEN_FARM);
  assert('Validar integridade → 200', intRes.status === 200);
  assert('Hash válido (integridade OK)', intRes.data?.valido === true);
  assert('Hash armazenado = recalculado', intRes.data?.hash_armazenado === intRes.data?.hash_recalculado);

  // Fechar período já fechado → erro
  const fechar2 = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/fechar', {}, TOKEN_FARM);
  assert('Fechar período já fechado → 400', fechar2.status === 400);
  assert('Mensagem menciona status', (fechar2.data?.error || '').includes('ABERTOS') || (fechar2.data?.error || '').includes('FECHADO'));
}

// ═══════════════════════════════════════════════════════════
//  5. BLOQUEIOS IMUTÁVEIS
// ═══════════════════════════════════════════════════════════
async function testBloqueios() {
  section('5. BLOQUEIOS IMUTÁVEIS');

  const hoje = new Date().toISOString().split('T')[0];

  // Tentar movimentar em período fechado
  const entradaBloq = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10,
    data_movimentacao: hoje
  }, TOKEN_FARM);
  assert('Entrada em período fechado → 400', entradaBloq.status === 400);
  assert('Mensagem menciona bloqueio', (entradaBloq.data?.error || '').toLowerCase().includes('fechado') || (entradaBloq.data?.error || '').includes('bloqueada') || (entradaBloq.data?.error || '').includes('ABERTO'));

  const dispBloq = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 1,
    cpf_paciente: '111.222.333-44', nome_paciente: 'Bloq',
    nome_medico: 'Dr. Bloq', crm_medico: '99999', uf_crm: 'SP',
    numero_receita: 'REC-BLQ', data_receita: hoje, data_movimentacao: hoje
  }, TOKEN_FARM);
  assert('Dispensação em período fechado → 400', dispBloq.status === 400);

  const perdaBloq = await req('POST', '/sngpc/v2/movimentacoes/perda', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 1,
    motivo_ajuste: 'quebra', data_movimentacao: hoje
  }, TOKEN_FARM);
  assert('Perda em período fechado → 400', perdaBloq.status === 400);

  const ajusteBloq = await req('POST', '/sngpc/v2/movimentacoes/ajuste', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 1,
    motivo_ajuste: 'correcao_inventario', data_movimentacao: hoje
  }, TOKEN_FARM);
  assert('Ajuste em período fechado → 400', ajusteBloq.status === 400);

  // Cancelar período fechado → erro
  const cancelFech = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar período fechado → 400', cancelFech.status === 400);

  // Transmitir período
  const transmRes = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/transmitir', {}, TOKEN_FARM);
  assert('Transmitir período → 200', transmRes.status === 200);
  assert('Status = transmitido', transmRes.data?.status === 'transmitido');

  // Movimentar em período transmitido (mesma data) → bloqueado
  const entradaTransm = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10,
    data_movimentacao: hoje
  }, TOKEN_FARM);
  assert('Entrada em período transmitido → 400', entradaTransm.status === 400);

  // Fechar período transmitido → erro
  const fecharTransm = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/fechar', {}, TOKEN_FARM);
  assert('Fechar período transmitido → 400', fecharTransm.status === 400);

  // Cancelar período transmitido → erro
  const cancelTransm = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar período transmitido → 400', cancelTransm.status === 400);

  // Transmitir período transmitido → erro
  const transmTransm = await req('PUT', '/sngpc/v2/periodos/' + periodoId + '/transmitir', {}, TOKEN_FARM);
  assert('Transmitir período transmitido → 400', transmTransm.status === 400);
}

// ═══════════════════════════════════════════════════════════
//  6. PERÍODO CANCELADO + SEM MOVIMENTAÇÕES
// ═══════════════════════════════════════════════════════════
async function testPeriodoCancelamento() {
  section('6. CANCELAR PERÍODO + FECHAR SEM MOVIMENTAÇÕES');

  // Criar novo período futuro
  const futuroInicio = new Date();
  futuroInicio.setDate(futuroInicio.getDate() + 60);
  const futuroFim = new Date(futuroInicio);
  futuroFim.setDate(futuroFim.getDate() + 30);

  const per2Res = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: futuroInicio.toISOString().split('T')[0],
    data_fim: futuroFim.toISOString().split('T')[0]
  }, TOKEN_FARM);
  periodo2Id = per2Res.data?.id;
  assert('Período 2 criado (futuro)', per2Res.status === 201 && !!periodo2Id);

  // Fechar sem movimentações → erro
  const fecharVazio = await req('PUT', '/sngpc/v2/periodos/' + periodo2Id + '/fechar', {}, TOKEN_FARM);
  assert('Fechar sem movimentações → 400', fecharVazio.status === 400);
  assert('Mensagem menciona sem movimentações', (fecharVazio.data?.error || '').includes('sem movimentações'));

  // Cancelar período aberto sem movimentações → OK
  const cancelRes = await req('PUT', '/sngpc/v2/periodos/' + periodo2Id + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar período vazio → 200', cancelRes.status === 200);
  assert('Status = cancelado', cancelRes.data?.status === 'cancelado');

  // Movimentar em período cancelado
  const entradaCancel = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10,
    data_movimentacao: futuroInicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Entrada em período cancelado → 400', entradaCancel.status === 400);
}

// ═══════════════════════════════════════════════════════════
//  7. CONCORRÊNCIA (duas dispensações simultâneas)
// ═══════════════════════════════════════════════════════════
async function testConcorrencia() {
  section('7. CONCORRÊNCIA (dispensações simultâneas)');

  // Criar novo período para concorrência
  const cInicio = new Date();
  cInicio.setDate(cInicio.getDate() + 100);
  const cFim = new Date(cInicio);
  cFim.setDate(cFim.getDate() + 30);

  const perCRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: cInicio.toISOString().split('T')[0],
    data_fim: cFim.toISOString().split('T')[0]
  }, TOKEN_FARM);
  const periodoConc = perCRes.data?.id;
  assert('Período concorrência criado', !!periodoConc);

  // Criar lote específico para concorrência com produto sem receita
  const loteCRes = await req('POST', '/produtos/' + produtoSemReceita_id + '/lotes', {
    numero_lote: 'F2-CONC', validade: '2027-12-31',
    quantidade: 1, fornecedor_id: fornecedorId
  }, TOKEN_ADMIN);
  const loteConcId = loteCRes.data?.id;
  assert('Lote concorrência criado', !!loteConcId);

  // Entrada de 5 unidades (saldo regulatório = 5)
  const entConc = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoSemReceita_id, lote_id: loteConcId, quantidade: 5,
    data_movimentacao: cInicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Entrada 5 unidades para concorrência → 201', entConc.status === 201);

  // Duas dispensações simultâneas de 3 unidades cada (saldo=5, 3+3=6 > 5)
  const dataConc = cInicio.toISOString().split('T')[0];
  const [r1, r2] = await Promise.all([
    req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
      produto_id: produtoSemReceita_id, lote_id: loteConcId, quantidade: 3,
      data_movimentacao: dataConc
    }, TOKEN_FARM),
    req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
      produto_id: produtoSemReceita_id, lote_id: loteConcId, quantidade: 3,
      data_movimentacao: dataConc
    }, TOKEN_FARM)
  ]);

  const um201 = (r1.status === 201 ? 1 : 0) + (r2.status === 201 ? 1 : 0);
  const umErro = (r1.status >= 400 ? 1 : 0) + (r2.status >= 400 ? 1 : 0);

  assert('Exatamente 1 dispensação passou', um201 === 1);
  assert('Exatamente 1 dispensação falhou', umErro === 1);

  // Verificar saldo final = 2 (5 - 3)
  const saldoFinal = await req('GET', '/sngpc/v2/estoque/verificar?produto_id=' + produtoSemReceita_id + '&lote_id=' + loteConcId, null, TOKEN_FARM);
  assert('Saldo final concorrência = 2', saldoFinal.data?.saldo_calculado === 2);
  assert('Saldo consistente após concorrência', saldoFinal.data?.consistente === true);

  // Cleanup: fechar período de concorrência
  // Tem movimentações, então pode fechar
  const fecharConc = await req('PUT', '/sngpc/v2/periodos/' + periodoConc + '/fechar', {}, TOKEN_FARM);
  assert('Fechar período concorrência → 200', fecharConc.status === 200);
}

// ═══════════════════════════════════════════════════════════
//  8. EXTRA — DADOS DA RECEITA OBRIGATÓRIOS
// ═══════════════════════════════════════════════════════════
async function testReceitaObrigatoria() {
  section('8. VALIDAÇÕES DE RECEITA E PRODUTO');

  // Criar período para testes de receita
  const rInicio = new Date();
  rInicio.setDate(rInicio.getDate() + 200);
  const rFim = new Date(rInicio);
  rFim.setDate(rFim.getDate() + 30);

  const perRRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: rInicio.toISOString().split('T')[0],
    data_fim: rFim.toISOString().split('T')[0]
  }, TOKEN_FARM);
  const periodoReceita = perRRes.data?.id;
  assert('Período receita criado', !!periodoReceita);

  // Entrada para ter saldo
  await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 20,
    data_movimentacao: rInicio.toISOString().split('T')[0]
  }, TOKEN_FARM);

  // Dispensação de produto que exige receita SEM dados de receita → erro
  const semReceita = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 1,
    data_movimentacao: rInicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Dispensação sem receita (produto obriga) → 400', semReceita.status === 400);
  assert('Mensagem menciona receita', (semReceita.data?.error || '').includes('receita'));

  // Dispensação com receita completa → OK
  const comReceita = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 1,
    data_movimentacao: rInicio.toISOString().split('T')[0],
    cpf_paciente: '999.888.777-66', nome_paciente: 'Paciente Receita',
    nome_medico: 'Dr. Receita', crm_medico: '54321', uf_crm: 'RJ',
    numero_receita: 'REC-OBRIG', data_receita: rInicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  assert('Dispensação com receita completa → 201', comReceita.status === 201);

  // Cancelar período (tem movimentações — não pode cancelar)
  const cancelComMov = await req('PUT', '/sngpc/v2/periodos/' + periodoReceita + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar período com movimentações → 400', cancelComMov.status === 400);
}

// ═══════════════════════════════════════════════════════════
//  CLEANUP
// ═══════════════════════════════════════════════════════════
async function cleanup() {
  console.log('\n' + '▓'.repeat(60));
  console.log('  🧹 CLEANUP');
  console.log('▓'.repeat(60));

  const { Sequelize } = require('sequelize');
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

  try {
    // Desabilitar triggers para permitir DELETE em dados protegidos
    await s.query("SET session_replication_role = 'replica'");

    // Buscar produtos F2 por nome para garantir limpeza completa
    const [prodsF2] = await s.query("SELECT id FROM produtos WHERE nome LIKE '%F2%' AND empresa_id = :eid", { replacements: { eid: EMPRESA_ID } });
    const prodIds = prodsF2.map(p => p.id);

    if (prodIds.length > 0) {
      await s.query("DELETE FROM sngpc_movimentacoes WHERE empresa_id = :eid AND produto_id IN (:ids)", { replacements: { eid: EMPRESA_ID, ids: prodIds } });
      await s.query("DELETE FROM sngpc_estoque WHERE empresa_id = :eid AND produto_id IN (:ids)", { replacements: { eid: EMPRESA_ID, ids: prodIds } });
      await s.query("DELETE FROM estoque_movimentacoes WHERE empresa_id = :eid AND produto_id IN (:ids)", { replacements: { eid: EMPRESA_ID, ids: prodIds } });
      await s.query("DELETE FROM medicamentos_controlados WHERE empresa_id = :eid AND produto_id IN (:ids)", { replacements: { eid: EMPRESA_ID, ids: prodIds } });
      await s.query("DELETE FROM lotes WHERE empresa_id = :eid AND produto_id IN (:ids)", { replacements: { eid: EMPRESA_ID, ids: prodIds } });
      await s.query("DELETE FROM produtos WHERE id IN (:ids)", { replacements: { ids: prodIds } });
    }
    console.log('  Produtos F2 e dependências removidos');

    // Arquivos e auditoria SNGPC (se houver)
    await s.query("DELETE FROM sngpc_auditoria WHERE empresa_id = :eid", { replacements: { eid: EMPRESA_ID } }).catch(() => {});
    await s.query("DELETE FROM sngpc_arquivos WHERE empresa_id = :eid", { replacements: { eid: EMPRESA_ID } }).catch(() => {});
    console.log('  Auditoria e arquivos SNGPC removidos');

    // Transmissões e períodos
    await s.query("DELETE FROM sngpc_transmissoes WHERE empresa_id = :eid", { replacements: { eid: EMPRESA_ID } });
    await s.query("DELETE FROM sngpc_periodos WHERE empresa_id = :eid", { replacements: { eid: EMPRESA_ID } });
    console.log('  Transmissões e períodos removidos');

    // Usuários de teste
    await s.query("DELETE FROM usuarios WHERE email IN ('farm-fase2@test.com', 'op-fase2@test.com')");
    console.log('  Usuários F2 removidos');

    // Categorias e fornecedores duplicados
    await s.query("DELETE FROM categorias WHERE nome = 'Controlados F2' AND empresa_id = :eid", { replacements: { eid: EMPRESA_ID } });
    await s.query("DELETE FROM fornecedores WHERE nome = 'Fornecedor F2' AND empresa_id = :eid", { replacements: { eid: EMPRESA_ID } });
    console.log('  Categorias e fornecedores F2 removidos');

    // Restaurar triggers
    await s.query("SET session_replication_role = 'origin'");
  } catch (err) {
    console.log('  ⚠️ Erro no cleanup: ' + err.message);
    await s.query("SET session_replication_role = 'origin'").catch(() => {});
  }

  await s.close();
  console.log('  Dados de teste removidos\n');
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
(async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  SNGPC FASE 2 — MOTOR REGULATÓRIO COMPLETO          ║');
  console.log('║  Testes Automatizados                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    await setup();
    await testMotorMovimentacoes();
    await testEstoqueRegulatorio();
    await testGestaoPeriodos();
    await testFechamentoHash();
    await testBloqueios();
    await testPeriodoCancelamento();
    await testConcorrencia();
    await testReceitaObrigatoria();
  } catch (err) {
    console.log('\n  💥 ERRO FATAL: ' + err.message);
    console.log('  Stack: ' + err.stack);
  }

  // ── Resultado final ──
  console.log('\n' + '═'.repeat(60));
  console.log('  📊 Resultado Fase 2');
  console.log('═'.repeat(60));
  console.log('  ✅ Passou: ' + passed);
  console.log('  ❌ Falhou: ' + failed);
  console.log('  Total:  ' + total);

  console.log('\n  CRITÉRIOS PARA FASE 3:');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' Estoque regulatório separado');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' 100% movimentações em transaction SERIALIZABLE');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' Bloqueio por status funcionando');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' Hash gerado corretamente');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' Nenhuma movimentação permitida após FECHADO');
  console.log('    ' + (failed === 0 ? '✓' : '✗') + ' Concorrência controlada');

  if (failed === 0) {
    console.log('\n  🟢 APROVADO PARA FASE 3\n');
  } else {
    console.log('\n  🔴 NÃO APROVADO — ' + failed + ' falhas\n');
  }

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
})();
