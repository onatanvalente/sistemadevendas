/**
 * Teste de Isolamento Multi-Tenant v2 — Validação Zero Trust
 * ════════════════════════════════════════════════════════════
 * 
 * Testa:
 *  1) Login com tenant correto/errado
 *  2) Acesso cross-tenant bloqueado com 404 (sem revelar existência)
 *  3) Header X-Tenant-Slug obrigatório
 *  4) Acesso legítimo (mesmo tenant)
 *  5) FK IDOR — referências de FKs de outro tenant
 *  6) Cobertura extra de rotas cross-tenant
 *  7) Token inválido/ausente
 *  8) Guard server-side: /app/:slug com token de outro tenant → 404
 *  9) Mensagens genéricas (sem revelar arquitetura multi-tenant)
 * 10) API /landing/tenant não vaza dados cross-tenant
 *
 * Uso: node scripts/test-tenant-isolation.js
 */

const http = require('http');

const BASE = 'http://localhost:3000';

// Tenants de teste (conforme seed)
const TENANT_A = { slug: 'mercadinho-bb', email: 'admin@sgc.com', senha: '123456' };
const TENANT_B = { slug: 'drogaria-roma', email: 'admin@farmacia.com', senha: '123456' };

let passed = 0;
let failed = 0;
let tokenA = null;
let tokenB = null;

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ FALHOU: ${testName}` + (detail ? ` — ${detail}` : ''));
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TESTE DE ISOLAMENTO MULTI-TENANT v2 (ZERO TRUST)');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── 1. LOGIN ──
  console.log('📋 1. LOGIN E AUTENTICAÇÃO');

  let r = await request('POST', '/api/auth/login', 
    { email: TENANT_A.email, senha: TENANT_A.senha },
    { 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 200 && r.body.token, 'Login tenant A com slug correto → 200');
  tokenA = r.body.token;

  r = await request('POST', '/api/auth/login',
    { email: TENANT_B.email, senha: TENANT_B.senha },
    { 'X-Tenant-Slug': TENANT_B.slug }
  );
  assert(r.status === 200 && r.body.token, 'Login tenant B com slug correto → 200');
  tokenB = r.body.token;

  r = await request('POST', '/api/auth/login',
    { email: TENANT_A.email, senha: TENANT_A.senha },
    { 'X-Tenant-Slug': TENANT_B.slug }
  );
  assert(r.status === 401, 'Login cross-tenant (email A no slug B) → 401');

  r = await request('POST', '/api/auth/login',
    { email: TENANT_A.email, senha: TENANT_A.senha }
  );
  assert(r.status === 400, 'Login sem X-Tenant-Slug → 400');

  // ── 2. CROSS-TENANT → 404 (NÃO REVELA EXISTÊNCIA) ──
  console.log('\n📋 2. CROSS-TENANT → 404 (SEM REVELAR EXISTÊNCIA)');

  const crossRoutes = [
    { path: '/api/produtos', name: 'produtos' },
    { path: '/api/clientes', name: 'clientes' },
    { path: '/api/financeiro/pagar', name: 'financeiro/pagar' },
    { path: '/api/categorias', name: 'categorias' },
    { path: '/api/fornecedores', name: 'fornecedores' },
    { path: '/api/usuarios', name: 'usuarios' },
  ];

  for (const route of crossRoutes) {
    r = await request('GET', route.path, null,
      { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_B.slug }
    );
    assert(r.status === 404, `Token A + Slug B → ${route.name} → 404`, `got ${r.status}`);
  }

  r = await request('GET', '/api/vendas', null,
    { 'Authorization': `Bearer ${tokenB}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 404, 'Token B + Slug A → vendas → 404', `got ${r.status}`);

  r = await request('GET', '/api/caixa/status', null,
    { 'Authorization': `Bearer ${tokenB}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 404, 'Token B + Slug A → caixa/status → 404', `got ${r.status}`);

  // ── 3. HEADER OBRIGATÓRIO ──
  console.log('\n📋 3. HEADER X-TENANT-SLUG OBRIGATÓRIO');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': `Bearer ${tokenA}` }
  );
  assert(r.status === 400, 'Request sem X-Tenant-Slug → 400');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': 'empresa-fantasma' }
  );
  assert(r.status === 404, 'Slug inexistente na API → 404', `got ${r.status}`);

  // ── 4. ACESSO LEGÍTIMO ──
  console.log('\n📋 4. ACESSO LEGÍTIMO (MESMO TENANT)');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 200, 'Token A + Slug A → produtos → 200');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': `Bearer ${tokenB}`, 'X-Tenant-Slug': TENANT_B.slug }
  );
  assert(r.status === 200, 'Token B + Slug B → produtos → 200');

  r = await request('GET', '/api/clientes', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 200, 'Token A + Slug A → clientes → 200');

  r = await request('GET', '/api/categorias', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 200, 'Token A + Slug A → categorias → 200');

  r = await request('GET', '/api/financeiro/pagar', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 200, 'Token A + Slug A → financeiro/pagar → 200');

  // ── 5. FK IDOR ──
  console.log('\n📋 5. FK IDOR — VALIDAÇÃO DE FOREIGN KEYS');

  r = await request('POST', '/api/financeiro/pagar',
    { descricao: 'Teste IDOR', fornecedor_id: 99999, valor: 100, data_vencimento: '2025-12-31' },
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 400, 'FK IDOR: fornecedor_id inexistente → 400');

  r = await request('POST', '/api/produtos',
    { nome: 'Produto IDOR', preco_venda: 10, categoria_id: 99999 },
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 400, 'FK IDOR: categoria_id inexistente → 400');

  r = await request('POST', '/api/produtos',
    { nome: 'Produto IDOR 2', preco_venda: 10, fornecedor_id: 99999 },
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 400, 'FK IDOR: fornecedor_id em produto → 400');

  // ── 6. COBERTURA EXTRA ──
  console.log('\n📋 6. COBERTURA EXTRA DE ROTAS');

  const rotasExtra = ['/api/estoque', '/api/dashboard', '/api/caixa/status'];
  for (const rota of rotasExtra) {
    r = await request('GET', rota, null,
      { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_B.slug }
    );
    assert(r.status === 404, `Cross-tenant GET ${rota} → 404`, `got ${r.status}`);
  }

  // ── 7. TOKENS INVÁLIDOS ──
  console.log('\n📋 7. TOKEN INVÁLIDO');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': 'Bearer token_invalido_xyz', 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 401, 'Token inválido → 401');

  r = await request('GET', '/api/produtos', null,
    { 'X-Tenant-Slug': TENANT_A.slug }
  );
  assert(r.status === 401, 'Sem token → 401');

  // ── 8. GUARD SERVER-SIDE: /app/:slug ──
  console.log('\n📋 8. GUARD SERVER-SIDE: /app/:slug');

  // Token A tentando acessar URL de B
  r = await request('GET', '/app/' + TENANT_B.slug, null,
    { 'Authorization': `Bearer ${tokenA}` }
  );
  assert(r.status === 404, 'GET /app/slug-B com token A → 404', `got ${r.status}`);
  assert(typeof r.raw === 'string' && !r.raw.includes('SGC - Sistema'),
    'Resposta NÃO contém interface do app');

  // Token B tentando acessar URL de A
  r = await request('GET', '/app/' + TENANT_A.slug, null,
    { 'Authorization': `Bearer ${tokenB}` }
  );
  assert(r.status === 404, 'GET /app/slug-A com token B → 404', `got ${r.status}`);

  // Slug inexistente
  r = await request('GET', '/app/empresa-que-nao-existe', null);
  assert(r.status === 404, 'GET /app/slug-inexistente → 404', `got ${r.status}`);

  // Token correto deve funcionar
  r = await request('GET', '/app/' + TENANT_A.slug, null,
    { 'Authorization': `Bearer ${tokenA}` }
  );
  assert(r.status === 200, 'GET /app/slug-A com token A → 200', `got ${r.status}`);

  // Sem token deve funcionar (mostrará tela de login)
  r = await request('GET', '/app/' + TENANT_A.slug, null);
  assert(r.status === 200, 'GET /app/slug-A sem token → 200 (login)', `got ${r.status}`);

  // ── 9. MENSAGENS GENÉRICAS ──
  console.log('\n📋 9. MENSAGENS NÃO REVELAM ARQUITETURA');

  r = await request('GET', '/api/produtos', null,
    { 'Authorization': `Bearer ${tokenA}`, 'X-Tenant-Slug': TENANT_B.slug }
  );
  const msg = typeof r.body === 'object' ? JSON.stringify(r.body) : r.raw;
  assert(!msg.includes('empresa') && !msg.includes('tenant') && !msg.includes('pertence'),
    'Resposta cross-tenant NÃO menciona empresa/tenant/pertence');
  assert(!msg.includes('multi-tenant') && !msg.includes('isolamento'),
    'Resposta NÃO revela arquitetura interna');

  // ── 10. API /landing/tenant NÃO VAZA CROSS-TENANT ──
  console.log('\n📋 10. API /landing/tenant — PROTEÇÃO CROSS-TENANT');

  r = await request('GET', '/api/landing/tenant/' + TENANT_B.slug, null,
    { 'Authorization': `Bearer ${tokenA}` }
  );
  assert(r.status === 404, 'Tenant info de B com token A → 404', `got ${r.status}`);

  r = await request('GET', '/api/landing/tenant/' + TENANT_A.slug, null,
    { 'Authorization': `Bearer ${tokenA}` }
  );
  assert(r.status === 200, 'Tenant info de A com token A → 200', `got ${r.status}`);

  // Sem token: público (necessário para tela de login)
  r = await request('GET', '/api/landing/tenant/' + TENANT_A.slug, null);
  assert(r.status === 200, 'Tenant info de A sem token → 200 (público)');

  r = await request('GET', '/api/landing/tenant/slug-fantasma', null);
  assert(r.status === 404, 'Tenant info de slug inexistente → 404');

  // ── RESULTADO ──
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${passed} PASS | ${failed} FAIL | ${passed + failed} TOTAL`);
  console.log('═══════════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  ATENÇÃO: Existem testes falhando!');
    process.exit(1);
  } else {
    console.log('\n🔒 ISOLAMENTO MULTI-TENANT v2 (ZERO TRUST) 100% VALIDADO');
    console.log('   → Nenhum layout/interface exposto a tenants errados');
    console.log('   → Sem mensagens que revelem arquitetura multi-tenant');
    console.log('   → 404 genérico para toda tentativa cross-tenant');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
