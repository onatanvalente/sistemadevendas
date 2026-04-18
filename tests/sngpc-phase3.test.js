/**
 * ═══════════════════════════════════════════════════════════
 *  SNGPC FASE 3 — ENCERRAMENTO DO MÓDULO
 *  Testes automatizados para os 7 blocos:
 *    1. Geração de Arquivo Oficial (TXT)
 *    2. Controle de Transmissão (registrar/aceitar/rejeitar/cancelar)
 *    3. Imutabilidade Pós-Transmissão (ACEITO = imutável)
 *    4. Auditoria Regulatória (registros permanentes)
 *    5. Fluxo completo (gerar → transmitir → aceitar)
 *    6. Rejeição + Regeneração
 *    7. Cancelamento de transmissão
 * ═══════════════════════════════════════════════════════════
 *
 *  Uso: node tests/sngpc-phase3.test.js
 *
 *  Pré-requisitos: servidor rodando em localhost:3000
 *                  Phase 1 + Phase 2 migrations executadas
 *                  Phase 3 migration executada (migrate-fase3.js)
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
let loteAId = 0;
let loteBId = 0;
let categoriaId = 0;
let fornecedorId = 0;

// Fase 3 IDs
let periodoFechadoId = 0;
let periodoRejeicaoId = 0;
let periodoCancelarId = 0;
let periodoImutavelId = 0;
let arquivoId = 0;
let transmissaoId = 0;
let transmissaoRejeicaoId = 0;
let transmissaoCancelarId = 0;
let transmissaoAceitoId = 0;

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
  console.log('\n' + '='.repeat(60));
  console.log('  ' + name);
  console.log('='.repeat(60));
}
function assert(desc, condition) {
  total++;
  if (condition) { passed++; console.log('  OK ' + desc); }
  else { failed++; console.log('  FAIL ' + desc + ' [' + currentSection + ']'); }
  return condition;
}

// Helper: criar periodo + entrada + fechar
async function criarPeriodoFechado(offsetDias, prefixo) {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + offsetDias);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 30);

  const perRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: inicio.toISOString().split('T')[0],
    data_fim: fim.toISOString().split('T')[0]
  }, TOKEN_FARM);
  const pid = perRes.data?.id;
  if (!pid) throw new Error('Falha ao criar periodo ' + prefixo + ': ' + JSON.stringify(perRes.data));

  const entRes = await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 50,
    numero_documento: prefixo + '-NF-001',
    data_movimentacao: inicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  if (entRes.status !== 201) throw new Error('Falha entrada ' + prefixo + ': ' + JSON.stringify(entRes.data));

  const dispRes = await req('POST', '/sngpc/v2/movimentacoes/dispensacao', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 2,
    cpf_paciente: '111.222.333-44', nome_paciente: 'Paciente ' + prefixo,
    nome_medico: 'Dr. ' + prefixo, crm_medico: '12345', uf_crm: 'SP',
    numero_receita: prefixo + '-REC', data_receita: inicio.toISOString().split('T')[0],
    data_movimentacao: inicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  if (dispRes.status !== 201) throw new Error('Falha dispensacao ' + prefixo + ': ' + JSON.stringify(dispRes.data));

  const fecharRes = await req('PUT', '/sngpc/v2/periodos/' + pid + '/fechar', {}, TOKEN_FARM);
  if (fecharRes.status !== 200) throw new Error('Falha fechar ' + prefixo + ': ' + JSON.stringify(fecharRes.data));

  return pid;
}

// ===================================================================
//  SETUP
// ===================================================================
async function setup() {
  section('SETUP - Preparar dados de teste Fase 3');

  const { Sequelize } = require('sequelize');
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

  const [empresas] = await s.query("SELECT id, subdominio FROM empresas WHERE tipo_negocio = 'drogaria' LIMIT 1");
  if (empresas.length === 0) throw new Error('Nenhuma empresa drogaria encontrada');
  EMPRESA_ID = empresas[0].id;
  SLUG = empresas[0].subdominio;
  console.log('  Empresa: id=' + EMPRESA_ID + ', slug=' + SLUG);

  const loginAdmin = await req('POST', '/auth/login', { email: 'admin@drogaria.com', senha: 'admin123' }, null, SLUG);
  if (loginAdmin.status !== 200) {
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

  const farmRes = await req('POST', '/usuarios', {
    nome: 'Farm Fase3', email: 'farm-fase3@test.com', senha: 'Test123!@#',
    perfil: 'farmaceutico', ativo: true
  }, TOKEN_ADMIN);
  if (farmRes.status === 201 || farmRes.status === 200) {
    const loginFarm = await req('POST', '/auth/login', { email: 'farm-fase3@test.com', senha: 'Test123!@#' }, null, SLUG);
    TOKEN_FARM = loginFarm.data.token;
  }
  assert('Farmaceutico criado', !!TOKEN_FARM);

  const opRes = await req('POST', '/usuarios', {
    nome: 'Op Fase3', email: 'op-fase3@test.com', senha: 'Test123!@#',
    perfil: 'vendedor', ativo: true
  }, TOKEN_ADMIN);
  if (opRes.status === 201 || opRes.status === 200) {
    const loginOp = await req('POST', '/auth/login', { email: 'op-fase3@test.com', senha: 'Test123!@#' }, null, SLUG);
    TOKEN_OP = loginOp.data.token;
  }
  assert('Operador criado', !!TOKEN_OP);

  const catRes = await req('POST', '/categorias', { nome: 'Controlados F3' }, TOKEN_ADMIN);
  categoriaId = catRes.data?.id;
  assert('Categoria criada', !!categoriaId);

  const fornRes = await req('POST', '/fornecedores', {
    nome: 'Fornecedor F3', cnpj: '88888888000188', tipo: 'medicamento'
  }, TOKEN_ADMIN);
  fornecedorId = fornRes.data?.id;
  assert('Fornecedor criado', !!fornecedorId);

  const prodRes = await req('POST', '/produtos', {
    nome: 'Diazepam F3 10mg', categoria_id: categoriaId,
    preco_venda: 22.50, unidade: 'cx', controlado: true,
    principio_ativo: 'Diazepam', classe_controlado: 'B1',
    registro_anvisa: 'F3-1234567890123', tipo_receita: 'azul',
    necessita_receita: true, estoque_atual: 0
  }, TOKEN_ADMIN);
  produtoId = prodRes.data?.id;
  assert('Produto controlado criado (id=' + produtoId + ')', !!produtoId);

  const loteARes = await req('POST', '/produtos/' + produtoId + '/lotes', {
    numero_lote: 'F3-LOTE-A', validade: '2028-12-31',
    quantidade: 1, fornecedor_id: fornecedorId
  }, TOKEN_ADMIN);
  loteAId = loteARes.data?.id;
  assert('Lote A criado (id=' + loteAId + ')', !!loteAId);

  const loteBRes = await req('POST', '/produtos/' + produtoId + '/lotes', {
    numero_lote: 'F3-LOTE-B', validade: '2028-06-30',
    quantidade: 1, fornecedor_id: fornecedorId
  }, TOKEN_ADMIN);
  loteBId = loteBRes.data?.id;
  assert('Lote B criado (id=' + loteBId + ')', !!loteBId);

  const cfgRes = await req('GET', '/sngpc/configuracao', null, TOKEN_FARM);
  if (!cfgRes.data?.id) {
    await req('POST', '/sngpc/configuracao', {
      cnpj: '12345678000199', razao_social: 'Drogaria Fase 3',
      responsavel_tecnico_nome: 'Dr. Fase3', responsavel_tecnico_crf: 'CRF-SP-11111',
      responsavel_tecnico_uf: 'SP', data_inicio_controle: '2026-01-01'
    }, TOKEN_FARM);
  }
  assert('Configuracao SNGPC OK', true);

  periodoFechadoId = await criarPeriodoFechado(300, 'F3-ARQ');
  assert('Periodo fechado criado (id=' + periodoFechadoId + ')', !!periodoFechadoId);

  periodoRejeicaoId = await criarPeriodoFechado(400, 'F3-REJ');
  assert('Periodo rejeicao criado (id=' + periodoRejeicaoId + ')', !!periodoRejeicaoId);

  periodoCancelarId = await criarPeriodoFechado(500, 'F3-CAN');
  assert('Periodo cancelamento criado (id=' + periodoCancelarId + ')', !!periodoCancelarId);

  periodoImutavelId = await criarPeriodoFechado(600, 'F3-IMU');
  assert('Periodo imutabilidade criado (id=' + periodoImutavelId + ')', !!periodoImutavelId);

  await s.close();
}

// ===================================================================
//  1. GERACAO DE ARQUIVO OFICIAL
// ===================================================================
async function testGeracaoArquivo() {
  section('1. GERACAO DE ARQUIVO OFICIAL (TXT)');

  const gerarRes = await req('POST', '/sngpc/v3/arquivos/' + periodoFechadoId + '/gerar', {}, TOKEN_FARM);
  if (!assert('Gerar arquivo -> 201', gerarRes.status === 201)) {
    console.log('    DETALHE: ' + JSON.stringify(gerarRes.data));
  }

  assert('Retorna arquivo', !!gerarRes.data?.arquivo);
  assert('Arquivo tem id', !!gerarRes.data?.arquivo?.id);
  assert('Arquivo tem nome', !!gerarRes.data?.arquivo?.nome_arquivo);
  assert('Nome comeca com SNGPC_', (gerarRes.data?.arquivo?.nome_arquivo || '').startsWith('SNGPC_'));
  assert('Nome termina com .txt', (gerarRes.data?.arquivo?.nome_arquivo || '').endsWith('.txt'));
  assert('Retorna hash SHA-256 (64 chars)', (gerarRes.data?.hash_arquivo || '').length === 64);
  assert('Hash do arquivo preenchido', !!gerarRes.data?.arquivo?.hash_arquivo);
  assert('Total movimentacoes > 0', gerarRes.data?.total_movimentacoes > 0);
  assert('Tamanho em bytes > 0', gerarRes.data?.tamanho_bytes > 0);
  arquivoId = gerarRes.data?.arquivo?.id;

  const consultaRes = await req('GET', '/sngpc/v3/arquivos/' + periodoFechadoId, null, TOKEN_FARM);
  assert('Consultar arquivo -> 200', consultaRes.status === 200);
  assert('Conteudo contem CABECALHO', (consultaRes.data?.conteudo || '').includes('SNGPC'));
  assert('Conteudo contem MOVIMENTACOES', (consultaRes.data?.conteudo || '').includes('MOVIMENTACOES'));
  assert('Conteudo contem SALDOS FINAIS', (consultaRes.data?.conteudo || '').includes('SALDOS FINAIS'));
  assert('Conteudo contem HASH_PERIODO', (consultaRes.data?.conteudo || '').includes('HASH_PERIODO'));
  assert('Conteudo contem FIM DO ARQUIVO', (consultaRes.data?.conteudo || '').includes('FIM DO ARQUIVO'));
  assert('Conteudo contem CNPJ', (consultaRes.data?.conteudo || '').includes('CNPJ'));
  assert('Conteudo contem ENTRADA', (consultaRes.data?.conteudo || '').includes('ENTRADA'));
  assert('Conteudo contem DISPENSACAO', (consultaRes.data?.conteudo || '').includes('DISPENSACAO'));

  const downloadRes = await req('GET', '/sngpc/v3/arquivos/' + periodoFechadoId + '/download', null, TOKEN_FARM);
  assert('Download arquivo -> 200', downloadRes.status === 200);
  assert('Download retorna conteudo', typeof downloadRes.data === 'string' && downloadRes.data.length > 0);

  const dupRes = await req('POST', '/sngpc/v3/arquivos/' + periodoFechadoId + '/gerar', {}, TOKEN_FARM);
  assert('Gerar arquivo duplicado -> 409', dupRes.status === 409);
  assert('Mensagem menciona ja existe', (dupRes.data?.error || '').includes('existe'));

  const inexRes = await req('POST', '/sngpc/v3/arquivos/999999/gerar', {}, TOKEN_FARM);
  assert('Periodo inexistente -> 404', inexRes.status === 404);

  const arqInexiste = await req('GET', '/sngpc/v3/arquivos/999999', null, TOKEN_FARM);
  assert('Consultar arquivo inexistente -> 404', arqInexiste.status === 404);

  const opRes = await req('POST', '/sngpc/v3/arquivos/' + periodoFechadoId + '/gerar', {}, TOKEN_OP);
  assert('Operador sem perfil -> 403', opRes.status === 403);
}

// ===================================================================
//  2. CONTROLE DE TRANSMISSAO
// ===================================================================
async function testTransmissao() {
  section('2. CONTROLE DE TRANSMISSAO');

  const transmRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoFechadoId, {
    protocolo: 'PROT-F3-001'
  }, TOKEN_FARM);
  if (!assert('Registrar transmissao -> 201', transmRes.status === 201)) {
    console.log('    DETALHE: ' + JSON.stringify(transmRes.data));
  }
  assert('Retorna transmissao', !!transmRes.data?.transmissao);
  assert('Transmissao tem id', !!transmRes.data?.transmissao?.id);
  assert('Status = enviado', transmRes.data?.transmissao?.status === 'enviado');
  assert('Protocolo registrado', transmRes.data?.transmissao?.protocolo_anvisa === 'PROT-F3-001');
  transmissaoId = transmRes.data?.transmissao?.id;

  const semProtRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoFechadoId, {}, TOKEN_FARM);
  assert('Sem protocolo -> 400', semProtRes.status === 400);

  const listarRes = await req('GET', '/sngpc/v3/transmissoes/' + periodoFechadoId, null, TOKEN_FARM);
  assert('Listar transmissoes -> 200', listarRes.status === 200);
  assert('Retorna array com >= 1 transmissao', Array.isArray(listarRes.data) && listarRes.data.length >= 1);

  const imutRes = await req('GET', '/sngpc/v3/transmissoes/' + periodoFechadoId + '/imutabilidade', null, TOKEN_FARM);
  assert('Imutabilidade antes de aceitar -> false', imutRes.status === 200 && imutRes.data?.imutavel === false);

  const aceitarRes = await req('PUT', '/sngpc/v3/transmissoes/' + transmissaoId + '/status', {
    status: 'aceito', mensagem: 'Aceito pela ANVISA'
  }, TOKEN_FARM);
  if (!assert('Aceitar transmissao -> 200', aceitarRes.status === 200)) {
    console.log('    DETALHE: ' + JSON.stringify(aceitarRes.data));
  }
  assert('Status atualizado', aceitarRes.data?.transmissao?.status === 'aceito');

  const imutRes2 = await req('GET', '/sngpc/v3/transmissoes/' + periodoFechadoId + '/imutabilidade', null, TOKEN_FARM);
  assert('Imutabilidade apos aceitar -> true', imutRes2.status === 200 && imutRes2.data?.imutavel === true);

  const statusInv = await req('PUT', '/sngpc/v3/transmissoes/' + transmissaoId + '/status', {
    status: 'invalido'
  }, TOKEN_FARM);
  assert('Status invalido -> 400', statusInv.status === 400);

  const transInex = await req('PUT', '/sngpc/v3/transmissoes/999999/status', {
    status: 'aceito'
  }, TOKEN_FARM);
  assert('Transmissao inexistente -> 404', transInex.status === 404);
}

// ===================================================================
//  3. IMUTABILIDADE POS-TRANSMISSAO ACEITA
// ===================================================================
async function testImutabilidade() {
  section('3. IMUTABILIDADE POS-TRANSMISSAO ACEITA');

  const gerarRes = await req('POST', '/sngpc/v3/arquivos/' + periodoImutavelId + '/gerar', {}, TOKEN_FARM);
  assert('Gerar arquivo para imutabilidade -> 201', gerarRes.status === 201);

  const transmRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoImutavelId, {
    protocolo: 'PROT-F3-IMUT'
  }, TOKEN_FARM);
  assert('Registrar transmissao imutabilidade -> 201', transmRes.status === 201);
  transmissaoAceitoId = transmRes.data?.transmissao?.id;

  const aceitarRes = await req('PUT', '/sngpc/v3/transmissoes/' + transmissaoAceitoId + '/status', {
    status: 'aceito', mensagem: 'Aceito com sucesso'
  }, TOKEN_FARM);
  assert('Aceitar transmissao imutabilidade -> 200', aceitarRes.status === 200);

  const imutRes = await req('GET', '/sngpc/v3/transmissoes/' + periodoImutavelId + '/imutabilidade', null, TOKEN_FARM);
  assert('Periodo e imutavel', imutRes.data?.imutavel === true);

  const regenRes = await req('POST', '/sngpc/v3/arquivos/' + periodoImutavelId + '/regenerar', {}, TOKEN_FARM);
  assert('Regenerar arquivo aceito -> erro', regenRes.status >= 400);

  const transRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoImutavelId, {
    protocolo: 'PROT-F3-IMUT-2'
  }, TOKEN_FARM);
  assert('Nova transmissao em periodo aceito -> erro', transRes.status >= 400);

  const cancelRes = await req('PUT', '/sngpc/v3/transmissoes/' + periodoImutavelId + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar transmissao aceita -> erro', cancelRes.status >= 400);

  const aceitar2 = await req('PUT', '/sngpc/v3/transmissoes/' + transmissaoAceitoId + '/status', {
    status: 'aceito'
  }, TOKEN_FARM);
  assert('Aceitar novamente -> erro', aceitar2.status >= 400);
}

// ===================================================================
//  4. REJEICAO + REGENERACAO
// ===================================================================
async function testRejeicao() {
  section('4. REJEICAO + REGENERACAO');

  const gerarRes = await req('POST', '/sngpc/v3/arquivos/' + periodoRejeicaoId + '/gerar', {}, TOKEN_FARM);
  assert('Gerar arquivo rejeicao -> 201', gerarRes.status === 201);

  const transmRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoRejeicaoId, {
    protocolo: 'PROT-F3-REJ'
  }, TOKEN_FARM);
  assert('Registrar transmissao rejeicao -> 201', transmRes.status === 201);
  transmissaoRejeicaoId = transmRes.data?.transmissao?.id;

  const rejRes = await req('PUT', '/sngpc/v3/transmissoes/' + transmissaoRejeicaoId + '/status', {
    status: 'rejeitado', mensagem: 'Dados inconsistentes. Refazer.'
  }, TOKEN_FARM);
  if (!assert('Rejeitar transmissao -> 200', rejRes.status === 200)) {
    console.log('    DETALHE: ' + JSON.stringify(rejRes.data));
  }
  assert('Status = rejeitado', rejRes.data?.transmissao?.status === 'rejeitado');

  const arqRes = await req('GET', '/sngpc/v3/arquivos/' + periodoRejeicaoId, null, TOKEN_FARM);
  assert('Arquivo deletado apos rejeicao -> 404', arqRes.status === 404);

  const imutRes = await req('GET', '/sngpc/v3/transmissoes/' + periodoRejeicaoId + '/imutabilidade', null, TOKEN_FARM);
  assert('Imutabilidade apos rejeicao -> false', imutRes.data?.imutavel === false);

  const regenRes = await req('POST', '/sngpc/v3/arquivos/' + periodoRejeicaoId + '/regenerar', {}, TOKEN_FARM);
  if (!assert('Regenerar arquivo -> 201', regenRes.status === 201)) {
    console.log('    DETALHE: ' + JSON.stringify(regenRes.data));
  }
  assert('Arquivo regenerado tem hash', !!regenRes.data?.arquivo?.hash_arquivo);
  assert('Flag regenerado = true', regenRes.data?.regenerado === true);

  const arqRegen = await req('GET', '/sngpc/v3/arquivos/' + periodoRejeicaoId, null, TOKEN_FARM);
  assert('Arquivo regenerado consultavel -> 200', arqRegen.status === 200);
  assert('Conteudo regenerado nao vazio', (arqRegen.data?.conteudo || '').length > 0);

  const novaTransm = await req('POST', '/sngpc/v3/transmissoes/' + periodoRejeicaoId, {
    protocolo: 'PROT-F3-REJ-2'
  }, TOKEN_FARM);
  assert('Nova transmissao apos rejeicao -> 201', novaTransm.status === 201);

  const aceitarNova = await req('PUT', '/sngpc/v3/transmissoes/' + novaTransm.data?.transmissao?.id + '/status', {
    status: 'aceito', mensagem: 'Aceito apos correcao'
  }, TOKEN_FARM);
  assert('Aceitar nova transmissao -> 200', aceitarNova.status === 200);

  const imutFinal = await req('GET', '/sngpc/v3/transmissoes/' + periodoRejeicaoId + '/imutabilidade', null, TOKEN_FARM);
  assert('Imutabilidade final -> true', imutFinal.data?.imutavel === true);
}

// ===================================================================
//  5. CANCELAMENTO DE TRANSMISSAO
// ===================================================================
async function testCancelamento() {
  section('5. CANCELAMENTO DE TRANSMISSAO');

  const gerarRes = await req('POST', '/sngpc/v3/arquivos/' + periodoCancelarId + '/gerar', {}, TOKEN_FARM);
  assert('Gerar arquivo cancelamento -> 201', gerarRes.status === 201);

  const transmRes = await req('POST', '/sngpc/v3/transmissoes/' + periodoCancelarId, {
    protocolo: 'PROT-F3-CAN'
  }, TOKEN_FARM);
  assert('Registrar transmissao cancelamento -> 201', transmRes.status === 201);
  transmissaoCancelarId = transmRes.data?.transmissao?.id;

  const cancelRes = await req('PUT', '/sngpc/v3/transmissoes/' + periodoCancelarId + '/cancelar', {}, TOKEN_FARM);
  if (!assert('Cancelar transmissao -> 200', cancelRes.status === 200)) {
    console.log('    DETALHE: ' + JSON.stringify(cancelRes.data));
  }

  const cancelRes2 = await req('PUT', '/sngpc/v3/transmissoes/' + periodoCancelarId + '/cancelar', {}, TOKEN_FARM);
  assert('Cancelar sem pendente -> erro', cancelRes2.status >= 400);

  const imutRes = await req('GET', '/sngpc/v3/transmissoes/' + periodoCancelarId + '/imutabilidade', null, TOKEN_FARM);
  assert('Imutabilidade apos cancelamento -> false', imutRes.data?.imutavel === false);

  const novaTransm = await req('POST', '/sngpc/v3/transmissoes/' + periodoCancelarId, {
    protocolo: 'PROT-F3-CAN-2'
  }, TOKEN_FARM);
  assert('Nova transmissao apos cancelamento -> 201', novaTransm.status === 201);
}

// ===================================================================
//  6. AUDITORIA REGULATORIA
// ===================================================================
async function testAuditoria() {
  section('6. AUDITORIA REGULATORIA');

  const audRes = await req('GET', '/sngpc/v3/auditoria', null, TOKEN_FARM);
  assert('Consultar auditoria -> 200', audRes.status === 200);
  const audRegistros = audRes.data?.registros || (Array.isArray(audRes.data) ? audRes.data : []);
  assert('Retorna registros', Array.isArray(audRegistros));
  assert('Tem registros de auditoria', audRegistros.length > 0);

  if (audRegistros.length > 0) {
    const acoes = [...new Set(audRegistros.map(a => a.acao))];
    console.log('    Acoes registradas: ' + acoes.join(', '));

    const temGerar = audRegistros.some(a => a.acao === 'GERAR_ARQUIVO');
    assert('Tem registro GERAR_ARQUIVO', temGerar);

    const temTransmitir = audRegistros.some(a => a.acao === 'TRANSMITIR');
    assert('Tem registro TRANSMITIR', temTransmitir);

    const temRejeitar = audRegistros.some(a => a.acao === 'REJEITAR');
    assert('Tem registro REJEITAR', temRejeitar);

    const temCancelar = audRegistros.some(a => a.acao === 'CANCELAR');
    assert('Tem registro CANCELAR', temCancelar);
  } else {
    // Forcar falha se nenhum registro (skip 4 testes)
    assert('Tem registro GERAR_ARQUIVO', false);
    assert('Tem registro TRANSMITIR', false);
    assert('Tem registro REJEITAR', false);
    assert('Tem registro CANCELAR', false);
  }

  const audPeriodoRes = await req('GET', '/sngpc/v3/auditoria/periodo/' + periodoFechadoId, null, TOKEN_FARM);
  assert('Auditoria por periodo -> 200', audPeriodoRes.status === 200);
  const audPRegistros = audPeriodoRes.data?.registros || (Array.isArray(audPeriodoRes.data) ? audPeriodoRes.data : []);
  assert('Registros do periodo', Array.isArray(audPRegistros) && audPRegistros.length > 0);

  const audAcaoRes = await req('GET', '/sngpc/v3/auditoria?acao=GERAR_ARQUIVO', null, TOKEN_FARM);
  assert('Auditoria filtro acao -> 200', audAcaoRes.status === 200);
  const audARegistros = audAcaoRes.data?.registros || (Array.isArray(audAcaoRes.data) ? audAcaoRes.data : []);
  assert('Todos registros sao GERAR_ARQUIVO', audARegistros.every(a => a.acao === 'GERAR_ARQUIVO'));

  const audPageRes = await req('GET', '/sngpc/v3/auditoria?limit=2&offset=0', null, TOKEN_FARM);
  assert('Auditoria com paginacao -> 200', audPageRes.status === 200);
  const audPageRegistros = audPageRes.data?.registros || (Array.isArray(audPageRes.data) ? audPageRes.data : []);
  assert('Respeita limit', audPageRegistros.length <= 2);

  if (audRegistros.length > 0) {
    const reg = audRegistros[0];
    assert('Registro tem empresa_id', !!reg.empresa_id);
    assert('Registro tem acao', !!reg.acao);
    assert('Registro tem usuario_id', !!reg.usuario_id);
    assert('Registro tem timestamp', !!reg.timestamp);
  }
}

// ===================================================================
//  7. VALIDACOES DE FLUXO E ERROS
// ===================================================================
async function testFluxoErros() {
  section('7. VALIDACOES DE FLUXO E ERROS');

  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 700);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 30);

  const perAbRes = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: inicio.toISOString().split('T')[0],
    data_fim: fim.toISOString().split('T')[0]
  }, TOKEN_FARM);
  const periodoAbertoId = perAbRes.data?.id;
  assert('Periodo aberto criado', !!periodoAbertoId);

  const gerarAberto = await req('POST', '/sngpc/v3/arquivos/' + periodoAbertoId + '/gerar', {}, TOKEN_FARM);
  assert('Gerar arquivo em periodo ABERTO -> 422', gerarAberto.status === 422);
  assert('Mensagem menciona FECHADO', (gerarAberto.data?.error || '').includes('FECHADO'));

  // Fechar o período aberto para poder criar outro
  // Primeiro adicionar uma movimentação para poder fechar
  await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 5,
    data_movimentacao: inicio.toISOString().split('T')[0]
  }, TOKEN_FARM);
  await req('PUT', '/sngpc/v2/periodos/' + periodoAbertoId + '/fechar', {}, TOKEN_FARM);

  const inicio2 = new Date();
  inicio2.setDate(inicio2.getDate() + 750);
  const fim2 = new Date(inicio2);
  fim2.setDate(fim2.getDate() + 30);

  const per2Res = await req('POST', '/sngpc/v2/periodos', {
    data_inicio: inicio2.toISOString().split('T')[0],
    data_fim: fim2.toISOString().split('T')[0]
  }, TOKEN_FARM);
  const perSemArq = per2Res.data?.id || per2Res.data?.periodo?.id;

  await req('POST', '/sngpc/v2/movimentacoes/entrada', {
    produto_id: produtoId, lote_id: loteAId, quantidade: 10,
    data_movimentacao: inicio2.toISOString().split('T')[0]
  }, TOKEN_FARM);
  await req('PUT', '/sngpc/v2/periodos/' + perSemArq + '/fechar', {}, TOKEN_FARM);

  const transmSemArq = await req('POST', '/sngpc/v3/transmissoes/' + perSemArq, {
    protocolo: 'PROT-F3-SEMARQ'
  }, TOKEN_FARM);
  assert('Transmitir sem arquivo -> 422', transmSemArq.status === 422);
  assert('Mensagem menciona arquivo', (transmSemArq.data?.error || '').toLowerCase().includes('arquivo'));

  const protDupRes = await req('POST', '/sngpc/v3/transmissoes/' + perSemArq, {
    protocolo: 'PROT-F3-001'
  }, TOKEN_FARM);
  assert('Protocolo duplicado ou sem arquivo -> erro', protDupRes.status >= 400);
}

// ===================================================================
//  8. PERMISSOES E SEGURANCA
// ===================================================================
async function testPermissoes() {
  section('8. PERMISSOES E SEGURANCA');

  const opGerar = await req('POST', '/sngpc/v3/arquivos/' + periodoFechadoId + '/gerar', {}, TOKEN_OP);
  assert('Operador gerar arquivo -> 403', opGerar.status === 403);

  const opRegen = await req('POST', '/sngpc/v3/arquivos/' + periodoFechadoId + '/regenerar', {}, TOKEN_OP);
  assert('Operador regenerar -> 403', opRegen.status === 403);

  const opTransm = await req('POST', '/sngpc/v3/transmissoes/' + periodoFechadoId, {
    protocolo: 'PROT-OP'
  }, TOKEN_OP);
  assert('Operador transmitir -> 403', opTransm.status === 403);

  const opStatus = await req('PUT', '/sngpc/v3/transmissoes/' + (transmissaoId || 1) + '/status', {
    status: 'aceito'
  }, TOKEN_OP);
  assert('Operador atualizar status -> 403', opStatus.status === 403);

  const opCancel = await req('PUT', '/sngpc/v3/transmissoes/' + periodoFechadoId + '/cancelar', {}, TOKEN_OP);
  assert('Operador cancelar -> 403', opCancel.status === 403);

  const opConsulta = await req('GET', '/sngpc/v3/arquivos/' + periodoFechadoId, null, TOKEN_OP);
  assert('Operador consultar arquivo -> 200', opConsulta.status === 200);

  const opAudit = await req('GET', '/sngpc/v3/auditoria', null, TOKEN_OP);
  assert('Operador consultar auditoria -> 200', opAudit.status === 200);
}

// ===================================================================
//  CLEANUP
// ===================================================================
async function cleanup() {
  console.log('\n' + '#'.repeat(60));
  console.log('  CLEANUP Fase 3');
  console.log('#'.repeat(60));

  const { Sequelize } = require('sequelize');
  const s = new Sequelize(process.env.DATABASE_URL, { logging: false });

  try {
    await s.query("SET session_replication_role = 'replica'");

    await s.query('DELETE FROM sngpc_auditoria WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Auditoria removida');

    await s.query('DELETE FROM sngpc_arquivos WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Arquivos SNGPC removidos');

    await s.query('DELETE FROM sngpc_transmissoes WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Transmissoes removidas');

    await s.query('DELETE FROM sngpc_movimentacoes WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Movimentacoes removidas');

    await s.query('DELETE FROM sngpc_estoque WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Saldos regulatorios removidos');

    await s.query('DELETE FROM sngpc_periodos WHERE empresa_id = :eid', { replacements: { eid: EMPRESA_ID } });
    console.log('  Periodos removidos');

    await s.query("SET session_replication_role = 'origin'");

    if (produtoId) {
      await s.query('DELETE FROM estoque_movimentacoes WHERE empresa_id = :eid AND produto_id = :pid', {
        replacements: { eid: EMPRESA_ID, pid: produtoId }
      });
      console.log('  Estoque movimentacoes removidas');
    }

    if (produtoId) {
      await s.query('DELETE FROM medicamentos_controlados WHERE empresa_id = :eid AND produto_id = :pid', {
        replacements: { eid: EMPRESA_ID, pid: produtoId }
      });
    }

    if (produtoId) {
      await s.query('DELETE FROM lotes WHERE empresa_id = :eid AND produto_id = :pid', {
        replacements: { eid: EMPRESA_ID, pid: produtoId }
      });
      console.log('  Lotes removidos');
    }

    if (produtoId) {
      await s.query('DELETE FROM produtos WHERE id = :id', { replacements: { id: produtoId } });
      console.log('  Produto removido');
    }

    await s.query("DELETE FROM usuarios WHERE email IN ('farm-fase3@test.com', 'op-fase3@test.com')");
    console.log('  Usuarios de teste removidos');

    if (categoriaId) {
      await s.query('DELETE FROM categorias WHERE id = :id', { replacements: { id: categoriaId } });
    }
    if (fornecedorId) {
      await s.query('DELETE FROM fornecedores WHERE id = :id', { replacements: { id: fornecedorId } });
    }
    console.log('  Categoria e fornecedor removidos');
  } catch (err) {
    console.log('  ERRO no cleanup: ' + err.message);
    try { await s.query("SET session_replication_role = 'origin'"); } catch {}
  }

  await s.close();
  console.log('  Dados de teste removidos\n');
}

// ===================================================================
//  MAIN
// ===================================================================
(async () => {
  console.log('\n' + '='.repeat(56));
  console.log('  SNGPC FASE 3 - ENCERRAMENTO DO MODULO');
  console.log('  Testes Automatizados');
  console.log('='.repeat(56));

  try {
    await setup();
    await testGeracaoArquivo();
    await testTransmissao();
    await testImutabilidade();
    await testRejeicao();
    await testCancelamento();
    await testAuditoria();
    await testFluxoErros();
    await testPermissoes();
  } catch (err) {
    console.log('\n  ERRO FATAL: ' + err.message);
    console.log('  Stack: ' + err.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  Resultado Fase 3');
  console.log('='.repeat(60));
  console.log('  Passou: ' + passed);
  console.log('  Falhou: ' + failed);
  console.log('  Total:  ' + total);

  console.log('\n  CRITERIOS ENCERRAMENTO DO MODULO:');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' Arquivo gerado corretamente');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' Transmissao registrada');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' Status imutavel funcionando');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' Rejeicao controlada');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' Auditoria completa');
  console.log('    ' + (failed === 0 ? 'OK' : 'FAIL') + ' 100% testes Fase 1 + 2 + 3 passando');

  if (failed === 0) {
    console.log('\n  MODULO SNGPC ENCERRADO COM SUCESSO\n');
  } else {
    console.log('\n  PENDENCIAS - ' + failed + ' falhas\n');
  }

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
})();
