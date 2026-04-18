/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Pages v3.0
   Cada módulo = app independente com menu próprio no header
   Home = stats + cards de módulos (sem sidebar)
   Icons: Lucide | Font: Inter | ZERO emojis
   ══════════════════════════════════════════════════════════════ */

var Pages = {

  // ============================================================
  //  LOGIN
  // ============================================================
  login: function() {
    var lastEmp = JSON.parse(localStorage.getItem('varlen_last_empresa') || 'null');

    // Se estiver em /app/:slug, mostrar branding do tenant
    var tenantInfo = App.tenantInfo || null;
    var brandName = 'VarlenSYS';
    var brandDesc = 'Sistema de Gestão Comercial';
    var brandHtml = '';

    if (tenantInfo) {
      brandName = tenantInfo.nome_fantasia || tenantInfo.nome || 'VarlenSYS';
      brandDesc = tenantInfo.tipo_negocio === 'drogaria' ? 'Drogaria' : 'Mercado';
      if (tenantInfo.logo_url) {
        brandHtml = '<div style="margin-bottom:16px"><img src="' + tenantInfo.logo_url + '" alt="' + brandName + '" style="max-height:60px;border-radius:12px"></div>';
      } else {
        var cor = tenantInfo.cor_primaria || '#2563eb';
        brandHtml = '<div style="margin-bottom:16px;width:56px;height:56px;background:' + cor + ';border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem;margin:0 auto">' +
          brandName.charAt(0).toUpperCase() + '</div>';
      }
    } else {
      brandHtml = '<div style="margin-bottom:16px;width:56px;height:56px;background:var(--gradient-primary);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem;margin:0 auto">S</div>';
      if (lastEmp && lastEmp.nome) {
        brandHtml += '<div style="background:var(--primary-bg);padding:12px;border-radius:var(--radius);margin-bottom:16px;text-align:center">' +
          '<small style="color:var(--text-muted);font-size:0.75rem">Empresa</small><br>' +
          '<strong style="font-size:1.05rem;color:var(--primary)">' + lastEmp.nome + '</strong></div>';
      }
    }

    document.getElementById('app').innerHTML =
      '<div class="auth-page">' +
        // ── Lado esquerdo (70%) — Gradient + benefícios ──
        '<div class="auth-left">' +
          '<div class="auth-left-top">' +
            '<div class="auth-left-logo">' +
              '<div class="auth-left-logo-icon">S</div>' +
              '<span class="auth-left-logo-text">VarlenSYS</span>' +
            '</div>' +
          '</div>' +
          '<div class="auth-left-hero">' +
            '<h1>Gestão inteligente para varejo moderno</h1>' +
            '<p>Controle completo do seu negócio em uma plataforma rápida, segura e fácil de usar.</p>' +
          '</div>' +
          '<div class="auth-left-benefits">' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="package" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>Controle total de estoque</h4><p>Gestão por lotes, FIFO automático e alertas de vencimento</p></div>' +
            '</div>' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="monitor" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>PDV rápido e estável</h4><p>Experiência fluida com atalhos e busca inteligente</p></div>' +
            '</div>' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="bar-chart-3" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>Relatórios estratégicos</h4><p>Dashboards em tempo real para decisões ágeis</p></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // ── Lado direito (30%) — Card de login ──
        '<div class="auth-right">' +
          '<div class="auth-card">' +
            '<div class="logo">' +
              brandHtml +
              '<h1>' + brandName + '</h1>' +
              '<p>' + brandDesc + '</p>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Email</label>' +
              '<input type="email" class="form-control" id="loginEmail" placeholder="seu@email.com"></div>' +
            '<div class="form-group">' +
              '<label class="form-label">Senha</label>' +
              '<input type="password" class="form-control" id="loginSenha" placeholder="Sua senha" data-onenter="Pages.doLogin()"></div>' +
            '<button class="btn btn-primary btn-block btn-lg" data-onclick="Pages.doLogin()" style="margin-top:8px">' +
              '<i data-lucide="log-in" style="width:18px;height:18px"></i> Entrar</button>' +
            (App.tenantSlug ? '' :
              '<p style="text-align:center;margin-top:16px;font-size:0.88rem">' +
                '<a href="#/registro">Cadastrar nova empresa</a></p>') +
          '</div>' +
        '</div>' +
      '</div>';
  },

  doLogin: async function() {
    var btn = document.querySelector('.auth-card .btn-primary');
    if (btn && btn.disabled) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" style="width:18px;height:18px;animation:spin 1s linear infinite"></i> Entrando...'; }
    try {
      var data = await App.api('/auth/login', {
        method: 'POST',
        body: { email: document.getElementById('loginEmail').value, senha: document.getElementById('loginSenha').value }
      });
      if (data) { App.setAuth(data); Router.navigate('home'); }
    } catch(e) { /* toast already shown */ } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="log-in" style="width:18px;height:18px"></i> Entrar'; if (typeof lucide !== "undefined") lucide.createIcons(); }
    }
  },

  // ============================================================
  //  REGISTRO
  // ============================================================
  registro: function() {
    document.getElementById('app').innerHTML =
      '<div class="auth-page">' +
        '<div class="auth-left">' +
          '<div class="auth-left-top">' +
            '<div class="auth-left-logo">' +
              '<div class="auth-left-logo-icon">S</div>' +
              '<span class="auth-left-logo-text">VarlenSYS</span>' +
            '</div>' +
          '</div>' +
          '<div class="auth-left-hero">' +
            '<h1>Comece a gerenciar seu neg\u00f3cio agora</h1>' +
            '<p>Cadastre sua empresa em segundos e tenha acesso completo ao sistema.</p>' +
          '</div>' +
          '<div class="auth-left-benefits">' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="zap" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>Configura\u00e7\u00e3o r\u00e1pida</h4><p>Pronto para usar em minutos</p></div>' +
            '</div>' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="shield-check" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>Seguro e confi\u00e1vel</h4><p>Seus dados protegidos sempre</p></div>' +
            '</div>' +
            '<div class="auth-benefit">' +
              '<div class="auth-benefit-icon"><i data-lucide="headphones" style="width:22px;height:22px"></i></div>' +
              '<div class="auth-benefit-text"><h4>Suporte dedicado</h4><p>Ajuda quando precisar</p></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="auth-right" style="max-width:560px;min-width:420px">' +
        '<div class="auth-card" style="max-width:500px">' +
          '<div class="logo">' +
            '<div style="margin-bottom:12px"><i data-lucide="building" style="width:40px;height:40px;color:var(--primary)"></i></div>' +
            '<h1>Cadastro</h1><p>Crie sua conta empresarial</p>' +
          '</div>' +
          '<h4 style="margin-bottom:12px">Dados da Empresa</h4>' +
          '<div class="form-group"><label class="form-label">Nome da Empresa</label>' +
            '<input type="text" class="form-control" id="regEmpNome" placeholder="Ex: Mercadinho Bom Preço"></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">CNPJ</label>' +
              '<input type="text" class="form-control" id="regEmpCnpj" placeholder="00.000.000/0000-00" data-oninput="Utils.maskCNPJInput(event)"></div>' +
            '<div class="form-group"><label class="form-label">Tipo de Negócio</label>' +
              '<select class="form-control" id="regEmpTipo"><option value="mercado">Mercado</option><option value="drogaria">Drogaria</option></select></div>' +
          '</div>' +
          '<h4 style="margin:20px 0 12px">Dados do Administrador</h4>' +
          '<div class="form-group"><label class="form-label">Nome Completo</label>' +
            '<input type="text" class="form-control" id="regNome" placeholder="Seu nome"></div>' +
          '<div class="form-group"><label class="form-label">Email</label>' +
            '<input type="email" class="form-control" id="regEmail" placeholder="seu@email.com"></div>' +
          '<div class="form-group"><label class="form-label">Senha</label>' +
            '<input type="password" class="form-control" id="regSenha" placeholder="Mínimo 8 caracteres"></div>' +
          '<button class="btn btn-success btn-block btn-lg" data-onclick="Pages.doRegistro()" style="margin-top:8px">' +
            '<i data-lucide="user-plus" style="width:18px;height:18px"></i> Criar Conta</button>' +
          '<p style="text-align:center;margin-top:16px;font-size:0.88rem">' +
            '<a href="#/login">Já tem conta? Entrar</a></p>' +
        '</div></div></div>';
  },

  doRegistro: async function() {
    try {
      var data = await App.post('/auth/registro', {
        empresa: {
          nome: document.getElementById('regEmpNome').value,
          cnpj: document.getElementById('regEmpCnpj').value,
          tipo_negocio: document.getElementById('regEmpTipo').value
        },
        usuario: {
          nome: document.getElementById('regNome').value,
          email: document.getElementById('regEmail').value,
          senha: document.getElementById('regSenha').value
        }
      });
      if (data) { App.setAuth(data); Toast.success('Conta criada!'); Router.navigate('home'); }
    } catch(e) { /* toast */ }
  },

  // ============================================================
  //  HOME — Stats do dashboard + Cards de módulos
  // ============================================================
  home: async function() {
    Layout.render(
      '<div class="home-container"><div class="loading"><div class="spinner"></div></div></div>',
      { hideBack: true }
    );

    var dash;
    try { dash = await App.get('/dashboard'); } catch(e) { dash = {}; }

    // Carregar alertas do sistema
    var alertas;
    try { alertas = await App.get('/jobs/alertas'); } catch(e) { alertas = { alertas: [] }; }

    var nome = App.usuario ? App.usuario.nome.split(' ')[0] : 'Usuario';
    var perfil = App.usuario ? App.usuario.perfil : '';
    var isDrog = App.isDrogaria();

    // Crescimento
    var crescimento = dash.crescimento || 0;
    var crescIcon = crescimento >= 0 ? 'trending-up' : 'trending-down';
    var crescColor = crescimento >= 0 ? 'text-success' : 'text-danger';
    var crescLabel = (crescimento >= 0 ? '+' : '') + crescimento.toFixed(1) + '%';

    // Margem
    var margem = dash.margem_mes || 0;
    var margemColor = margem >= 30 ? 'text-success' : margem >= 15 ? 'text-warning' : 'text-danger';

    // Meta
    var metaHtml = '';
    if (dash.meta_ativa) {
      var m = dash.meta_ativa;
      var pct = m.percentual || 0;
      var barColor = pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--primary)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
      metaHtml =
        '<div class="meta-progress-card">' +
          '<div class="meta-header"><span class="fw-600">Meta: ' + (m.tipo || 'faturamento') + '</span>' +
            '<span class="fw-700" style="color:' + barColor + '">' + pct.toFixed(0) + '%</span></div>' +
          '<div class="meta-bar"><div class="meta-bar-fill" style="width:' + Math.min(pct, 100) + '%;background:' + barColor + '"></div></div>' +
          '<div class="meta-detail"><span>' + Utils.currency(m.valor_atual || 0) + ' / ' + Utils.currency(m.valor_meta || 0) + '</span></div>' +
        '</div>';
    }

    // Stats row 1 - Faturamento
    var statsHtml =
      '<div class="home-stats">' +
        '<div class="stat-card">' +
          '<div class="stat-icon blue"><i data-lucide="trending-up" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Faturamento Hoje</h4><div class="value">' + Utils.currency(dash.faturamento_hoje || 0) + '</div>' +
            '<div class="detail">' + (dash.vendas_hoje || 0) + ' vendas</div></div></div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon green"><i data-lucide="calendar" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Faturamento Mês</h4><div class="value">' + Utils.currency(dash.faturamento_mes || 0) + '</div>' +
            '<div class="detail"><span class="' + crescColor + '">' +
              '<i data-lucide="' + crescIcon + '" style="width:14px;height:14px"></i> ' + crescLabel + '</span> vs mês anterior</div></div></div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon teal"><i data-lucide="piggy-bank" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Lucro Mês</h4><div class="value text-success">' + Utils.currency(dash.lucro_mes || 0) + '</div>' +
            '<div class="detail"><span class="' + margemColor + '">Margem: ' + margem.toFixed(1) + '%</span></div></div></div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon amber"><i data-lucide="receipt" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Ticket Médio</h4><div class="value">' + Utils.currency(dash.ticket_medio || 0) + '</div></div></div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon red"><i data-lucide="alert-triangle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Estoque Crítico</h4><div class="value">' + (dash.estoque_critico || 0) + '</div>' +
            '<div class="detail">produtos abaixo do mínimo</div></div></div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon purple"><i data-lucide="users" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Clientes</h4><div class="value">' + (dash.total_clientes || 0) + '</div>' +
            '<div class="detail">' + Utils.currency(dash.total_receber || 0) + ' a receber</div></div></div>' +
      '</div><!-- end-home-stats -->';

    // Drogaria-specific cards (merged into statsHtml)
    var drogCards = '';
    if (isDrog) {
      drogCards =
          '<div class="stat-card stat-card-drog">' +
            '<div class="stat-icon teal"><i data-lucide="pill" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>SNGPC Pendentes</h4><div class="value">' + (dash.sngpc_pendentes || 0) + '</div>' +
              '<div class="detail">aguardando exportação</div></div></div>' +
          '<div class="stat-card stat-card-drog">' +
            '<div class="stat-icon amber"><i data-lucide="clipboard-list" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>Controlados Hoje</h4><div class="value">' + (dash.controlados_hoje || 0) + '</div>' +
              '<div class="detail">dispensações registradas</div></div></div>';
    }

    // Insert drog cards before closing home-stats
    statsHtml = statsHtml.replace('</div><!-- end-home-stats -->', drogCards + '</div><!-- end-home-stats -->');
    var drogHtml = ''; // consolidated into statsHtml

    // Module cards
    var modules = [
      { id: 'pdv',          icon: 'monitor',       color: 'blue',   label: 'PDV',               desc: 'Ponto de venda',                    perfis: ['administrador','vendedor','gerente','caixa','farmaceutico'] },
      { id: 'vendas',       icon: 'shopping-bag',   color: 'green',  label: 'Vendas',            desc: 'Histórico e gestão de vendas',      perfis: ['administrador','vendedor','gerente','farmaceutico'] },
      { id: 'caixa',        icon: 'landmark',       color: 'amber',  label: 'Caixa',             desc: 'Abertura, fechamento e controle',   perfis: ['administrador','vendedor','gerente','caixa','farmaceutico'] },
      { id: 'produtos',     icon: 'package',        color: 'purple', label: 'Produtos',          desc: 'Cadastro e gestão de produtos',     perfis: ['administrador','gerente','estoquista'] },
      { id: 'estoque',      icon: 'warehouse',      color: 'teal',   label: 'Estoque',           desc: 'Movimentações e controle',          perfis: ['administrador','gerente','estoquista'] },
      { id: 'clientes',     icon: 'user-check',     color: 'indigo', label: 'Clientes',          desc: 'Cadastro e histórico de clientes',  perfis: ['administrador','gerente','vendedor','farmaceutico'] },
      { id: 'programas',    icon: 'crown',          color: 'amber',  label: 'Programas Comerciais', desc: 'Clubes, convênios e descontos',  perfis: ['administrador','gerente'] },
      { id: 'categorias',   icon: 'tags',           color: 'slate',  label: 'Cadastros',         desc: 'Categorias e subcategorias',        perfis: ['administrador','gerente'] },
      { id: 'fornecedores', icon: 'truck',          color: 'slate',  label: 'Fornecedores',      desc: 'Gestão e ranking de fornecedores',  perfis: ['administrador','gerente','financeiro'] },
      { id: 'compras',      icon: 'shopping-cart',   color: 'orange', label: 'Compras',           desc: 'Notas de compra e entrada de NF',   perfis: ['administrador','gerente','estoquista'] },
      { id: 'financeiro',   icon: 'wallet',         color: 'green',  label: 'Gestão Financeira', desc: 'Contas, fluxo de caixa, DRE',       perfis: ['administrador','financeiro'] },
      { id: 'etiquetas',    icon: 'tag',            color: 'teal',   label: 'Etiquetas',         desc: 'Impressão de etiquetas de preço',   perfis: ['administrador','gerente','estoquista'] }
    ];

    // Módulos condicionais
    if (isDrog) {
      modules.push({ id: 'sngpc',  icon: 'pill',      color: 'teal',   label: 'SNGPC',            desc: 'Controle de medicamentos controlados', perfis: ['administrador','farmaceutico'] });
      modules.push({ id: 'fiscal', icon: 'file-check', color: 'blue',   label: 'Fiscal',           desc: 'Notas fiscais NFC-e / NF-e',          perfis: ['administrador','financeiro'] });
    } else {
      modules.push({ id: 'fiscal', icon: 'file-check', color: 'blue',   label: 'Fiscal',           desc: 'Notas fiscais NFC-e / NF-e',          perfis: ['administrador','financeiro'] });
    }

    modules.push({ id: 'usuarios', icon: 'users',    color: 'blue',   label: 'Usuarios',          desc: 'Gerenciar acessos e permissoes',    perfis: ['administrador'] });
    modules.push({ id: 'relatorios', icon: 'bar-chart-3', color: 'indigo', label: 'Relatorios', desc: 'Vendas, DRE, fluxo de caixa', perfis: ['administrador','gerente','financeiro'] });
    modules.push({ id: 'config',   icon: 'settings',  color: 'slate',  label: 'Configuracoes',     desc: 'Empresa e preferencias do sistema', perfis: ['administrador'] });
    modules.push({ id: 'tutorial', icon: 'book-open', color: 'indigo', label: 'Tutorial',          desc: 'Central de ajuda e guia completo',  perfis: ['administrador','gerente','vendedor','caixa','estoquista','financeiro','farmaceutico'] });

    var cardsHtml = modules.filter(function(m) {
      return m.perfis.indexOf(perfil) !== -1;
    }).map(function(m) {
      return '<div class="module-card" data-onclick="Router.navigate(\'' + m.id + '\')">' +
        '<div class="module-card-icon ' + m.color + '"><i data-lucide="' + m.icon + '" style="width:24px;height:24px"></i></div>' +
        '<div class="module-card-info"><h3>' + m.label + '</h3><p>' + m.desc + '</p></div></div>';
    }).join('');

    // Alertas do sistema
    var alertasHtml = '';
    var als = (alertas && alertas.alertas) ? alertas.alertas : [];
    if (als.length > 0) {
      alertasHtml = '<div style="margin-bottom:16px;display:flex;flex-direction:column;gap:8px">';
      als.forEach(function(a) {
        var bgColor = a.tipo === 'danger' ? 'var(--danger-bg, #fef2f2)' : a.tipo === 'warning' ? '#fefce8' : '#eff6ff';
        var txtColor = a.tipo === 'danger' ? 'var(--danger)' : a.tipo === 'warning' ? '#92400e' : 'var(--primary)';
        alertasHtml += '<div class="card" style="padding:12px 16px;border-left:4px solid ' + txtColor + ';background:' + bgColor + ';cursor:pointer" data-onclick="Router.navigate(\'' + (a.link || 'home') + '\')">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<i data-lucide="' + (a.icone || 'alert-circle') + '" style="width:20px;height:20px;color:' + txtColor + ';flex-shrink:0"></i>' +
            '<div><strong style="color:' + txtColor + '">' + a.titulo + '</strong><p style="margin:0;font-size:0.85rem;color:' + txtColor + '">' + a.mensagem + '</p></div>' +
          '</div></div>';
      });
      alertasHtml += '</div>';
    }

    Layout.render(
      '<div class="home-container">' +
        '<div class="home-welcome">' +
          '<h1>Bem-vindo, ' + nome + '</h1>' +
          '<p>' + (App.empresa ? App.empresa.nome : 'VarlenSYS') + '</p>' +
        '</div>' +
        alertasHtml +
        statsHtml +
        drogHtml +
        metaHtml +
        '<div class="home-modules-title"><i data-lucide="layout-grid" style="width:16px;height:16px"></i> Modulos</div>' +
        '<div class="home-modules">' + cardsHtml + '</div>' +
      '</div>',
      { hideBack: true }
    );
  },

  // ============================================================
  //  PDV — delega ao PDV fullscreen
  // ============================================================
  pdv: function() { PDV.open(); },

  // ============================================================
  //  VENDAS — módulo com sub-nav próprio
  // ============================================================
  // State vendas
  _vendasPag: 1,
  _vendasFiltroStatus: '',
  _vendasFiltroPgto: '',
  _vendasFiltroInicio: '',
  _vendasFiltroFim: '',
  _vendasFiltroBusca: '',

  vendas: async function() {
    Pages._vendasTab = Pages._vendasTab || 'lista';
    if (Pages._vendasTab === 'lista') await Pages._vendasLista();
  },

  _vendasLista: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', {
      title: 'Vendas',
      moduleMenu: [
        { label: 'Todas as Vendas', icon: 'list', active: true, action: "Pages._vendasTab='lista';Pages.vendas()" }
      ]
    });

    // Construir URL com filtros
    var pag = Pages._vendasPag || 1;
    var url = '/vendas?page=' + pag + '&limit=25';
    if (Pages._vendasFiltroStatus) url += '&status=' + Pages._vendasFiltroStatus;
    if (Pages._vendasFiltroPgto) url += '&forma_pagamento=' + Pages._vendasFiltroPgto;
    if (Pages._vendasFiltroInicio) url += '&data_inicio=' + Pages._vendasFiltroInicio;
    if (Pages._vendasFiltroFim) url += '&data_fim=' + Pages._vendasFiltroFim;
    if (Pages._vendasFiltroBusca) url += '&busca=' + encodeURIComponent(Pages._vendasFiltroBusca);

    var res;
    try { res = await App.get(url); } catch(e) { res = { data: [], total: 0, resumo: {} }; }
    var vendas = res.data || [];
    var total = res.total || 0;
    var tp = res.pages || 1;
    var r = res.resumo || {};

    // Cards resumo
    var cardsHtml =
      '<div class="stats-grid" style="margin-bottom:20px">' +
        '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="shopping-cart" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Total Vendas</h4><div class="value">' + total + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon green"><i data-lucide="dollar-sign" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Faturamento</h4><div class="value">' + Utils.currency(r.faturamento) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon purple"><i data-lucide="receipt" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Ticket Médio</h4><div class="value">' + Utils.currency(r.ticket_medio) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon red"><i data-lucide="x-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Canceladas</h4><div class="value">' + (r.canceladas || 0) + '</div></div></div>' +
      '</div>';

    // Barra de filtros
    var filtrosHtml =
      '<div class="card" style="padding:16px;margin-bottom:16px">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">' +
          '<div class="form-group" style="margin:0;flex:1;min-width:180px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Busca</label>' +
            '<input type="text" class="form-control" id="vendasBusca" placeholder="Nº venda ou cliente..." value="' + (Pages._vendasFiltroBusca || '') + '"></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Status</label>' +
            '<select class="form-control" id="vendasFiltroStatus">' +
              '<option value="">Todos</option>' +
              '<option value="finalizada"' + (Pages._vendasFiltroStatus === 'finalizada' ? ' selected' : '') + '>Finalizada</option>' +
              '<option value="cancelada"' + (Pages._vendasFiltroStatus === 'cancelada' ? ' selected' : '') + '>Cancelada</option>' +
            '</select></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Pagamento</label>' +
            '<select class="form-control" id="vendasFiltroPgto">' +
              '<option value="">Todos</option>' +
              '<option value="dinheiro"' + (Pages._vendasFiltroPgto === 'dinheiro' ? ' selected' : '') + '>Dinheiro</option>' +
              '<option value="pix"' + (Pages._vendasFiltroPgto === 'pix' ? ' selected' : '') + '>Pix</option>' +
              '<option value="debito"' + (Pages._vendasFiltroPgto === 'debito' ? ' selected' : '') + '>Débito</option>' +
              '<option value="credito"' + (Pages._vendasFiltroPgto === 'credito' ? ' selected' : '') + '>Crédito</option>' +
              '<option value="multiplo"' + (Pages._vendasFiltroPgto === 'multiplo' ? ' selected' : '') + '>Múltiplo</option>' +
            '</select></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">De</label>' +
            '<input type="date" class="form-control" id="vendasFiltroInicio" value="' + (Pages._vendasFiltroInicio || '') + '"></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Até</label>' +
            '<input type="date" class="form-control" id="vendasFiltroFim" value="' + (Pages._vendasFiltroFim || '') + '"></div>' +
          '<button class="btn btn-primary btn-sm" data-onclick="Pages._aplicarFiltrosVendas()" style="height:38px">' +
            '<i data-lucide="search" style="width:14px;height:14px"></i> Filtrar</button>' +
          '<button class="btn btn-ghost btn-sm" data-onclick="Pages._limparFiltrosVendas()" style="height:38px">' +
            '<i data-lucide="x" style="width:14px;height:14px"></i></button>' +
        '</div>' +
      '</div>';

    // Tabela
    var rows = vendas.map(function(v) {
      var statusBadge = v.status === 'cancelada'
        ? '<span class="badge badge-danger">Cancelada</span>'
        : '<span class="badge badge-success">Finalizada</span>';
      return '<tr class="clickable" data-onclick="Pages.detalheVenda(' + v.id + ')">' +
        '<td>#' + v.numero + '</td>' +
        '<td>' + Utils.date(v.createdAt) + '</td>' +
        '<td>' + new Date(v.createdAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '</td>' +
        '<td>' + (v.cliente_nome || '-') + '</td>' +
        '<td>' + (v.Usuario ? v.Usuario.nome : '-') + '</td>' +
        '<td>' + Pages._formatPayment(v.forma_pagamento) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(v.total) + '</td>' +
        '<td>' + statusBadge + '</td></tr>';
    }).join('');

    if (vendas.length === 0) {
      rows = '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">Nenhuma venda encontrada</td></tr>';
    }

    // Paginação
    var pagHtml = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
    if (pag > 1) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._vendasPag=' + (pag-1) + ';Pages._vendasLista()">← Anterior</button>';
    pagHtml += '<span style="font-size:0.85rem;color:var(--text-muted)">Página ' + pag + ' de ' + tp + ' (' + total + ' registros)</span>';
    if (pag < tp) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._vendasPag=' + (pag+1) + ';Pages._vendasLista()">Próxima →</button>';
    pagHtml += '</div>';

    Layout.render(
      cardsHtml + filtrosHtml +
      '<div class="card">' +
        '<div class="card-header"><h3>Vendas</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Nº</th><th>Data</th><th>Hora</th><th>Cliente</th><th>Vendedor</th><th>Pagamento</th><th class="text-right">Total</th><th>Status</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' + pagHtml + '</div>',
      {
        title: 'Vendas',
        moduleMenu: [
          { label: 'Todas as Vendas', icon: 'list', active: true, action: "Pages._vendasTab='lista';Pages.vendas()" }
        ]
      }
    );
  },

  _aplicarFiltrosVendas: function() {
    Pages._vendasPag = 1;
    Pages._vendasFiltroBusca = (document.getElementById('vendasBusca') || {}).value || '';
    Pages._vendasFiltroStatus = (document.getElementById('vendasFiltroStatus') || {}).value || '';
    Pages._vendasFiltroPgto = (document.getElementById('vendasFiltroPgto') || {}).value || '';
    Pages._vendasFiltroInicio = (document.getElementById('vendasFiltroInicio') || {}).value || '';
    Pages._vendasFiltroFim = (document.getElementById('vendasFiltroFim') || {}).value || '';
    Pages._vendasLista();
  },

  _limparFiltrosVendas: function() {
    Pages._vendasPag = 1;
    Pages._vendasFiltroBusca = '';
    Pages._vendasFiltroStatus = '';
    Pages._vendasFiltroPgto = '';
    Pages._vendasFiltroInicio = '';
    Pages._vendasFiltroFim = '';
    Pages._vendasLista();
  },

  detalheVenda: async function(id) {
    var v;
    try { v = await App.get('/vendas/' + id); } catch(e) { return; }
    var itens = (v.VendaItems || []).map(function(i) {
      return '<tr><td>' + i.produto_nome + '</td><td class="text-center">' + Utils.number(i.quantidade,0) + '</td>' +
        '<td class="text-right">' + Utils.currency(i.preco_unitario) + '</td>' +
        '<td class="text-right">' + Utils.currency(i.subtotal) + '</td></tr>';
    }).join('');

    var tipoDocBadge = '';
    if (v.tipo_documento_emitido === 'nfce') {
      tipoDocBadge = '<span class="badge badge-primary" style="font-size:0.7rem">NFC-e</span>';
    } else {
      tipoDocBadge = '<span class="badge" style="font-size:0.7rem;background:var(--bg);color:var(--text-muted)">Cupom Não Fiscal</span>';
    }

    var footer = '';
    if (v.status === 'finalizada') {
      footer = '<button class="btn btn-secondary" data-onclick="PDV.reimprimirCupom(' + v.id + ')"><i data-lucide="printer" style="width:16px;height:16px"></i> Reimprimir Cupom</button>';
      footer += '<button class="btn btn-warning" data-onclick="Pages._devolucaoParcial(' + v.id + ')"><i data-lucide="rotate-ccw" style="width:16px;height:16px"></i> Devolucao</button>';
      footer += '<button class="btn btn-danger" data-onclick="Pages.cancelarVenda(' + v.id + ')"><i data-lucide="x-circle" style="width:16px;height:16px"></i> Cancelar Venda</button>';
    }
    footer += '<button class="btn btn-ghost" data-onclick="Modal.close()">Fechar</button>';

    Modal.show('Venda #' + v.numero,
      '<div style="margin-bottom:16px">' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Data:</span><span>' + Utils.dateTime(v.createdAt) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Cliente:</span><span>' + (v.cliente_nome || '-') + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">CPF:</span><span>' + (v.cliente_cpf || '-') + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Operador:</span><span>' + (v.operador_nome || (v.Usuario ? v.Usuario.nome : '-')) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Pagamento:</span><span>' + Pages._formatPayment(v.forma_pagamento) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Documento:</span>' + tipoDocBadge + '</div>' +
        '<div class="d-flex justify-between mb-1"><span class="text-muted">Status:</span><span>' +
          (v.status === 'cancelada' ? '<span class="badge badge-danger">Cancelada</span>' : '<span class="badge badge-success">Finalizada</span>') + '</span></div>' +
      '</div>' +
      '<table><thead><tr><th>Produto</th><th class="text-center">Qtd</th><th class="text-right">Unitário</th><th class="text-right">Subtotal</th></tr></thead>' +
        '<tbody>' + itens + '</tbody></table>' +
      '<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">' +
        '<div class="d-flex justify-between"><span>Subtotal</span><span>' + Utils.currency(v.subtotal) + '</span></div>' +
        (parseFloat(v.desconto_automatico_total || 0) > 0 ? '<div class="d-flex justify-between" style="color:var(--primary)"><span>★ Desc. Clube</span><span>-' + Utils.currency(v.desconto_automatico_total) + '</span></div>' : '') +
        (parseFloat(v.desconto_manual_total || 0) > 0 ? '<div class="d-flex justify-between text-danger"><span>Desc. Manual</span><span>-' + Utils.currency(v.desconto_manual_total) + '</span></div>' : '') +
        (parseFloat(v.desconto) > 0 && parseFloat(v.desconto_automatico_total || 0) <= 0 && parseFloat(v.desconto_manual_total || 0) <= 0 ? '<div class="d-flex justify-between text-danger"><span>Desconto</span><span>-' + Utils.currency(v.desconto) + '</span></div>' : '') +
        (parseFloat(v.acrescimo) > 0 ? '<div class="d-flex justify-between"><span>Acréscimo</span><span>+' + Utils.currency(v.acrescimo) + '</span></div>' : '') +
        '<div class="d-flex justify-between fw-700" style="font-size:1.15rem;margin-top:4px"><span>Total</span><span>' + Utils.currency(v.total) + '</span></div>' +
      '</div>',
      footer, 'modal-lg'
    );
  },

  cancelarVenda: async function(id) {
    if (!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
    try {
      await App.put('/vendas/' + id + '/cancelar');
      Toast.success('Venda cancelada');
      Modal.close();
      Pages.vendas();
    } catch(e) { /* toast */ }
  },

  // ============================================================
  //  CAIXA — módulo independente
  // ============================================================
  _caixaPag: 1,
  _caixaFiltroStatus: '',
  _caixaFiltroInicio: '',
  _caixaFiltroFim: '',

  caixa: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Caixa' });

    var status;
    try { status = await App.get('/caixa/status'); } catch(e) { status = { aberto: false }; }

    // Historico paginado
    var cpag = Pages._caixaPag || 1;
    var hUrl = '/caixa/historico?page=' + cpag + '&limit=20';
    if (Pages._caixaFiltroStatus) hUrl += '&status=' + Pages._caixaFiltroStatus;
    if (Pages._caixaFiltroInicio) hUrl += '&data_inicio=' + Pages._caixaFiltroInicio;
    if (Pages._caixaFiltroFim) hUrl += '&data_fim=' + Pages._caixaFiltroFim;

    var hRes;
    try { hRes = await App.get(hUrl); } catch(e) { hRes = { data: [], total: 0 }; }
    var historico = hRes.data || [];
    var hTotal = hRes.total || 0;
    var hPages = hRes.pages || 1;

    var caixaAberto = status.aberto;
    var caixaAtual = status.caixa;

    var statusHtml = '';
    var botoesHtml = '';
    if (caixaAberto && caixaAtual) {
      statusHtml =
        '<div class="stats-grid" style="margin-bottom:24px">' +
          '<div class="stat-card"><div class="stat-icon green"><i data-lucide="lock-open" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>Status</h4><div class="value" style="color:var(--success)">Aberto</div>' +
            '<div class="detail">Desde ' + Utils.dateTime(caixaAtual.data_abertura) + '</div></div></div>' +
          '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="banknote" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>Total Vendas</h4><div class="value">' + Utils.currency(caixaAtual.total_vendas) + '</div></div></div>' +
          '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="arrow-down-circle" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>Sangrias</h4><div class="value">' + Utils.currency(caixaAtual.total_sangria) + '</div></div></div>' +
          '<div class="stat-card"><div class="stat-icon purple"><i data-lucide="arrow-up-circle" style="width:22px;height:22px"></i></div>' +
            '<div class="stat-info"><h4>Suprimentos</h4><div class="value">' + Utils.currency(caixaAtual.total_suprimento) + '</div></div></div>' +
        '</div>';
      botoesHtml =
        '<div style="display:flex;gap:8px;margin-bottom:24px">' +
          '<button class="btn btn-warning" data-onclick="Pages.sangriaModal()"><i data-lucide="arrow-down-circle" style="width:16px;height:16px"></i> Sangria</button>' +
          '<button class="btn btn-primary" data-onclick="Pages.suprimentoModal()"><i data-lucide="arrow-up-circle" style="width:16px;height:16px"></i> Suprimento</button>' +
          '<button class="btn btn-danger" data-onclick="Pages.fecharCaixaModal()"><i data-lucide="lock" style="width:16px;height:16px"></i> Fechar Caixa</button>' +
        '</div>';
    } else {
      statusHtml =
        '<div class="alert alert-warning" style="margin-bottom:24px">' +
          '<i data-lucide="alert-triangle" style="width:20px;height:20px;flex-shrink:0"></i>' +
          '<div><strong>Caixa Fechado</strong><p style="margin-top:4px">Abra o caixa para iniciar operações.</p></div></div>';
      botoesHtml =
        '<button class="btn btn-success" data-onclick="Pages.abrirCaixaModal()" style="margin-bottom:24px">' +
          '<i data-lucide="lock-open" style="width:16px;height:16px"></i> Abrir Caixa</button>';
    }

    // Filtros historico
    var filtrosCaixaHtml =
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">' +
        '<div class="form-group" style="margin:0;min-width:120px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Status</label>' +
          '<select class="form-control" id="caixaFiltroStatus">' +
            '<option value="">Todos</option>' +
            '<option value="aberto"' + (Pages._caixaFiltroStatus === 'aberto' ? ' selected' : '') + '>Aberto</option>' +
            '<option value="fechado"' + (Pages._caixaFiltroStatus === 'fechado' ? ' selected' : '') + '>Fechado</option>' +
          '</select></div>' +
        '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">De</label>' +
          '<input type="date" class="form-control" id="caixaFiltroInicio" value="' + (Pages._caixaFiltroInicio || '') + '"></div>' +
        '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Até</label>' +
          '<input type="date" class="form-control" id="caixaFiltroFim" value="' + (Pages._caixaFiltroFim || '') + '"></div>' +
        '<button class="btn btn-primary btn-sm" style="height:38px" data-onclick="Pages._caixaPag=1;Pages._caixaFiltroStatus=(document.getElementById(\'caixaFiltroStatus\')||{}).value||\'\';\
Pages._caixaFiltroInicio=(document.getElementById(\'caixaFiltroInicio\')||{}).value||\'\';\
Pages._caixaFiltroFim=(document.getElementById(\'caixaFiltroFim\')||{}).value||\'\';\
Pages.caixa()"><i data-lucide="search" style="width:14px;height:14px"></i> Filtrar</button>' +
        '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._caixaPag=1;Pages._caixaFiltroStatus=\'\';Pages._caixaFiltroInicio=\'\';Pages._caixaFiltroFim=\'\';Pages.caixa()">' +
          '<i data-lucide="x" style="width:14px;height:14px"></i></button>' +
      '</div>';

    // Histórico rows
    var histRows = historico.map(function(c) {
      var sBadge = c.status === 'aberto'
        ? '<span class="badge badge-success">Aberto</span>'
        : '<span class="badge badge-neutral">Fechado</span>';
      return '<tr class="clickable" data-onclick="Pages.detalheCaixa(' + c.id + ')">' +
        '<td>#' + c.id + '</td>' +
        '<td>' + Utils.dateTime(c.data_abertura) + '</td>' +
        '<td>' + (c.data_fechamento ? Utils.dateTime(c.data_fechamento) : '-') + '</td>' +
        '<td class="text-right">' + Utils.currency(c.total_vendas) + '</td>' +
        '<td class="text-right">' + (c.quantidade_vendas || 0) + '</td>' +
        '<td>' + sBadge + '</td></tr>';
    }).join('');

    // Paginação
    var pagCaixa = '';
    if (hTotal > 20) {
      pagCaixa = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
      if (cpag > 1) pagCaixa += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._caixaPag=' + (cpag-1) + ';Pages.caixa()">← Anterior</button>';
      pagCaixa += '<span style="font-size:0.85rem;color:var(--text-muted)">Página ' + cpag + ' de ' + hPages + ' (' + hTotal + ' registros)</span>';
      if (cpag < hPages) pagCaixa += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._caixaPag=' + (cpag+1) + ';Pages.caixa()">Próxima →</button>';
      pagCaixa += '</div>';
    }

    Layout.render(
      statusHtml + botoesHtml +
      '<div class="card"><div class="card-header"><h3>Histórico de Caixas</h3></div>' +
        '<div style="padding:0 16px">' + filtrosCaixaHtml + '</div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>ID</th><th>Abertura</th><th>Fechamento</th><th class="text-right">Total Vendas</th><th class="text-right">Qtd Vendas</th><th>Status</th></tr></thead>' +
          '<tbody>' + (histRows || '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhum registro</td></tr>') + '</tbody></table></div>' + pagCaixa + '</div>',
      { title: 'Caixa' }
    );
  },

  detalheCaixa: async function(id) {
    var hRes;
    try { hRes = await App.get('/caixa/historico?limit=100'); } catch(e) { return; }
    var caixas = hRes.data || hRes || [];
    var c = (Array.isArray(caixas) ? caixas : []).find(function(x) { return x.id === id; });
    if (!c) return;

    var esperado = parseFloat(c.valor_abertura) + parseFloat(c.total_vendas) + parseFloat(c.total_suprimento) - parseFloat(c.total_sangria);

    Modal.show('Caixa #' + c.id,
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><span class="text-muted">Abertura:</span><br><strong>' + Utils.dateTime(c.data_abertura) + '</strong></div>' +
        '<div><span class="text-muted">Fechamento:</span><br><strong>' + (c.data_fechamento ? Utils.dateTime(c.data_fechamento) : 'Em aberto') + '</strong></div>' +
        '<div><span class="text-muted">Operador:</span><br><strong>' + (c.Usuario ? c.Usuario.nome : '-') + '</strong></div>' +
        '<div><span class="text-muted">Status:</span><br>' +
          (c.status === 'aberto' ? '<span class="badge badge-success">Aberto</span>' : '<span class="badge badge-neutral">Fechado</span>') + '</div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--border);padding-top:16px">' +
        '<div class="d-flex justify-between mb-1"><span>Valor Abertura</span><span>' + Utils.currency(c.valor_abertura) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Total Vendas</span><span class="text-success fw-600">' + Utils.currency(c.total_vendas) + '</span></div>' +
        '<div class="d-flex justify-between mb-1" style="padding-left:16px"><span class="text-muted">Dinheiro</span><span>' + Utils.currency(c.total_dinheiro) + '</span></div>' +
        '<div class="d-flex justify-between mb-1" style="padding-left:16px"><span class="text-muted">Pix</span><span>' + Utils.currency(c.total_pix) + '</span></div>' +
        '<div class="d-flex justify-between mb-1" style="padding-left:16px"><span class="text-muted">Débito</span><span>' + Utils.currency(c.total_debito) + '</span></div>' +
        '<div class="d-flex justify-between mb-1" style="padding-left:16px"><span class="text-muted">Crédito</span><span>' + Utils.currency(c.total_credito) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Total Sangrias</span><span class="text-danger">' + Utils.currency(c.total_sangria) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Total Suprimentos</span><span class="text-primary">' + Utils.currency(c.total_suprimento) + '</span></div>' +
        '<hr style="margin:8px 0;border-color:var(--border)">' +
        '<div class="d-flex justify-between mb-1"><span>Valor Esperado</span><span class="fw-600">' + Utils.currency(esperado) + '</span></div>' +
        (c.valor_fechamento ? '<div class="d-flex justify-between mb-1"><span>Valor Fechamento</span><span class="fw-600">' + Utils.currency(c.valor_fechamento) + '</span></div>' : '') +
        '<div class="d-flex justify-between fw-700" style="font-size:1.1rem"><span>Diferença</span><span style="color:' + (parseFloat(c.diferenca) >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + Utils.currency(c.diferenca) + '</span></div>' +
      '</div>',
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>',
      'modal-lg'
    );
  },

  abrirCaixaModal: function() {
    var operadorNome = App.usuario ? App.usuario.nome : '';
    Modal.show('Abrir Caixa',
      '<div class="form-group"><label class="form-label">Operador</label>' +
        '<input type="text" class="form-control" value="' + operadorNome + '" readonly style="background:var(--bg);cursor:not-allowed"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Identificação do Caixa</label>' +
          '<select class="form-control" id="caixaNumAbertura">' +
            '<option value="1">Caixa 01</option><option value="2">Caixa 02</option>' +
            '<option value="3">Caixa 03</option><option value="4">Caixa 04</option>' +
            '<option value="5">Caixa 05</option>' +
          '</select></div>' +
        '<div class="form-group"><label class="form-label">Valor de Abertura (R$)</label>' +
          '<input type="text" class="form-control" id="valorAbertura" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Senha do Operador</label>' +
        '<input type="password" class="form-control" id="senhaAbertura" placeholder="Digite sua senha"></div>',
      '<button class="btn btn-success" data-onclick="Pages._doAbrirCaixa()"><i data-lucide="lock-open" style="width:16px;height:16px"></i> Abrir</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _doAbrirCaixa: async function() {
    var senha = (document.getElementById('senhaAbertura') || {}).value || '';
    if (!senha) { Toast.error('Digite sua senha para abrir o caixa'); return; }
    try {
      await App.api('/auth/login', { method: 'POST', body: { email: App.usuario.email, senha: senha } });
    } catch(e) { Toast.error('Senha incorreta'); return; }
    try {
      var v = (document.getElementById('valorAbertura').value || '0').replace(',', '.');
      var caixaNum = (document.getElementById('caixaNumAbertura') || {}).value || '1';
      await App.post('/caixa/abrir', { valor_abertura: v, caixa_numero: caixaNum });
      Toast.success('Caixa aberto!');
      Modal.close();
      Pages.caixa();
    } catch(e) { /* toast */ }
  },

  fecharCaixaModal: function() {
    Modal.show('Fechar Caixa',
      '<div class="form-group"><label class="form-label">Valor de Fechamento (R$)</label>' +
        '<input type="text" class="form-control" id="valorFechamento" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '<div class="form-group"><label class="form-label">Observações</label>' +
        '<textarea class="form-control" id="obsFechamento" rows="3" placeholder="Observações (opcional)"></textarea></div>',
      '<button class="btn btn-danger" data-onclick="Pages._doFecharCaixa()"><i data-lucide="lock" style="width:16px;height:16px"></i> Fechar Caixa</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-md'
    );
  },

  _doFecharCaixa: async function() {
    try {
      var v = (document.getElementById('valorFechamento').value || '0').replace(',', '.');
      var obs = document.getElementById('obsFechamento').value;
      var res = await App.post('/caixa/fechar', { valor_fechamento: v, observacoes: obs });
      var r = res.resumo;
      Modal.show('Resumo do Fechamento',
        '<div class="d-flex justify-between mb-1"><span>Total Vendas</span><span class="fw-600">' + Utils.currency(r.total_vendas) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Qtd Vendas</span><span>' + r.quantidade_vendas + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Dinheiro</span><span>' + Utils.currency(r.total_dinheiro) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Pix</span><span>' + Utils.currency(r.total_pix) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Débito</span><span>' + Utils.currency(r.total_debito) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Crédito</span><span>' + Utils.currency(r.total_credito) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Sangrias</span><span class="text-danger">' + Utils.currency(r.total_sangria) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Suprimentos</span><span class="text-primary">' + Utils.currency(r.total_suprimento) + '</span></div>' +
        '<hr style="margin:8px 0">' +
        '<div class="d-flex justify-between mb-1"><span>Valor Esperado</span><span class="fw-600">' + Utils.currency(r.valor_esperado) + '</span></div>' +
        '<div class="d-flex justify-between mb-1"><span>Valor Fechamento</span><span class="fw-600">' + Utils.currency(r.valor_fechamento) + '</span></div>' +
        '<div class="d-flex justify-between fw-700" style="font-size:1.15rem"><span>Diferença</span><span style="color:' + (parseFloat(r.diferenca) >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + Utils.currency(r.diferenca) + '</span></div>',
        '<button class="btn btn-primary" data-onclick="Modal.close();Pages.caixa()">OK</button>',
        'modal-lg'
      );
    } catch(e) { /* toast */ }
  },

  sangriaModal: function() {
    Modal.show('Sangria',
      '<div class="form-group"><label class="form-label">Valor (R$)</label>' +
        '<input type="text" class="form-control" id="valorSangria" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '<div class="form-group"><label class="form-label">Motivo</label>' +
        '<input type="text" class="form-control" id="motivoSangria" placeholder="Ex: Pagamento de entregador"></div>',
      '<button class="btn btn-warning" data-onclick="Pages._doSangria()">Confirmar Sangria</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-sm'
    );
  },

  _doSangria: async function() {
    try {
      var v = (document.getElementById('valorSangria').value || '0').replace(',', '.');
      await App.post('/caixa/sangria', { valor: v, motivo: document.getElementById('motivoSangria').value });
      Toast.success('Sangria registrada');
      Modal.close();
      if (App.currentPage === 'caixa') Pages.caixa();
    } catch(e) { /* toast */ }
  },

  suprimentoModal: function() {
    Modal.show('Suprimento',
      '<div class="form-group"><label class="form-label">Valor (R$)</label>' +
        '<input type="text" class="form-control" id="valorSuprimento" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '<div class="form-group"><label class="form-label">Motivo</label>' +
        '<input type="text" class="form-control" id="motivoSuprimento" placeholder="Ex: Troco adicional"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._doSuprimento()">Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-sm'
    );
  },

  _doSuprimento: async function() {
    try {
      var v = (document.getElementById('valorSuprimento').value || '0').replace(',', '.');
      await App.post('/caixa/suprimento', { valor: v, motivo: document.getElementById('motivoSuprimento').value });
      Toast.success('Suprimento registrado');
      Modal.close();
      if (App.currentPage === 'caixa') Pages.caixa();
    } catch(e) { /* toast */ }
  },

  // ============================================================
  //  PRODUTOS — módulo com tabs (Dados, Estoque, Farmácia, Movimentações)
  // ============================================================
  _produtosPag: 1,
  _produtosBusca: '',

  produtos: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Produtos' });

    var pag = Pages._produtosPag || 1;
    var url = '/produtos?page=' + pag + '&limit=30';
    if (Pages._produtosBusca) url += '&busca=' + encodeURIComponent(Pages._produtosBusca);

    var res, categorias, fornecedores;
    try { res = await App.get(url); } catch(e) { res = { data: [], total: 0 }; }
    try { var _catR = await App.get('/categorias'); categorias = Array.isArray(_catR) ? _catR : (_catR.data || []); } catch(e) { categorias = []; }
    try { var _fornR = await App.get('/fornecedores'); fornecedores = Array.isArray(_fornR) ? _fornR : (_fornR.data || []); } catch(e) { fornecedores = []; }

    var produtos = res.data || [];
    var total = res.total || 0;
    var tp = res.pages || 1;

    Pages._produtosData = produtos;
    Pages._categoriasData = categorias;
    Pages._fornecedoresData = fornecedores;

    var rows = produtos.map(function(p) {
      var estClass = parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo) ? 'text-danger fw-600' : '';
      return '<tr class="clickable" data-onclick="Pages.editarProduto(' + p.id + ')">' +
        '<td>' + (p.codigo_barras || '-') + '</td>' +
        '<td class="fw-500">' + p.nome + '</td>' +
        '<td>' + (p.Categorium ? p.Categorium.nome : (p.Categoria ? p.Categoria.nome : '-')) + '</td>' +
        '<td class="text-right">' + Utils.currency(p.preco_custo) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(p.preco_venda) + '</td>' +
        '<td class="text-right ' + estClass + '">' + Utils.number(p.estoque_atual, 0) + '</td>' +
        '<td>' + (p.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-neutral">Inativo</span>') + '</td></tr>';
    }).join('');

    // Paginação
    var pagHtml = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
    if (pag > 1) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._produtosPag=' + (pag-1) + ';Pages.produtos()">← Anterior</button>';
    pagHtml += '<span style="font-size:0.85rem;color:var(--text-muted)">Página ' + pag + ' de ' + tp + ' (' + total + ' produtos)</span>';
    if (pag < tp) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._produtosPag=' + (pag+1) + ';Pages.produtos()">Próxima →</button>';
    pagHtml += '</div>';

    Layout.render(
      '<div class="card" style="margin-bottom:16px"><div class="card-body" style="padding:12px 20px">' +
        '<div style="display:flex;gap:12px;align-items:center">' +
          '<div class="search-box" style="flex:1"><span class="search-icon"><i data-lucide="search" style="width:16px;height:16px"></i></span>' +
            '<input type="text" class="form-control" id="prodBuscaInput" placeholder="Buscar produto..." value="' + (Pages._produtosBusca || '') + '" data-onkeydown="if(event.key===\'Enter\'){Pages._produtosPag=1;Pages._produtosBusca=this.value;Pages.produtos()}"></div>' +
          '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._produtosPag=1;Pages._produtosBusca=document.getElementById(\'prodBuscaInput\').value;Pages.produtos()"><i data-lucide="search" style="width:14px;height:14px"></i></button>' +
          (Pages._produtosBusca ? '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._produtosPag=1;Pages._produtosBusca=\'\';Pages.produtos()"><i data-lucide="x" style="width:14px;height:14px"></i></button>' : '') +
          '<button class="btn btn-primary" data-onclick="Pages.novoProduto()"><i data-lucide="plus" style="width:16px;height:16px"></i> Novo Produto</button>' +
        '</div></div></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th class="text-right">Custo</th><th class="text-right">Venda</th><th class="text-right">Estoque</th><th>Status</th></tr></thead>' +
        '<tbody id="produtosBody">' + (rows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhum produto</td></tr>') + '</tbody></table></div>' + pagHtml + '</div>',
      { title: 'Produtos' }
    );
  },

  filtrarProdutos: function(busca) {
    // Mantido para compatibilidade mas agora a busca é server-side via Enter
    Pages._produtosBusca = busca;
  },

  novoProduto: function() { Pages._produtoForm(null); },
  editarProduto: async function(id) {
    var p;
    try { p = await App.get('/produtos/' + id); } catch(e) { return; }
    Pages._produtoForm(p);
  },

  _produtoForm: function(prod) {
    var isEdit = !!prod;
    var catOpts = '<option value="">Selecione</option>' + (Pages._categoriasData || []).map(function(c) {
      return '<option value="' + c.id + '"' + (prod && prod.categoria_id == c.id ? ' selected' : '') + '>' + c.nome + '</option>';
    }).join('');
    var fornOpts = '<option value="">Selecione</option>' + (Pages._fornecedoresData || []).map(function(f) {
      return '<option value="' + f.id + '"' + (prod && prod.fornecedor_id == f.id ? ' selected' : '') + '>' + f.nome + '</option>';
    }).join('');

    var isDrog = App.isDrogaria();
    var v = function(field, def) { return prod ? (prod[field] || def || '') : (def || ''); };
    // Formatar valores monetários no padrão brasileiro (vírgula decimal, 2 casas)
    var vMoney = function(field, def) {
      var raw = prod ? prod[field] : null;
      if (raw == null || raw === '') { if (def === '' || def == null) return ''; raw = def || 0; }
      var num = parseFloat(raw) || 0;
      return num.toFixed(2).replace('.', ',');
    };
    var chk = function(field) { return prod && prod[field] ? ' checked' : ''; };
    var sel = function(field, val) { return prod && prod[field] === val ? ' selected' : ''; };

    // ══════════════════════════════════════════════
    // Tab 1: DADOS GERAIS
    // ══════════════════════════════════════════════
    var tabDados =
      '<div class="form-row">' +
        '<div class="form-group" style="flex:2"><label class="form-label">Nome do Produto *</label><input type="text" class="form-control" id="pNome" value="' + v('nome') + '"></div>' +
        '<div class="form-group"><label class="form-label">Código de Barras (EAN/GTIN)</label><input type="text" class="form-control" id="pCodigo" value="' + v('codigo_barras') + '"></div>' +
        '<div class="form-group"><label class="form-label">Código Interno (SKU)</label><input type="text" class="form-control" id="pCodInterno" value="' + v('codigo_interno') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Categoria</label><select class="form-control" id="pCategoria">' + catOpts + '</select></div>' +
        '<div class="form-group"><label class="form-label">Subcategoria</label><input type="text" class="form-control" id="pSubcategoria" value="' + v('subcategoria') + '" placeholder="Ex: Higiene, Limpeza"></div>' +
        '<div class="form-group"><label class="form-label">Marca</label><input type="text" class="form-control" id="pMarca" value="' + v('marca') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group" style="flex:2"><label class="form-label">Fornecedor Principal</label><select class="form-control" id="pFornecedor">' + fornOpts + '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Unidade de Venda</label><select class="form-control" id="pUnidade">' +
          '<option value="UN"' + sel('unidade','UN') + '>UN - Unidade</option>' +
          '<option value="KG"' + sel('unidade','KG') + '>KG - Quilograma</option>' +
          '<option value="G"' + sel('unidade','G') + '>G - Grama</option>' +
          '<option value="L"' + sel('unidade','L') + '>L - Litro</option>' +
          '<option value="ML"' + sel('unidade','ML') + '>ML - Mililitro</option>' +
          '<option value="CX"' + sel('unidade','CX') + '>CX - Caixa</option>' +
          '<option value="FD"' + sel('unidade','FD') + '>FD - Fardo</option>' +
          '<option value="PC"' + sel('unidade','PC') + '>PC - Peça</option>' +
        '</select></div>' +
        '<div class="form-group"><label class="form-label">Tipo do Produto</label><select class="form-control" id="pTipoProduto">' +
          '<option value="mercadoria"' + sel('tipo_produto','mercadoria') + '>Mercadoria</option>' +
          '<option value="servico"' + sel('tipo_produto','servico') + '>Serviço</option>' +
          '<option value="uso_interno"' + sel('tipo_produto','uso_interno') + '>Uso Interno</option>' +
          '<option value="medicamento_referencia"' + sel('tipo_produto','medicamento_referencia') + '>Medicamento Referência</option>' +
          '<option value="medicamento_generico"' + sel('tipo_produto','medicamento_generico') + '>Medicamento Genérico</option>' +
          '<option value="medicamento_similar"' + sel('tipo_produto','medicamento_similar') + '>Medicamento Similar</option>' +
          '<option value="perfumaria"' + sel('tipo_produto','perfumaria') + '>Perfumaria</option>' +
          '<option value="cosmetico"' + sel('tipo_produto','cosmetico') + '>Cosmético</option>' +
          '<option value="higiene"' + sel('tipo_produto','higiene') + '>Higiene</option>' +
          '<option value="outros"' + sel('tipo_produto','outros') + '>Outros</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pPesado"' + chk('produto_pesado') + '> Produto Pesado</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pFracionamento"' + chk('permite_fracionamento') + '> Permite Fracionamento</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pVendaSemEstoque"' + chk('permite_venda_sem_estoque') + '> Permite Venda sem Estoque</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pAtivo"' + (prod ? (prod.ativo ? ' checked' : '') : ' checked') + '> Ativo</label></div>' +
      '</div>' +
      // Balança (condicional visível se pesado)
      '<div id="pBalancaSection" style="' + (prod && prod.produto_pesado ? '' : 'display:none;') + 'margin-top:12px">' +
        '<h4 style="margin:0 0 8px;font-size:13px;color:var(--text-secondary)">Configuração Balança</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Código Balança</label><input type="text" class="form-control" id="pCodBalanca" value="' + v('codigo_balanca') + '"></div>' +
          '<div class="form-group"><label class="form-label">Prefixo Balança</label><input type="text" class="form-control" id="pPrefixoBalanca" value="' + v('prefixo_balanca') + '"></div>' +
          '<div class="form-group"><label class="form-label">Tipo Leitura</label><select class="form-control" id="pTipoLeitura">' +
            '<option value="">Selecione</option>' +
            '<option value="peso_embutido"' + sel('tipo_leitura_balanca','peso_embutido') + '>Código com peso embutido</option>' +
            '<option value="leitura_serial"' + sel('tipo_leitura_balanca','leitura_serial') + '>Leitura direta serial</option>' +
          '</select></div>' +
        '</div>' +
      '</div>';

    // ══════════════════════════════════════════════
    // Tab 2: COMERCIAL (Preços e Venda)
    // ══════════════════════════════════════════════
    var custoVal = vMoney('preco_custo', '0');
    var despVal = vMoney('despesas_adicionais', '0');
    var margemVal = vMoney('margem', '0');
    var vendaVal = vMoney('preco_venda', '0');
    var tabComercial =
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Preço de Custo (R$)</label><input type="text" class="form-control" id="pCusto" value="' + custoVal + '" data-oninput="Utils.maskNumericInput(event);Pages._calcMargemProduto()"></div>' +
        '<div class="form-group"><label class="form-label">Despesas Adicionais (R$)</label><input type="text" class="form-control" id="pDespesas" value="' + despVal + '" data-oninput="Utils.maskNumericInput(event);Pages._calcMargemProduto()" placeholder="Frete, impostos, etc."></div>' +
        '<div class="form-group"><label class="form-label">Custo Efetivo (R$)</label><input type="text" class="form-control" id="pCustoEfetivo" value="" disabled style="background:var(--bg-secondary);font-weight:600"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Custo Médio Ponderado (R$)</label><input type="text" class="form-control" id="pCustoMedio" value="' + vMoney('preco_custo_medio', '0') + '" disabled style="background:var(--bg-secondary)"></div>' +
        '<div class="form-group"><label class="form-label">Margem (%)</label><input type="text" class="form-control" id="pMargem" value="' + margemVal + '" data-oninput="Utils.maskNumericInput(event);Pages._calcVendaPorMargem()" style="font-weight:600;color:var(--success)"></div>' +
        '<div class="form-group"><label class="form-label">Preço de Venda (R$) *</label><input type="text" class="form-control" id="pVenda" value="' + vendaVal + '" data-oninput="Utils.maskNumericInput(event);Pages._calcMargemProduto()" style="font-weight:700;font-size:18px"></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Preço Promocional (R$)</label><input type="text" class="form-control" id="pPromo" value="' + vMoney('preco_promocional', '') + '" data-oninput="Utils.maskNumericInput(event)" placeholder="Deixe vazio se sem promoção"></div>' +
        '<div class="form-group"><label class="form-label">Início Promoção</label><input type="date" class="form-control" id="pPromoInicio" value="' + v('promocao_inicio') + '"></div>' +
        '<div class="form-group"><label class="form-label">Fim Promoção</label><input type="date" class="form-control" id="pPromoFim" value="' + v('promocao_fim') + '"></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<div class="form-row">' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pPermiteDesconto"' + (prod ? (prod.permite_desconto_manual !== false ? ' checked' : '') : ' checked') + '> Permite Desconto Manual</label></div>' +
        '<div class="form-group"><label class="form-label">Desconto Máximo (%)</label><input type="text" class="form-control" id="pDescontoMax" value="' + v('desconto_maximo', '100') + '" data-oninput="Utils.maskNumericInput(event)" style="max-width:120px"></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-top:24px"><input type="checkbox" id="pFidelidade"' + chk('participa_fidelidade') + '> Participa Clube Fidelidade</label></div>' +
      '</div>';

    // ══════════════════════════════════════════════
    // Tab 3: ESTOQUE
    // ══════════════════════════════════════════════
    var tabEstoque =
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Estoque Atual</label><input type="text" class="form-control" id="pEstoque" value="' + v('estoque_atual', '0') + '" ' + (isEdit ? 'disabled style="background:var(--bg-secondary);font-weight:600"' : '') + ' data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Estoque Reservado</label><input type="text" class="form-control" id="pEstoqueRes" value="' + v('estoque_reservado', '0') + '" disabled style="background:var(--bg-secondary)"></div>' +
        '<div class="form-group"><label class="form-label">Estoque Mínimo</label><input type="text" class="form-control" id="pEstoqueMin" value="' + v('estoque_minimo', '0') + '" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Estoque Máximo</label><input type="text" class="form-control" id="pEstoqueMax" value="' + v('estoque_maximo') + '" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Ponto de Reposição</label><input type="text" class="form-control" id="pReposicao" value="' + v('ponto_reposicao', '0') + '" data-oninput="Utils.maskNumericInput(event)" placeholder="Qtd para disparar pedido"></div>' +
        '<div class="form-group"><label class="form-label">Localização</label><input type="text" class="form-control" id="pLocalizacao" value="' + v('localizacao') + '" placeholder="Ex: Corredor 3, Prateleira B"></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Configurações de Controle</h4>' +
      '<div class="form-row">' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pEstoqueNegativo"' + chk('permite_estoque_negativo') + '> Permite Estoque Negativo</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pControlaLote"' + chk('controla_lote') + '> Controla Lote</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pControlaValidade"' + chk('controla_validade') + '> Controla Validade</label></div>' +
        '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pSugereCompra"' + chk('sugere_compra_automatica') + '> Sugere Compra Automática</label></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Compras & Reposição</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Unidade de Compra</label><input type="text" class="form-control" id="pUnidCompra" value="' + v('unidade_compra') + '" placeholder="Ex: CX, FD"></div>' +
        '<div class="form-group"><label class="form-label">Fator de Conversão</label><input type="text" class="form-control" id="pFatorConv" value="' + v('fator_conversao', '1') + '" data-oninput="Utils.maskNumericInput(event)" placeholder="Ex: 12 (1 CX = 12 UN)"></div>' +
        '<div class="form-group"><label class="form-label">Prazo Entrega (dias)</label><input type="text" class="form-control" id="pPrazoEntrega" value="' + v('prazo_entrega', '0') + '" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Qtd Mínima Compra</label><input type="text" class="form-control" id="pQtdMinCompra" value="' + v('quantidade_minima_compra', '1') + '" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '</div>' +
      '<p class="text-muted" style="font-size:12px;margin-top:-4px">Se compra em caixa com 12 unidades: Unidade = CX, Fator = 12.</p>' +
      (isEdit
        ? '<hr style="margin:16px 0"><h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Movimentação Rápida</h4>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="pMovTipo"><option value="entrada">Entrada</option><option value="ajuste">Ajuste</option><option value="perda">Perda</option></select></div>' +
            '<div class="form-group"><label class="form-label">Quantidade</label><input type="text" class="form-control" id="pMovQtd" placeholder="0" data-oninput="Utils.maskNumericInput(event)"></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Motivo</label><input type="text" class="form-control" id="pMovMotivo" placeholder="Motivo da movimentação"></div>' +
          '<button class="btn btn-primary" data-onclick="Pages._movimentarProduto(' + prod.id + ')"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i> Registrar Movimentação</button>'
        : '<p class="text-muted" style="margin-top:16px;font-size:13px">Movimentações e lotes disponíveis após salvar o produto.</p>');

    // ══════════════════════════════════════════════
    // Tab 4: FISCAL
    // ══════════════════════════════════════════════
    var tabFiscal =
      '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Identificação Fiscal</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">NCM</label><input type="text" class="form-control" id="pNcm" value="' + v('ncm') + '" placeholder="Ex: 30049099" maxlength="10"></div>' +
        '<div class="form-group"><label class="form-label">CEST</label><input type="text" class="form-control" id="pCest" value="' + v('cest') + '" placeholder="Ex: 1300100"></div>' +
        '<div class="form-group"><label class="form-label">Origem</label><select class="form-control" id="pOrigem">' +
          '<option value="0"' + sel('origem','0') + '>0 - Nacional</option>' +
          '<option value="1"' + sel('origem','1') + '>1 - Estrangeira (Importação direta)</option>' +
          '<option value="2"' + sel('origem','2') + '>2 - Estrangeira (Mercado interno)</option>' +
          '<option value="3"' + sel('origem','3') + '>3 - Nacional (40-70% importado)</option>' +
          '<option value="5"' + sel('origem','5') + '>5 - Nacional (importado < 40%)</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CFOP Venda</label><input type="text" class="form-control" id="pCfop" value="' + v('cfop') + '" placeholder="Ex: 5102"></div>' +
        '<div class="form-group"><label class="form-label">CFOP Compra</label><input type="text" class="form-control" id="pCfopCompra" value="' + v('cfop_compra') + '" placeholder="Ex: 1102"></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Tributação</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CST ICMS</label><input type="text" class="form-control" id="pCstIcms" value="' + v('cst_icms') + '" placeholder="Ex: 00, 10, 20" maxlength="3"></div>' +
        '<div class="form-group"><label class="form-label">CST PIS</label><input type="text" class="form-control" id="pCstPis" value="' + v('cst_pis') + '" placeholder="Ex: 01, 04, 06" maxlength="2"></div>' +
        '<div class="form-group"><label class="form-label">CST COFINS</label><input type="text" class="form-control" id="pCstCofins" value="' + v('cst_cofins') + '" placeholder="Ex: 01, 04, 06" maxlength="2"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Alíq. ICMS (%)</label><input type="text" class="form-control" id="pAliqIcms" value="' + vMoney('aliquota_icms', '') + '" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Alíq. PIS (%)</label><input type="text" class="form-control" id="pAliqPis" value="' + vMoney('aliquota_pis', '') + '" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Alíq. COFINS (%)</label><input type="text" class="form-control" id="pAliqCofins" value="' + vMoney('aliquota_cofins', '') + '" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Alíq. IPI (%)</label><input type="text" class="form-control" id="pAliqIpi" value="' + vMoney('aliquota_ipi', '') + '" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '</div>' +
      '<hr style="margin:16px 0">' +
      '<h4 style="margin:0 0 8px;font-size:13px;color:var(--text-muted)">Reforma Tributária (preparação futura)</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CBS (%)</label><input type="text" class="form-control" id="pCbs" value="' + v('cbs', '0') + '" data-oninput="Utils.maskNumericInput(event)" disabled style="background:var(--bg-secondary)"></div>' +
        '<div class="form-group"><label class="form-label">IBS (%)</label><input type="text" class="form-control" id="pIbs" value="' + v('ibs', '0') + '" data-oninput="Utils.maskNumericInput(event)" disabled style="background:var(--bg-secondary)"></div>' +
        '<div class="form-group"><label class="form-label">Imp. Seletivo (%)</label><input type="text" class="form-control" id="pSeletivo" value="' + v('imposto_seletivo', '0') + '" data-oninput="Utils.maskNumericInput(event)" disabled style="background:var(--bg-secondary)"></div>' +
      '</div>';

    // ══════════════════════════════════════════════
    // Tab 5: MEDICAMENTOS (somente drogaria)
    // ══════════════════════════════════════════════
    var tabMed = isDrog
      ? '<div class="form-row">' +
          '<div class="form-group" style="flex:2"><label class="form-label">Princípio Ativo</label><input type="text" class="form-control" id="pPrincipioAtivo" value="' + v('principio_ativo') + '"></div>' +
          '<div class="form-group"><label class="form-label">Classe Terapêutica</label><input type="text" class="form-control" id="pClasseTerapeutica" value="' + v('classe_terapeutica') + '" placeholder="Ex: Anti-inflamatório"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Tipo Medicamento</label><select class="form-control" id="pTipoMedicamento">' +
            '<option value="">Selecione</option>' +
            '<option value="referencia"' + sel('tipo_medicamento','referencia') + '>Referência</option>' +
            '<option value="generico"' + sel('tipo_medicamento','generico') + '>Genérico</option>' +
            '<option value="similar"' + sel('tipo_medicamento','similar') + '>Similar</option>' +
            '<option value="otc"' + sel('tipo_medicamento','otc') + '>OTC (Livre)</option>' +
            '<option value="fitoterapico"' + sel('tipo_medicamento','fitoterapico') + '>Fitoterápico</option>' +
            '<option value="cosmetico"' + sel('tipo_medicamento','cosmetico') + '>Cosmético</option>' +
            '<option value="outros"' + sel('tipo_medicamento','outros') + '>Outros</option>' +
          '</select></div>' +
          '<div class="form-group"><label class="form-label">Laboratório</label><input type="text" class="form-control" id="pLaboratorio" value="' + v('laboratorio') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Registro ANVISA</label><input type="text" class="form-control" id="pAnvisa" value="' + v('registro_anvisa') + '"></div>' +
          '<div class="form-group"><label class="form-label">Registro MS</label><input type="text" class="form-control" id="pRegistroMS" value="' + v('registro_ms') + '"></div>' +
          '<div class="form-group"><label class="form-label">Código Farmacêutico</label><input type="text" class="form-control" id="pCodFarma" value="' + v('codigo_farmaceutico') + '"></div>' +
        '</div>' +
        '<hr style="margin:16px 0">' +
        '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Controle de Receita</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Tipo Receita</label><select class="form-control" id="pTipoReceita">' +
            '<option value="sem_receita"' + sel('tipo_receita','sem_receita') + '>Sem Receita</option>' +
            '<option value="simples"' + sel('tipo_receita','simples') + '>Simples</option>' +
            '<option value="branca"' + sel('tipo_receita','branca') + '>Branca (C1)</option>' +
            '<option value="azul"' + sel('tipo_receita','azul') + '>Azul (B)</option>' +
            '<option value="amarela"' + sel('tipo_receita','amarela') + '>Amarela (A)</option>' +
            '<option value="especial"' + sel('tipo_receita','especial') + '>Especial</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;color:var(--danger)"><input type="checkbox" id="pControlado"' + chk('controlado') + '> Controlado</label></div>' +
          '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pPortaria344"' + chk('portaria_344') + '> Portaria 344</label></div>' +
          '<div class="form-group" style="flex:0 0 auto"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="pRetencao"' + chk('exige_retencao_receita') + '> Exige Retenção Receita</label></div>' +
        '</div>' +
        '<hr style="margin:16px 0">' +
        '<h4 style="margin:0 0 12px;font-size:14px;color:var(--text-secondary)">Controle por Lote</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Número do Lote</label><input type="text" class="form-control" id="pLote" value="' + v('numero_lote') + '"></div>' +
          '<div class="form-group"><label class="form-label">Validade</label><input type="date" class="form-control" id="pValidade" value="' + v('validade') + '"></div>' +
        '</div>' +
        (isEdit
          ? '<div id="produtoLotes" style="margin-top:12px"><div class="loading"><div class="spinner"></div></div></div>'
          : '<p class="text-muted" style="font-size:12px">Gestão de lotes disponível após salvar o produto.</p>')
      : '<p class="text-muted">Aba disponível apenas para drogarias.</p>';

    // ══════════════════════════════════════════════
    // Tab 6: HISTÓRICO & INDICADORES
    // ══════════════════════════════════════════════
    var tabHistorico = isEdit
      ? '<div id="produtoDashboard"><div class="loading"><div class="spinner"></div></div></div>'
      : '<p class="text-muted">Histórico e indicadores disponíveis após salvar o produto.</p>';

    Modal.show(isEdit ? 'Editar: ' + prod.nome : 'Novo Produto',
      '<div class="tabs">' +
        '<button class="tab active" data-onclick="Pages._switchTab(event,\'tabPDados\')">Dados Gerais</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPComercial\')">Comercial</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPEstoque\')">Estoque</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPFiscal\')">Fiscal</button>' +
        (isDrog ? '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPMed\')' + (isEdit ? ';Pages._carregarLotesProduto(' + prod.id + ')' : '') + '">Medicamentos</button>' : '') +
        (isEdit ? '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPHistorico\');Pages._carregarDashboardProduto(' + prod.id + ')">Histórico</button>' : '') +
      '</div>' +
      '<div class="tab-content active" id="tabPDados">' + tabDados + '</div>' +
      '<div class="tab-content" id="tabPComercial">' + tabComercial + '</div>' +
      '<div class="tab-content" id="tabPEstoque">' + tabEstoque + '</div>' +
      '<div class="tab-content" id="tabPFiscal">' + tabFiscal + '</div>' +
      (isDrog ? '<div class="tab-content" id="tabPMed">' + tabMed + '</div>' : '') +
      (isEdit ? '<div class="tab-content" id="tabPHistorico">' + tabHistorico + '</div>' : ''),
      '<button class="btn btn-primary" data-onclick="Pages._salvarProduto(' + (isEdit ? prod.id : 'null') + ')"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      (isEdit ? '<button class="btn btn-outline" style="border-color:var(--info);color:var(--info)" data-onclick="Pages._abrirImprimirEtiquetaProduto(' + prod.id + ',\'' + (prod.nome || '').replace(/'/g, "\\'") + '\',' + (prod.preco_venda || 0) + ',\'' + (prod.codigo_barras || '').replace(/'/g, "\\'") + '\')"><i data-lucide="tag" style="width:16px;height:16px"></i> Etiqueta</button>' : '') +
      (isEdit ? '<button class="btn btn-danger" data-onclick="Pages._excluirProduto(' + prod.id + ')">Excluir</button>' : '') +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-xl'
    );

    // Toggle balança section quando muda checkbox pesado
    setTimeout(function() {
      Pages._calcMargemProduto();
      var pesadoCheck = document.getElementById('pPesado');
      if (pesadoCheck) {
        pesadoCheck.addEventListener('change', function() {
          var sec = document.getElementById('pBalancaSection');
          if (sec) sec.style.display = this.checked ? '' : 'none';
        });
      }
    }, 50);
  },

  _calcMargemProduto: function() {
    var custoEl = document.getElementById('pCusto');
    var despEl = document.getElementById('pDespesas');
    var ceEl = document.getElementById('pCustoEfetivo');
    var margemEl = document.getElementById('pMargem');
    var vendaEl = document.getElementById('pVenda');
    if (!custoEl || !vendaEl) return;

    var custo = parseFloat((custoEl.value || '0').replace(',', '.'));
    var despesas = parseFloat((despEl ? despEl.value || '0' : '0').replace(',', '.'));
    var custoEfetivo = custo + despesas;
    var venda = parseFloat((vendaEl.value || '0').replace(',', '.'));

    if (ceEl) ceEl.value = custoEfetivo.toFixed(2).replace('.', ',');

    if (custoEfetivo > 0 && venda > 0) {
      var margem = ((venda - custoEfetivo) / custoEfetivo * 100).toFixed(2).replace('.', ',');
      if (margemEl && document.activeElement !== margemEl) margemEl.value = margem;
    }
  },

  _calcVendaPorMargem: function() {
    var custoEl = document.getElementById('pCusto');
    var despEl = document.getElementById('pDespesas');
    var margemEl = document.getElementById('pMargem');
    var vendaEl = document.getElementById('pVenda');
    if (!custoEl || !margemEl || !vendaEl) return;

    var custo = parseFloat((custoEl.value || '0').replace(',', '.'));
    var despesas = parseFloat((despEl ? despEl.value || '0' : '0').replace(',', '.'));
    var custoEfetivo = custo + despesas;
    var margem = parseFloat((margemEl.value || '0').replace(',', '.'));

    if (custoEfetivo > 0) {
      var venda = (custoEfetivo * (1 + margem / 100)).toFixed(2).replace('.', ',');
      vendaEl.value = venda;
    }

    var ceEl = document.getElementById('pCustoEfetivo');
    if (ceEl) ceEl.value = custoEfetivo.toFixed(2).replace('.', ',');
  },

  _carregarDashboardProduto: async function(produtoId) {
    var container = document.getElementById('produtoDashboard');
    if (!container || container.dataset.loaded === 'true') return;
    container.dataset.loaded = 'true';

    try {
      var data = await App.get('/produtos/' + produtoId + '/dashboard');
      var kpis = data.kpis || {};
      var movs = data.movimentacoes || [];
      var hist = data.historicoPrecos || [];
      var lotes = data.lotes || [];

      // KPIs cards (12 indicadores)
      var diasRupturaHtml = kpis.dias_ruptura !== null
        ? '<div style="font-size:20px;font-weight:700' + (kpis.dias_ruptura <= 7 ? ';color:var(--danger)' : (kpis.dias_ruptura <= 15 ? ';color:var(--warning)' : '')) + '">' + kpis.dias_ruptura + ' dias</div>'
        : '<div style="font-size:16px;font-weight:700;color:var(--text-muted)">—</div>';

      var kpiHtml =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:20px">' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Estoque</div><div style="font-size:18px;font-weight:700' + (kpis.alerta_estoque ? ';color:var(--danger)' : '') + '">' + Utils.number(kpis.estoque_atual, 0) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Reservado</div><div style="font-size:18px;font-weight:700">' + Utils.number(kpis.estoque_reservado, 0) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Custo</div><div style="font-size:18px;font-weight:700">' + Utils.currency(kpis.preco_custo) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Custo Médio</div><div style="font-size:18px;font-weight:700">' + Utils.currency(kpis.preco_custo_medio) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Venda</div><div style="font-size:18px;font-weight:700;color:var(--success)">' + Utils.currency(kpis.preco_venda) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Margem</div><div style="font-size:18px;font-weight:700">' + Utils.number(kpis.margem, 2) + '%</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Margem Média</div><div style="font-size:18px;font-weight:700">' + Utils.number(kpis.margem_real_media, 2) + '%</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Vendido/Mês</div><div style="font-size:18px;font-weight:700">' + Utils.number(kpis.total_vendido_mes, 0) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Fatur./Mês</div><div style="font-size:18px;font-weight:700">' + Utils.currency(kpis.faturamento_mes) + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Curva ABC</div><div style="font-size:18px;font-weight:700">' + (kpis.curva_abc || 'C') + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Giro</div><div style="font-size:18px;font-weight:700">' + (kpis.giro_estoque || 'medio') + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Dias até Ruptura</div>' + diasRupturaHtml + '</div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Última Venda</div><div style="font-size:14px;font-weight:700">' + (kpis.ultima_venda ? new Date(kpis.ultima_venda + 'T00:00:00').toLocaleDateString('pt-BR') : '—') + '</div></div>' +
          '<div class="card" style="padding:10px;text-align:center"><div class="text-muted" style="font-size:11px">Última Compra</div><div style="font-size:14px;font-weight:700">' + (kpis.ultima_compra ? new Date(kpis.ultima_compra + 'T00:00:00').toLocaleDateString('pt-BR') : '—') + '</div></div>' +
        '</div>';

      // Lotes (se houver)
      var lotesHtml = '';
      if (lotes.length > 0) {
        var loteRows = lotes.map(function(l) {
          var hoje = new Date();
          var valDate = l.validade ? new Date(l.validade + 'T00:00:00') : null;
          var diasVenc = valDate ? Math.ceil((valDate - hoje) / 86400000) : null;
          var vencClass = diasVenc !== null && diasVenc <= 30 ? (diasVenc <= 0 ? 'text-danger fw-600' : 'text-warning fw-600') : '';
          return '<tr>' +
            '<td class="fw-500">' + l.numero_lote + '</td>' +
            '<td class="' + vencClass + '">' + (l.validade ? new Date(l.validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—') + '</td>' +
            '<td class="text-right">' + Utils.number(l.quantidade, 0) + '</td>' +
            '<td>' + (l.Fornecedor ? l.Fornecedor.nome : '—') + '</td>' +
            '<td>' + (l.data_entrada ? new Date(l.data_entrada + 'T00:00:00').toLocaleDateString('pt-BR') : '—') + '</td>' +
          '</tr>';
        }).join('');
        lotesHtml =
          '<h4 style="margin:0 0 8px;font-size:14px">Lotes Ativos</h4>' +
          '<div class="table-container" style="margin-bottom:20px"><table><thead><tr><th>Lote</th><th>Validade</th><th class="text-right">Qtd</th><th>Fornecedor</th><th>Entrada</th></tr></thead><tbody>' + loteRows + '</tbody></table></div>';
      }

      // Histórico de preços
      var histRows = hist.length > 0 ? hist.map(function(h) {
        return '<tr>' +
          '<td>' + new Date(h.created_at || h.createdAt).toLocaleDateString('pt-BR') + '</td>' +
          '<td class="text-right">' + Utils.currency(h.preco_custo_anterior) + ' → ' + Utils.currency(h.preco_custo_novo) + '</td>' +
          '<td class="text-right">' + Utils.currency(h.preco_venda_anterior) + ' → ' + Utils.currency(h.preco_venda_novo) + '</td>' +
          '<td class="text-right">' + Utils.number(h.margem_anterior,1) + '% → ' + Utils.number(h.margem_nova,1) + '%</td>' +
          '<td>' + (h.Usuario ? h.Usuario.nome : '-') + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5" class="text-center text-muted">Nenhuma alteração registrada</td></tr>';

      var histHtml =
        '<h4 style="margin:0 0 8px;font-size:14px">Histórico de Preços</h4>' +
        '<div class="table-container" style="margin-bottom:20px"><table><thead><tr><th>Data</th><th class="text-right">Custo</th><th class="text-right">Venda</th><th class="text-right">Margem</th><th>Usuário</th></tr></thead><tbody>' + histRows + '</tbody></table></div>';

      // Movimentações recentes
      var movRows = movs.length > 0 ? movs.map(function(m) {
        var badgeClass = m.tipo === 'entrada' ? 'badge-success' : (m.tipo === 'saida' ? 'badge-warning' : 'badge-neutral');
        return '<tr>' +
          '<td>' + new Date(m.created_at || m.createdAt).toLocaleDateString('pt-BR') + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + m.tipo + '</span></td>' +
          '<td class="text-right">' + Utils.number(m.quantidade, 2) + '</td>' +
          '<td class="text-right">' + Utils.number(m.estoque_anterior, 0) + ' → ' + Utils.number(m.estoque_posterior, 0) + '</td>' +
          '<td>' + (m.referencia || m.motivo || '-') + '</td>' +
          '<td>' + (m.Usuario ? m.Usuario.nome : '-') + '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="6" class="text-center text-muted">Nenhuma movimentação registrada</td></tr>';

      var movHtml =
        '<h4 style="margin:0 0 8px;font-size:14px">Movimentações Recentes</h4>' +
        '<div class="table-container"><table><thead><tr><th>Data</th><th>Tipo</th><th class="text-right">Qtd</th><th class="text-right">Estoque</th><th>Documento</th><th>Usuário</th></tr></thead><tbody>' + movRows + '</tbody></table></div>';

      container.innerHTML = kpiHtml + lotesHtml + histHtml + movHtml;
    } catch(e) {
      container.innerHTML = '<p class="text-muted">Erro ao carregar histórico.</p>';
    }
  },

  _carregarLotesProduto: async function(produtoId) {
    var container = document.getElementById('produtoLotes');
    if (!container || container.dataset.loaded === 'true') return;
    container.dataset.loaded = 'true';

    try {
      var _lotesRes = await App.get('/produtos/' + produtoId + '/lotes');
      var lotes = Array.isArray(_lotesRes) ? _lotesRes : [];
      if (lotes.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size:12px">Nenhum lote cadastrado.</p>';
        return;
      }
      var rows = lotes.map(function(l) {
        var hoje = new Date();
        var valDate = l.validade ? new Date(l.validade + 'T00:00:00') : null;
        var diasVenc = valDate ? Math.ceil((valDate - hoje) / 86400000) : null;
        var vencClass = diasVenc !== null && diasVenc <= 30 ? (diasVenc <= 0 ? 'text-danger fw-600' : 'text-warning fw-600') : '';
        return '<tr><td class="fw-500">' + l.numero_lote + '</td><td class="' + vencClass + '">' + (l.validade ? valDate.toLocaleDateString('pt-BR') : '—') + '</td><td class="text-right">' + Utils.number(l.quantidade, 0) + '</td></tr>';
      }).join('');
      container.innerHTML = '<div class="table-container"><table><thead><tr><th>Lote</th><th>Validade</th><th class="text-right">Qtd</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    } catch(e) {
      container.innerHTML = '<p class="text-muted" style="font-size:12px">Erro ao carregar lotes.</p>';
    }
  },

  _salvarProduto: async function(id) {
    var val = function(elId, def) { var el = document.getElementById(elId); return el ? (el.value || def || '') : (def || ''); };
    var numVal = function(elId) { return (val(elId, '0')).replace(',', '.'); };
    var chkVal = function(elId) { var el = document.getElementById(elId); return el ? el.checked : false; };

    var data = {
      // Dados Gerais
      nome: val('pNome'),
      codigo_barras: val('pCodigo') || null,
      codigo_interno: val('pCodInterno') || null,
      marca: val('pMarca') || null,
      subcategoria: val('pSubcategoria') || null,
      categoria_id: val('pCategoria') || null,
      unidade: val('pUnidade', 'UN'),
      tipo_produto: val('pTipoProduto', 'mercadoria'),
      produto_pesado: chkVal('pPesado'),
      permite_fracionamento: chkVal('pFracionamento'),
      permite_venda_sem_estoque: chkVal('pVendaSemEstoque'),
      ativo: chkVal('pAtivo'),
      // Balança
      codigo_balanca: val('pCodBalanca') || null,
      prefixo_balanca: val('pPrefixoBalanca') || null,
      tipo_leitura_balanca: val('pTipoLeitura') || null,
      // Comercial
      preco_custo: numVal('pCusto'),
      preco_venda: numVal('pVenda'),
      despesas_adicionais: numVal('pDespesas'),
      preco_promocional: val('pPromo') ? numVal('pPromo') : null,
      promocao_inicio: val('pPromoInicio') || null,
      promocao_fim: val('pPromoFim') || null,
      permite_desconto_manual: chkVal('pPermiteDesconto'),
      desconto_maximo: numVal('pDescontoMax'),
      participa_fidelidade: chkVal('pFidelidade'),
      // Estoque
      estoque_minimo: numVal('pEstoqueMin'),
      estoque_maximo: numVal('pEstoqueMax'),
      ponto_reposicao: numVal('pReposicao'),
      permite_estoque_negativo: chkVal('pEstoqueNegativo'),
      localizacao: val('pLocalizacao') || null,
      controla_validade: chkVal('pControlaValidade'),
      sugere_compra_automatica: chkVal('pSugereCompra'),
      // Fiscal
      ncm: val('pNcm') || null,
      cest: val('pCest') || null,
      cfop: val('pCfop') || null,
      cfop_compra: val('pCfopCompra') || null,
      origem: val('pOrigem', '0'),
      cst_icms: val('pCstIcms') || null,
      cst_pis: val('pCstPis') || null,
      cst_cofins: val('pCstCofins') || null,
      aliquota_icms: numVal('pAliqIcms'),
      aliquota_pis: numVal('pAliqPis'),
      aliquota_cofins: numVal('pAliqCofins'),
      aliquota_ipi: numVal('pAliqIpi'),
      // Compras
      fornecedor_id: val('pFornecedor') || null,
      unidade_compra: val('pUnidCompra') || null,
      fator_conversao: numVal('pFatorConv'),
      prazo_entrega: numVal('pPrazoEntrega'),
      quantidade_minima_compra: numVal('pQtdMinCompra')
    };

    if (!id) data.estoque_atual = numVal('pEstoque');

    // Pharmacy fields (drogaria)
    if (App.isDrogaria()) {
      data.principio_ativo = val('pPrincipioAtivo') || null;
      data.classe_terapeutica = val('pClasseTerapeutica') || null;
      data.tipo_medicamento = val('pTipoMedicamento') || null;
      data.laboratorio = val('pLaboratorio') || null;
      data.registro_anvisa = val('pAnvisa') || null;
      data.registro_ms = val('pRegistroMS') || null;
      data.codigo_farmaceutico = val('pCodFarma') || null;
      data.tipo_receita = val('pTipoReceita', 'sem_receita');
      data.controlado = chkVal('pControlado');
      data.portaria_344 = chkVal('pPortaria344');
      data.exige_retencao_receita = chkVal('pRetencao');
      data.controla_lote = chkVal('pControlaLote');
      data.numero_lote = val('pLote') || null;
      data.validade = val('pValidade') || null;
    }

    if (!data.nome) { Toast.error('Nome é obrigatório'); return; }
    if (!data.preco_venda || parseFloat(data.preco_venda) <= 0) { Toast.error('Preço de venda é obrigatório'); return; }

    try {
      if (id) await App.put('/produtos/' + id, data);
      else await App.post('/produtos', data);
      Toast.success(id ? 'Produto atualizado' : 'Produto criado');
      Modal.close();
      Pages.produtos();
    } catch(e) { /* toast */ }
  },

  _excluirProduto: async function(id) {
    if (!confirm('Desativar este produto?')) return;
    try { await App.del('/produtos/' + id); Toast.success('Produto desativado'); Modal.close(); Pages.produtos(); } catch(e) {}
  },

  _importarXml: async function() {
    var fileInput = document.getElementById('pXmlFile');
    var resultDiv = document.getElementById('xmlResultado');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      Toast.error('Selecione um arquivo XML');
      return;
    }
    var formData = new FormData();
    formData.append('xml', fileInput.files[0]);
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      var resp = await fetch('/estoque/importar-xml', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        body: formData
      });
      var data = await resp.json();
      if (!resp.ok) { Toast.error(data.error || 'Erro ao importar'); resultDiv.style.display = 'none'; return; }

      var html = '<div style="padding:8px;border-radius:6px;background:var(--success-bg,#d4edda);color:var(--success,#28a745);margin-bottom:8px"><strong>NF-e ' + (data.numero_nf || '') + '</strong> — ' + data.fornecedor + '<br>' + data.atualizados + ' de ' + data.processados + ' itens atualizados</div>';

      if (data.itens && data.itens.length > 0) {
        html += '<div class="table-container"><table><thead><tr><th>Produto</th><th class="text-right">Qtd</th><th class="text-right">Custo</th><th class="text-right">Estoque Novo</th></tr></thead><tbody>';
        data.itens.forEach(function(it) {
          html += '<tr><td>' + it.nome + '</td><td class="text-right">' + Utils.number(it.qtd, 2) + '</td><td class="text-right">' + Utils.currency(it.custo) + '</td><td class="text-right">' + Utils.number(it.estoque_novo, 0) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      if (data.nao_encontrados && data.nao_encontrados.length > 0) {
        html += '<div style="margin-top:8px;padding:8px;border-radius:6px;background:var(--warning-light);color:var(--warning)"><strong>Não encontrados (' + data.nao_encontrados.length + '):</strong><ul style="margin:4px 0 0;padding-left:20px">';
        data.nao_encontrados.forEach(function(nf) {
          html += '<li>' + nf.nome + ' (cod: ' + (nf.codigo || '-') + ', qtd: ' + nf.qtd + ')</li>';
        });
        html += '</ul></div>';
      }
      resultDiv.innerHTML = html;
      Toast.success(data.atualizados + ' itens importados com sucesso');
    } catch(e) {
      resultDiv.innerHTML = '<p class="text-danger">Erro ao processar XML.</p>';
      Toast.error('Erro ao importar XML');
    }
  },

  _movimentarProduto: async function(produtoId) {
    var tipo = document.getElementById('pMovTipo').value;
    var qtd = (document.getElementById('pMovQtd').value || '0').replace(',', '.');
    var motivo = document.getElementById('pMovMotivo').value;

    if (parseFloat(qtd) <= 0) { Toast.error('Informe a quantidade'); return; }

    try {
      if (tipo === 'entrada') await App.post('/estoque/entrada', { produto_id: produtoId, quantidade: qtd, motivo: motivo });
      else if (tipo === 'ajuste') await App.post('/estoque/ajuste', { produto_id: produtoId, quantidade_nova: qtd, motivo: motivo });
      else if (tipo === 'perda') await App.post('/estoque/perda', { produto_id: produtoId, quantidade: qtd, motivo: motivo });
      Toast.success('Movimentação registrada');
      Modal.close();
      Pages.produtos();
    } catch(e) { /* toast */ }
  },


  // ============================================================
  //  CATEGORIAS / CADASTROS — módulo com tabs
  // ============================================================
  categorias: async function() {
    Pages._cadastrosTab = Pages._cadastrosTab || 'categorias';
    Layout.render('<div class="loading"><div class="spinner"></div></div>', {
      title: 'Cadastros',
      moduleMenu: [
        { label: 'Categorias',  icon: 'tag',        active: Pages._cadastrosTab==='categorias',  action: "Pages._cadastrosTab='categorias';Pages.categorias()" },
        { label: 'Subcategorias', icon: 'tags',     active: Pages._cadastrosTab==='subcategorias', action: "Pages._cadastrosTab='subcategorias';Pages.categorias()" }
      ]
    });

    if (Pages._cadastrosTab === 'categorias') await Pages._categoriasLista();
    else await Pages._categoriasLista(); // subcategorias uses same for now
  },

  _categoriasLista: async function() {
    var cats;
    try { var _cRes = await App.get('/categorias'); cats = Array.isArray(_cRes) ? _cRes : (_cRes.data || []); } catch(e) { cats = []; }

    var rows = cats.map(function(c) {
      return '<tr class="clickable" data-onclick="Pages._editarCategoria(' + c.id + ',\'' + c.nome.replace(/'/g, "\\'") + '\',\'' + (c.descricao||'').replace(/'/g, "\\'") + '\')">' +
        '<td class="fw-500">' + c.nome + '</td>' +
        '<td>' + (c.descricao || '-') + '</td>' +
        '<td>' + (c.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-neutral">Inativo</span>') + '</td></tr>';
    }).join('');

    Layout.render(
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novaCategoria()"><i data-lucide="plus" style="width:16px;height:16px"></i> Nova Categoria</button></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Nome</th><th>Descrição</th><th>Status</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="3" class="text-center text-muted" style="padding:40px">Nenhuma categoria</td></tr>') + '</tbody></table></div></div>',
      {
        title: 'Cadastros',
        moduleMenu: [
          { label: 'Categorias',  icon: 'tag',  active: Pages._cadastrosTab==='categorias',  action: "Pages._cadastrosTab='categorias';Pages.categorias()" },
          { label: 'Subcategorias', icon: 'tags', active: Pages._cadastrosTab==='subcategorias', action: "Pages._cadastrosTab='subcategorias';Pages.categorias()" }
        ]
      }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novaCategoria: function() {
    Modal.show('Nova Categoria',
      '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="catNome"></div>' +
      '<div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="catDesc"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarCategoria(null)">Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _editarCategoria: function(id, nome, desc) {
    Modal.show('Editar Categoria',
      '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="catNome" value="' + nome + '"></div>' +
      '<div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="catDesc" value="' + desc + '"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarCategoria(' + id + ')">Salvar</button>' +
      '<button class="btn btn-danger" data-onclick="Pages._excluirCategoria(' + id + ')">Excluir</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarCategoria: async function(id) {
    var data = { nome: document.getElementById('catNome').value, descricao: document.getElementById('catDesc').value };
    try {
      if (id) await App.put('/categorias/' + id, data);
      else await App.post('/categorias', data);
      Toast.success(id ? 'Atualizada' : 'Criada');
      Modal.close(); Pages.categorias();
    } catch(e) {}
  },

  _excluirCategoria: async function(id) {
    if (!confirm('Desativar esta categoria?')) return;
    try { await App.del('/categorias/' + id); Toast.success('Desativada'); Modal.close(); Pages.categorias(); } catch(e) {}
  },

  // ============================================================
  //  FORNECEDORES — módulo independente
  // ============================================================
  fornecedores: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Fornecedores' });

    var fornecedores;
    try { var _fRes = await App.get('/fornecedores'); fornecedores = Array.isArray(_fRes) ? _fRes : (_fRes.data || []); } catch(e) { fornecedores = []; }

    var rows = fornecedores.map(function(f) {
      var stars = Pages._renderStars(f.ranking || 0);
      return '<tr class="clickable" data-onclick="Pages._detalharFornecedor(' + f.id + ')">' +
        '<td class="fw-500">' + f.nome + '</td>' +
        '<td>' + (f.cnpj_cpf || '-') + '</td>' +
        '<td>' + (f.telefone || '-') + '</td>' +
        '<td>' + stars + '</td>' +
        '<td class="text-right">' + Utils.currency(f.valor_medio_compra || 0) + '</td>' +
        '<td>' + (f.cidade ? f.cidade + '/' + (f.estado||'') : '-') + '</td></tr>';
    }).join('');

    Layout.render(
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novoFornecedor()"><i data-lucide="plus" style="width:16px;height:16px"></i> Novo</button></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Nome</th><th>CNPJ/CPF</th><th>Telefone</th><th>Ranking</th><th class="text-right">Média Compras</th><th>Cidade/UF</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhum fornecedor</td></tr>') + '</tbody></table></div></div>',
      { title: 'Fornecedores' }
    );
  },

  _renderStars: function(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s += '<i data-lucide="star" style="width:14px;height:14px;' + (i <= n ? 'color:var(--warning);fill:var(--warning)' : 'color:var(--text-muted)') + '"></i>';
    }
    return '<span class="ranking-stars">' + s + '</span>';
  },

  _detalharFornecedor: async function(id) {
    var res;
    try { res = await App.get('/fornecedores/' + id); } catch(e) { return; }
    if (!res) return;
    var f = res.fornecedor || res;
    var produtos = res.produtos || f.produtos || [];
    var totalDevido = res.total_devido || f.total_devido || 0;
    
    var stars = Pages._renderStars(f.ranking || 0);
    var prodRows = produtos.slice(0, 10).map(function(p) {
      return '<tr><td>' + p.nome + '</td><td class="text-right">' + Utils.currency(p.preco_custo) + '</td>' +
        '<td class="text-right">' + Utils.number(p.estoque_atual, 0) + '</td></tr>';
    }).join('');

    Modal.show(f.nome,
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><span class="text-muted">CNPJ/CPF:</span><br><strong>' + (f.cnpj_cpf||'-') + '</strong></div>' +
        '<div><span class="text-muted">Telefone:</span><br><strong>' + (f.telefone||'-') + '</strong></div>' +
        '<div><span class="text-muted">Email:</span><br><strong>' + (f.email||'-') + '</strong></div>' +
        '<div><span class="text-muted">Contato:</span><br><strong>' + (f.contato||'-') + '</strong></div>' +
        '<div><span class="text-muted">Cidade/UF:</span><br><strong>' + (f.cidade ? f.cidade + '/' + (f.estado||'') : '-') + '</strong></div>' +
        '<div><span class="text-muted">Ranking:</span><br>' + stars + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Total Compras</h4><div class="value" style="font-size:1rem">' + Utils.currency(f.total_compras || 0) + '</div></div></div>' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Última Compra</h4><div class="value" style="font-size:1rem">' + (f.ultima_compra ? Utils.date(f.ultima_compra) : '-') + '</div></div></div>' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Total Devido</h4><div class="value text-danger" style="font-size:1rem">' + Utils.currency(totalDevido) + '</div></div></div>' +
      '</div>' +
      (prodRows ? '<h4>Produtos deste Fornecedor</h4>' +
        '<table><thead><tr><th>Produto</th><th class="text-right">Custo</th><th class="text-right">Estoque</th></tr></thead>' +
        '<tbody>' + prodRows + '</tbody></table>' : ''),
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-primary" data-onclick="Pages._editarFornecedorById(' + f.id + ')"><i data-lucide="edit" style="width:16px;height:16px"></i> Editar</button>' +
        '<button class="btn btn-warning" data-onclick="Pages._rankingModal(' + f.id + ',' + (f.ranking||0) + ')"><i data-lucide="star" style="width:16px;height:16px"></i> Ranking</button>' +
        '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button></div>',
      'modal-lg'
    );
  },

  _editarFornecedorById: async function(id) {
    var res;
    try { res = await App.get('/fornecedores/' + id); } catch(e) { return; }
    if (res) { var f = res.fornecedor || res; Modal.close(); Pages._fornecedorForm(f); }
  },

  _rankingModal: function(id, current) {
    Modal.show('Avaliar Fornecedor',
      '<p class="text-muted" style="margin-bottom:12px">Selecione a avaliação (1 a 5 estrelas):</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">' +
        [1,2,3,4,5].map(function(n) {
          return '<button class="btn ' + (n <= current ? 'btn-warning' : 'btn-secondary') + '" data-onclick="Pages._setRanking(' + id + ',' + n + ')" style="font-size:1.2rem;padding:8px 16px">' + n + ' <i data-lucide="star" style="width:16px;height:16px"></i></button>';
        }).join('') +
      '</div>',
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _setRanking: async function(id, ranking) {
    try {
      await App.put('/fornecedores/' + id + '/ranking', { ranking: ranking });
      Toast.success('Ranking atualizado!');
      Modal.close();
      Pages.fornecedores();
    } catch(e) {}
  },

  _novoFornecedor: function() { Pages._fornecedorForm(null); },
  _editarFornecedor: async function(id) {
    var res;
    try { res = await App.get('/fornecedores/' + id); } catch(e) { return; }
    if (res) { var f = res.fornecedor || res; Pages._fornecedorForm(f); }
  },

  _fornecedorForm: function(f) {
    var isEdit = !!f;
    Modal.show(isEdit ? 'Editar: ' + f.nome : 'Novo Fornecedor',
      '<div class="form-group"><label class="form-label">Nome / Razão Social *</label><input type="text" class="form-control" id="fNome" value="' + (f ? f.nome : '') + '" placeholder="Nome do fornecedor"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CNPJ/CPF *</label><input type="text" class="form-control" id="fCnpj" value="' + (f ? (f.cnpj_cpf||'') : '') + '" data-oninput="Utils.maskCNPJInput(event)" placeholder="00.000.000/0000-00"></div>' +
        '<div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="fTel" value="' + (f ? (f.telefone||'') : '') + '" data-oninput="Utils.maskPhoneInput(event)" placeholder="(00) 00000-0000"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="fEmail" value="' + (f ? (f.email||'') : '') + '" placeholder="fornecedor@email.com"></div>' +
        '<div class="form-group"><label class="form-label">Contato</label><input type="text" class="form-control" id="fContato" value="' + (f ? (f.contato||'') : '') + '" placeholder="Nome do contato"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Endereço</label><input type="text" class="form-control" id="fEnd" value="' + (f ? (f.endereco||'') : '') + '" placeholder="Rua, número, bairro"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Inscrição Estadual (IE)</label><input type="text" class="form-control" id="fIE" value="' + (f ? (f.inscricao_estadual||'') : '') + '" placeholder="IE do fornecedor"></div>' +
        '<div class="form-group"><label class="form-label">Inscrição Municipal (IM)</label><input type="text" class="form-control" id="fIM" value="' + (f ? (f.inscricao_municipal||'') : '') + '" placeholder="IM do fornecedor"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Cidade</label><input type="text" class="form-control" id="fCidade" value="' + (f ? (f.cidade||'') : '') + '" placeholder="Cidade"></div>' +
        '<div class="form-group"><label class="form-label">Estado</label><input type="text" class="form-control" id="fEstado" value="' + (f ? (f.estado||'') : '') + '" maxlength="2" style="max-width:100px;text-transform:uppercase" placeholder="UF"></div>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarFornecedor(' + (isEdit ? f.id : 'null') + ')">Salvar</button>' +
      (isEdit ? '<button class="btn btn-danger" data-onclick="Pages._excluirFornecedor(' + f.id + ')">Excluir</button>' : '') +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarFornecedor: async function(id) {
    var nome = document.getElementById('fNome').value.trim();
    var cnpj = document.getElementById('fCnpj').value.trim();
    var email = document.getElementById('fEmail').value.trim();
    var telefone = document.getElementById('fTel').value.trim();
    
    // Validações
    if (!nome || nome.length < 3) {
      Toast.error('Nome/Razão Social deve ter pelo menos 3 caracteres');
      return;
    }
    
    if (!cnpj) {
      Toast.error('CNPJ/CPF é obrigatório');
      return;
    }
    
    // Validar CNPJ (se tiver 14 dígitos)
    var cnpjDigitos = cnpj.replace(/\D/g, '');
    if (cnpjDigitos.length === 14) {
      if (!Pages._validarCNPJ(cnpj)) {
        Toast.error('CNPJ inválido');
        return;
      }
    } else if (cnpjDigitos.length !== 11) {
      Toast.error('CNPJ deve ter 14 dígitos ou CPF 11 dígitos');
      return;
    }
    
    // Validar email se preenchido
    if (email && !Pages._validarEmail(email)) {
      Toast.error('Email inválido');
      return;
    }
    
    // Validar telefone se preenchido
    if (telefone && !Pages._validarTelefone(telefone)) {
      Toast.error('Telefone inválido (deve ter 10 ou 11 dígitos)');
      return;
    }
    
    var data = {
      nome: nome,
      cnpj_cpf: cnpj,
      telefone: telefone,
      email: email,
      contato: document.getElementById('fContato').value.trim(),
      endereco: document.getElementById('fEnd').value.trim(),
      inscricao_estadual: document.getElementById('fIE') ? document.getElementById('fIE').value.trim() : '',
      inscricao_municipal: document.getElementById('fIM') ? document.getElementById('fIM').value.trim() : '',
      cidade: document.getElementById('fCidade').value.trim(),
      estado: document.getElementById('fEstado').value.trim().toUpperCase()
    };
    try {
      if (id) await App.put('/fornecedores/' + id, data);
      else await App.post('/fornecedores', data);
      Toast.success(id ? 'Atualizado' : 'Criado');
      Modal.close(); Pages.fornecedores();
    } catch(e) {
      Toast.error('Erro ao salvar: ' + ((e && e.error) || ''));
    }
  },

  _excluirFornecedor: async function(id) {
    if (!confirm('Desativar este fornecedor?')) return;
    try { await App.del('/fornecedores/' + id); Toast.success('Desativado'); Modal.close(); Pages.fornecedores(); } catch(e) {}
  },

  // ============================================================
  //  ESTOQUE — movimentações e controle
  // ============================================================
  estoque: async function() {
    Pages._estoqueTab = Pages._estoqueTab || 'visao';
    var menuItems = [
      { label: 'Visão Geral',       icon: 'layout-dashboard', active: Pages._estoqueTab==='visao',       action: "Pages._estoqueTab='visao';Pages.estoque()" },
      { label: 'Movimentações',      icon: 'activity',         active: Pages._estoqueTab==='movimentacoes', action: "Pages._estoqueTab='movimentacoes';Pages.estoque()" },
      { label: 'Lotes',             icon: 'boxes',            active: Pages._estoqueTab==='lotes',       action: "Pages._estoqueTab='lotes';Pages.estoque()" },
      { label: 'Inventário',        icon: 'clipboard-check',  active: Pages._estoqueTab==='inventario',  action: "Pages._estoqueTab='inventario';Pages.estoque()" },
      { label: 'Sugestão Compra',   icon: 'shopping-cart',    active: Pages._estoqueTab==='sugestao',    action: "Pages._estoqueTab='sugestao';Pages.estoque()" }
    ];

    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Gestão de Estoque', moduleMenu: menuItems });

    if (Pages._estoqueTab === 'movimentacoes') { await Pages._estoqueMovimentacoes(menuItems); return; }
    if (Pages._estoqueTab === 'lotes')         { await Pages._estoqueLotes(menuItems); return; }
    if (Pages._estoqueTab === 'inventario')    { Pages._estoqueInventario(menuItems); return; }
    if (Pages._estoqueTab === 'sugestao')      { await Pages._estoqueSugestao(menuItems); return; }

    // ── Visão Geral ──
    var data;
    try { data = await App.get('/estoque/visao-geral'); } catch(e) { data = { metricas: {}, produtos: [] }; }
    var m = data.metricas || {};

    var filtro = Pages._estoqueFiltro || 'todos';
    var produtos = (data.produtos || []).filter(function(p) {
      if (filtro === 'critico') return p.situacao === 'critico' || p.situacao === 'sem_estoque';
      if (filtro === 'excesso') return p.situacao === 'excesso';
      return true;
    });

    var rows = produtos.map(function(p) {
      var sitBadge = { normal: 'badge-success', critico: 'badge-danger', sem_estoque: 'badge-danger', excesso: 'badge-warning' };
      var sitLabel = { normal: 'Normal', critico: 'Crítico', sem_estoque: 'Sem Estoque', excesso: 'Excesso' };
      return '<tr>' +
        '<td class="fw-500">' + p.nome + '</td>' +
        '<td>' + (p.codigo_barras || '-') + '</td>' +
        '<td>' + (p.categoria || '-') + '</td>' +
        '<td class="text-right fw-600">' + Utils.number(p.estoque_atual, 0) + ' ' + p.unidade + '</td>' +
        '<td class="text-right">' + Utils.number(p.estoque_minimo, 0) + '</td>' +
        '<td class="text-right">' + Utils.number(p.estoque_maximo, 0) + '</td>' +
        '<td class="text-right">' + Utils.currency(p.custo_medio) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(p.valor_estoque) + '</td>' +
        '<td><span class="badge ' + (sitBadge[p.situacao] || 'badge-neutral') + '">' + (sitLabel[p.situacao] || p.situacao) + '</span></td>' +
      '</tr>';
    }).join('');

    if (!rows) rows = '<tr><td colspan="9" class="text-center text-muted" style="padding:40px">Nenhum produto encontrado</td></tr>';

    Layout.render(
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="package" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Produtos</h4><div class="value">' + (m.total_produtos || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon green"><i data-lucide="dollar-sign" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Valor Estoque</h4><div class="value">' + Utils.currency(m.valor_estoque || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon red"><i data-lucide="alert-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Sem Estoque</h4><div class="value text-danger">' + (m.sem_estoque || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="arrow-down" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Abaixo Mínimo</h4><div class="value">' + (m.abaixo_minimo || 0) + '</div></div></div>' +
      '</div>' +

      '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
        '<button class="btn ' + (filtro === 'todos' ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-onclick="Pages._estoqueTabFiltro(\'todos\')">Todos</button>' +
        '<button class="btn ' + (filtro === 'critico' ? 'btn-danger' : 'btn-secondary') + ' btn-sm" data-onclick="Pages._estoqueTabFiltro(\'critico\')">Críticos / Sem Estoque (' + ((m.sem_estoque||0)+(m.abaixo_minimo||0)) + ')</button>' +
        '<button class="btn ' + (filtro === 'excesso' ? 'btn-warning' : 'btn-secondary') + ' btn-sm" data-onclick="Pages._estoqueTabFiltro(\'excesso\')">Excesso (' + (m.acima_maximo||0) + ')</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-primary btn-sm" data-onclick="Pages._estoqueMovModal(\'ajuste\')"><i data-lucide="sliders" style="width:14px;height:14px"></i> Ajuste</button>' +
        '<button class="btn btn-danger btn-sm" data-onclick="Pages._estoqueMovModal(\'perda\')"><i data-lucide="alert-triangle" style="width:14px;height:14px"></i> Perda</button>' +
      '</div>' +

      '<div class="card"><div class="card-header"><h3>Estoque por Produto</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Produto</th><th>EAN</th><th>Categoria</th><th class="text-right">Estoque</th><th class="text-right">Mínimo</th><th class="text-right">Máximo</th><th class="text-right">Custo Médio</th><th class="text-right">Valor Est.</th><th>Situação</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>',
      { title: 'Gestão de Estoque', moduleMenu: menuItems }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _estoqueTabFiltro: function(filtro) {
    Pages._estoqueFiltro = filtro;
    Pages._estoqueTab = 'visao';
    Pages.estoque();
  },

  // ── Aba Movimentações ──
  _estoqueMovPag: 1,
  _estoqueMovTipo: '',
  _estoqueMovOrigem: '',
  _estoqueMovInicio: '',
  _estoqueMovFim: '',

  _estoqueMovimentacoes: async function(menu) {
    var pag = Pages._estoqueMovPag || 1;
    var url = '/estoque?page=' + pag + '&limit=25';
    if (Pages._estoqueMovTipo) url += '&tipo=' + Pages._estoqueMovTipo;
    if (Pages._estoqueMovOrigem) url += '&origem=' + Pages._estoqueMovOrigem;
    if (Pages._estoqueMovInicio) url += '&data_inicio=' + Pages._estoqueMovInicio;
    if (Pages._estoqueMovFim) url += '&data_fim=' + Pages._estoqueMovFim;

    var res;
    try { res = await App.get(url); } catch(e) { res = { data: [], total: 0 }; }
    var movs = res.data || [];
    var total = res.total || 0;
    var tp = res.pages || 1;

    // Filtros
    var filtrosHtml =
      '<div class="card" style="padding:16px;margin-bottom:16px">' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">' +
          '<div class="form-group" style="margin:0;min-width:120px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Tipo</label>' +
            '<select class="form-control" id="estMovTipo">' +
              '<option value="">Todos</option>' +
              '<option value="entrada"' + (Pages._estoqueMovTipo === 'entrada' ? ' selected' : '') + '>Entrada</option>' +
              '<option value="saida"' + (Pages._estoqueMovTipo === 'saida' ? ' selected' : '') + '>Saída</option>' +
              '<option value="ajuste"' + (Pages._estoqueMovTipo === 'ajuste' ? ' selected' : '') + '>Ajuste</option>' +
              '<option value="perda"' + (Pages._estoqueMovTipo === 'perda' ? ' selected' : '') + '>Perda</option>' +
            '</select></div>' +
          '<div class="form-group" style="margin:0;min-width:120px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Origem</label>' +
            '<select class="form-control" id="estMovOrigem">' +
              '<option value="">Todas</option>' +
              '<option value="COMPRA"' + (Pages._estoqueMovOrigem === 'COMPRA' ? ' selected' : '') + '>Compra</option>' +
              '<option value="VENDA"' + (Pages._estoqueMovOrigem === 'VENDA' ? ' selected' : '') + '>Venda</option>' +
              '<option value="AJUSTE"' + (Pages._estoqueMovOrigem === 'AJUSTE' ? ' selected' : '') + '>Ajuste</option>' +
              '<option value="CANCELAMENTO"' + (Pages._estoqueMovOrigem === 'CANCELAMENTO' ? ' selected' : '') + '>Cancelamento</option>' +
            '</select></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">De</label>' +
            '<input type="date" class="form-control" id="estMovInicio" value="' + (Pages._estoqueMovInicio || '') + '"></div>' +
          '<div class="form-group" style="margin:0;min-width:130px"><label class="form-label" style="font-size:0.75rem;margin-bottom:4px">Até</label>' +
            '<input type="date" class="form-control" id="estMovFim" value="' + (Pages._estoqueMovFim || '') + '"></div>' +
          '<button class="btn btn-primary btn-sm" style="height:38px" data-onclick="Pages._filtrarEstMov()"><i data-lucide="search" style="width:14px;height:14px"></i> Filtrar</button>' +
          '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._limparFiltroEstMov()"><i data-lucide="x" style="width:14px;height:14px"></i></button>' +
        '</div>' +
      '</div>';

    var rows = movs.map(function(m) {
      var tipoMap = { entrada: 'badge-success', saida: 'badge-danger', ajuste: 'badge-info', perda: 'badge-warning', vencimento: 'badge-warning' };
      var origemMap = { COMPRA: 'Compra', VENDA: 'Venda', AJUSTE: 'Ajuste', INVENTARIO: 'Inventário', CANCELAMENTO: 'Cancelamento', MANUAL: 'Manual' };
      return '<tr>' +
        '<td>' + Utils.dateTime(m.createdAt) + '</td>' +
        '<td class="fw-500">' + (m.Produto ? m.Produto.nome : '-') + '</td>' +
        '<td><span class="badge ' + (tipoMap[m.tipo] || 'badge-neutral') + '">' + m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1) + '</span></td>' +
        '<td style="font-size:0.8rem">' + (origemMap[m.origem] || m.origem || '-') + '</td>' +
        '<td class="text-right">' + Utils.number(m.quantidade, 0) + '</td>' +
        '<td class="text-right">' + Utils.number(m.estoque_anterior, 0) + ' &rarr; ' + Utils.number(m.estoque_posterior, 0) + '</td>' +
        '<td>' + (m.Lote ? m.Lote.numero_lote : '-') + '</td>' +
        '<td>' + (m.motivo || '-') + '</td></tr>';
    }).join('');

    if (!rows) rows = '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">Nenhuma movimentação</td></tr>';

    // Paginação
    var pagHtml = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
    if (pag > 1) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._estoqueMovPag=' + (pag-1) + ';Pages.estoque()">← Anterior</button>';
    pagHtml += '<span style="font-size:0.85rem;color:var(--text-muted)">Página ' + pag + ' de ' + tp + ' (' + total + ' registros)</span>';
    if (pag < tp) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._estoqueMovPag=' + (pag+1) + ';Pages.estoque()">Próxima →</button>';
    pagHtml += '</div>';

    Layout.render(
      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="btn btn-primary btn-sm" data-onclick="Pages._estoqueMovModal(\'ajuste\')"><i data-lucide="sliders" style="width:16px;height:16px"></i> Ajuste Manual</button>' +
        '<button class="btn btn-danger btn-sm" data-onclick="Pages._estoqueMovModal(\'perda\')"><i data-lucide="alert-triangle" style="width:16px;height:16px"></i> Registrar Perda</button>' +
      '</div>' + filtrosHtml +
      '<div class="card"><div class="card-header"><h3>Movimentações de Estoque</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Origem</th><th class="text-right">Qtd</th><th class="text-right">Estoque</th><th>Lote</th><th>Motivo</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' + pagHtml + '</div>',
      { title: 'Gestão de Estoque', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _filtrarEstMov: function() {
    Pages._estoqueMovPag = 1;
    Pages._estoqueMovTipo = (document.getElementById('estMovTipo') || {}).value || '';
    Pages._estoqueMovOrigem = (document.getElementById('estMovOrigem') || {}).value || '';
    Pages._estoqueMovInicio = (document.getElementById('estMovInicio') || {}).value || '';
    Pages._estoqueMovFim = (document.getElementById('estMovFim') || {}).value || '';
    Pages.estoque();
  },

  _limparFiltroEstMov: function() {
    Pages._estoqueMovPag = 1;
    Pages._estoqueMovTipo = '';
    Pages._estoqueMovOrigem = '';
    Pages._estoqueMovInicio = '';
    Pages._estoqueMovFim = '';
    Pages.estoque();
  },

  // ── Aba Lotes ──
  _estoqueLotes: async function(menu) {
    var lotes, vencData;
    try { lotes = await App.get('/estoque/lotes?apenas_ativos=true'); } catch(e) { lotes = []; }
    try { vencData = await App.get('/estoque/lotes/vencimento?dias=60'); } catch(e) { vencData = { vencendo: [], vencidos: [] }; }
    if (!Array.isArray(lotes)) lotes = [];

    var vencidos = vencData.vencidos || [];
    var vencendo = vencData.vencendo || [];

    // Alerta de lotes vencidos
    var alertHtml = '';
    if (vencidos.length > 0) {
      alertHtml += '<div style="background:var(--danger);color:#fff;padding:12px 16px;border-radius:var(--radius);margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
        '<i data-lucide="alert-triangle" style="width:20px;height:20px"></i> <strong>' + vencidos.length + ' lote(s) vencido(s) com estoque!</strong> Verifique e registre as perdas se necessário.</div>';
    }
    if (vencendo.length > 0) {
      alertHtml += '<div style="background:var(--warning);color:#000;padding:12px 16px;border-radius:var(--radius);margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
        '<i data-lucide="clock" style="width:20px;height:20px"></i> <strong>' + vencendo.length + ' lote(s) vencendo nos próximos 60 dias</strong></div>';
    }

    var todosMostrar = vencidos.concat(vencendo).concat(lotes);
    // Remover duplicatas por ID
    var ids = {};
    todosMostrar = todosMostrar.filter(function(l) { if (ids[l.id]) return false; ids[l.id] = true; return true; });

    var rows = todosMostrar.map(function(l) {
      var hoje = new Date().toISOString().split('T')[0];
      var validadeClass = '';
      if (l.validade) {
        if (l.validade < hoje) validadeClass = 'text-danger fw-600';
        else {
          var diff = Math.ceil((new Date(l.validade) - new Date()) / 86400000);
          if (diff <= 30) validadeClass = 'text-warning fw-600';
        }
      }
      var statusBadge = { ATIVO: 'badge-success', ESGOTADO: 'badge-neutral', VENCIDO: 'badge-danger' };
      return '<tr>' +
        '<td class="fw-500">' + (l.Produto ? l.Produto.nome : '-') + '</td>' +
        '<td>' + (l.numero_lote || '-') + '</td>' +
        '<td class="text-right">' + Utils.number(l.quantidade_atual, 0) + '</td>' +
        '<td class="text-right text-muted">' + Utils.number(l.quantidade_inicial, 0) + '</td>' +
        '<td>' + Utils.date(l.data_entrada) + '</td>' +
        '<td class="' + validadeClass + '">' + (l.validade ? Utils.date(l.validade) : '-') + '</td>' +
        '<td class="text-right">' + Utils.currency(l.custo_unitario) + '</td>' +
        '<td><span class="badge ' + (statusBadge[l.status] || 'badge-neutral') + '">' + l.status + '</span></td>' +
        '<td>' + (l.Fornecedor ? l.Fornecedor.nome : '-') + '</td></tr>';
    }).join('');

    if (!rows) rows = '<tr><td colspan="9" class="text-center text-muted" style="padding:40px">Nenhum lote encontrado</td></tr>';

    Layout.render(
      alertHtml +
      '<div class="card"><div class="card-header"><h3>Lotes Ativos (FIFO/PEPS)</h3><span class="text-muted" style="font-size:0.85rem">Ordenados por validade ↑ (mais antigo primeiro)</span></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Produto</th><th>Lote</th><th class="text-right">Estoque</th><th class="text-right">Inicial</th><th>Entrada</th><th>Validade</th><th class="text-right">Custo Unit.</th><th>Status</th><th>Fornecedor</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>',
      { title: 'Gestão de Estoque', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ── Aba Inventário Físico ──
  _estoqueInventario: function(menu) {
    Pages._inventarioItens = Pages._inventarioItens || [];

    var itensHtml = '';
    if (Pages._inventarioItens.length > 0) {
      itensHtml = Pages._inventarioItens.map(function(it, i) {
        var dif = (parseFloat(it.quantidade_contada) || 0) - (parseFloat(it.estoque_sistema) || 0);
        var difClass = dif > 0 ? 'text-success' : dif < 0 ? 'text-danger' : '';
        return '<tr>' +
          '<td class="fw-500">' + (it.nome || '-') + '</td>' +
          '<td class="text-right">' + Utils.number(it.estoque_sistema, 0) + '</td>' +
          '<td><input type="text" class="form-control" style="width:80px;text-align:right" value="' + (it.quantidade_contada || '') + '" ' +
            'data-onchange="Pages._setInventarioQtd(' + i + ',this.value)"></td>' +
          '<td class="text-right ' + difClass + ' fw-600">' + (dif !== 0 ? (dif > 0 ? '+' : '') + dif : '-') + '</td>' +
          '<td><input type="text" class="form-control" style="width:200px;font-size:0.85rem" value="' + (it.justificativa || '') + '" placeholder="Justificativa..." ' +
            'data-onchange="Pages._setInventarioJust(' + i + ',this.value)"></td>' +
          '<td><button class="btn-icon" data-onclick="Pages._removeInventarioItem(' + i + ')" style="color:var(--danger)"><i data-lucide="x" style="width:14px;height:14px"></i></button></td></tr>';
      }).join('');
    } else {
      itensHtml = '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">Adicione produtos para iniciar o inventário</td></tr>';
    }

    Layout.render(
      '<div class="card"><div class="card-body">' +
        '<h3 style="margin-bottom:8px"><i data-lucide="clipboard-check" style="width:20px;height:20px"></i> Inventário Físico</h3>' +
        '<p class="text-muted" style="margin-bottom:16px">Conte fisicamente os produtos e registre a quantidade. O sistema ajustará automaticamente os estoques com divergências.</p>' +
        '<div class="form-row" style="margin-bottom:16px">' +
          '<div class="form-group" style="flex:2"><label class="form-label">Buscar produto para adicionar</label>' +
            '<input type="text" class="form-control" id="invProdBusca" placeholder="Nome ou código do produto..." data-oninput="Pages._buscarProdutoInventario(this.value)">' +
            '<div id="invProdResultados" style="margin-top:4px"></div></div>' +
        '</div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Produto</th><th class="text-right">Estoque Sistema</th><th>Contagem Física</th><th class="text-right">Diferença</th><th>Justificativa</th><th></th></tr></thead>' +
          '<tbody>' + itensHtml + '</tbody></table></div>' +
        '<hr style="margin:16px 0;border-color:var(--border)">' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success btn-lg" data-onclick="Pages._processarInventario()" ' + (Pages._inventarioItens.length === 0 ? 'disabled' : '') + '>' +
            '<i data-lucide="check" style="width:18px;height:18px"></i> Processar Inventário (' + Pages._inventarioItens.length + ' itens)</button>' +
          '<button class="btn btn-secondary" data-onclick="Pages._inventarioItens=[];Pages.estoque()">Limpar</button>' +
        '</div>' +
      '</div></div>',
      { title: 'Gestão de Estoque', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _inventarioItens: [],

  _buscarProdutoInventario: async function(valor) {
    if (!valor || valor.length < 2) { document.getElementById('invProdResultados').innerHTML = ''; return; }
    try {
      var res = await App.get('/produtos?busca=' + encodeURIComponent(valor));
      var prods = Array.isArray(res) ? res : (res.data || []);
      document.getElementById('invProdResultados').innerHTML = prods.slice(0, 5).map(function(p) {
        return '<div style="padding:8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-top:4px" ' +
          'data-onclick="Pages._addProdutoInventario(' + p.id + ',\'' + p.nome.replace(/'/g, "\\'") + '\',' + (parseFloat(p.estoque_atual)||0) + ')">' +
          '<strong>' + p.nome + '</strong> | Estoque atual: ' + Utils.number(p.estoque_atual, 0) + '</div>';
      }).join('');
    } catch(e) {}
  },

  _addProdutoInventario: function(id, nome, estAtual) {
    // Evitar duplicata
    for (var i = 0; i < Pages._inventarioItens.length; i++) {
      if (Pages._inventarioItens[i].produto_id === id) { Toast.error('Produto já adicionado'); return; }
    }
    Pages._inventarioItens.push({ produto_id: id, nome: nome, estoque_sistema: estAtual, quantidade_contada: '', justificativa: '' });
    document.getElementById('invProdBusca').value = '';
    document.getElementById('invProdResultados').innerHTML = '';
    Pages._estoqueTab = 'inventario';
    Pages.estoque();
  },

  _setInventarioQtd: function(i, val) { Pages._inventarioItens[i].quantidade_contada = val.replace(',', '.'); },
  _setInventarioJust: function(i, val) { Pages._inventarioItens[i].justificativa = val; },
  _removeInventarioItem: function(i) { Pages._inventarioItens.splice(i, 1); Pages._estoqueTab = 'inventario'; Pages.estoque(); },

  _processarInventario: async function() {
    var itens = Pages._inventarioItens.filter(function(it) { return it.quantidade_contada !== '' && it.quantidade_contada !== null; });
    if (itens.length === 0) { Toast.error('Preencha a contagem de pelo menos um produto'); return; }
    if (!confirm('Processar inventário de ' + itens.length + ' produto(s)?\\nO estoque será ajustado automaticamente.')) return;

    var payload = {
      itens: itens.map(function(it) {
        return { produto_id: it.produto_id, quantidade_contada: parseFloat(it.quantidade_contada) || 0, justificativa: it.justificativa || 'Contagem de inventário' };
      })
    };

    try {
      var result = await App.post('/estoque/inventario', payload);
      var msg = 'Inventário processado: ' + (result.divergencias || 0) + ' divergência(s), ' + (result.sem_divergencia || 0) + ' sem alteração.';
      Toast.success(msg);
      Pages._inventarioItens = [];
      Pages._estoqueTab = 'movimentacoes';
      Pages.estoque();
    } catch(e) { Toast.error('Erro ao processar inventário: ' + ((e && e.error) || '')); }
  },

  // ── Aba Sugestão de Compra ──
  _estoqueSugestao: async function(menu) {
    var data;
    try { data = await App.get('/estoque/sugestao-compra'); } catch(e) { data = { sugestoes: [], total: 0, custo_total_estimado: 0 }; }

    var sugestoes = data.sugestoes || [];
    var urgBadge = { critica: 'badge-danger', alta: 'badge-warning', media: 'badge-info', baixa: 'badge-neutral' };
    var urgLabel = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

    var rows = sugestoes.map(function(s) {
      return '<tr>' +
        '<td><span class="badge ' + (urgBadge[s.urgencia] || 'badge-neutral') + '">' + (urgLabel[s.urgencia] || s.urgencia) + '</span></td>' +
        '<td class="fw-500">' + s.nome + '</td>' +
        '<td>' + (s.codigo_barras || '-') + '</td>' +
        '<td class="text-right">' + Utils.number(s.estoque_atual, 0) + ' ' + s.unidade + '</td>' +
        '<td class="text-right">' + Utils.number(s.estoque_minimo, 0) + '</td>' +
        '<td class="text-right fw-600">' + s.quantidade_sugerida + ' ' + s.unidade + '</td>' +
        '<td class="text-right">' + Utils.currency(s.custo_unitario) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(s.custo_estimado) + '</td>' +
        '<td>' + (s.fornecedor ? s.fornecedor.nome : '-') + '</td>' +
        '<td>' + (s.lead_time ? s.lead_time + 'd' : '-') + '</td></tr>';
    }).join('');

    if (!rows) rows = '<tr><td colspan="10" class="text-center text-muted" style="padding:40px">Todos os produtos estão com estoque acima do mínimo</td></tr>';

    Layout.render(
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="shopping-cart" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Produtos p/ Repor</h4><div class="value">' + (data.total || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="dollar-sign" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Custo Estimado</h4><div class="value">' + Utils.currency(data.custo_total_estimado || 0) + '</div></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-header"><h3>Sugestão de Compra</h3><span class="text-muted" style="font-size:0.85rem">Produtos abaixo do ponto de reposição/estoque mínimo</span></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Urgência</th><th>Produto</th><th>EAN</th><th class="text-right">Estoque</th><th class="text-right">Mínimo</th><th class="text-right">Qtd Sugerida</th><th class="text-right">Custo Unit.</th><th class="text-right">Custo Est.</th><th>Fornecedor</th><th>Lead Time</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>',
      { title: 'Gestão de Estoque', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ── Modal de ajuste/perda ──
  _estoqueMovModal: function(tipo) {
    var tipoLabel = tipo === 'ajuste' ? 'Ajuste de Estoque' : 'Registrar Perda';
    var qtdLabel = tipo === 'ajuste' ? 'Novo Estoque (quantidade final)' : 'Quantidade perdida';

    Modal.show(tipoLabel,
      '<div class="form-group"><label class="form-label">Produto *</label>' +
        '<input type="text" class="form-control" id="estProdBusca" placeholder="Buscar produto..." data-oninput="Pages._buscarProdutoEstoque(this.value)">' +
        '<div id="estProdResultados" style="margin-top:4px"></div>' +
        '<input type="hidden" id="estProdId"></div>' +
      '<div class="form-group"><label class="form-label">' + qtdLabel + ' *</label>' +
        '<input type="text" class="form-control" id="estQtd" placeholder="0" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '<div class="form-group"><label class="form-label">Justificativa * <small class="text-muted">(mínimo 5 caracteres)</small></label>' +
        '<textarea class="form-control" id="estJustificativa" rows="2" placeholder="Descreva o motivo do ajuste..."></textarea></div>',
      '<button class="btn btn-primary" data-onclick="Pages._doEstoqueMov(\'' + tipo + '\')">Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _buscarProdutoEstoque: async function(valor) {
    if (!valor || valor.length < 2) { document.getElementById('estProdResultados').innerHTML = ''; return; }
    try {
      var res = await App.get('/produtos?busca=' + encodeURIComponent(valor));
      var prods = Array.isArray(res) ? res : (res.data || []);
      document.getElementById('estProdResultados').innerHTML = prods.slice(0, 5).map(function(p) {
        return '<div style="padding:8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-top:4px" ' +
          'data-onclick="Pages.selecionarProdutoEstoque(' + p.id + ',\'' + p.nome.replace(/'/g, "\\'") + '\')">' +
          '<strong>' + p.nome + '</strong> | Estoque: ' + Utils.number(p.estoque_atual, 0) + '</div>';
      }).join('');
    } catch(e) {}
  },

  _doEstoqueMov: async function(tipo) {
    var prodId = document.getElementById('estProdId').value;
    var qtd = (document.getElementById('estQtd').value || '0').replace(',', '.');
    var justificativa = (document.getElementById('estJustificativa') || {}).value || '';
    if (!prodId) { Toast.error('Selecione um produto'); return; }
    if (parseFloat(qtd) <= 0) { Toast.error('Informe a quantidade'); return; }
    if (!justificativa || justificativa.trim().length < 5) { Toast.error('Justificativa obrigatória (mínimo 5 caracteres)'); return; }

    try {
      if (tipo === 'ajuste') {
        await App.post('/estoque/ajuste', { produto_id: prodId, quantidade_nova: qtd, justificativa: justificativa.trim() });
      } else {
        await App.post('/estoque/perda', { produto_id: prodId, quantidade: qtd, justificativa: justificativa.trim() });
      }
      Toast.success('Movimentação registrada');
      Modal.close(); Pages.estoque();
    } catch(e) { Toast.error((e && e.error) || 'Erro ao registrar movimentação'); }
  },

  // ============================================================
  //  FINANCEIRO — módulo unificado (Pagar + Receber + Fluxo)
  // ============================================================
  financeiro: async function() {
    Pages._financeiroTab = Pages._financeiroTab || 'pagar';
    var menuItems = [
      { label: 'Contas a Pagar',   icon: 'arrow-up-circle',   active: Pages._financeiroTab==='pagar',   action: "Pages._financeiroTab='pagar';Pages.financeiro()" },
      { label: 'Contas a Receber', icon: 'arrow-down-circle', active: Pages._financeiroTab==='receber', action: "Pages._financeiroTab='receber';Pages.financeiro()" },
      { label: 'Fluxo de Caixa',  icon: 'trending-up',       active: Pages._financeiroTab==='fluxo',   action: "Pages._financeiroTab='fluxo';Pages.financeiro()" }
    ];

    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Gestão Financeira', moduleMenu: menuItems });

    if (Pages._financeiroTab === 'pagar') await Pages._financeiroPagar(menuItems);
    else if (Pages._financeiroTab === 'receber') await Pages._financeiroReceber(menuItems);
    else await Pages._financeiroFluxo(menuItems);
  },

  _financeiroPagar: async function(menu) {
    var contas;
    try { var _cpRes = await App.get('/financeiro/pagar'); contas = Array.isArray(_cpRes) ? _cpRes : (_cpRes.data || []); } catch(e) { contas = []; }

    var totalPend = 0, totalPago = 0, totalVenc = 0;
    contas.forEach(function(c) {
      if (c.status === 'pendente') totalPend += parseFloat(c.valor);
      if (c.status === 'pago') totalPago += parseFloat(c.valor);
      if (c.status === 'vencido') totalVenc += parseFloat(c.valor);
    });

    var rows = contas.map(function(c) {
      var badgeMap = { pendente: 'badge-warning', pago: 'badge-success', vencido: 'badge-danger', cancelado: 'badge-neutral' };
      return '<tr class="clickable" data-onclick="Pages._editarContaPagar(' + c.id + ')">' +
        '<td class="fw-500">' + c.descricao + '</td>' +
        '<td>' + (c.Fornecedor ? c.Fornecedor.nome : '-') + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(c.valor) + '</td>' +
        '<td>' + Utils.date(c.data_vencimento) + '</td>' +
        '<td>' + (c.data_pagamento ? Utils.date(c.data_pagamento) : '-') + '</td>' +
        '<td><span class="badge ' + (badgeMap[c.status]||'badge-neutral') + '">' + c.status.charAt(0).toUpperCase()+c.status.slice(1) + '</span></td></tr>';
    }).join('');

    Layout.render(
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="clock" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Pendente</h4><div class="value">' + Utils.currency(totalPend) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon red"><i data-lucide="alert-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Vencido</h4><div class="value text-danger">' + Utils.currency(totalVenc) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon green"><i data-lucide="check-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Pago</h4><div class="value">' + Utils.currency(totalPago) + '</div></div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novaContaPagar()"><i data-lucide="plus" style="width:16px;height:16px"></i> Nova Conta</button></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Descrição</th><th>Fornecedor</th><th class="text-right">Valor</th><th>Vencimento</th><th>Pagamento</th><th>Status</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhuma conta</td></tr>') + '</tbody></table></div></div>',
      { title: 'Gestão Financeira', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novaContaPagar: function() {
    Modal.show('Nova Conta a Pagar',
      '<div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="cpDesc"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Valor (R$)</label><input type="text" class="form-control" id="cpValor" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Vencimento</label><input type="date" class="form-control" id="cpVenc"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Categoria</label>' +
        '<select class="form-control" id="cpCategoria"><option value="fornecedor">Fornecedor</option><option value="aluguel">Aluguel</option><option value="salario">Salário</option><option value="imposto">Imposto</option><option value="outros">Outros</option></select></div>' +
      '<div class="form-group"><label class="form-label">Observações</label><textarea class="form-control" id="cpObs" rows="2"></textarea></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarContaPagar(null)">Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _editarContaPagar: async function(id) {
    var contas;
    try { contas = await App.get('/financeiro/pagar'); } catch(e) { return; }
    var c = contas.find(function(x) { return x.id === id; });
    if (!c) return;

    var footer = '';
    if (c.status === 'pendente' || c.status === 'vencido') {
      footer += '<button class="btn btn-success" data-onclick="Pages._quitarContaPagar(' + c.id + ')"><i data-lucide="check" style="width:16px;height:16px"></i> Quitar</button>';
    }
    footer += '<button class="btn btn-danger" data-onclick="Pages._cancelarContaPagar(' + c.id + ')">Cancelar Conta</button>';
    footer += '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>';

    Modal.show('Conta a Pagar',
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Descrição:</span><span class="fw-600">' + c.descricao + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Valor:</span><span class="fw-700">' + Utils.currency(c.valor) + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Vencimento:</span><span>' + Utils.date(c.data_vencimento) + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Categoria:</span><span>' + (c.categoria || '-') + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Status:</span><span>' + c.status + '</span></div>',
      footer
    );
  },

  _salvarContaPagar: async function(id) {
    var data = {
      descricao: document.getElementById('cpDesc').value,
      valor: (document.getElementById('cpValor').value || '0').replace(',', '.'),
      data_vencimento: document.getElementById('cpVenc').value,
      categoria: document.getElementById('cpCategoria').value,
      observacoes: document.getElementById('cpObs').value
    };
    try {
      if (id) await App.put('/financeiro/pagar/' + id, data);
      else await App.post('/financeiro/pagar', data);
      Toast.success('Salvo'); Modal.close(); Pages.financeiro();
    } catch(e) {}
  },

  _quitarContaPagar: async function(id) {
    try { await App.put('/financeiro/pagar/' + id + '/quitar', {}); Toast.success('Conta quitada'); Modal.close(); Pages.financeiro(); } catch(e) {}
  },

  _cancelarContaPagar: async function(id) {
    if (!confirm('Cancelar esta conta?')) return;
    try { await App.del('/financeiro/pagar/' + id); Toast.success('Conta cancelada'); Modal.close(); Pages.financeiro(); } catch(e) {}
  },

  _financeiroReceber: async function(menu) {
    var contas;
    try { var _crRes = await App.get('/financeiro/receber'); contas = Array.isArray(_crRes) ? _crRes : (_crRes.data || []); } catch(e) { contas = []; }

    var totalPend = 0, totalRec = 0;
    contas.forEach(function(c) {
      if (c.status === 'pendente' || c.status === 'vencido') totalPend += parseFloat(c.valor);
      if (c.status === 'recebido') totalRec += parseFloat(c.valor);
    });

    var rows = contas.map(function(c) {
      var badgeMap = { pendente: 'badge-warning', recebido: 'badge-success', vencido: 'badge-danger', cancelado: 'badge-neutral' };
      return '<tr class="clickable" data-onclick="Pages._detalheContaReceber(' + c.id + ')">' +
        '<td class="fw-500">' + c.descricao + '</td>' +
        '<td>' + (c.cliente_nome || '-') + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(c.valor) + '</td>' +
        '<td>' + Utils.date(c.data_vencimento) + '</td>' +
        '<td><span class="badge ' + (badgeMap[c.status]||'badge-neutral') + '">' + c.status.charAt(0).toUpperCase()+c.status.slice(1) + '</span></td></tr>';
    }).join('');

    Layout.render(
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="clock" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>A Receber</h4><div class="value">' + Utils.currency(totalPend) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon green"><i data-lucide="check-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Recebido</h4><div class="value">' + Utils.currency(totalRec) + '</div></div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novaContaReceber()"><i data-lucide="plus" style="width:16px;height:16px"></i> Nova Conta</button></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Descrição</th><th>Cliente</th><th class="text-right">Valor</th><th>Vencimento</th><th>Status</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="5" class="text-center text-muted" style="padding:40px">Nenhuma conta</td></tr>') + '</tbody></table></div></div>',
      { title: 'Gestão Financeira', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novaContaReceber: function() {
    Modal.show('Nova Conta a Receber',
      '<div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="crDesc"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Valor (R$)</label><input type="text" class="form-control" id="crValor" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Vencimento</label><input type="date" class="form-control" id="crVenc"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-control" id="crCliente"></div>' +
        '<div class="form-group"><label class="form-label">CPF</label><input type="text" class="form-control" id="crCpf" data-oninput="Utils.maskCPFInput(event)"></div>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarContaReceber()">Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarContaReceber: async function() {
    try {
      await App.post('/financeiro/receber', {
        descricao: document.getElementById('crDesc').value,
        valor: (document.getElementById('crValor').value || '0').replace(',', '.'),
        data_vencimento: document.getElementById('crVenc').value,
        cliente_nome: document.getElementById('crCliente').value,
        cliente_cpf: document.getElementById('crCpf').value
      });
      Toast.success('Criada'); Modal.close(); Pages.financeiro();
    } catch(e) {}
  },

  _detalheContaReceber: async function(id) {
    var contas;
    try { contas = await App.get('/financeiro/receber'); } catch(e) { return; }
    var c = contas.find(function(x) { return x.id === id; });
    if (!c) return;

    var footer = '';
    if (c.status === 'pendente' || c.status === 'vencido') {
      footer += '<button class="btn btn-success" data-onclick="Pages._quitarContaReceber(' + c.id + ')"><i data-lucide="check" style="width:16px;height:16px"></i> Confirmar Recebimento</button>';
    }
    footer += '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>';

    Modal.show('Conta a Receber',
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Descrição:</span><span class="fw-600">' + c.descricao + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Valor:</span><span class="fw-700">' + Utils.currency(c.valor) + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Cliente:</span><span>' + (c.cliente_nome || '-') + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Vencimento:</span><span>' + Utils.date(c.data_vencimento) + '</span></div>' +
      '<div class="d-flex justify-between mb-1"><span class="text-muted">Status:</span><span>' + c.status + '</span></div>',
      footer
    );
  },

  _quitarContaReceber: async function(id) {
    try { await App.put('/financeiro/receber/' + id + '/quitar', {}); Toast.success('Recebimento confirmado'); Modal.close(); Pages.financeiro(); } catch(e) {}
  },

  _financeiroFluxo: async function(menu) {
    var fluxo;
    try { fluxo = await App.get('/financeiro/fluxo'); } catch(e) { fluxo = { entradas: 0, saidas: 0, saldo: 0, periodo: {} }; }

    var saldoColor = parseFloat(fluxo.saldo) >= 0 ? 'var(--success)' : 'var(--danger)';

    Layout.render(
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon green"><i data-lucide="arrow-down-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Entradas</h4><div class="value text-success">' + Utils.currency(fluxo.entradas) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon red"><i data-lucide="arrow-up-circle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Saídas</h4><div class="value text-danger">' + Utils.currency(fluxo.saidas) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="wallet" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Saldo</h4><div class="value" style="color:' + saldoColor + '">' + Utils.currency(fluxo.saldo) + '</div></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-body">' +
        '<p class="text-muted" style="margin-bottom:12px">Período: ' + Utils.date(fluxo.periodo.inicio) + ' a ' + Utils.date(fluxo.periodo.fim) + '</p>' +
        '<h4 style="margin-bottom:8px">DRE Simplificado</h4>' +
        '<div style="border:1px solid var(--border);border-radius:var(--radius);padding:16px">' +
          '<div class="d-flex justify-between mb-1" style="font-size:1rem"><span class="fw-500">Receitas (Entradas)</span><span class="text-success fw-600">' + Utils.currency(fluxo.entradas) + '</span></div>' +
          '<div class="d-flex justify-between mb-1" style="font-size:1rem"><span class="fw-500">Despesas (Saídas)</span><span class="text-danger fw-600">-' + Utils.currency(fluxo.saidas) + '</span></div>' +
          '<hr style="margin:12px 0;border-color:var(--border)">' +
          '<div class="d-flex justify-between" style="font-size:1.2rem"><span class="fw-700">Resultado Líquido</span><span class="fw-700" style="color:' + saldoColor + '">' + Utils.currency(fluxo.saldo) + '</span></div>' +
        '</div>' +
      '</div></div>',
      { title: 'Gestão Financeira', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ============================================================
  //  USUÁRIOS — admin module
  // ============================================================
  usuarios: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Usuários' });

    var users;
    try { var _uRes = await App.get('/usuarios'); users = Array.isArray(_uRes) ? _uRes : (_uRes.data || []); } catch(e) { users = []; }

    var rows = users.map(function(u) {
      var perfilBadge = { administrador: 'badge-info', vendedor: 'badge-success', financeiro: 'badge-warning', farmaceutico: 'badge-neutral' };
      return '<tr class="clickable" data-onclick="Pages._editarUsuario(' + u.id + ')">' +
        '<td class="fw-500">' + u.nome + '</td>' +
        '<td>' + u.email + '</td>' +
        '<td><span class="badge ' + (perfilBadge[u.perfil]||'badge-neutral') + '">' + u.perfil.charAt(0).toUpperCase()+u.perfil.slice(1) + '</span></td>' +
        '<td>' + (u.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>') + '</td></tr>';
    }).join('');

    Layout.render(
      '<div style="display:flex;justify-content:flex-end;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novoUsuario()"><i data-lucide="user-plus" style="width:16px;height:16px"></i> Novo Usuário</button></div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" class="text-center text-muted" style="padding:40px">Nenhum usuário</td></tr>') + '</tbody></table></div></div>',
      { title: 'Usuários' }
    );
  },

  _novoUsuario: function() { Pages._usuarioForm(null); },
  _editarUsuario: async function(id) {
    var users;
    try { users = await App.get('/usuarios'); } catch(e) { return; }
    var u = users.find(function(x) { return x.id === id; });
    if (u) Pages._usuarioForm(u);
  },

  _usuarioForm: function(u) {
    var isEdit = !!u;
    var perfis = ['vendedor','administrador','gerente','caixa','estoquista','financeiro','farmaceutico'];
    var selectPerfil = perfis.map(function(p) {
      return '<option value="' + p + '"' + (u && u.perfil === p ? ' selected' : '') + '>' + p.charAt(0).toUpperCase()+p.slice(1) + '</option>';
    }).join('');

    // Módulos do sistema e permissões
    var modulos = [
      { key: 'pdv',         label: 'PDV',           icon: 'monitor' },
      { key: 'vendas',      label: 'Vendas',        icon: 'shopping-bag' },
      { key: 'produtos',    label: 'Produtos',      icon: 'package' },
      { key: 'estoque',     label: 'Estoque',       icon: 'warehouse' },
      { key: 'financeiro',  label: 'Financeiro',    icon: 'dollar-sign' },
      { key: 'caixa',       label: 'Caixa',         icon: 'calculator' },
      { key: 'fornecedores',label: 'Fornecedores',  icon: 'truck' },
      { key: 'clientes',    label: 'Clientes',      icon: 'users' },
      { key: 'compras',     label: 'Compras',       icon: 'shopping-cart' },
      { key: 'fiscal',      label: 'Fiscal',        icon: 'file-text' },
      { key: 'sngpc',       label: 'SNGPC',         icon: 'pill' },
      { key: 'usuarios',    label: 'Usuários',      icon: 'user-cog' },
      { key: 'config',      label: 'Configurações', icon: 'settings' }
    ];
    var userPerms = (u && u.permissoes) ? u.permissoes : {};

    var permissoesHtml = modulos.map(function(m) {
      var checked = (!u || u.perfil === 'administrador' || userPerms[m.key]) ? ' checked' : '';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:6px">' +
        '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;margin:0">' +
          '<input type="checkbox" class="uPerm" data-modulo="' + m.key + '"' + checked + '>' +
          '<i data-lucide="' + m.icon + '" style="width:16px;height:16px;color:var(--text-muted)"></i>' +
          '<span>' + m.label + '</span>' +
        '</label></div>';
    }).join('');

    Modal.show(isEdit ? 'Editar: ' + u.nome : 'Novo Usuário',
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button class="tab active" data-onclick="Pages._switchTab(event,\'tabUserDados\')">Dados</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabUserPerms\')">Permissões</button>' +
      '</div>' +

      '<div class="tab-content active" id="tabUserDados">' +
        '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="uNome" value="' + (u ? u.nome : '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="uEmail" value="' + (u ? u.email : '') + '"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Perfil</label><select class="form-control" id="uPerfil" data-onchange="Pages._togglePermsAdmin(this.value)">' + selectPerfil + '</select></div>' +
          '<div class="form-group"><label class="form-label">Senha' + (isEdit ? ' (deixe vazio para manter)' : '') + '</label><input type="password" class="form-control" id="uSenha"></div>' +
        '</div>' +
      '</div>' +

      '<div class="tab-content" id="tabUserPerms">' +
        '<p class="text-muted" style="margin-bottom:12px">Selecione os módulos que este usuário pode acessar. Administradores têm acesso total.</p>' +
        '<div id="uPermissoes">' + permissoesHtml + '</div>' +
        '<div style="margin-top:12px">' +
          '<button class="btn btn-sm btn-secondary" data-onclick="Pages.marcarTodasPermissoes(true)">Marcar Todos</button> ' +
          '<button class="btn btn-sm btn-secondary" data-onclick="Pages.marcarTodasPermissoes(false)">Desmarcar Todos</button>' +
        '</div>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarUsuario(' + (isEdit ? u.id : 'null') + ')">Salvar</button>' +
      (isEdit ? '<button class="btn btn-danger" data-onclick="Pages._desativarUsuario(' + u.id + ')">' + (u.ativo ? 'Desativar' : 'Reativar') + '</button>' : '') +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-lg'
    );
  },

  _togglePermsAdmin: function(perfil) {
    var checks = document.querySelectorAll('.uPerm');
    checks.forEach(function(c) {
      if (perfil === 'administrador') { c.checked = true; c.disabled = true; }
      else { c.disabled = false; }
    });
  },

  _salvarUsuario: async function(id) {
    var data = {
      nome: document.getElementById('uNome').value,
      email: document.getElementById('uEmail').value,
      perfil: document.getElementById('uPerfil').value
    };
    var senha = document.getElementById('uSenha').value;
    if (senha) data.senha = senha;

    // Coletar permissões
    var permissoes = {};
    document.querySelectorAll('.uPerm').forEach(function(c) {
      permissoes[c.dataset.modulo] = c.checked;
    });
    data.permissoes = permissoes;

    try {
      if (id) await App.put('/usuarios/' + id, data);
      else await App.post('/usuarios', data);
      Toast.success(id ? 'Atualizado' : 'Criado');
      Modal.close(); Pages.usuarios();
    } catch(e) {}
  },

  _desativarUsuario: async function(id) {
    if (!confirm('Desativar este usuário?')) return;
    try { await App.del('/usuarios/' + id); Toast.success('Desativado'); Modal.close(); Pages.usuarios(); } catch(e) {}
  },

  // ============================================================
  //  CONFIGURAÇÕES — Empresa + Perfil + Sistema
  // ============================================================
  config: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Configuracoes' });

    var empresa;
    try { empresa = await App.get('/empresas'); } catch(e) { empresa = {}; }

    var themeIcon = document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon';
    var themeLabel = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Modo Claro' : 'Modo Escuro';

    var logoPreview = empresa.logo_url
      ? '<img src="' + empresa.logo_url + '" style="max-width:120px;max-height:80px;border-radius:8px;border:1px solid var(--border)" alt="Logo">'
      : '<div style="width:120px;height:80px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px dashed var(--border)"><i data-lucide="image" style="width:32px;height:32px;opacity:0.3"></i></div>';

    Layout.render(
      '<div class="tabs">' +
        '<button class="tab active" data-onclick="Pages._switchTab(event,\'tabEmpresa\')">Empresa</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabPerfil\')">Meu Perfil</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabSistema\')">Sistema</button>' +
      '</div>' +

      '<div class="tab-content active" id="tabEmpresa"><div class="card"><div class="card-body">' +
        '<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:20px">' +
          '<div>' + logoPreview +
            '<div style="margin-top:8px;display:flex;gap:4px">' +
              '<label class="btn btn-secondary btn-sm" style="cursor:pointer"><i data-lucide="upload" style="width:12px;height:12px"></i> Logo<input type="file" id="cfgLogo" accept="image/*" style="display:none" data-onchange="Pages._uploadLogo()"></label>' +
              (empresa.logo_url ? '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-onclick="Pages._removerLogo()"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>' : '') +
            '</div>' +
          '</div>' +
          '<div style="flex:1">' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label">Razao Social</label><input type="text" class="form-control" id="cfgEmpNome" value="' + (empresa.nome||'') + '"></div>' +
              '<div class="form-group"><label class="form-label">Nome Fantasia</label><input type="text" class="form-control" id="cfgEmpFantasia" value="' + (empresa.nome_fantasia||'') + '"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">CNPJ</label><input type="text" class="form-control" id="cfgEmpCnpj" value="' + (empresa.cnpj||'') + '" data-oninput="Utils.maskCNPJInput(event)"></div>' +
          '<div class="form-group"><label class="form-label">Inscricao Estadual</label><input type="text" class="form-control" id="cfgEmpIe" value="' + (empresa.inscricao_estadual||'') + '"></div>' +
          '<div class="form-group"><label class="form-label">Inscricao Municipal</label><input type="text" class="form-control" id="cfgEmpIm" value="' + (empresa.inscricao_municipal||'') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="cfgEmpTel" value="' + (empresa.telefone||'') + '" data-oninput="Utils.maskPhoneInput(event)"></div>' +
          '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="cfgEmpEmail" value="' + (empresa.email||'') + '"></div>' +
        '</div>' +
        '<h4 style="margin:20px 0 12px">Endereco</h4>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:3"><label class="form-label">Logradouro</label><input type="text" class="form-control" id="cfgEmpEnd" value="' + (empresa.endereco||'') + '"></div>' +
          '<div class="form-group" style="flex:1"><label class="form-label">Numero</label><input type="text" class="form-control" id="cfgEmpNumero" value="' + (empresa.numero||'') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Bairro</label><input type="text" class="form-control" id="cfgEmpBairro" value="' + (empresa.bairro||'') + '"></div>' +
          '<div class="form-group"><label class="form-label">Cidade</label><input type="text" class="form-control" id="cfgEmpCidade" value="' + (empresa.cidade||'') + '"></div>' +
          '<div class="form-group" style="flex:0.5"><label class="form-label">UF</label><input type="text" class="form-control" id="cfgEmpEstado" value="' + (empresa.estado||'') + '" maxlength="2"></div>' +
          '<div class="form-group"><label class="form-label">CEP</label><input type="text" class="form-control" id="cfgEmpCep" value="' + (empresa.cep||'') + '"></div>' +
        '</div>' +
        '<h4 style="margin:20px 0 12px">Identidade Visual</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Cor Primaria</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cfgCorPrimaria" value="' + (empresa.cor_primaria||'#4F46E5') + '" style="width:40px;height:36px;padding:2px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="text" class="form-control" value="' + (empresa.cor_primaria||'#4F46E5') + '" style="flex:1" data-oninput="document.getElementById(\'cfgCorPrimaria\').value=this.value"></div></div>' +
          '<div class="form-group"><label class="form-label">Cor Secundaria</label><div style="display:flex;gap:8px;align-items:center"><input type="color" id="cfgCorSecundaria" value="' + (empresa.cor_secundaria||'#7C3AED') + '" style="width:40px;height:36px;padding:2px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="text" class="form-control" value="' + (empresa.cor_secundaria||'#7C3AED') + '" style="flex:1" data-oninput="document.getElementById(\'cfgCorSecundaria\').value=this.value"></div></div>' +
        '</div>' +
        '<button class="btn btn-primary" data-onclick="Pages._salvarEmpresa()"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar Empresa</button>' +
      '</div></div></div>' +

      '<div class="tab-content" id="tabPerfil"><div class="card"><div class="card-body">' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="cfgPerfilNome" value="' + (App.usuario ? App.usuario.nome : '') + '"></div>' +
          '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="cfgPerfilEmail" value="' + (App.usuario ? App.usuario.email : '') + '"></div>' +
        '</div>' +
        '<button class="btn btn-primary" data-onclick="Pages._salvarPerfilConfig()" style="margin-bottom:20px"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar Dados</button>' +
        '<h4 style="margin:20px 0 12px;padding-top:16px;border-top:1px solid var(--border)">Alterar Senha</h4>' +
        '<div class="form-group"><label class="form-label">Senha Atual</label><input type="password" class="form-control" id="cfgSenhaAtual"></div>' +
        '<div class="form-group"><label class="form-label">Nova Senha</label><input type="password" class="form-control" id="cfgSenhaNova"></div>' +
        '<button class="btn btn-primary" data-onclick="Pages._alterarSenha()"><i data-lucide="key" style="width:16px;height:16px"></i> Alterar Senha</button>' +
      '</div></div></div>' +

      '<div class="tab-content" id="tabSistema"><div class="card"><div class="card-body">' +
        '<div class="d-flex justify-between align-center" style="padding:16px 0;border-bottom:1px solid var(--border)">' +
          '<div><strong>Tema</strong><p class="text-muted" style="font-size:0.85rem">Alternar entre claro e escuro</p></div>' +
          '<button class="btn btn-secondary" data-onclick="App.toggleTheme();Pages.config()">' +
            '<i data-lucide="' + themeIcon + '" style="width:16px;height:16px"></i> ' + themeLabel + '</button>' +
        '</div>' +
        '<div style="padding:16px 0">' +
          '<strong>Tipo de Negocio</strong><p class="text-muted" style="font-size:0.85rem">' + (empresa.tipo_negocio === 'drogaria' ? 'Drogaria' : 'Mercado') + '</p>' +
        '</div>' +
        '<div style="padding:16px 0;border-top:1px solid var(--border)">' +
          '<strong>Regime Tributario</strong><p class="text-muted" style="font-size:0.85rem">' + (empresa.regime_tributario || 'Simples Nacional') + '</p>' +
        '</div>' +
        '<div style="padding:16px 0;border-top:1px solid var(--border)">' +
          '<strong>Importar Produtos CSV</strong><p class="text-muted" style="font-size:0.85rem">Importar produtos em lote via arquivo CSV</p>' +
          '<button class="btn btn-secondary btn-sm" style="margin-top:8px" data-onclick="Pages._importarProdutosCSV()"><i data-lucide="upload" style="width:14px;height:14px"></i> Importar CSV</button>' +
        '</div>' +
        '<div style="padding:16px 0;border-top:1px solid var(--border)">' +
          '<strong>Processar Vencimentos</strong><p class="text-muted" style="font-size:0.85rem">Atualizar status de contas e lotes vencidos</p>' +
          '<button class="btn btn-warning btn-sm" style="margin-top:8px" data-onclick="Pages._executarVencimentos()"><i data-lucide="clock" style="width:14px;height:14px"></i> Executar Agora</button>' +
        '</div>' +
        '<div style="padding:16px 0;border-top:1px solid var(--border)">' +
          '<strong>Contas Recorrentes</strong><p class="text-muted" style="font-size:0.85rem">Gerar proximas parcelas de contas recorrentes pagas</p>' +
          '<button class="btn btn-secondary btn-sm" style="margin-top:8px" data-onclick="Pages._executarRecorrentes()"><i data-lucide="repeat" style="width:14px;height:14px"></i> Processar Recorrentes</button>' +
        '</div>' +
      '</div></div></div>',
      { title: 'Configuracoes' }
    );
  },

  _uploadLogo: async function() {
    var input = document.getElementById('cfgLogo');
    if (!input || !input.files[0]) return;
    var formData = new FormData();
    formData.append('logo', input.files[0]);
    try {
      var resp = await fetch('/api/empresas/logo', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('varlen_token'), 'X-Tenant-Slug': App.slug },
        body: formData
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao enviar logo');
      Toast.success('Logo atualizado!');
      Pages.config();
    } catch(e) { Toast.error(e.message); }
  },

  _removerLogo: async function() {
    var ok = await UI.confirm('Remover o logo da empresa?');
    if (!ok) return;
    try {
      await App.del('/empresas/logo');
      Toast.success('Logo removido');
      Pages.config();
    } catch(e) {}
  },

  _salvarEmpresa: async function() {
    try {
      await App.put('/empresas', {
        nome: document.getElementById('cfgEmpNome').value,
        nome_fantasia: document.getElementById('cfgEmpFantasia').value,
        cnpj: document.getElementById('cfgEmpCnpj').value,
        inscricao_estadual: document.getElementById('cfgEmpIe').value,
        inscricao_municipal: document.getElementById('cfgEmpIm').value,
        telefone: document.getElementById('cfgEmpTel').value,
        email: document.getElementById('cfgEmpEmail').value,
        endereco: document.getElementById('cfgEmpEnd').value,
        numero: document.getElementById('cfgEmpNumero').value,
        bairro: document.getElementById('cfgEmpBairro').value,
        cidade: document.getElementById('cfgEmpCidade').value,
        estado: document.getElementById('cfgEmpEstado').value,
        cep: document.getElementById('cfgEmpCep').value,
        cor_primaria: document.getElementById('cfgCorPrimaria').value,
        cor_secundaria: document.getElementById('cfgCorSecundaria').value
      });
      Toast.success('Empresa atualizada');
    } catch(e) {}
  },

  _salvarPerfilConfig: async function() {
    var nome = document.getElementById('cfgPerfilNome').value.trim();
    var email = document.getElementById('cfgPerfilEmail').value.trim();
    if (!nome || !email) { Toast.error('Nome e email sao obrigatorios'); return; }
    try {
      var res = await App.put('/auth/perfil', { nome: nome, email: email });
      if (res && res.usuario) {
        App.usuario = res.usuario;
        localStorage.setItem('varlen_usuario', JSON.stringify(res.usuario));
      }
      Toast.success('Perfil atualizado');
    } catch(e) {}
  },

  _alterarSenha: async function() {
    var senhaAtual = document.getElementById('cfgSenhaAtual') || document.getElementById('perfilSenhaAtual');
    var senhaNova = document.getElementById('cfgSenhaNova') || document.getElementById('perfilSenhaNova');
    var senhaConfirm = document.getElementById('perfilSenhaConfirm');
    if (!senhaAtual || !senhaNova) return;
    if (senhaConfirm && senhaNova.value !== senhaConfirm.value) {
      Toast.error('As senhas nao coincidem');
      return;
    }
    if (senhaNova.value.length < 8) {
      Toast.error('A nova senha deve ter pelo menos 8 caracteres');
      return;
    }
    try {
      await App.put('/auth/senha', {
        senha_atual: senhaAtual.value,
        nova_senha: senhaNova.value
      });
      Toast.success('Senha alterada com sucesso');
      senhaAtual.value = '';
      senhaNova.value = '';
      if (senhaConfirm) senhaConfirm.value = '';
    } catch(e) {}
  },

  _executarVencimentos: async function() {
    var ok = await UI.confirm('Processar todos os vencimentos pendentes?');
    if (!ok) return;
    try {
      var res = await App.post('/jobs/vencimentos', {});
      var r = res.resultado || {};
      Toast.success('Vencimentos processados: ' + (r.contas_pagar_vencidas || 0) + ' contas a pagar, ' + (r.contas_receber_vencidas || 0) + ' a receber, ' + (r.lotes_vencidos || 0) + ' lotes');
    } catch(e) {}
  },

  _executarRecorrentes: async function() {
    try {
      var res = await App.post('/jobs/recorrentes', {});
      var r = res.resultado || {};
      Toast.success('Recorrentes processadas: ' + (r.novas_geradas || 0) + ' nova(s) conta(s) gerada(s)');
    } catch(e) {}
  },

  // ============================================================
  //  MEU PERFIL - Modal popup (abre do menu do usuario)
  // ============================================================
  perfilModal: function() {
    var u = App.usuario || {};
    Modal.show('Meu Perfil',
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border)">' +
        '<div class="user-avatar" style="width:56px;height:56px;font-size:1.3rem;flex-shrink:0">' + App.getInitials(u.nome) + '</div>' +
        '<div><div class="fw-600" style="font-size:1.1rem">' + (u.nome || '') + '</div>' +
          '<div class="text-muted" style="font-size:0.85rem">' + (u.email || '') + '</div>' +
          '<span class="badge badge-info" style="margin-top:4px">' + (u.perfil ? u.perfil.charAt(0).toUpperCase() + u.perfil.slice(1) : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<h4 style="margin-bottom:12px"><i data-lucide="user" style="width:16px;height:16px"></i> Dados Pessoais</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Nome</label>' +
          '<input type="text" class="form-control" id="perfilNome" value="' + (u.nome || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Email</label>' +
          '<input type="email" class="form-control" id="perfilEmail" value="' + (u.email || '') + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Telefone</label>' +
          '<input type="text" class="form-control" id="perfilTelefone" value="' + (u.telefone || '') + '" placeholder="(00) 00000-0000" data-oninput="Utils.maskPhoneInput(event)"></div>' +
      '</div>' +
      '<button class="btn btn-primary" data-onclick="Pages._salvarPerfil()" style="margin-bottom:24px">' +
        '<i data-lucide="save" style="width:16px;height:16px"></i> Salvar Dados</button>' +
      '<h4 style="margin-bottom:12px;padding-top:16px;border-top:1px solid var(--border)">' +
        '<i data-lucide="key" style="width:16px;height:16px"></i> Alterar Senha</h4>' +
      '<div class="form-group"><label class="form-label">Senha Atual</label>' +
        '<input type="password" class="form-control" id="perfilSenhaAtual" placeholder="Digite a senha atual"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Nova Senha</label>' +
          '<input type="password" class="form-control" id="perfilSenhaNova" placeholder="Mínimo 8 caracteres"></div>' +
        '<div class="form-group"><label class="form-label">Confirmar Nova Senha</label>' +
          '<input type="password" class="form-control" id="perfilSenhaConfirm" placeholder="Repita a nova senha"></div>' +
      '</div>',
      '<button class="btn btn-warning" data-onclick="Pages._alterarSenha()">' +
        '<i data-lucide="key" style="width:16px;height:16px"></i> Alterar Senha</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>'
    );
  },

  _salvarPerfil: async function() {
    var nome = document.getElementById('perfilNome').value.trim();
    var email = document.getElementById('perfilEmail').value.trim();
    var telefone = (document.getElementById('perfilTelefone') || {}).value || '';
    if (!nome || !email) { Toast.error('Nome e email são obrigatórios'); return; }
    try {
      var res = await App.put('/auth/perfil', { nome: nome, email: email, telefone: telefone });
      if (res && res.usuario) {
        App.usuario = res.usuario;
        localStorage.setItem('varlen_usuario', JSON.stringify(res.usuario));
      }
      Toast.success('Perfil atualizado');
      Modal.close();
    } catch(e) {}
  },

  // ============================================================
  //  CLIENTES — CRUD + histórico de compras
  // ============================================================
  _clientesPag: 1,
  _clientesBusca: '',
  _clientesFiltroIncompleto: false,

  clientes: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Clientes' });

    var pag = Pages._clientesPag || 1;
    var url = '/clientes?page=' + pag + '&limit=30';
    if (Pages._clientesBusca) url += '&busca=' + encodeURIComponent(Pages._clientesBusca);
    if (Pages._clientesFiltroIncompleto) url += '&cadastro_incompleto=true';

    var res;
    try { res = await App.get(url); } catch(e) { res = { data: [], total: 0 }; }
    var clientes = res.data || [];
    var total = res.total || 0;
    var tp = res.pages || 1;

    Pages._clientesData = clientes;

    var rows = clientes.map(function(c) {
      var badgeIncompleto = c.cadastro_incompleto ? ' <span class="badge" style="background:#fef3c7;color:#92400e;font-size:0.7rem;padding:2px 6px">incompleto</span>' : '';
      return '<tr class="clickable" data-onclick="Pages._detalharCliente(' + c.id + ')">' +
        '<td class="fw-500">' + c.nome + badgeIncompleto + '</td>' +
        '<td>' + (c.cpf || '-') + '</td>' +
        '<td>' + (c.telefone || '-') + '</td>' +
        '<td>' + (c.email || '-') + '</td>' +
        '<td class="text-right">' + (c.quantidade_compras || 0) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(c.total_compras || 0) + '</td>' +
        '<td>' + Utils.currency(c.ticket_medio || 0) + '</td></tr>';
    }).join('');

    // Paginação
    var pagHtml = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
    if (pag > 1) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._clientesPag=' + (pag-1) + ';Pages.clientes()">← Anterior</button>';
    pagHtml += '<span style="font-size:0.85rem;color:var(--text-muted)">Página ' + pag + ' de ' + tp + ' (' + total + ' clientes)</span>';
    if (pag < tp) pagHtml += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._clientesPag=' + (pag+1) + ';Pages.clientes()">Próxima →</button>';
    pagHtml += '</div>';

    var incBtnStyle = Pages._clientesFiltroIncompleto ? 'outline:2px solid var(--warning);' : '';

    Layout.render(
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">' +
        '<div class="search-box" style="flex:1"><span class="search-icon"><i data-lucide="search" style="width:16px;height:16px"></i></span>' +
          '<input type="text" class="form-control" id="clienteBusca" placeholder="Buscar cliente..." value="' + (Pages._clientesBusca || '') + '" data-onkeydown="if(event.key===\'Enter\'){Pages._clientesPag=1;Pages._clientesBusca=this.value;Pages.clientes()}"></div>' +
        '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._clientesPag=1;Pages._clientesBusca=document.getElementById(\'clienteBusca\').value;Pages.clientes()"><i data-lucide="search" style="width:14px;height:14px"></i></button>' +
        (Pages._clientesBusca ? '<button class="btn btn-ghost btn-sm" style="height:38px" data-onclick="Pages._clientesPag=1;Pages._clientesBusca=\'\';Pages.clientes()"><i data-lucide="x" style="width:14px;height:14px"></i></button>' : '') +
        '<button class="btn btn-sm btn-warning" style="white-space:nowrap;' + incBtnStyle + '" data-onclick="Pages._clientesFiltroIncompleto=!Pages._clientesFiltroIncompleto;Pages._clientesPag=1;Pages.clientes()">' +
          '<i data-lucide="alert-circle" style="width:14px;height:14px"></i> Incompletos</button>' +
        '<button class="btn btn-primary" data-onclick="Pages._novoCliente()"><i data-lucide="user-plus" style="width:16px;height:16px"></i> Novo Cliente</button>' +
      '</div>' +
      '<div class="card"><div class="table-container"><table>' +
        '<thead><tr><th>Nome</th><th>CPF</th><th>Telefone</th><th>Email</th><th class="text-right">Compras</th><th class="text-right">Total</th><th>Ticket</th></tr></thead>' +
        '<tbody id="clientesBody">' + (rows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhum cliente</td></tr>') + '</tbody></table></div>' + pagHtml + '</div>',
      { title: 'Clientes' }
    );
    Pages._filtroIncompleto = false;
  },

  _filtrarIncompletos: function() {
    Pages._clientesFiltroIncompleto = !Pages._clientesFiltroIncompleto;
    Pages._clientesPag = 1;
    Pages.clientes();
  },

  _buscarClientes: function(busca) {
    Pages._clientesBusca = busca;
    Pages._clientesPag = 1;
    Pages.clientes();
  },

  _renderClientesFiltrados: function() {
    // Mantido para compatibilidade - busca agora é server-side
    Pages.clientes();
  },

  _novoCliente: function() {
    Modal.show('Novo Cliente',
      '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="cliNome"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CPF</label><input type="text" class="form-control" id="cliCpf" data-oninput="Utils.maskCPFInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="cliTel" data-oninput="Utils.maskPhoneInput(event)"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="cliEmail"></div>' +
        '<div class="form-group"><label class="form-label">Data Nascimento</label><input type="date" class="form-control" id="cliNasc"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Endereço</label><input type="text" class="form-control" id="cliEnd"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarCliente(null)">Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarCliente: async function(id) {
    var data = {
      nome: document.getElementById('cliNome').value,
      cpf: document.getElementById('cliCpf').value || null,
      telefone: document.getElementById('cliTel').value || null,
      email: document.getElementById('cliEmail').value || null,
      data_nascimento: document.getElementById('cliNasc').value || null,
      endereco: document.getElementById('cliEnd').value || null
    };
    try {
      if (id) await App.put('/clientes/' + id, data);
      else await App.post('/clientes', data);
      Toast.success(id ? 'Atualizado' : 'Cliente cadastrado');
      Modal.close(); Pages.clientes();
    } catch(e) {}
  },

  _detalharCliente: async function(id) {
    var res;
    try { res = await App.get('/clientes/' + id); } catch(e) { return; }
    if (!res) return;

    // O backend retorna { cliente, historico, produtosMaisComprados }
    var c = res.cliente || res;
    var historico = res.historico || [];
    var produtosMaisComprados = res.produtosMaisComprados || [];

    // Calcular totais a partir do histórico (mais confiável que os campos cached)
    var totalCompras = historico.reduce(function(s, v) { return s + parseFloat(v.total || 0); }, 0);
    var qtdCompras = historico.length;
    var ticketMedio = qtdCompras > 0 ? totalCompras / qtdCompras : 0;
    // Usar campos do modelo se disponíveis e maiores (histórico pode ser limitado a 20)
    if (parseFloat(c.total_compras || 0) > totalCompras) totalCompras = parseFloat(c.total_compras);
    if (parseInt(c.quantidade_compras || 0) > qtdCompras) qtdCompras = parseInt(c.quantidade_compras);
    if (parseFloat(c.ticket_medio || 0) > 0 && qtdCompras === parseInt(c.quantidade_compras || 0)) ticketMedio = parseFloat(c.ticket_medio);

    // Última compra
    var ultimaCompra = historico.length > 0 ? historico[0].createdAt : null;

    var histRows = historico.map(function(v) {
      return '<tr><td>#' + v.numero + '</td><td>' + Utils.dateTime(v.createdAt) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(v.total) + '</td>' +
        '<td>' + Pages._formatPayment(v.forma_pagamento) + '</td></tr>';
    }).join('');

    var topProd = produtosMaisComprados.map(function(p) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0">' +
        '<span>' + p.produto_nome + '</span><span class="fw-600">' + parseFloat(p.total_quantidade).toFixed(0) + 'x — ' + Utils.currency(p.total_valor) + '</span></div>';
    }).join('');

    Modal.show(c.nome || 'Cliente',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><span class="text-muted">CPF:</span><br><strong>' + (c.cpf ? c.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '-') + '</strong></div>' +
        '<div><span class="text-muted">Telefone:</span><br><strong>' + (c.telefone||'-') + '</strong></div>' +
        '<div><span class="text-muted">Email:</span><br><strong>' + (c.email||'-') + '</strong></div>' +
        '<div><span class="text-muted">Última Compra:</span><br><strong>' + (ultimaCompra ? Utils.dateTime(ultimaCompra) : 'Nunca') + '</strong></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Total Compras</h4><div class="value" style="font-size:1rem">' + Utils.currency(totalCompras) + '</div></div></div>' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Qtd Compras</h4><div class="value" style="font-size:1rem">' + qtdCompras + '</div></div></div>' +
        '<div class="stat-card" style="padding:12px"><div class="stat-info"><h4>Ticket Médio</h4><div class="value" style="font-size:1rem">' + Utils.currency(ticketMedio) + '</div></div></div>' +
      '</div>' +
      (topProd ? '<h4 style="margin-bottom:8px">Produtos Mais Comprados</h4><div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:16px">' + topProd + '</div>' : '') +
      (histRows ? '<h4 style="margin-bottom:8px">Últimas Compras</h4>' +
        '<table><thead><tr><th>Venda</th><th>Data</th><th class="text-right">Total</th><th>Pagamento</th></tr></thead>' +
        '<tbody>' + histRows + '</tbody></table>' : '<p class="text-muted">Nenhuma compra registrada</p>'),
      '<button class="btn btn-primary" data-onclick="Pages._editarCliente(' + c.id + ')"><i data-lucide="edit" style="width:16px;height:16px"></i> Editar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>',
      'modal-lg'
    );
  },

  _editarCliente: async function(id) {
    var res;
    try { res = await App.get('/clientes/' + id); } catch(e) { return; }
    var c = (res && res.cliente) ? res.cliente : res;
    Modal.show('Editar: ' + (c.nome || 'Cliente'),
      '<div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="cliNome" value="' + (c.nome||'') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CPF</label><input type="text" class="form-control" id="cliCpf" value="' + (c.cpf||'') + '" data-oninput="Utils.maskCPFInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="cliTel" value="' + (c.telefone||'') + '" data-oninput="Utils.maskPhoneInput(event)"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="cliEmail" value="' + (c.email||'') + '"></div>' +
        '<div class="form-group"><label class="form-label">Data Nascimento</label><input type="date" class="form-control" id="cliNasc" value="' + (c.data_nascimento||'') + '"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Endereço</label><input type="text" class="form-control" id="cliEnd" value="' + (c.endereco||'') + '"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarCliente(' + c.id + ')">Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  // ============================================================
  //  SNGPC — Sistema Nacional de Gerenciamento de Produtos Controlados
  // ============================================================
  sngpc: async function() {
    if (!App.isDrogaria()) { Toast.warning('Módulo disponível apenas para drogarias'); Router.navigate('home'); return; }
    Pages._sngpcTab = Pages._sngpcTab || 'dash';
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() });
    try {
      if (Pages._sngpcTab === 'dash')           await Pages._sngpcDash();
      else if (Pages._sngpcTab === 'movimentacoes') await Pages._sngpcMovimentacoes();
      else if (Pages._sngpcTab === 'estoque')       await Pages._sngpcEstoque();
      else if (Pages._sngpcTab === 'periodos')      await Pages._sngpcPeriodos();
      else if (Pages._sngpcTab === 'transmissoes')  await Pages._sngpcTransmissoes();
      else if (Pages._sngpcTab === 'config')        await Pages._sngpcConfig();
      else if (Pages._sngpcTab === 'relatorios')    await Pages._sngpcRelatorios();
      else await Pages._sngpcDash();
    } catch(e) { Toast.error('Erro ao carregar SNGPC'); console.error(e); }
  },

  _sngpcMenuItems: function() {
    return [
      { label: 'Dashboard',    icon: 'bar-chart-2',     active: Pages._sngpcTab==='dash',        action: "Pages._sngpcTab='dash';Pages.sngpc()" },
      { label: 'Movimentações', icon: 'arrow-left-right', active: Pages._sngpcTab==='movimentacoes', action: "Pages._sngpcTab='movimentacoes';Pages.sngpc()" },
      { label: 'Estoque/Lotes', icon: 'clipboard-list',  active: Pages._sngpcTab==='estoque',     action: "Pages._sngpcTab='estoque';Pages.sngpc()" },
      { label: 'Períodos',      icon: 'calendar',        active: Pages._sngpcTab==='periodos',    action: "Pages._sngpcTab='periodos';Pages.sngpc()" },
      { label: 'Transmissões',  icon: 'send',            active: Pages._sngpcTab==='transmissoes', action: "Pages._sngpcTab='transmissoes';Pages.sngpc()" },
      { label: 'Configuração',  icon: 'settings',        active: Pages._sngpcTab==='config',      action: "Pages._sngpcTab='config';Pages.sngpc()" },
      { label: 'Relatórios',    icon: 'file-text',       active: Pages._sngpcTab==='relatorios',  action: "Pages._sngpcTab='relatorios';Pages.sngpc()" }
    ];
  },

  _sngpcMovimentacoes: async function() {
    var ft = Pages._sngpcFiltroTipo || '';
    var fp = Pages._sngpcFiltroPag || 1;
    var url = '/sngpc/movimentacoes?page=' + fp + '&limit=20';
    if (ft) url += '&tipo=' + ft;
    if (Pages._sngpcFiltroInicio) url += '&data_inicio=' + Pages._sngpcFiltroInicio;
    if (Pages._sngpcFiltroFim) url += '&data_fim=' + Pages._sngpcFiltroFim;
    var res;
    try { res = await App.get(url); } catch(e) { res = { data: [], total: 0 }; }
    var movs = res.data || [];
    var total = res.total || 0;
    var tp = Math.ceil(total / 20) || 1;
    var tipoBadge = { entrada:'badge-success', saida:'badge-danger', ajuste:'badge-warning', inventario:'badge-info' };
    var rows = movs.map(function(m) {
      return '<tr>' +
        '<td><span class="badge ' + (tipoBadge[m.tipo]||'badge-neutral') + '">' + m.tipo + '</span></td>' +
        '<td class="fw-500">' + (m.Produto ? m.Produto.nome : '-') + '</td>' +
        '<td>' + (m.Lote ? m.Lote.numero_lote : '-') + '</td>' +
        '<td class="text-right">' + m.quantidade + '</td>' +
        '<td>' + (m.nome_paciente || '-') + '</td>' +
        '<td>' + (m.numero_receita || '-') + '</td>' +
        '<td>' + Utils.date(m.data_movimentacao) + '</td>' +
        '<td>' + (m.transmitido ? '<span class="badge badge-success">Sim</span>' : '<span class="badge badge-warning">Não</span>') + '</td></tr>';
    }).join('');
    var pag = '<div style="display:flex;gap:8px;align-items:center;margin-top:16px;justify-content:center">';
    if (fp > 1) pag += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._sngpcFiltroPag=' + (fp-1) + ';Pages._sngpcMovimentacoes()">Anterior</button>';
    pag += '<span>Página ' + fp + ' de ' + tp + ' (' + total + ' reg.)</span>';
    if (fp < tp) pag += '<button class="btn btn-secondary btn-sm" data-onclick="Pages._sngpcFiltroPag=' + (fp+1) + ';Pages._sngpcMovimentacoes()">Próxima</button>';
    pag += '</div>';
    Layout.render(
      '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn btn-primary" data-onclick="Pages._novaDispensacao()"><i data-lucide="plus" style="width:16px;height:16px"></i> Nova Dispensação</button>' +
        '<button class="btn btn-warning" data-onclick="Pages._novoAjusteSngpc()"><i data-lucide="sliders" style="width:16px;height:16px"></i> Ajuste</button>' +
        '<select class="form-control" style="max-width:150px" data-onchange="Pages._sngpcFiltroTipo=this.value;Pages._sngpcFiltroPag=1;Pages._sngpcMovimentacoes()">' +
          '<option value="">Todos</option>' +
          '<option value="entrada"' + (ft==='entrada'?' selected':'') + '>Entrada</option>' +
          '<option value="saida"' + (ft==='saida'?' selected':'') + '>Saída</option>' +
          '<option value="ajuste"' + (ft==='ajuste'?' selected':'') + '>Ajuste</option>' +
          '<option value="inventario"' + (ft==='inventario'?' selected':'') + '>Inventário</option>' +
        '</select>' +
        '<input type="date" class="form-control" style="max-width:140px" value="' + (Pages._sngpcFiltroInicio||'') + '" data-onchange="Pages._sngpcFiltroInicio=this.value;Pages._sngpcFiltroPag=1;Pages._sngpcMovimentacoes()">' +
        '<input type="date" class="form-control" style="max-width:140px" value="' + (Pages._sngpcFiltroFim||'') + '" data-onchange="Pages._sngpcFiltroFim=this.value;Pages._sngpcFiltroPag=1;Pages._sngpcMovimentacoes()">' +
      '</div>' +
      '<div class="card"><div class="card-header"><h3>Movimentações SNGPC</h3><span class="badge badge-info">' + total + '</span></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Tipo</th><th>Produto</th><th>Lote</th><th class="text-right">Qtd</th><th>Paciente</th><th>Receita</th><th>Data</th><th>Transm.</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">Nenhuma movimentação</td></tr>') + '</tbody></table></div></div>' +
      pag,
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _sngpcDash: async function() {
    var dash;
    try { dash = await App.get('/sngpc/dashboard'); } catch(e) { dash = {}; }
    var configStatus = dash.configurado
      ? '<span class="badge badge-success">Configurado</span>'
      : '<span class="badge badge-danger" style="cursor:pointer" data-onclick="Pages._sngpcTab=\'config\';Pages.sngpc()">Não configurado — Clique aqui</span>';
    var periodoInfo = dash.periodoAberto
      ? '<span class="badge badge-info">Período aberto: ' + Utils.date(dash.periodoAberto.data_inicio) + ' a ' + Utils.date(dash.periodoAberto.data_fim) + '</span>'
      : '<span class="badge badge-warning">Nenhum período aberto</span>';
    var porTipo = (dash.porTipo || []).map(function(t) {
      var bc = t.tipo === 'entrada' ? 'badge-success' : t.tipo === 'saida' ? 'badge-danger' : t.tipo === 'ajuste' ? 'badge-warning' : 'badge-info';
      return '<div class="d-flex justify-between mb-1" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<span class="badge ' + bc + '">' + t.tipo + '</span><span class="fw-600">' + t.total + '</span></div>';
    }).join('');
    var ultTransm = (dash.ultimasTransmissoes || []).map(function(tr) {
      var sc = { gerado:'badge-neutral', enviado:'badge-info', aceito:'badge-success', rejeitado:'badge-danger' };
      return '<div class="d-flex justify-between mb-1" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<span>' + Utils.date(tr.createdAt) + '</span><span class="badge ' + (sc[tr.status]||'badge-neutral') + '">' + tr.status + '</span></div>';
    }).join('');
    Layout.render(
      '<div style="margin-bottom:16px">' + configStatus + ' ' + periodoInfo + '</div>' +
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-icon teal"><i data-lucide="arrow-left-right" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Movim. no Mês</h4><div class="value">' + (dash.totalMes || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon amber"><i data-lucide="clock" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Pend. Transmissão</h4><div class="value">' + (dash.pendentesTransmissao || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon blue"><i data-lucide="pill" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Controlados</h4><div class="value">' + (dash.totalControlados || 0) + '</div></div></div>' +
        '<div class="stat-card"><div class="stat-icon red"><i data-lucide="alert-triangle" style="width:22px;height:22px"></i></div>' +
          '<div class="stat-info"><h4>Lotes Vencidos</h4><div class="value">' + (dash.lotesVencidos || 0) + '</div></div></div>' +
      '</div>' +
      (dash.lotesProximoVencer > 0 ? '<div class="alert alert-warning" style="margin:16px 0"><i data-lucide="alert-circle" style="width:16px;height:16px;vertical-align:middle"></i> ' + dash.lotesProximoVencer + ' lote(s) próximo(s) do vencimento (30 dias)</div>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">' +
        '<div class="card"><div class="card-header"><h3>Por Tipo de Movimentação</h3></div><div class="card-body">' + (porTipo || '<p class="text-muted">Sem dados no mês</p>') + '</div></div>' +
        '<div class="card"><div class="card-header"><h3>Últimas Transmissões</h3></div><div class="card-body">' + (ultTransm || '<p class="text-muted">Nenhuma transmissão</p>') + '</div></div>' +
      '</div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novaDispensacao: function() {
    Modal.show('Nova Dispensação de Controlado',
      '<div class="form-group"><label class="form-label">Medicamento Controlado</label>' +
        '<input type="text" class="form-control" id="sngpcMedBusca" placeholder="Buscar medicamento controlado..." data-oninput="Pages._buscarMedSngpc(this.value)">' +
        '<div id="sngpcMedResultados" style="margin-top:4px"></div>' +
        '<input type="hidden" id="sngpcProdutoId">' +
        '<input type="hidden" id="sngpcNecessitaReceita"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Lote *</label>' +
          '<select class="form-control" id="sngpcLoteId"><option value="">Selecione o medicamento primeiro</option></select></div>' +
        '<div class="form-group"><label class="form-label">Quantidade *</label>' +
          '<input type="text" class="form-control" id="sngpcQtd" placeholder="1" data-oninput="Utils.maskIntegerInput(event)"></div>' +
      '</div>' +
      '<div id="sngpcReceitaSection">' +
        '<h4 style="margin:16px 0 8px">Dados da Receita</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">CPF do Paciente *</label>' +
            '<input type="text" class="form-control" id="sngpcCPF" data-oninput="Utils.maskCPFInput(event)" placeholder="000.000.000-00"></div>' +
          '<div class="form-group"><label class="form-label">Nome do Paciente *</label>' +
            '<input type="text" class="form-control" id="sngpcCliente" placeholder="Nome completo"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Nome do Médico *</label>' +
            '<input type="text" class="form-control" id="sngpcMedico" placeholder="Nome do médico prescritor"></div>' +
          '<div class="form-group"><label class="form-label">CRM *</label>' +
            '<input type="text" class="form-control" id="sngpcCRM" placeholder="CRM"></div>' +
          '<div class="form-group" style="max-width:100px"><label class="form-label">UF *</label>' +
            '<input type="text" class="form-control" id="sngpcUFCRM" placeholder="UF" maxlength="2"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Nº da Receita *</label>' +
            '<input type="text" class="form-control" id="sngpcNumReceita" placeholder="Número"></div>' +
          '<div class="form-group"><label class="form-label">Data da Receita *</label>' +
            '<input type="date" class="form-control" id="sngpcDataReceita"></div>' +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Observação</label>' +
        '<input type="text" class="form-control" id="sngpcObs" placeholder="Observação opcional"></div>',
      '<button class="btn btn-success" data-onclick="Pages._salvarDispensacao()"><i data-lucide="check" style="width:16px;height:16px"></i> Registrar Dispensação</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-xl'
    );
  },

  _buscarMedSngpc: async function(valor) {
    if (!valor || valor.length < 2) { document.getElementById('sngpcMedResultados').innerHTML = ''; return; }
    try {
      var res = await App.get('/sngpc/produtos-controlados?busca=' + encodeURIComponent(valor));
      var prods = Array.isArray(res) ? res : (res.data || []);
      var classeBadge = { A1:'badge-danger', A2:'badge-danger', A3:'badge-warning', B1:'badge-info', B2:'badge-info', C1:'badge-neutral', C2:'badge-neutral' };
      document.getElementById('sngpcMedResultados').innerHTML = prods.slice(0, 5).map(function(p) {
        return '<div style="padding:8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-top:4px" ' +
          'data-onclick="Pages._selecionarProdutoSngpc(' + p.id + ',\'' + (p.nome||'').replace(/'/g, "\\'") + '\',' + (p.necessita_receita ? 'true' : 'false') + ')">' +
          '<strong>' + p.nome + '</strong> ' +
          '<span class="badge ' + (classeBadge[p.classe_controlado]||'badge-neutral') + '">' + (p.classe_controlado||'Ctrl') + '</span>' +
          ' | ' + (p.principio_ativo||'-') + ' | Estoque: ' + Utils.number(p.estoque_atual, 0) + '</div>';
      }).join('') || '<div style="padding:8px;color:var(--text-muted)">Nenhum controlado encontrado</div>';
    } catch(e) { console.error(e); }
  },

  _selecionarProdutoSngpc: async function(id, nome, necessitaReceita) {
    document.getElementById('sngpcProdutoId').value = id;
    document.getElementById('sngpcMedBusca').value = nome;
    document.getElementById('sngpcMedResultados').innerHTML = '';
    document.getElementById('sngpcNecessitaReceita').value = necessitaReceita ? '1' : '0';
    var receitaSection = document.getElementById('sngpcReceitaSection');
    if (receitaSection) receitaSection.style.display = necessitaReceita ? '' : 'none';
    try {
      var lotes = await App.get('/sngpc/lotes/' + id);
      var sel = document.getElementById('sngpcLoteId');
      sel.innerHTML = '<option value="">Selecione o lote</option>';
      (Array.isArray(lotes) ? lotes : []).forEach(function(l) {
        sel.innerHTML += '<option value="' + l.id + '">' + l.numero_lote + ' | Qtd: ' + l.quantidade_atual + ' | Val: ' + (l.validade ? Utils.date(l.validade) : 'N/A') + '</option>';
      });
      if (!lotes || lotes.length === 0) sel.innerHTML = '<option value="">Nenhum lote disponível</option>';
    } catch(e) { document.getElementById('sngpcLoteId').innerHTML = '<option value="">Erro ao carregar lotes</option>'; }
  },

  _salvarDispensacao: async function() {
    var produtoId = document.getElementById('sngpcProdutoId').value;
    if (!produtoId) { Toast.error('Selecione um medicamento'); return; }
    var loteId = document.getElementById('sngpcLoteId').value;
    if (!loteId) { Toast.error('Selecione um lote'); return; }
    var qtd = parseInt(document.getElementById('sngpcQtd').value) || 1;
    var necessitaReceita = document.getElementById('sngpcNecessitaReceita').value === '1';
    var data = {
      produto_id: parseInt(produtoId),
      lote_id: parseInt(loteId),
      quantidade: qtd,
      observacao: (document.getElementById('sngpcObs') || {}).value || ''
    };
    if (necessitaReceita) {
      data.cpf_paciente = (document.getElementById('sngpcCPF') || {}).value;
      data.nome_paciente = (document.getElementById('sngpcCliente') || {}).value;
      data.nome_medico = (document.getElementById('sngpcMedico') || {}).value;
      data.crm_medico = (document.getElementById('sngpcCRM') || {}).value;
      data.uf_crm = (document.getElementById('sngpcUFCRM') || {}).value;
      data.numero_receita = (document.getElementById('sngpcNumReceita') || {}).value;
      data.data_receita = (document.getElementById('sngpcDataReceita') || {}).value;
      if (!data.cpf_paciente || !data.nome_paciente || !data.nome_medico || !data.crm_medico || !data.uf_crm || !data.numero_receita || !data.data_receita) {
        Toast.error('Preencha todos os campos obrigatórios da receita'); return;
      }
    }
    try {
      await App.post('/sngpc/dispensacao', data);
      Toast.success('Dispensação registrada com sucesso');
      Modal.close();
      Pages._sngpcTab = 'movimentacoes';
      Pages.sngpc();
    } catch(e) {}
  },

  _novoAjusteSngpc: function() {
    Modal.show('Ajuste de Estoque — SNGPC',
      '<p class="text-muted">Registrar ajuste imutável (perda, vencimento, quebra, correção).</p>' +
      '<div class="form-group"><label class="form-label">Medicamento Controlado *</label>' +
        '<input type="text" class="form-control" id="ajSngpcBusca" placeholder="Buscar..." data-oninput="Pages._buscarMedAjusteSngpc(this.value)">' +
        '<div id="ajSngpcResultados" style="margin-top:4px"></div>' +
        '<input type="hidden" id="ajSngpcProdutoId"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Lote *</label>' +
          '<select class="form-control" id="ajSngpcLoteId"><option value="">Selecione o medicamento</option></select></div>' +
        '<div class="form-group"><label class="form-label">Quantidade *</label>' +
          '<input type="text" class="form-control" id="ajSngpcQtd" placeholder="1" data-oninput="Utils.maskIntegerInput(event)"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Motivo *</label>' +
        '<select class="form-control" id="ajSngpcMotivo">' +
          '<option value="perda">Perda</option>' +
          '<option value="vencimento">Vencimento</option>' +
          '<option value="quebra">Quebra</option>' +
          '<option value="correcao_inventario">Correção de inventário</option>' +
        '</select></div>' +
      '<div class="form-group"><label class="form-label">Observação</label>' +
        '<input type="text" class="form-control" id="ajSngpcObs" placeholder="Detalhar o motivo"></div>',
      '<button class="btn btn-warning" data-onclick="Pages._salvarAjusteSngpc()"><i data-lucide="check" style="width:16px;height:16px"></i> Registrar Ajuste</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _buscarMedAjusteSngpc: async function(valor) {
    if (!valor || valor.length < 2) { document.getElementById('ajSngpcResultados').innerHTML = ''; return; }
    try {
      var res = await App.get('/sngpc/produtos-controlados?busca=' + encodeURIComponent(valor));
      var prods = Array.isArray(res) ? res : (res.data || []);
      document.getElementById('ajSngpcResultados').innerHTML = prods.slice(0, 5).map(function(p) {
        return '<div style="padding:8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-top:4px" ' +
          'data-onclick="Pages._selecionarProdAjSngpc(' + p.id + ',\'' + (p.nome||'').replace(/'/g, "\\'") + '\')">' +
          '<strong>' + p.nome + '</strong> | Estoque: ' + Utils.number(p.estoque_atual, 0) + '</div>';
      }).join('') || '<div style="padding:8px;color:var(--text-muted)">Nenhum controlado encontrado</div>';
    } catch(e) {}
  },

  _selecionarProdAjSngpc: async function(id, nome) {
    document.getElementById('ajSngpcProdutoId').value = id;
    document.getElementById('ajSngpcBusca').value = nome;
    document.getElementById('ajSngpcResultados').innerHTML = '';
    try {
      var lotes = await App.get('/sngpc/lotes/' + id);
      var sel = document.getElementById('ajSngpcLoteId');
      sel.innerHTML = '<option value="">Selecione o lote</option>';
      (Array.isArray(lotes) ? lotes : []).forEach(function(l) {
        sel.innerHTML += '<option value="' + l.id + '">' + l.numero_lote + ' | Qtd: ' + l.quantidade_atual + ' | Val: ' + (l.validade ? Utils.date(l.validade) : 'N/A') + '</option>';
      });
    } catch(e) {}
  },

  _salvarAjusteSngpc: async function() {
    var produtoId = document.getElementById('ajSngpcProdutoId').value;
    var loteId = document.getElementById('ajSngpcLoteId').value;
    var qtd = parseInt(document.getElementById('ajSngpcQtd').value) || 0;
    var motivo = document.getElementById('ajSngpcMotivo').value;
    if (!produtoId || !loteId || !qtd) { Toast.error('Preencha produto, lote e quantidade'); return; }
    try {
      await App.post('/sngpc/movimentacoes/ajuste', {
        produto_id: parseInt(produtoId),
        lote_id: parseInt(loteId),
        quantidade: qtd,
        motivo: motivo,
        observacao: (document.getElementById('ajSngpcObs') || {}).value || ''
      });
      Toast.success('Ajuste registrado com sucesso');
      Modal.close();
      Pages._sngpcTab = 'movimentacoes';
      Pages.sngpc();
    } catch(e) {}
  },

  _sngpcEstoque: async function() {
    var inv;
    try { inv = await App.get('/sngpc/inventario'); } catch(e) { inv = {}; }
    var produtos = inv.produtos || [];
    var invRealizado = inv.inventarioRealizado;
    var podeRealizar = inv.podeRealizarInventario;
    var rows = '';
    produtos.forEach(function(p) {
      var lotes = p.Lotes || [];
      lotes.forEach(function(l, idx) {
        var valClass = '';
        if (l.validade) {
          var hoje = new Date().toISOString().split('T')[0];
          var d30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
          if (l.validade < hoje) valClass = 'style="color:var(--danger);font-weight:600"';
          else if (l.validade < d30) valClass = 'style="color:var(--warning);font-weight:600"';
        }
        rows += '<tr>' +
          (idx === 0 ? '<td rowspan="' + lotes.length + '" class="fw-500">' + p.nome + '</td>' +
            '<td rowspan="' + lotes.length + '"><span class="badge badge-info">' + (p.classe_controlado||'-') + '</span></td>' : '') +
          '<td>' + l.numero_lote + '</td>' +
          '<td class="text-right">' + Utils.number(l.quantidade_atual, 0) + '</td>' +
          '<td ' + valClass + '>' + (l.validade ? Utils.date(l.validade) : '-') + '</td>' +
          '<td>' + (l.nota_fiscal_compra || '-') + '</td>' +
          '<td><span class="badge ' + (l.status === 'ATIVO' ? 'badge-success' : l.status === 'ESGOTADO' ? 'badge-danger' : 'badge-warning') + '">' + l.status + '</span></td></tr>';
      });
      if (lotes.length === 0) {
        rows += '<tr><td class="fw-500">' + p.nome + '</td><td><span class="badge badge-info">' + (p.classe_controlado||'-') + '</span></td>' +
          '<td colspan="5" class="text-muted">Sem lotes</td></tr>';
      }
    });
    var invBtn = '';
    if (!invRealizado && podeRealizar) {
      invBtn = '<button class="btn btn-info" data-onclick="Pages._realizarInventarioSngpc()"><i data-lucide="clipboard-check" style="width:16px;height:16px"></i> Realizar Inventário Inicial</button>';
    } else if (invRealizado) {
      invBtn = '<span class="badge badge-success" style="padding:8px 16px">Inventário inicial realizado</span>';
    }
    Layout.render(
      '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">' + invBtn + '</div>' +
      '<div class="card"><div class="card-header"><h3>Estoque de Controlados por Lote</h3><span class="badge badge-info">' + produtos.length + ' produtos</span></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Produto</th><th>Classe</th><th>Lote</th><th class="text-right">Qtd</th><th>Validade</th><th>NF Compra</th><th>Status</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhum produto controlado com lotes</td></tr>') + '</tbody></table></div></div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _realizarInventarioSngpc: async function() {
    if (!confirm('Deseja realizar o inventário inicial SNGPC?\n\nIsso registrará o estoque atual de todos os lotes de controlados como movimentação de inventário.\n\nEssa operação é realizada apenas UMA VEZ.')) return;
    try {
      var res = await App.post('/sngpc/inventario', {});
      Toast.success('Inventário inicial realizado! ' + (res.totalMovimentacoes || 0) + ' movimentações registradas.');
      Pages.sngpc();
    } catch(e) {}
  },

  _sngpcPeriodos: async function() {
    var periodos;
    try { periodos = await App.get('/sngpc/periodos'); } catch(e) { periodos = []; }
    if (!Array.isArray(periodos)) periodos = periodos.data || [];
    var stBadge = { aberto: 'badge-info', fechado: 'badge-warning', transmitido: 'badge-success' };
    var rows = periodos.map(function(p) {
      var acoes = '';
      if (p.status === 'aberto') {
        acoes = '<button class="btn btn-warning btn-sm" data-onclick="Pages._fecharPeriodoSngpc(' + p.id + ')">Fechar</button>';
      } else if (p.status === 'fechado') {
        acoes = '<button class="btn btn-primary btn-sm" data-onclick="Pages._sngpcTab=\'transmissoes\';Pages.sngpc()">Transmitir</button>';
      }
      return '<tr>' +
        '<td>' + Utils.date(p.data_inicio) + '</td>' +
        '<td>' + Utils.date(p.data_fim) + '</td>' +
        '<td><span class="badge ' + (stBadge[p.status]||'badge-neutral') + '">' + p.status + '</span></td>' +
        '<td>' + (p.FechadoPor ? p.FechadoPor.nome : '-') + '</td>' +
        '<td>' + (p.fechado_em ? Utils.dateTime(p.fechado_em) : '-') + '</td>' +
        '<td>' + (p.observacoes || '-') + '</td>' +
        '<td>' + acoes + '</td></tr>';
    }).join('');
    Layout.render(
      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._novoPeriodoSngpc()"><i data-lucide="plus" style="width:16px;height:16px"></i> Novo Período</button>' +
      '</div>' +
      '<div class="card"><div class="card-header"><h3>Períodos SNGPC</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Início</th><th>Fim</th><th>Status</th><th>Fechado por</th><th>Fechado em</th><th>Obs</th><th>Ações</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhum período</td></tr>') + '</tbody></table></div></div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novoPeriodoSngpc: function() {
    var now = new Date();
    var firstDay = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-01';
    var lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0);
    var lastDayStr = lastDay.getFullYear() + '-' + String(lastDay.getMonth()+1).padStart(2,'0') + '-' + String(lastDay.getDate()).padStart(2,'0');
    Modal.show('Novo Período SNGPC',
      '<p class="text-muted">Período para agrupar movimentações para transmissão ANVISA.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Data Início *</label>' +
          '<input type="date" class="form-control" id="perSngpcInicio" value="' + firstDay + '"></div>' +
        '<div class="form-group"><label class="form-label">Data Fim *</label>' +
          '<input type="date" class="form-control" id="perSngpcFim" value="' + lastDayStr + '"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Observações</label>' +
        '<input type="text" class="form-control" id="perSngpcObs" placeholder="Ex: Período mensal"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarPeriodoSngpc()"><i data-lucide="check" style="width:16px;height:16px"></i> Criar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarPeriodoSngpc: async function() {
    var inicio = (document.getElementById('perSngpcInicio') || {}).value;
    var fim = (document.getElementById('perSngpcFim') || {}).value;
    if (!inicio || !fim) { Toast.error('Preencha as datas'); return; }
    try {
      await App.post('/sngpc/periodos', { data_inicio: inicio, data_fim: fim, observacoes: (document.getElementById('perSngpcObs') || {}).value || '' });
      Toast.success('Período criado com sucesso');
      Modal.close();
      Pages.sngpc();
    } catch(e) {}
  },

  _fecharPeriodoSngpc: async function(id) {
    if (!confirm('Deseja fechar este período?\n\nApós fechado, novas movimentações não poderão ser incluídas nele.')) return;
    try {
      await App.put('/sngpc/periodos/' + id + '/fechar', {});
      Toast.success('Período fechado');
      Pages.sngpc();
    } catch(e) {}
  },

  _sngpcTransmissoes: async function() {
    var transmissoes;
    try { transmissoes = await App.get('/sngpc/transmissoes'); } catch(e) { transmissoes = []; }
    if (!Array.isArray(transmissoes)) transmissoes = transmissoes.data || [];
    var periodos;
    try { periodos = await App.get('/sngpc/periodos'); } catch(e) { periodos = []; }
    if (!Array.isArray(periodos)) periodos = periodos.data || [];
    var fechados = periodos.filter(function(p) { return p.status === 'fechado'; });
    var stBadge = { gerado:'badge-neutral', enviado:'badge-info', aceito:'badge-success', rejeitado:'badge-danger' };
    var rows = transmissoes.map(function(tr) {
      var acoes = '<button class="btn btn-secondary btn-sm" data-onclick="Pages._downloadXmlSngpc(' + tr.id + ')"><i data-lucide="download" style="width:14px;height:14px"></i></button> ';
      if (tr.status === 'gerado') {
        acoes += '<button class="btn btn-info btn-sm" data-onclick="Pages._registrarEnvioSngpc(' + tr.id + ')">Reg. Envio</button>';
      } else if (tr.status === 'enviado') {
        acoes += '<button class="btn btn-success btn-sm" data-onclick="Pages._registrarRetornoSngpc(' + tr.id + ',\'aceito\')">Aceito</button> ' +
          '<button class="btn btn-danger btn-sm" data-onclick="Pages._registrarRetornoSngpc(' + tr.id + ',\'rejeitado\')">Rejeitado</button>';
      }
      return '<tr>' +
        '<td>' + (tr.Periodo ? Utils.date(tr.Periodo.data_inicio) + ' a ' + Utils.date(tr.Periodo.data_fim) : '-') + '</td>' +
        '<td><span class="badge ' + (stBadge[tr.status]||'badge-neutral') + '">' + tr.status + '</span></td>' +
        '<td>' + (tr.protocolo_anvisa || '-') + '</td>' +
        '<td>' + (tr.data_envio ? Utils.dateTime(tr.data_envio) : '-') + '</td>' +
        '<td>' + (tr.data_retorno ? Utils.dateTime(tr.data_retorno) : '-') + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">' + (tr.mensagem_retorno || '-') + '</td>' +
        '<td style="white-space:nowrap">' + acoes + '</td></tr>';
    }).join('');
    var gerarBtns = fechados.map(function(p) {
      return '<button class="btn btn-primary btn-sm" data-onclick="Pages._gerarXmlSngpc(' + p.id + ')" style="margin:2px">' +
        '<i data-lucide="file-code" style="width:14px;height:14px"></i> ' + Utils.date(p.data_inicio) + ' a ' + Utils.date(p.data_fim) + '</button>';
    }).join('');
    Layout.render(
      (fechados.length > 0 ? '<div class="card" style="margin-bottom:16px"><div class="card-header"><h3>Períodos Prontos</h3></div>' +
        '<div class="card-body"><p class="text-muted" style="margin-bottom:8px">Gerar XML para períodos fechados:</p>' + gerarBtns + '</div></div>' : '') +
      '<div class="card"><div class="card-header"><h3>Transmissões SNGPC</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Período</th><th>Status</th><th>Protocolo</th><th>Envio</th><th>Retorno</th><th>Mensagem</th><th>Ações</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhuma transmissão</td></tr>') + '</tbody></table></div></div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _gerarXmlSngpc: async function(periodoId) {
    try {
      var val = await App.get('/sngpc/validar-periodo/' + periodoId);
      if (val.erros && val.erros.length > 0) {
        Toast.error('Validação falhou:\n' + val.erros.map(function(e) { return '• ' + e; }).join('\n'));
        return;
      }
      if (val.avisos && val.avisos.length > 0) {
        if (!confirm('Avisos:\n' + val.avisos.map(function(a) { return '• ' + a; }).join('\n') + '\n\nContinuar?')) return;
      }
    } catch(e) { Toast.error('Erro na validação'); return; }
    try {
      var res = await App.post('/sngpc/transmissoes/gerar-xml/' + periodoId, {});
      Toast.success('XML gerado! ' + (res.totalMovimentacoes || 0) + ' movimentações.');
      Pages.sngpc();
    } catch(e) {}
  },

  _downloadXmlSngpc: async function(id) {
    try {
      var headers = {};
      if (App.token) headers['Authorization'] = 'Bearer ' + App.token;
      if (App.tenantSlug) headers['X-Tenant-Slug'] = App.tenantSlug;
      var res = await fetch('/api/sngpc/transmissoes/' + id + '/download-xml', { headers: headers });
      if (!res.ok) throw new Error('Erro ao baixar XML');
      var xml = await res.text();
      var blob = new Blob([xml], { type: 'text/xml' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'sngpc_transmissao_' + id + '.xml';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch(e) { Toast.error(e.message || 'Erro ao baixar XML'); }
  },

  _registrarEnvioSngpc: function(id) {
    Modal.show('Registrar Envio à ANVISA',
      '<p class="text-muted">Registre o envio manual do XML ao SNGPC/ANVISA.</p>' +
      '<div class="form-group"><label class="form-label">Protocolo ANVISA</label>' +
        '<input type="text" class="form-control" id="sngpcProtocolo" placeholder="Número do protocolo (se disponível)"></div>',
      '<button class="btn btn-info" data-onclick="Pages._doRegistrarEnvio(' + id + ')"><i data-lucide="send" style="width:16px;height:16px"></i> Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _doRegistrarEnvio: async function(id) {
    try {
      await App.put('/sngpc/transmissoes/' + id + '/registrar-envio', { protocolo_anvisa: (document.getElementById('sngpcProtocolo') || {}).value || '' });
      Toast.success('Envio registrado');
      Modal.close();
      Pages.sngpc();
    } catch(e) {}
  },

  _registrarRetornoSngpc: function(id, status) {
    var titulo = status === 'aceito' ? 'Registrar Aceitação' : 'Registrar Rejeição';
    Modal.show(titulo,
      '<p class="text-muted">' + (status === 'aceito' ? 'Confirme a aceitação pela ANVISA.' : 'Registre a rejeição. O período será reaberto.') + '</p>' +
      '<div class="form-group"><label class="form-label">Protocolo</label>' +
        '<input type="text" class="form-control" id="sngpcProtRet"></div>' +
      '<div class="form-group"><label class="form-label">Mensagem</label>' +
        '<input type="text" class="form-control" id="sngpcMsgRet" placeholder="Mensagem da ANVISA"></div>',
      '<button class="btn btn-' + (status==='aceito'?'success':'danger') + '" data-onclick="Pages._doRegistrarRetorno(' + id + ',\'' + status + '\')"><i data-lucide="check" style="width:16px;height:16px"></i> Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _doRegistrarRetorno: async function(id, status) {
    try {
      await App.put('/sngpc/transmissoes/' + id + '/registrar-retorno', {
        status: status,
        protocolo_anvisa: (document.getElementById('sngpcProtRet') || {}).value || '',
        mensagem_retorno: (document.getElementById('sngpcMsgRet') || {}).value || ''
      });
      Toast.success(status === 'aceito' ? 'Transmissão aceita!' : 'Rejeição registrada. Período reaberto.');
      Modal.close();
      Pages.sngpc();
    } catch(e) {}
  },

  _sngpcConfig: async function() {
    var cfg;
    try { cfg = await App.get('/sngpc/configuracao'); } catch(e) { cfg = null; }
    if (!cfg) cfg = {};
    Layout.render(
      '<div class="card"><div class="card-header"><h3>Configuração SNGPC</h3></div><div class="card-body">' +
      '<p class="text-muted" style="margin-bottom:16px">Dados obrigatórios para transmissão SNGPC/ANVISA.</p>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CNPJ *</label>' +
          '<input type="text" class="form-control" id="cfgSngpcCnpj" value="' + (cfg.cnpj||'') + '" placeholder="00.000.000/0000-00"></div>' +
        '<div class="form-group"><label class="form-label">Razão Social *</label>' +
          '<input type="text" class="form-control" id="cfgSngpcRazao" value="' + (cfg.razao_social||'') + '"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Nº AFE (Autorização de Funcionamento) *</label>' +
        '<input type="text" class="form-control" id="cfgSngpcAfe" value="' + (cfg.numero_afe||'') + '"></div>' +
      '<h4 style="margin:16px 0 8px">Responsável Técnico</h4>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Nome *</label>' +
          '<input type="text" class="form-control" id="cfgSngpcRtNome" value="' + (cfg.responsavel_tecnico_nome||'') + '"></div>' +
        '<div class="form-group"><label class="form-label">CRF *</label>' +
          '<input type="text" class="form-control" id="cfgSngpcRtCrf" value="' + (cfg.responsavel_tecnico_crf||'') + '"></div>' +
        '<div class="form-group" style="max-width:100px"><label class="form-label">UF *</label>' +
          '<input type="text" class="form-control" id="cfgSngpcRtUf" value="' + (cfg.responsavel_tecnico_uf||'') + '" maxlength="2"></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Data Início Controle</label>' +
          '<input type="date" class="form-control" id="cfgSngpcDataInicio" value="' + (cfg.data_inicio_controle||'') + '"></div>' +
        '<div class="form-group"><label class="form-label">Ambiente</label>' +
          '<select class="form-control" id="cfgSngpcAmbiente">' +
            '<option value="producao"' + (cfg.ambiente==='producao'?' selected':'') + '>Produção</option>' +
            '<option value="homologacao"' + (cfg.ambiente==='homologacao'?' selected':'') + '>Homologação</option>' +
          '</select></div>' +
      '</div>' +
      '<div style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="cfgSngpcAtivo"' + (cfg.ativo !== false ? ' checked' : '') + '> SNGPC Ativo</label></div>' +
      '<div style="margin-top:16px"><button class="btn btn-primary" data-onclick="Pages._salvarConfigSngpc()"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar Configuração</button></div>' +
      '</div></div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _salvarConfigSngpc: async function() {
    var data = {
      cnpj: (document.getElementById('cfgSngpcCnpj') || {}).value,
      razao_social: (document.getElementById('cfgSngpcRazao') || {}).value,
      numero_afe: (document.getElementById('cfgSngpcAfe') || {}).value,
      responsavel_tecnico_nome: (document.getElementById('cfgSngpcRtNome') || {}).value,
      responsavel_tecnico_crf: (document.getElementById('cfgSngpcRtCrf') || {}).value,
      responsavel_tecnico_uf: (document.getElementById('cfgSngpcRtUf') || {}).value,
      data_inicio_controle: (document.getElementById('cfgSngpcDataInicio') || {}).value || null,
      ambiente: (document.getElementById('cfgSngpcAmbiente') || {}).value || 'producao',
      ativo: document.getElementById('cfgSngpcAtivo') ? document.getElementById('cfgSngpcAtivo').checked : true
    };
    if (!data.cnpj || !data.razao_social || !data.numero_afe || !data.responsavel_tecnico_nome || !data.responsavel_tecnico_crf || !data.responsavel_tecnico_uf) {
      Toast.error('Preencha todos os campos obrigatórios (*)'); return;
    }
    try {
      await App.post('/sngpc/configuracao', data);
      Toast.success('Configuração salva com sucesso');
    } catch(e) {}
  },

  _sngpcRelatorios: function() {
    Layout.render(
      '<div class="card"><div class="card-header"><h3>Relatórios SNGPC</h3></div><div class="card-body">' +
      '<p class="text-muted" style="margin-bottom:16px">Selecione o relatório desejado:</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="card" style="cursor:pointer;transition:transform .15s" data-onclick="Pages._gerarRelSngpc(\'estoque-controlado\')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div class="card-body" style="padding:16px;display:flex;align-items:center;gap:12px"><i data-lucide="package" style="width:24px;height:24px;color:var(--primary)"></i><div><h4 style="margin:0">Estoque de Controlados</h4><small class="text-muted">Estoque atual por produto</small></div></div></div>' +
        '<div class="card" style="cursor:pointer;transition:transform .15s" data-onclick="Pages._gerarRelSngpc(\'estoque-por-lote\')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div class="card-body" style="padding:16px;display:flex;align-items:center;gap:12px"><i data-lucide="layers" style="width:24px;height:24px;color:var(--primary)"></i><div><h4 style="margin:0">Estoque por Lote</h4><small class="text-muted">Detalhamento por lote e validade</small></div></div></div>' +
        '<div class="card" style="cursor:pointer;transition:transform .15s" data-onclick="Pages._gerarRelSngpc(\'movimentacoes\')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div class="card-body" style="padding:16px;display:flex;align-items:center;gap:12px"><i data-lucide="arrow-left-right" style="width:24px;height:24px;color:var(--primary)"></i><div><h4 style="margin:0">Movimentações</h4><small class="text-muted">Histórico com filtros de data</small></div></div></div>' +
        '<div class="card" style="cursor:pointer;transition:transform .15s" data-onclick="Pages._gerarRelSngpc(\'transmissoes\')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div class="card-body" style="padding:16px;display:flex;align-items:center;gap:12px"><i data-lucide="send" style="width:24px;height:24px;color:var(--primary)"></i><div><h4 style="margin:0">Transmissões</h4><small class="text-muted">XMLs gerados e enviados</small></div></div></div>' +
        '<div class="card" style="cursor:pointer;transition:transform .15s" data-onclick="Pages._gerarRelSngpc(\'vencidos\')" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'">' +
          '<div class="card-body" style="padding:16px;display:flex;align-items:center;gap:12px"><i data-lucide="alert-triangle" style="width:24px;height:24px;color:var(--danger)"></i><div><h4 style="margin:0">Lotes Vencidos / a Vencer</h4><small class="text-muted">Controle de validade</small></div></div></div>' +
      '</div></div></div>',
      { title: 'SNGPC', moduleMenu: Pages._sngpcMenuItems() }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _gerarRelSngpc: function(tipo) {
    var needsDates = (tipo === 'movimentacoes' || tipo === 'transmissoes');
    if (needsDates) {
      Modal.show('Período do Relatório',
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Data Início</label><input type="date" class="form-control" id="relSngpcInicio"></div>' +
          '<div class="form-group"><label class="form-label">Data Fim</label><input type="date" class="form-control" id="relSngpcFim"></div>' +
        '</div>',
        '<button class="btn btn-primary" data-onclick="Pages._doGerarRelSngpc(\'' + tipo + '\')"><i data-lucide="download" style="width:16px;height:16px"></i> Gerar</button>' +
        '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
      );
      return;
    }
    Pages._doGerarRelSngpc(tipo);
  },

  _doGerarRelSngpc: async function(tipo) {
    var url = '/sngpc/relatorios/' + tipo;
    var params = [];
    var inicio = document.getElementById('relSngpcInicio');
    var fim = document.getElementById('relSngpcFim');
    if (inicio && inicio.value) params.push('data_inicio=' + inicio.value);
    if (fim && fim.value) params.push('data_fim=' + fim.value);
    if (params.length) url += '?' + params.join('&');
    try {
      var data = await App.get(url);
      var items = data.data || data;
      if (!items || items.length === 0) { Toast.warning('Nenhum dado no relatório'); Modal.close(); return; }
      var headers = Object.keys(items[0] || {});
      var csv = headers.join(';') + '\n';
      items.forEach(function(row) {
        csv += headers.map(function(h) {
          var val = row[h];
          if (val && typeof val === 'object') val = JSON.stringify(val);
          return (val === null || val === undefined) ? '' : String(val).replace(/;/g, ',');
        }).join(';') + '\n';
      });
      var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'sngpc_' + tipo + '_' + new Date().toISOString().split('T')[0] + '.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      Toast.success('Relatório gerado com ' + items.length + ' registros');
      Modal.close();
    } catch(e) { Toast.error('Erro ao gerar relatório'); }
  },

  // ============================================================
  //  FISCAL — Notas Fiscais NFC-e (Arquitetura Desacoplada)
  // ============================================================
  fiscal: async function() {
    Pages._fiscalTab = Pages._fiscalTab || 'notas';
    var menuItems = [
      { label: 'Notas Fiscais', icon: 'file-text',     active: Pages._fiscalTab==='notas',      action: "Pages._fiscalTab='notas';Pages.fiscal()" },
      { label: 'Emitir NFC-e',  icon: 'send',          active: Pages._fiscalTab==='emitir',     action: "Pages._fiscalTab='emitir';Pages.fiscal()" },
      { label: 'Configuração',  icon: 'settings',      active: Pages._fiscalTab==='config',     action: "Pages._fiscalTab='config';Pages.fiscal()" },
      { label: 'Contingência',  icon: 'refresh-cw',    active: Pages._fiscalTab==='contingencia', action: "Pages._fiscalTab='contingencia';Pages.fiscal()" }
    ];

    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Fiscal', moduleMenu: menuItems });

    if (Pages._fiscalTab === 'emitir')       { Pages._fiscalEmitir(menuItems); return; }
    if (Pages._fiscalTab === 'config')       { Pages._fiscalConfig(menuItems); return; }
    if (Pages._fiscalTab === 'contingencia') { Pages._fiscalContingencia(menuItems); return; }

    /* ── Tab: Lista de Notas ── */
    var page = Pages._fiscalPage || 1;
    var notas, dashData;
    try { 
      var _nfRes = await App.get('/fiscal?page=' + page + '&limit=30');
      notas = _nfRes.data || [];
      Pages._fiscalPages = _nfRes.pages || 1;
      Pages._fiscalTotal = _nfRes.total || 0;
    } catch(e) { notas = []; }
    try { dashData = await App.get('/fiscal/dashboard'); } catch(e) { dashData = {}; }

    /* Dashboard cards */
    var statMap = {};
    (dashData.porStatus || []).forEach(function(s) { statMap[s.status] = s; });
    var dashCards =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">' +
        '<div class="card" style="padding:16px;border-left:4px solid var(--success)">' +
          '<div class="text-muted" style="font-size:0.8rem">Autorizadas (mês)</div>' +
          '<div class="fw-700" style="font-size:1.3rem;color:var(--success)">' + (statMap.autorizada ? statMap.autorizada.total : 0) + '</div>' +
          '<div class="text-muted" style="font-size:0.8rem">' + Utils.currency(statMap.autorizada ? statMap.autorizada.valor : 0) + '</div></div>' +
        '<div class="card" style="padding:16px;border-left:4px solid var(--warning)">' +
          '<div class="text-muted" style="font-size:0.8rem">Pendentes</div>' +
          '<div class="fw-700" style="font-size:1.3rem;color:var(--warning)">' + (dashData.pendentes || 0) + '</div>' +
          '<div class="text-muted" style="font-size:0.8rem">contingência</div></div>' +
        '<div class="card" style="padding:16px;border-left:4px solid var(--danger)">' +
          '<div class="text-muted" style="font-size:0.8rem">Canceladas (mês)</div>' +
          '<div class="fw-700" style="font-size:1.3rem;color:var(--danger)">' + (statMap.cancelada ? statMap.cancelada.total : 0) + '</div></div>' +
        '<div class="card" style="padding:16px;border-left:4px solid var(--primary)">' +
          '<div class="text-muted" style="font-size:0.8rem">Provider Ativo</div>' +
          '<div class="fw-700" style="font-size:0.95rem;color:var(--primary)">' + (dashData.providerAtivo || 'Nenhum') + '</div></div>' +
      '</div>';

    /* Tabela de notas */
    var statusBadge = { autorizada: 'badge-success', cancelada: 'badge-danger', rejeitada: 'badge-warning', pendente: 'badge-neutral' };
    var rows = notas.map(function(nf) {
      return '<tr class="clickable" data-onclick="Pages._detalharNF(' + nf.id + ')">' +
        '<td class="fw-500">#' + (nf.numero || '-') + '</td>' +
        '<td>' + (nf.tipo === 'nfce' ? 'NFC-e' : 'NF-e') + '</td>' +
        '<td>' + Utils.dateTime(nf.createdAt || nf.created_at) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(nf.valor_total || 0) + '</td>' +
        '<td><span class="badge ' + (statusBadge[nf.status]||'badge-neutral') + '">' + (nf.status||'-') + '</span></td>' +
        '<td style="font-size:0.8rem;color:var(--text-muted)">' + (nf.provider_usado || '-') + '</td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhuma nota fiscal</td></tr>';

    /* Paginação */
    var pagination = '';
    if (Pages._fiscalPages > 1) {
      pagination = '<div style="display:flex;justify-content:center;gap:8px;margin-top:16px">';
      if (page > 1) pagination += '<button class="btn btn-sm" data-onclick="Pages._fiscalPage=' + (page-1) + ';Pages.fiscal()">← Anterior</button>';
      pagination += '<span class="text-muted" style="padding:6px 12px">' + page + ' / ' + Pages._fiscalPages + ' (' + Pages._fiscalTotal + ' notas)</span>';
      if (page < Pages._fiscalPages) pagination += '<button class="btn btn-sm" data-onclick="Pages._fiscalPage=' + (page+1) + ';Pages.fiscal()">Próxima →</button>';
      pagination += '</div>';
    }

    Layout.render(
      dashCards +
      '<div class="card"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center"><h3>Notas Fiscais</h3>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-primary btn-sm" data-onclick="Pages._fiscalTab=\'emitir\';Pages.fiscal()"><i data-lucide="send" style="width:14px;height:14px"></i> Emitir NFC-e</button>' +
          ((dashData.pendentes||0) > 0 ? '<button class="btn btn-warning btn-sm" data-onclick="Pages._fiscalReenviar()"><i data-lucide="refresh-cw" style="width:14px;height:14px"></i> Reenviar ' + dashData.pendentes + ' pendentes</button>' : '') +
        '</div></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Número</th><th>Tipo</th><th>Data</th><th class="text-right">Valor</th><th>Status</th><th>Provider</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' + pagination + '</div>',
      { title: 'Fiscal', moduleMenu: menuItems }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* ── Tab: Emitir NFC-e ── */
  _fiscalEmitir: function(menu) {
    Layout.render(
      '<div class="card"><div class="card-body">' +
        '<h3 style="margin-bottom:16px"><i data-lucide="send" style="width:20px;height:20px"></i> Emissão de NFC-e</h3>' +
        '<p class="text-muted" style="margin-bottom:20px">Emita uma NFC-e a partir de uma venda finalizada. O documento será enviado ao provider configurado (DevNota, etc).</p>' +
        '<div class="form-group"><label class="form-label">Buscar Venda (por número)</label>' +
          '<div class="form-row">' +
            '<input type="text" class="form-control" id="fiscalVendaNum" placeholder="Ex: 10001">' +
            '<button class="btn btn-primary" data-onclick="Pages._buscarVendaFiscal()"><i data-lucide="search" style="width:16px;height:16px"></i> Buscar</button>' +
          '</div></div>' +
        '<div id="fiscalVendaPreview" style="margin-top:16px"></div>' +
        '<hr style="margin:24px 0;border-color:var(--border)">' +
        '<h4 style="margin-bottom:12px">Dados Complementares</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">CPF/CNPJ do Destinatário (opcional)</label>' +
            '<input type="text" class="form-control" id="fiscalDestCpf" placeholder="CPF ou CNPJ (opcional para NFC-e < R$ 5000)"></div>' +
          '<div class="form-group"><label class="form-label">Nome do Destinatário</label>' +
            '<input type="text" class="form-control" id="fiscalDestNome" placeholder="Ex: João Silva"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Informações Complementares</label>' +
          '<textarea class="form-control" id="fiscalInfoCompl" rows="2" placeholder="Informações adicionais para a NF"></textarea></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px">' +
          '<button class="btn btn-success btn-lg" id="btnEmitirNfce" data-onclick="Pages._emitirNFCe()">' +
            '<i data-lucide="send" style="width:18px;height:18px"></i> Emitir NFC-e</button>' +
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
            '<input type="checkbox" id="fiscalForcar"> <span class="text-muted" style="font-size:0.85rem">Forçar emissão (ignorar avisos fiscais)</span></label>' +
        '</div>' +
      '</div></div>',
      { title: 'Fiscal', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _buscarVendaFiscal: async function() {
    var num = document.getElementById('fiscalVendaNum').value;
    if (!num) { Toast.error('Digite o número da venda'); return; }
    try {
      var res = await App.get('/vendas?page=1&limit=200');
      var vendas = res.data || res || [];
      var v = vendas.find(function(x) { return String(x.numero) === String(num); });
      if (!v) { Toast.error('Venda não encontrada'); return; }
      if (v.status !== 'finalizada') { Toast.error('Venda deve estar finalizada (status: ' + v.status + ')'); return; }
      document.getElementById('fiscalVendaPreview').innerHTML =
        '<div class="card" style="border-color:var(--success)">' +
          '<div class="card-body">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<div><strong>Venda #' + v.numero + '</strong> — ' + Utils.dateTime(v.createdAt || v.created_at) + '</div>' +
              '<span class="badge badge-success">Encontrada</span></div>' +
            '<div style="margin-top:8px">Cliente: ' + (v.cliente_nome||'Consumidor') + ' | Total: <strong>' + Utils.currency(v.total) + '</strong> | ' + Pages._formatPayment(v.forma_pagamento) + '</div>' +
          '</div></div>';
      Pages._fiscalVendaId = v.id;
      /* Pré-preencher CPF/nome se disponível */
      if (v.cliente_cpf) document.getElementById('fiscalDestCpf').value = v.cliente_cpf;
      if (v.cliente_nome) document.getElementById('fiscalDestNome').value = v.cliente_nome;
    } catch(e) { Toast.error('Erro ao buscar venda'); }
  },

  _emitirNFCe: async function() {
    if (!Pages._fiscalVendaId) { Toast.error('Busque uma venda primeiro'); return; }
    var btn = document.getElementById('btnEmitirNfce');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:18px;height:18px"></div> Emitindo...'; }
    try {
      var resultado = await App.post('/fiscal/emitir', {
        venda_id: Pages._fiscalVendaId,
        dest_cpf_cnpj: document.getElementById('fiscalDestCpf').value,
        dest_nome: document.getElementById('fiscalDestNome').value,
        info_complementar: document.getElementById('fiscalInfoCompl').value,
        forcar: document.getElementById('fiscalForcar').checked
      });
      if (resultado.nf && resultado.nf.status === 'autorizada') {
        Toast.success(resultado.message || 'NFC-e autorizada!');
      } else if (resultado.nf && resultado.nf.status === 'pendente') {
        Toast.info(resultado.message || 'NFC-e em contingência — será reenviada automaticamente');
      } else {
        Toast.warning(resultado.message || 'NFC-e gerada — verifique o status');
      }
      Pages._fiscalVendaId = null;
      Pages._fiscalTab = 'notas';
      Pages.fiscal();
    } catch(e) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" style="width:18px;height:18px"></i> Emitir NFC-e'; if (typeof lucide !== 'undefined') lucide.createIcons(); }
    }
  },

  /* ── Tab: Configuração de Provider ── */
  _fiscalConfig: async function(menu) {
    var providers;
    try { providers = await App.get('/fiscal/providers'); } catch(e) { providers = []; }

    var provRows = (providers || []).map(function(p) {
      var ambBadge = p.ambiente === 'producao' ? '<span class="badge badge-danger">Produção</span>' : '<span class="badge badge-info">Homologação</span>';
      var ativoBadge = p.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-neutral">Inativo</span>';
      return '<tr>' +
        '<td class="fw-600">' + p.provider_nome + '</td>' +
        '<td>' + ambBadge + '</td>' +
        '<td>' + ativoBadge + '</td>' +
        '<td>' + (p.prioridade || 1) + '</td>' +
        '<td style="font-size:0.8rem;color:var(--text-muted)">' + (p.base_url || '-') + '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn-icon" data-onclick="Pages._editarProvider(' + p.id + ')" title="Editar"><i data-lucide="edit" style="width:16px;height:16px"></i></button>' +
          '<button class="btn-icon" data-onclick="Pages._testarProvider(' + p.id + ')" title="Testar conexão" style="color:var(--success)"><i data-lucide="wifi" style="width:16px;height:16px"></i></button>' +
          '<button class="btn-icon" data-onclick="Pages._removerProvider(' + p.id + ')" title="Remover" style="color:var(--danger)"><i data-lucide="trash-2" style="width:16px;height:16px"></i></button>' +
        '</td></tr>';
    }).join('');
    if (!provRows) provRows = '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhum provider configurado. Adicione um abaixo.</td></tr>';

    Layout.render(
      '<div class="card" style="margin-bottom:20px"><div class="card-header"><h3>Providers Fiscais</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Provider</th><th>Ambiente</th><th>Status</th><th>Prioridade</th><th>URL Base</th><th>Ações</th></tr></thead>' +
          '<tbody>' + provRows + '</tbody></table></div></div>' +
      /* Formulário de novo provider */
      '<div class="card"><div class="card-body">' +
        '<h3 style="margin-bottom:16px"><i data-lucide="plus-circle" style="width:20px;height:20px"></i> Adicionar Provider</h3>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Provider</label>' +
            '<select class="form-control" id="provNome"><option value="DEVNOTA">DevNota</option><option value="TECNOSPEED">TecnoSpeed</option><option value="FOCUS">Focus NFe</option></select></div>' +
          '<div class="form-group"><label class="form-label">Ambiente</label>' +
            '<select class="form-control" id="provAmbiente"><option value="homologacao">Homologação (testes)</option><option value="producao">Produção</option></select></div>' +
          '<div class="form-group"><label class="form-label">Prioridade</label>' +
            '<input type="number" class="form-control" id="provPrioridade" value="1" min="1" max="10" style="max-width:80px"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Token de Acesso / API Key</label>' +
          '<input type="password" class="form-control" id="provToken" placeholder="Cole aqui o token da API">' +
          '<small class="text-muted">O token será criptografado (AES-256-GCM) antes de salvar no banco. Nunca é armazenado em texto plano.</small></div>' +
        '<div class="form-group"><label class="form-label">URL Base (opcional)</label>' +
          '<input type="text" class="form-control" id="provBaseUrl" placeholder="Deixe vazio para usar URL padrão do provider"></div>' +
        '<button class="btn btn-success" data-onclick="Pages._salvarProvider()">' +
          '<i data-lucide="save" style="width:16px;height:16px"></i> Salvar Provider</button>' +
      '</div></div>',
      { title: 'Fiscal', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _salvarProvider: async function() {
    var token = document.getElementById('provToken').value;
    if (!token) { Toast.error('Token é obrigatório'); return; }
    try {
      await App.post('/fiscal/providers', {
        provider_nome: document.getElementById('provNome').value,
        token: token,
        ambiente: document.getElementById('provAmbiente').value,
        prioridade: document.getElementById('provPrioridade').value,
        base_url: document.getElementById('provBaseUrl').value || undefined
      });
      Toast.success('Provider configurado com sucesso!');
      Pages._fiscalTab = 'config';
      Pages.fiscal();
    } catch(e) {}
  },

  _editarProvider: async function(id) {
    Modal.show('Editar Provider',
      '<div class="form-group"><label class="form-label">Ambiente</label>' +
        '<select class="form-control" id="editProvAmb"><option value="homologacao">Homologação</option><option value="producao">Produção</option></select></div>' +
      '<div class="form-group"><label class="form-label">Novo Token (deixe vazio para manter o atual)</label>' +
        '<input type="password" class="form-control" id="editProvToken" placeholder="Novo token (opcional)"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Prioridade</label>' +
          '<input type="number" class="form-control" id="editProvPrio" value="1" min="1" max="10"></div>' +
        '<div class="form-group"><label class="form-label">Ativo</label>' +
          '<select class="form-control" id="editProvAtivo"><option value="true">Sim</option><option value="false">Não</option></select></div>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._doEditarProvider(' + id + ')"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _doEditarProvider: async function(id) {
    var data = {
      ambiente: document.getElementById('editProvAmb').value,
      prioridade: parseInt(document.getElementById('editProvPrio').value),
      ativo: document.getElementById('editProvAtivo').value === 'true'
    };
    var tk = document.getElementById('editProvToken').value;
    if (tk) data.token = tk;
    try {
      await App.put('/fiscal/providers/' + id, data);
      Toast.success('Provider atualizado');
      Modal.close();
      Pages._fiscalTab = 'config';
      Pages.fiscal();
    } catch(e) {}
  },

  _testarProvider: async function(id) {
    Toast.info('Testando conexão...');
    try {
      var res = await App.post('/fiscal/providers/' + id + '/testar');
      Toast.success(res.message || 'Conexão OK!');
    } catch(e) { /* Toast.error já chamado pelo App */ }
  },

  _removerProvider: async function(id) {
    if (!confirm('Remover este provider fiscal?')) return;
    try {
      await App.delete('/fiscal/providers/' + id);
      Toast.success('Provider removido');
      Pages._fiscalTab = 'config';
      Pages.fiscal();
    } catch(e) {}
  },

  /* ── Tab: Contingência ── */
  _fiscalContingencia: async function(menu) {
    var notas;
    try {
      var res = await App.get('/fiscal?status=pendente&limit=50');
      notas = res.data || [];
    } catch(e) { notas = []; }

    var rows = notas.map(function(nf) {
      return '<tr>' +
        '<td class="fw-500">#' + (nf.numero || '-') + '</td>' +
        '<td>' + Utils.dateTime(nf.createdAt || nf.created_at) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(nf.valor_total || 0) + '</td>' +
        '<td>' + (nf.tentativas_envio || 0) + '/10</td>' +
        '<td style="font-size:0.8rem">' + (nf.motivo_rejeicao || '-') + '</td>' +
        '<td>' + (nf.provider_usado || '-') + '</td>' +
        '<td><button class="btn btn-sm btn-primary" data-onclick="Pages._consultarNF(' + nf.id + ')"><i data-lucide="search" style="width:14px;height:14px"></i></button></td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhuma nota em contingência</td></tr>';

    Layout.render(
      '<div class="card" style="margin-bottom:16px"><div class="card-body" style="display:flex;justify-content:space-between;align-items:center">' +
        '<div><h3 style="margin:0">Contingência Fiscal</h3><p class="text-muted" style="margin:4px 0 0">Notas pendentes que serão reenviadas ao provider SEFAZ</p></div>' +
        '<button class="btn btn-warning" data-onclick="Pages._fiscalReenviar()"><i data-lucide="refresh-cw" style="width:16px;height:16px"></i> Reenviar Todas</button>' +
      '</div></div>' +
      '<div class="card"><div class="card-header"><h3>Notas Pendentes (' + notas.length + ')</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>Número</th><th>Data</th><th class="text-right">Valor</th><th>Tentativas</th><th>Último Erro</th><th>Provider</th><th>Ações</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>',
      { title: 'Fiscal', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _fiscalReenviar: async function() {
    Toast.info('Reenviando notas pendentes...');
    try {
      var res = await App.post('/fiscal/reenviar-pendentes');
      if (res.processadas === 0) {
        Toast.info('Nenhuma nota pendente para reenviar');
      } else {
        var autorz = (res.resultados || []).filter(function(r) { return r.status === 'AUTORIZADA'; }).length;
        Toast.success('Processadas: ' + res.processadas + ' | Autorizadas: ' + autorz);
      }
      Pages.fiscal();
    } catch(e) {}
  },

  /* ── Detalhe da NF ── */
  _detalharNF: async function(id) {
    var nf;
    try { nf = await App.get('/fiscal/' + id); } catch(e) { return; }
    if (!nf) return;

    var statusBadge = { autorizada: 'badge-success', cancelada: 'badge-danger', rejeitada: 'badge-warning', pendente: 'badge-neutral' };
    var info =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><span class="text-muted">Tipo:</span><br><strong>' + (nf.tipo === 'nfce' ? 'NFC-e' : 'NF-e') + '</strong></div>' +
        '<div><span class="text-muted">Status:</span><br><span class="badge ' + (statusBadge[nf.status]||'badge-neutral') + '" style="font-size:0.9rem">' + (nf.status||'-') + '</span></div>' +
        '<div><span class="text-muted">Data Emissão:</span><br><strong>' + Utils.dateTime(nf.data_emissao || nf.createdAt || nf.created_at) + '</strong></div>' +
        '<div><span class="text-muted">Valor Total:</span><br><strong style="font-size:1.1rem;color:var(--primary)">' + Utils.currency(nf.valor_total) + '</strong></div>' +
        '<div><span class="text-muted">Provider:</span><br><strong>' + (nf.provider_usado || 'LOCAL') + '</strong></div>' +
        '<div><span class="text-muted">Ambiente:</span><br><strong>' + (nf.ambiente || '-') + '</strong></div>' +
        (nf.numero ? '<div><span class="text-muted">Número / Série:</span><br><strong>' + nf.numero + ' / ' + (nf.serie||1) + '</strong></div>' : '') +
        (nf.dest_nome ? '<div><span class="text-muted">Destinatário:</span><br><strong>' + nf.dest_nome + (nf.dest_cpf_cnpj ? ' (' + nf.dest_cpf_cnpj + ')' : '') + '</strong></div>' : '') +
      '</div>';

    if (nf.chave_acesso) {
      info += '<div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:6px"><span class="text-muted">Chave de Acesso:</span><br><code style="font-size:0.75rem;word-break:break-all">' + nf.chave_acesso + '</code></div>';
    }
    if (nf.protocolo_autorizacao) {
      info += '<div style="margin-bottom:12px"><span class="text-muted">Protocolo:</span> <strong>' + nf.protocolo_autorizacao + '</strong></div>';
    }
    if (nf.motivo_rejeicao) {
      info += '<div class="alert alert-warning" style="margin-bottom:12px"><strong>Motivo:</strong> ' + nf.motivo_rejeicao + '</div>';
    }
    if (nf.motivo_cancelamento) {
      info += '<div class="alert alert-danger" style="margin-bottom:12px"><strong>Motivo Cancelamento:</strong> ' + nf.motivo_cancelamento + ' (' + Utils.dateTime(nf.data_cancelamento) + ')</div>';
    }

    /* Botões de ação */
    var footer = '';
    if (nf.status === 'pendente') {
      footer += '<button class="btn btn-primary" data-onclick="Pages._consultarNF(' + nf.id + ')"><i data-lucide="search" style="width:16px;height:16px"></i> Consultar Status</button>';
    }
    if (nf.status === 'autorizada') {
      footer += '<button class="btn btn-warning" data-onclick="Pages._cartaCorrecao(' + nf.id + ')"><i data-lucide="edit-3" style="width:16px;height:16px"></i> Carta de Correção</button>';
      footer += '<button class="btn btn-danger" data-onclick="Pages._cancelarNF(' + nf.id + ')"><i data-lucide="x-circle" style="width:16px;height:16px"></i> Cancelar</button>';
    }
    if (nf.pdf_url) {
      footer += '<a class="btn btn-secondary" href="' + nf.pdf_url + '" target="_blank"><i data-lucide="download" style="width:16px;height:16px"></i> PDF</a>';
    }
    footer += '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>';

    Modal.show('NF #' + (nf.numero || '-'), info, footer, 'modal-lg');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _consultarNF: async function(id) {
    Toast.info('Consultando status na SEFAZ...');
    try {
      var res = await App.post('/fiscal/' + id + '/consultar');
      Toast.success(res.message || 'Consulta realizada');
      Modal.close();
      Pages.fiscal();
    } catch(e) {}
  },

  _cartaCorrecao: function(id) {
    Modal.show('Carta de Correção',
      '<p class="text-muted" style="margin-bottom:12px">A carta de correção corrige erros em notas autorizadas. Não corrige valores, impostos ou dados do destinatário.</p>' +
      '<div class="form-group"><label class="form-label">Texto da Correção</label>' +
        '<textarea class="form-control" id="ccTexto" rows="4" placeholder="Descreva a correção (mínimo 15 caracteres)"></textarea></div>' +
      '<div class="alert alert-warning"><i data-lucide="alert-triangle" style="width:16px;height:16px"></i> Máximo de 20 cartas de correção por NF.</div>',
      '<button class="btn btn-warning" data-onclick="Pages._enviarCartaCorrecao(' + id + ')"><i data-lucide="send" style="width:16px;height:16px"></i> Enviar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _enviarCartaCorrecao: async function(id) {
    var texto = document.getElementById('ccTexto').value;
    if (!texto || texto.length < 15) { Toast.error('O texto deve ter pelo menos 15 caracteres'); return; }
    try {
      await App.post('/fiscal/' + id + '/carta-correcao', { texto: texto });
      Toast.success('Carta de correção enviada');
      Modal.close(); Pages.fiscal();
    } catch(e) {}
  },

  _cancelarNF: async function(id) {
    Modal.show('Cancelar Nota Fiscal',
      '<p class="text-muted" style="margin-bottom:12px">O cancelamento será enviado à SEFAZ via provider. Justificativa mínima de 15 caracteres.</p>' +
      '<div class="form-group"><label class="form-label">Motivo do Cancelamento</label>' +
        '<textarea class="form-control" id="cancelMotivo" rows="3" placeholder="Motivo do cancelamento (mín 15 caracteres)"></textarea></div>',
      '<button class="btn btn-danger" data-onclick="Pages._doCancelarNF(' + id + ')"><i data-lucide="x-circle" style="width:16px;height:16px"></i> Confirmar Cancelamento</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Voltar</button>'
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _doCancelarNF: async function(id) {
    var motivo = document.getElementById('cancelMotivo').value;
    if (!motivo || motivo.length < 15) { Toast.error('Motivo deve ter pelo menos 15 caracteres'); return; }
    try {
      var res = await App.post('/fiscal/' + id + '/cancelar', { motivo: motivo });
      Toast.success(res.message || 'NF cancelada');
      Modal.close(); Pages.fiscal();
    } catch(e) {}
  },

  // ============================================================
  //  COMPRAS — Módulo completo de notas de compra v2.0
  // ============================================================
  compras: async function() {
    Pages._comprasTab = Pages._comprasTab || 'notas';
    var menuItems = [
      { label: 'Notas de Compra', icon: 'file-text',     active: Pages._comprasTab==='notas',   action: "Pages._comprasTab='notas';Pages.compras()" },
      { label: 'Nova Entrada',    icon: 'file-input',    active: Pages._comprasTab==='entrada', action: "Pages._comprasTab='entrada';Pages.compras()" },
      { label: 'Importar XML',    icon: 'upload',        active: Pages._comprasTab==='xml',     action: "Pages._comprasTab='xml';Pages.compras()" }
    ];

    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Compras', moduleMenu: menuItems });

    if (Pages._comprasTab === 'entrada') { Pages._comprasEntrada(menuItems); return; }
    if (Pages._comprasTab === 'xml')     { Pages._comprasXml(menuItems); return; }

    // ── Lista de notas de compra ──
    var res;
    try { res = await App.get('/compras'); } catch(e) { res = { data: [] }; }
    var compras = Array.isArray(res) ? res : (res.data || []);

    var rows = compras.map(function(c) {
      var badgeMap = { ABERTA: 'badge-warning', FINALIZADA: 'badge-success', CANCELADA: 'badge-danger', lancada: 'badge-success', cancelada: 'badge-danger' };
      var forn = c.Fornecedor || {};
      var qtdItens = (c.CompraItems || []).length;
      var statusLabel = (c.status || '-').charAt(0).toUpperCase() + (c.status || '-').slice(1).toLowerCase();
      return '<tr>' +
        '<td class="fw-500">' + (c.numero_nf || '-') + '</td>' +
        '<td>' + (c.serie || '1') + '</td>' +
        '<td>' + (forn.nome || '-') + '</td>' +
        '<td style="font-size:0.85rem">' + (forn.cnpj_cpf || '-') + '</td>' +
        '<td>' + Utils.date(c.data_emissao) + '</td>' +
        '<td>' + Utils.date(c.data_entrada) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(c.valor_total) + '</td>' +
        '<td class="text-center">' + qtdItens + '</td>' +
        '<td><span class="badge ' + (badgeMap[c.status]||'badge-neutral') + '">' + statusLabel + '</span></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn-icon" data-onclick="Pages._verCompra(' + c.id + ')" title="Visualizar"><i data-lucide="eye" style="width:16px;height:16px"></i></button>' +
          (c.status === 'ABERTA' ? '<button class="btn-icon" data-onclick="Pages._finalizarCompra(' + c.id + ')" title="Finalizar" style="color:var(--success)"><i data-lucide="check-circle" style="width:16px;height:16px"></i></button>' : '') +
          (c.status === 'ABERTA' || c.status === 'FINALIZADA' || c.status === 'lancada' ? '<button class="btn-icon" data-onclick="Pages._cancelarCompra(' + c.id + ')" title="Cancelar" style="color:var(--danger)"><i data-lucide="x-circle" style="width:16px;height:16px"></i></button>' : '') +
        '</td></tr>';
    }).join('');

    if (!rows) rows = '<tr><td colspan="10" class="text-center text-muted" style="padding:40px">Nenhuma nota de compra registrada</td></tr>';

    Layout.render(
      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="btn btn-primary" data-onclick="Pages._comprasTab=\'entrada\';Pages.compras()"><i data-lucide="plus" style="width:16px;height:16px"></i> Nova Entrada Manual</button>' +
        '<button class="btn btn-secondary" data-onclick="Pages._comprasTab=\'xml\';Pages.compras()"><i data-lucide="upload" style="width:16px;height:16px"></i> Importar XML</button>' +
      '</div>' +
      '<div class="card"><div class="card-header"><h3>Notas de Compra</h3></div>' +
        '<div class="table-container"><table>' +
          '<thead><tr><th>NF</th><th>Série</th><th>Fornecedor</th><th>CNPJ</th><th>Emissão</th><th>Entrada</th><th class="text-right">Valor Total</th><th class="text-center">Itens</th><th>Status</th><th>Ações</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>',
      { title: 'Compras', moduleMenu: menuItems }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _verCompra: async function(id) {
    var compra;
    try { compra = await App.get('/compras/' + id); } catch(e) { Toast.error('Erro ao carregar compra'); return; }
    var forn = compra.Fornecedor || {};
    var itens = compra.CompraItems || [];
    var parcelas = compra.CompraParcelas || [];
    var badgeMap = { ABERTA: 'badge-warning', FINALIZADA: 'badge-success', CANCELADA: 'badge-danger', lancada: 'badge-success', cancelada: 'badge-danger' };
    var statusLabel = (compra.status || '-').charAt(0).toUpperCase() + (compra.status || '-').slice(1).toLowerCase();

    var itensHtml = itens.map(function(it, i) {
      var custoFinal = it.custo_final_unitario ? ' <small class="text-muted">(custo: ' + Utils.currency(it.custo_final_unitario) + ')</small>' : '';
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td>' + (it.produto_nome || '-') + '</td>' +
        '<td>' + (it.codigo_barras || '-') + '</td>' +
        '<td>' + (it.ncm || '-') + '</td>' +
        '<td>' + (it.cfop || '-') + '</td>' +
        '<td class="text-right">' + (it.quantidade || 0) + '</td>' +
        '<td class="text-right">' + Utils.currency(it.valor_unitario) + custoFinal + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(it.valor_total) + '</td>' +
        '<td>' + (it.numero_lote || '-') + '</td>' +
        '<td>' + (it.validade ? Utils.date(it.validade) : '-') + '</td></tr>';
    }).join('') || '<tr><td colspan="10" class="text-center text-muted">Nenhum item</td></tr>';

    var parcelasHtml = parcelas.map(function(p) {
      var pBadgeMap = { pendente: 'badge-warning', paga: 'badge-success', cancelada: 'badge-danger' };
      return '<tr>' +
        '<td>' + p.numero_parcela + '</td>' +
        '<td>' + Utils.date(p.data_vencimento) + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(p.valor) + '</td>' +
        '<td><span class="badge ' + (pBadgeMap[p.status]||'badge-neutral') + '">' + p.status + '</span></td></tr>';
    }).join('') || '<tr><td colspan="4" class="text-center text-muted">Nenhuma parcela</td></tr>';

    var tipoDoc = compra.tipo_documento === 'NFE' ? '<span class="badge badge-info">NF-e</span>' : '<span class="badge badge-neutral">Manual</span>';

    var footerBtns = '';
    if (compra.status === 'ABERTA') {
      footerBtns += '<button class="btn btn-success" data-onclick="Modal.close();Pages._finalizarCompra(' + compra.id + ')"><i data-lucide="check" style="width:16px;height:16px"></i> Finalizar Compra</button>';
    }
    if (compra.status === 'ABERTA' || compra.status === 'FINALIZADA') {
      footerBtns += '<button class="btn btn-danger" data-onclick="Modal.close();Pages._cancelarCompra(' + compra.id + ')"><i data-lucide="x-circle" style="width:16px;height:16px"></i> Cancelar</button>';
    }
    footerBtns += '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>';

    Modal.show('Nota de Compra #' + compra.id,
      '<div class="tabs">' +
        '<button class="tab active" data-onclick="Pages._switchTab(event,\'tabCDados\')">Dados da NF</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabCItens\')">Itens (' + itens.length + ')</button>' +
        '<button class="tab" data-onclick="Pages._switchTab(event,\'tabCParcelas\')">Parcelas (' + parcelas.length + ')</button>' +
      '</div>' +
      '<div class="tab-content active" id="tabCDados">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><span class="text-muted">Número NF:</span> <strong>' + (compra.numero_nf || '-') + '</strong></div>' +
          '<div><span class="text-muted">Tipo:</span> ' + tipoDoc + '</div>' +
          '<div><span class="text-muted">Série:</span> <strong>' + (compra.serie || '1') + '</strong></div>' +
          '<div><span class="text-muted">Fornecedor:</span> <strong>' + (forn.nome || '-') + '</strong></div>' +
          '<div><span class="text-muted">CNPJ:</span> <strong>' + (forn.cnpj_cpf || '-') + '</strong></div>' +
          '<div><span class="text-muted">Emissão:</span> <strong>' + Utils.date(compra.data_emissao) + '</strong></div>' +
          '<div><span class="text-muted">Entrada:</span> <strong>' + Utils.date(compra.data_entrada) + '</strong></div>' +
          '<div><span class="text-muted">Valor Produtos:</span> <strong>' + Utils.currency(compra.valor_produtos || compra.valor_total) + '</strong></div>' +
          '<div><span class="text-muted">Valor Total:</span> <strong style="font-size:1.2em;color:var(--success)">' + Utils.currency(compra.valor_total) + '</strong></div>' +
          '<div><span class="text-muted">Frete:</span> <strong>' + Utils.currency(compra.valor_frete) + '</strong></div>' +
          '<div><span class="text-muted">Desconto:</span> <strong>' + Utils.currency(compra.valor_desconto) + '</strong></div>' +
          '<div><span class="text-muted">Impostos:</span> <strong>' + Utils.currency(compra.valor_impostos) + '</strong></div>' +
          '<div><span class="text-muted">Status:</span> <span class="badge ' + (badgeMap[compra.status] || 'badge-neutral') + '">' + statusLabel + '</span></div>' +
        '</div>' +
        (compra.chave_acesso ? '<div style="margin-top:12px"><span class="text-muted">Chave de Acesso:</span><br><code style="font-size:0.8rem;word-break:break-all">' + compra.chave_acesso + '</code></div>' : '') +
        (compra.observacoes ? '<div style="margin-top:12px"><span class="text-muted">Obs:</span> ' + compra.observacoes + '</div>' : '') +
        (compra.motivo_cancelamento ? '<div style="margin-top:12px;padding:8px;background:var(--danger-light);border-radius:4px"><span class="text-muted">Motivo cancelamento:</span> ' + compra.motivo_cancelamento + '</div>' : '') +
        (compra.finalizada_em ? '<div style="margin-top:8px"><span class="text-muted">Finalizada em:</span> ' + Utils.dateTime(compra.finalizada_em) + '</div>' : '') +
      '</div>' +
      '<div class="tab-content" id="tabCItens">' +
        '<div class="table-container"><table><thead><tr><th>#</th><th>Produto</th><th>EAN</th><th>NCM</th><th>CFOP</th><th class="text-right">Qtd</th><th class="text-right">Vlr Unit</th><th class="text-right">Vlr Total</th><th>Lote</th><th>Validade</th></tr></thead>' +
        '<tbody>' + itensHtml + '</tbody></table></div>' +
      '</div>' +
      '<div class="tab-content" id="tabCParcelas">' +
        '<div class="table-container"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="text-right">Valor</th><th>Status</th></tr></thead>' +
        '<tbody>' + parcelasHtml + '</tbody></table></div>' +
      '</div>',
      footerBtns,
      'modal-xl'
    );
  },

  _finalizarCompra: async function(id) {
    if (!confirm('Finalizar esta compra?\n\nIsso irá:\n• Dar entrada no estoque\n• Criar lotes\n• Calcular custo médio\n• Gerar contas a pagar\n\nEsta ação não pode ser desfeita facilmente.')) return;
    try {
      await App.put('/compras/' + id + '/finalizar', {});
      Toast.success('Compra finalizada! Estoque atualizado, lotes criados e contas geradas.');
      Pages.compras();
    } catch(e) {
      Toast.error('Erro ao finalizar: ' + ((e && e.error) || (e && e.message) || ''));
    }
  },

  _cancelarCompra: async function(id) {
    var motivo = prompt('Motivo do cancelamento:');
    if (motivo === null) return;
    if (!motivo || motivo.trim().length < 3) { Toast.error('Informe o motivo do cancelamento'); return; }
    try {
      await App.put('/compras/' + id + '/cancelar', { motivo_cancelamento: motivo.trim() });
      Toast.success('Compra cancelada');
      Pages.compras();
    } catch(e) { Toast.error('Erro ao cancelar: ' + ((e && e.error) || (e && e.message) || '')); }
  },

  // ── Entrada manual de NF-e ──
  _comprasEntrada: async function(menu) {
    // Carregar fornecedores e armazenar no cache
    Pages._fornecedoresCache = [];
    try {
      var fRes = await App.get('/fornecedores');
      Pages._fornecedoresCache = Array.isArray(fRes) ? fRes : (fRes.data || []);
    } catch(e) {}

    Layout.render(
      '<div class="card"><div class="card-body">' +
        '<h3 style="margin-bottom:16px"><i data-lucide="file-input" style="width:20px;height:20px"></i> Entrada Manual de NF-e</h3>' +
        '<p class="text-muted" style="margin-bottom:20px">Registre manualmente uma nota fiscal de compra. O estoque será atualizado automaticamente.</p>' +
        '<div class="form-row">' +
          '<div class="form-group" style="flex:2">' +
            '<label class="form-label">Fornecedor *</label>' +
            '<div style="display:flex;gap:8px">' +
              '<div class="fornecedor-autocomplete-wrapper" style="flex:1">' +
                '<input type="text" class="form-control" id="entFornecedorSearch" ' +
                  'placeholder="Digite CNPJ ou Razão Social..." ' +
                  'data-oninput="Pages._buscarFornecedorAutocomplete(this.value)" ' +
                  'autocomplete="off">' +
                '<input type="hidden" id="entFornecedor">' +
                '<div class="fornecedor-autocomplete-list" id="entFornecedorList"></div>' +
              '</div>' +
              '<button class="btn btn-secondary btn-sm" data-onclick="Pages._novoFornecedorModal()" title="Cadastrar novo fornecedor" style="white-space:nowrap">' +
                '<i data-lucide="plus" style="width:14px;height:14px"></i> Novo</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Número da NF</label><input type="text" class="form-control" id="entNFNum" placeholder="Número da nota"></div>' +
          '<div class="form-group" style="max-width:100px"><label class="form-label">Série</label><input type="text" class="form-control" id="entNFSerie" value="1"></div>' +
          '<div class="form-group"><label class="form-label">Data Emissão</label><input type="date" class="form-control" id="entNFEmissao"></div>' +
          '<div class="form-group"><label class="form-label">Data Entrada</label><input type="date" class="form-control" id="entNFEntrada" value="' + new Date().toISOString().split('T')[0] + '"></div>' +
        '</div>' +
        '<div class="form-group"><label class="form-label">Chave de Acesso (44 dígitos)</label>' +
          '<input type="text" class="form-control" id="entNFChave" maxlength="44" placeholder="Chave de acesso da NF-e"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Valor Total (R$)</label><input type="text" class="form-control" id="entNFValor" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
          '<div class="form-group"><label class="form-label">Valor Frete (R$)</label><input type="text" class="form-control" id="entNFFrete" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
          '<div class="form-group"><label class="form-label">Valor Desconto (R$)</label><input type="text" class="form-control" id="entNFDesconto" placeholder="0,00" data-oninput="Utils.maskNumericInput(event)"></div>' +
        '</div>' +
        '<hr style="margin:16px 0;border-color:var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h4 style="margin:0"><i data-lucide="package" style="width:16px;height:16px"></i> Itens da Nota</h4>' +
          '<button class="btn btn-secondary btn-sm" data-onclick="Pages._addItemEntradaNF()"><i data-lucide="plus" style="width:14px;height:14px"></i> Adicionar Item</button>' +
        '</div>' +
        '<div id="entNFItens"><p class="text-muted">Nenhum item adicionado. Clique em "Adicionar Item".</p></div>' +
        '<hr style="margin:16px 0;border-color:var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
          '<h4 style="margin:0"><i data-lucide="calendar" style="width:16px;height:16px"></i> Parcelas / Duplicatas</h4>' +
          '<button class="btn btn-secondary btn-sm" data-onclick="Pages._addParcelaCompra()"><i data-lucide="plus" style="width:14px;height:14px"></i> Adicionar Parcela</button>' +
        '</div>' +
        '<div id="entNFParcelas"><p class="text-muted">Nenhuma parcela. A vista por padrão.</p></div>' +
        '<div class="form-group" style="margin-top:16px"><label class="form-label">Observações</label><textarea class="form-control" id="entNFObs" rows="2"></textarea></div>' +
        '<hr style="margin:16px 0;border-color:var(--border)">' +
        '<div style="display:flex;gap:8px;margin-top:16px">' +
          '<button class="btn btn-success" data-onclick="Pages._confirmarEntradaNF()">' +
            '<i data-lucide="check" style="width:16px;height:16px"></i> Confirmar Entrada da NF</button>' +
          '<button class="btn btn-secondary" data-onclick="Pages._comprasTab=\'notas\';Pages.compras()">Cancelar</button>' +
        '</div>' +
      '</div></div>',
      { title: 'Compras', moduleMenu: menu }
    );
    // Preencher automaticamente se há dados do XML importado
    if (Pages._xmlDados) {
      var xml = Pages._xmlDados;
      if (xml.numero_nf) { var el = document.getElementById('entNFNum'); if (el) el.value = xml.numero_nf; }
      if (xml.serie) { var el2 = document.getElementById('entNFSerie'); if (el2) el2.value = xml.serie; }
      if (xml.chave_acesso) { var el3 = document.getElementById('entNFChave'); if (el3) el3.value = xml.chave_acesso; }
      if (xml.data_emissao) { var el4 = document.getElementById('entNFEmissao'); if (el4) el4.value = xml.data_emissao; }
      if (xml.valor_total) { var el5 = document.getElementById('entNFValor'); if (el5) el5.value = String(xml.valor_total).replace('.', ','); }
      if (xml.valor_frete) { var el6 = document.getElementById('entNFFrete'); if (el6) el6.value = String(xml.valor_frete).replace('.', ','); }
      if (xml.valor_desconto) { var el7 = document.getElementById('entNFDesconto'); if (el7) el7.value = String(xml.valor_desconto).replace('.', ','); }
      // Buscar/criar fornecedor pelo CNPJ
      if (xml.cnpj_fornecedor) {
        var selForn = document.getElementById('entFornecedor');
        for (var fi = 0; fi < fornecedores.length; fi++) {
          if (fornecedores[fi].cnpj_cpf && fornecedores[fi].cnpj_cpf.replace(/\D/g, '') === xml.cnpj_fornecedor.replace(/\D/g, '')) {
            selForn.value = fornecedores[fi].id; break;
          }
        }
      }
      // Preencher itens
      if (xml.itens && xml.itens.length > 0) {
        Pages._entradaItens = xml.itens.map(function(it) {
          return { produto_nome: it.produto_nome || '', codigo_barras: it.codigo_barras || '', ncm: it.ncm || '', cfop: it.cfop || '', quantidade: it.quantidade || 1, valor_unitario: it.valor_unitario || 0 };
        });
        Pages._refreshEntradaItens();
      }
      // Preencher parcelas
      if (xml.parcelas && xml.parcelas.length > 0) {
        Pages._compraParcelas = xml.parcelas.map(function(p) {
          return { numero_parcela: p.numero_parcela, data_vencimento: p.data_vencimento, valor: p.valor };
        });
        Pages._refreshCompraParcelas();
      }
      Pages._xmlDados = null;
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _entradaItens: [],
  _compraParcelas: [],

  _addItemEntradaNF: function() {
    Pages._entradaItens.push({ produto_nome: '', codigo_barras: '', ncm: '', cfop: '', quantidade: 1, valor_unitario: 0 });
    Pages._refreshEntradaItens();
  },

  _refreshEntradaItens: function() {
    var container = document.getElementById('entNFItens');
    if (!container) return;
    if (Pages._entradaItens.length === 0) {
      container.innerHTML = '<p class="text-muted">Nenhum item adicionado.</p>';
      return;
    }
    var html = Pages._entradaItens.map(function(item, i) {
      var vlTotal = (parseFloat(item.valor_unitario) || 0) * (parseInt(item.quantidade) || 0);
      return '<div style="display:grid;grid-template-columns:2fr 1fr 80px 80px 80px 80px 90px auto;gap:6px;margin-bottom:6px;align-items:end">' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Produto' : '') + '</label>' +
          '<input type="text" class="form-control" placeholder="Nome do produto" value="' + (item.produto_nome || '') + '" ' +
          'data-onchange="Pages._setEntItem(' + i + ',\'produto_nome\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'EAN' : '') + '</label>' +
          '<input type="text" class="form-control" placeholder="Código barras" value="' + (item.codigo_barras || '') + '" ' +
          'data-onchange="Pages._setEntItem(' + i + ',\'codigo_barras\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'NCM' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (item.ncm || '') + '" ' +
          'data-onchange="Pages._setEntItem(' + i + ',\'ncm\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'CFOP' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (item.cfop || '') + '" ' +
          'data-onchange="Pages._setEntItem(' + i + ',\'cfop\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Qtd' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + item.quantidade + '" ' +
          'data-onchange="Pages._setEntItemNum(' + i + ',\'quantidade\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Vlr Unit' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (item.valor_unitario || '') + '" placeholder="0,00" ' +
          'data-onchange="Pages._setEntItemNum(' + i + ',\'valor_unitario\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Total' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + vlTotal.toFixed(2) + '" disabled style="background:var(--bg-secondary);font-weight:600"></div>' +
        '<button class="btn-icon" data-onclick="Pages._removeEntItem(' + i + ')" style="color:var(--danger);margin-bottom:4px"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    }).join('');
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _setEntItem: function(i, field, val) { Pages._entradaItens[i][field] = val; },
  _setEntItemNum: function(i, field, val) {
    Pages._entradaItens[i][field] = parseFloat(String(val).replace(',', '.')) || 0;
    Pages._refreshEntradaItens();
  },
  _removeEntItem: function(i) {
    Pages._entradaItens.splice(i, 1);
    Pages._refreshEntradaItens();
  },

  _addParcelaCompra: function() {
    var num = Pages._compraParcelas.length + 1;
    Pages._compraParcelas.push({ numero_parcela: num, data_vencimento: '', valor: 0 });
    Pages._refreshCompraParcelas();
  },

  _refreshCompraParcelas: function() {
    var container = document.getElementById('entNFParcelas');
    if (!container) return;
    if (Pages._compraParcelas.length === 0) {
      container.innerHTML = '<p class="text-muted">Nenhuma parcela. A vista por padrão.</p>';
      return;
    }
    var html = Pages._compraParcelas.map(function(p, i) {
      return '<div style="display:grid;grid-template-columns:80px 1fr 1fr auto;gap:8px;margin-bottom:6px;align-items:end">' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Parcela' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + p.numero_parcela + '" disabled style="background:var(--bg-secondary);text-align:center"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Vencimento' : '') + '</label>' +
          '<input type="date" class="form-control" value="' + (p.data_vencimento || '') + '" ' +
          'data-onchange="Pages._setParcelaField(' + i + ',\'data_vencimento\',this.value)"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:0.7rem">' + (i === 0 ? 'Valor (R$)' : '') + '</label>' +
          '<input type="text" class="form-control" value="' + (p.valor || '') + '" placeholder="0,00" ' +
          'data-onchange="Pages._setParcelaField(' + i + ',\'valor\',parseFloat(this.value.replace(\',\',\'.\')))"></div>' +
        '<button class="btn-icon" data-onclick="Pages._removeParcela(' + i + ')" style="color:var(--danger);margin-bottom:4px"><i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    }).join('');
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _setParcelaField: function(i, field, val) { Pages._compraParcelas[i][field] = val; },
  _removeParcela: function(i) {
    Pages._compraParcelas.splice(i, 1);
    // Renumerar
    Pages._compraParcelas.forEach(function(p, idx) { p.numero_parcela = idx + 1; });
    Pages._refreshCompraParcelas();
  },

  _confirmarEntradaNF: async function() {
    var fornId = (document.getElementById('entFornecedor') || {}).value;
    if (!fornId) { Toast.error('Selecione um fornecedor'); return; }
    if (Pages._entradaItens.length === 0) { Toast.error('Adicione pelo menos um item'); return; }
    var itensValidos = Pages._entradaItens.filter(function(it) { return it.produto_nome && (parseInt(it.quantidade) || 0) > 0; });
    if (itensValidos.length === 0) { Toast.error('Preencha os dados dos itens'); return; }

    var payload = {
      fornecedor_id: parseInt(fornId),
      numero_nf: (document.getElementById('entNFNum') || {}).value || null,
      serie: (document.getElementById('entNFSerie') || {}).value || '1',
      chave_acesso: (document.getElementById('entNFChave') || {}).value || null,
      data_emissao: (document.getElementById('entNFEmissao') || {}).value || null,
      data_entrada: (document.getElementById('entNFEntrada') || {}).value || new Date().toISOString().split('T')[0],
      valor_total: parseFloat(((document.getElementById('entNFValor') || {}).value || '0').replace(',', '.')) || 0,
      valor_frete: parseFloat(((document.getElementById('entNFFrete') || {}).value || '0').replace(',', '.')) || 0,
      valor_desconto: parseFloat(((document.getElementById('entNFDesconto') || {}).value || '0').replace(',', '.')) || 0,
      observacoes: (document.getElementById('entNFObs') || {}).value || null,
      itens: itensValidos,
      parcelas: Pages._compraParcelas.filter(function(p) { return p.data_vencimento && p.valor > 0; })
    };

    try {
      var result = await App.post('/compras', payload);
      var compraId = result && result.id ? result.id : null;
      Toast.success('Compra criada em status ABERTA com ' + itensValidos.length + ' item(ns). Revise e finalize para dar entrada no estoque.');
      Pages._entradaItens = [];
      Pages._compraParcelas = [];
      Pages._comprasTab = 'notas';
      // Se criou com sucesso, perguntar se quer finalizar agora
      if (compraId && confirm('Compra #' + compraId + ' criada em ABERTA.\nDeseja finalizar agora? (entrada no estoque + lotes + contas)')) {
        try {
          await App.put('/compras/' + compraId + '/finalizar', {});
          Toast.success('Compra finalizada! Estoque atualizado.');
        } catch(ef) {
          Toast.error('Compra criada mas erro ao finalizar: ' + ((ef && ef.error) || ''));
        }
      }
      Pages.compras();
    } catch(e) {
      var msg = (e && e.error) || (e && e.message) || 'Erro ao registrar compra';
      Toast.error(msg);
    }
  },

  // ── Autocomplete de fornecedor ──
  _fornecedoresCache: [],
  _fornecedorSelecionado: null,
  
  _buscarFornecedorAutocomplete: function(query) {
    var list = document.getElementById('entFornecedorList');
    if (!list) return;
    
    if (!query || query.trim().length < 2) {
      list.classList.remove('active');
      Pages._fornecedorSelecionado = null;
      document.getElementById('entFornecedor').value = '';
      return;
    }
    
    var q = query.toLowerCase().trim();
    var filtrados = Pages._fornecedoresCache.filter(function(f) {
      return f.nome.toLowerCase().indexOf(q) !== -1 || 
             (f.cnpj_cpf || '').toLowerCase().replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) !== -1;
    });
    
    if (filtrados.length === 0) {
      list.innerHTML = '<div class="fornecedor-autocomplete-empty">Nenhum fornecedor encontrado</div>';
      list.classList.add('active');
      return;
    }
    
    list.innerHTML = filtrados.map(function(f) {
      return '<div class="fornecedor-autocomplete-item" data-onclick="Pages._selecionarFornecedor(' + f.id + ',\'' + 
        f.nome.replace(/'/g, "\\'") + '\',\'' + (f.cnpj_cpf || '').replace(/'/g, "\\'") + '\')">' +
        '<div class="fornecedor-autocomplete-nome">' + f.nome + '</div>' +
        '<div class="fornecedor-autocomplete-cnpj">' + (f.cnpj_cpf || 'Sem CNPJ') + '</div>' +
      '</div>';
    }).join('');
    list.classList.add('active');
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },
  
  _selecionarFornecedor: function(id, nome, cnpj) {
    document.getElementById('entFornecedorSearch').value = nome + ' | ' + cnpj;
    document.getElementById('entFornecedor').value = id;
    document.getElementById('entFornecedorList').classList.remove('active');
    Pages._fornecedorSelecionado = { id: id, nome: nome, cnpj: cnpj };
  },

  // ── Validações ──
  _validarCNPJ: function(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return false;
    
    // Validar duplicados
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    // Validar dígitos verificadores
    var tamanho = cnpj.length - 2;
    var numeros = cnpj.substring(0, tamanho);
    var digitos = cnpj.substring(tamanho);
    var soma = 0;
    var pos = tamanho - 7;
    
    for (var i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    var resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (var i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;
    
    return true;
  },
  
  _validarEmail: function(email) {
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },
  
  _validarTelefone: function(telefone) {
    var digitos = telefone.replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 11;
  },

  _novoFornecedorModal: function() {
    Modal.show('Cadastrar Novo Fornecedor',
      '<div class="form-group"><label class="form-label">Nome / Razão Social *</label>' +
        '<input type="text" class="form-control" id="nFornNome" placeholder="Nome do fornecedor"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">CNPJ / CPF *</label>' +
          '<input type="text" class="form-control" id="nFornCnpj" placeholder="00.000.000/0000-00" data-oninput="Utils.maskCNPJInput(event)"></div>' +
        '<div class="form-group"><label class="form-label">Telefone</label>' +
          '<input type="text" class="form-control" id="nFornTel" placeholder="(00) 00000-0000" data-oninput="Utils.maskPhoneInput(event)"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Email</label>' +
        '<input type="email" class="form-control" id="nFornEmail" placeholder="fornecedor@email.com"></div>' +
      '<div class="form-group"><label class="form-label">Endereço</label>' +
        '<input type="text" class="form-control" id="nFornEnd" placeholder="Rua, número, bairro"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Cidade</label>' +
          '<input type="text" class="form-control" id="nFornCidade" placeholder="Cidade"></div>' +
        '<div class="form-group" style="max-width:80px"><label class="form-label">UF</label>' +
          '<input type="text" class="form-control" id="nFornUF" placeholder="UF" maxlength="2" style="text-transform:uppercase"></div>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarNovoFornecedor()">Salvar Fornecedor</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarNovoFornecedor: async function() {
    var nome = (document.getElementById('nFornNome') || {}).value.trim();
    var cnpj = (document.getElementById('nFornCnpj') || {}).value.trim();
    var email = (document.getElementById('nFornEmail') || {}).value.trim();
    var telefone = (document.getElementById('nFornTel') || {}).value.trim();
    
    // Validações
    if (!nome || nome.length < 3) {
      Toast.error('Nome/Razão Social deve ter pelo menos 3 caracteres');
      return;
    }
    
    if (!cnpj) {
      Toast.error('CNPJ/CPF é obrigatório');
      return;
    }
    
    // Validar CNPJ (se tiver 14 dígitos)
    var cnpjDigitos = cnpj.replace(/\D/g, '');
    if (cnpjDigitos.length === 14) {
      if (!Pages._validarCNPJ(cnpj)) {
        Toast.error('CNPJ inválido');
        return;
      }
    } else if (cnpjDigitos.length !== 11) {
      Toast.error('CNPJ deve ter 14 dígitos ou CPF 11 dígitos');
      return;
    }
    
    // Validar email se preenchido
    if (email && !Pages._validarEmail(email)) {
      Toast.error('Email inválido');
      return;
    }
    
    // Validar telefone se preenchido
    if (telefone && !Pages._validarTelefone(telefone)) {
      Toast.error('Telefone inválido (deve ter 10 ou 11 dígitos)');
      return;
    }
    
    var data = {
      nome: nome,
      cnpj_cpf: cnpj,
      telefone: telefone,
      email: email,
      endereco: (document.getElementById('nFornEnd') || {}).value.trim() || '',
      cidade: (document.getElementById('nFornCidade') || {}).value.trim() || '',
      estado: (document.getElementById('nFornUF') || {}).value.trim().toUpperCase() || ''
    };
    
    try {
      var result = await App.post('/fornecedores', data);
      Toast.success('Fornecedor cadastrado com sucesso!');
      Modal.close();
      
      // Recarregar a página de entrada para atualizar a lista
      Pages._comprasTab = 'entrada';
      Pages.compras();
      
      // Auto-selecionar o novo fornecedor após recarregar
      if (result && result.id) {
        setTimeout(function() {
          var input = document.getElementById('entFornecedorSearch');
          var hidden = document.getElementById('entFornecedor');
          if (input && hidden) {
            input.value = result.nome + ' | ' + (result.cnpj_cpf || '');
            hidden.value = result.id;
            Pages._fornecedorSelecionado = { 
              id: result.id, 
              nome: result.nome, 
              cnpj: result.cnpj_cpf 
            };
          }
        }, 500);
      }
    } catch(e) {
      Toast.error('Erro ao cadastrar fornecedor: ' + ((e && e.error) || ''));
    }
  },

  // ── Importar XML ──
  _comprasXml: function(menu) {
    Layout.render(
      '<div class="card"><div class="card-body" style="text-align:center;padding:60px 20px">' +
        '<i data-lucide="upload" style="width:64px;height:64px;color:var(--text-muted);margin-bottom:16px"></i>' +
        '<h3 style="margin-bottom:8px">Importar XML de NF-e</h3>' +
        '<p class="text-muted" style="margin-bottom:24px">Arraste o arquivo XML ou clique para selecionar.<br>O sistema irá ler e pré-preencher os dados da nota automaticamente.</p>' +
        '<div style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:40px;cursor:pointer;max-width:500px;margin:0 auto" ' +
          'data-onclick="Pages.triggerXmlFileInput()" ' +
          'data-ondragover="Pages.handleXmlDragOver(event)" ' +
          'data-ondragleave="Pages.handleXmlDragLeave(event)">' +
          '<i data-lucide="file-up" style="width:32px;height:32px;color:var(--primary);margin-bottom:8px"></i>' +
          '<p>Clique ou arraste o arquivo XML aqui</p>' +
          '<input type="file" id="xmlFileInput" accept=".xml" style="display:none" data-onchange="Pages._processarXml(this)">' +
        '</div>' +
        '<div id="xmlPreview" style="margin-top:24px;text-align:left"></div>' +
      '</div></div>',
      { title: 'Compras', moduleMenu: menu }
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _xmlDados: null,

  _processarXml: async function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var xmlContent = e.target.result;
        // Parse no servidor para extrair dados
        var parsed = await App.post('/compras/xml', { xml_content: xmlContent });

        Pages._xmlDados = parsed;
        Pages._xmlDados.xml_original = xmlContent;

        var itensPreview = (parsed.itens || []).slice(0, 5).map(function(it) {
          return '<tr><td>' + (it.produto_nome || '-') + '</td><td>' + (it.codigo_barras || '-') + '</td>' +
            '<td class="text-right">' + it.quantidade + '</td><td class="text-right">' + Utils.currency(it.valor_unitario) + '</td>' +
            '<td class="text-right fw-600">' + Utils.currency(it.valor_total) + '</td></tr>';
        }).join('');
        var maisItens = (parsed.itens || []).length > 5 ? '<tr><td colspan="5" class="text-center text-muted">... e mais ' + ((parsed.itens || []).length - 5) + ' itens</td></tr>' : '';

        var preview = '<div class="card" style="border-color:var(--success)">' +
          '<div class="card-body">' +
            '<h4 style="margin-bottom:12px"><span class="badge badge-success">XML processado com sucesso</span></h4>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
              '<div><span class="text-muted">Emitente:</span> <strong>' + (parsed.fornecedor || '-') + '</strong></div>' +
              '<div><span class="text-muted">CNPJ:</span> <strong>' + (parsed.cnpj_fornecedor || '-') + '</strong></div>' +
              '<div><span class="text-muted">NF:</span> <strong>' + (parsed.numero_nf || '-') + '</strong></div>' +
              '<div><span class="text-muted">Série:</span> <strong>' + (parsed.serie || '1') + '</strong></div>' +
              '<div><span class="text-muted">Emissão:</span> <strong>' + (parsed.data_emissao || '-') + '</strong></div>' +
              '<div><span class="text-muted">Valor Total:</span> <strong style="font-size:1.1em;color:var(--success)">' + Utils.currency(parsed.valor_total) + '</strong></div>' +
              '<div><span class="text-muted">Frete:</span> <strong>' + Utils.currency(parsed.valor_frete) + '</strong></div>' +
              '<div><span class="text-muted">Desconto:</span> <strong>' + Utils.currency(parsed.valor_desconto) + '</strong></div>' +
              '<div><span class="text-muted">Itens:</span> <strong>' + (parsed.itens || []).length + '</strong></div>' +
              '<div><span class="text-muted">Parcelas:</span> <strong>' + (parsed.parcelas || []).length + '</strong></div>' +
            '</div>' +
            (itensPreview ? '<div class="table-container" style="max-height:200px;overflow:auto"><table><thead><tr><th>Produto</th><th>EAN</th><th class="text-right">Qtd</th><th class="text-right">Vlr Unit</th><th class="text-right">Vlr Total</th></tr></thead><tbody>' + itensPreview + maisItens + '</tbody></table></div>' : '') +
            '<div style="margin-top:16px;display:flex;gap:8px">' +
              '<button class="btn btn-success" data-onclick="Pages._comprasTab=\'entrada\';Pages.compras()">' +
                '<i data-lucide="check" style="width:16px;height:16px"></i> Revisar e Confirmar Entrada</button>' +
              '<button class="btn btn-secondary" data-onclick="Pages._xmlDados=null;Pages._comprasTab=\'xml\';Pages.compras()">Cancelar</button>' +
            '</div>' +
          '</div></div>';
        document.getElementById('xmlPreview').innerHTML = preview;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } catch(err) {
        var errMsg = (err && err.error) || (err && err.message) || 'Erro desconhecido';
        Toast.error('Erro ao processar XML: ' + errMsg);
      }
    };
    reader.readAsText(file);
  },

  // ============================================================
  //  BUSCA FLUTUANTE — Overlay de busca global (Ctrl+K)
  // ============================================================
  _buscaFlutuante: function() {
    var overlay = document.createElement('div');
    overlay.className = 'busca-flutuante-overlay';
    overlay.id = 'buscaFlutuanteOverlay';
    overlay.innerHTML =
      '<div class="busca-flutuante-box">' +
        '<div class="busca-flutuante-header">' +
          '<i data-lucide="search" style="width:20px;height:20px;color:var(--text-muted)"></i>' +
          '<input type="text" id="buscaFlutuanteInput" placeholder="Buscar produto por nome ou código..." ' +
            'data-oninput="Pages._doBuscaFlutuante(this.value)" autocomplete="off">' +
          '<kbd>ESC</kbd>' +
        '</div>' +
        '<div class="busca-flutuante-results" id="buscaFlutuanteResults">' +
          '<div style="padding:40px;text-align:center;color:var(--text-muted)">' +
            '<i data-lucide="search" style="width:32px;height:32px;margin-bottom:8px"></i>' +
            '<p>Digite para buscar produtos...</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.classList.add('active'); });
    if (typeof lucide !== 'undefined') lucide.createIcons();

    var input = document.getElementById('buscaFlutuanteInput');
    if (input) setTimeout(function() { input.focus(); }, 100);

    // Fechar com ESC ou clicando fora
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) Pages._fecharBuscaFlutuante();
    });
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') Pages._fecharBuscaFlutuante();
    });
  },

  _fecharBuscaFlutuante: function() {
    var overlay = document.getElementById('buscaFlutuanteOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(function() { overlay.remove(); }, 200);
    }
  },

  _buscaFlutuanteTimeout: null,
  _doBuscaFlutuante: function(valor) {
    clearTimeout(Pages._buscaFlutuanteTimeout);
    var results = document.getElementById('buscaFlutuanteResults');
    if (!valor || valor.length < 2) {
      results.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><p>Digite pelo menos 2 caracteres...</p></div>';
      return;
    }
    results.innerHTML = '<div style="padding:20px;text-align:center"><div class="spinner"></div></div>';
    Pages._buscaFlutuanteTimeout = setTimeout(async function() {
      try {
        var res = await App.get('/produtos?busca=' + encodeURIComponent(valor));
        var produtos = Array.isArray(res) ? res : (res.data || []);
        if (produtos.length === 0) {
          results.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)"><p>Nenhum produto encontrado</p></div>';
          return;
        }
        results.innerHTML = produtos.slice(0, 12).map(function(p) {
          var estClass = parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo) ? 'text-danger' : '';
          return '<div class="busca-flutuante-item" data-onclick="Pages._fecharBuscaFlutuante();Pages.editarProduto(' + p.id + ')">' +
            '<div style="flex:1">' +
              '<div class="fw-500">' + p.nome + '</div>' +
              '<div style="font-size:0.8rem;color:var(--text-muted)">' + (p.codigo_barras || '-') + ' | ' + (p.Categorium ? p.Categorium.nome : '-') + '</div>' +
            '</div>' +
            '<div style="text-align:right">' +
              '<div class="fw-600">' + Utils.currency(p.preco_venda) + '</div>' +
              '<div class="' + estClass + '" style="font-size:0.8rem">Est: ' + Utils.number(p.estoque_atual, 0) + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      } catch(e) { results.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger)">Erro na busca</div>'; }
    }, 300);
  },

  // ============================================================
  //  HELPERS
  // ============================================================
  _formatPayment: function(forma) {
    if (!forma) return '-';
    var map = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', cartao: 'Cartão', voucher: 'Voucher' };
    return map[forma] || forma.charAt(0).toUpperCase() + forma.slice(1);
  },

  // ── Helpers para data-on* (CSP sem unsafe-eval) ──
  selecionarProdutoEstoque: function(id, nome) {
    document.getElementById('estProdId').value = id;
    document.getElementById('estProdBusca').value = nome;
    document.getElementById('estProdResultados').innerHTML = '';
  },
  selecionarMedSngpc: function(id, nome) {
    // Legacy — redirect to new _selecionarProdutoSngpc
    Pages._selecionarProdutoSngpc(id, nome, true);
  },
  selecionarFornEntrada: function(id, nome) {
    var sel = document.getElementById('entFornecedor');
    if (sel) sel.value = id;
  },
  marcarTodasPermissoes: function(val) {
    document.querySelectorAll('.uPerm').forEach(function(c) { c.checked = val; });
  },
  removeEntradaItem: function(i) {
    Pages._removeEntItem(i);
  },
  handleEntradaItemProduto: function(e, i) {
    Pages._setEntItem(i, 'produto_nome', e.target.value);
  },
  handleEntradaItemQtd: function(e, i) {
    Pages._setEntItemNum(i, 'quantidade', e.target.value);
  },
  handleEntradaItemCusto: function(e, i) {
    Pages._setEntItemNum(i, 'valor_unitario', e.target.value);
  },
  triggerXmlFileInput: function() {
    document.getElementById('xmlFileInput').click();
  },
  handleXmlDragOver: function(e) {
    e.preventDefault();
    var el = e.target.closest('[data-ondragover]');
    if (el) el.style.borderColor = 'var(--primary)';
  },
  handleXmlDragLeave: function(e) {
    var el = e.target.closest('[data-ondragleave]');
    if (el) el.style.borderColor = 'var(--border)';
  },

  _switchTab: function(event, tabId) {
    var container = event.target.closest('.module-content') || event.target.closest('.modal-body') || document;
    container.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    container.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    event.target.classList.add('active');
    var el = document.getElementById(tabId);
    if (el) el.classList.add('active');
  },

  // ============================================================
  //  PROGRAMAS COMERCIAIS — Clube, Convênio, Campanha, Tabela
  // ============================================================
  _programasData: [],
  _programaAtual: null,

  programas: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Programas Comerciais' });

    var programas, stats;
    try { 
      programas = await App.get('/programas');
      stats = await App.get('/programas/stats');
    } catch(e) { programas = []; stats = {}; }
    Pages._programasData = programas;

    // Dashboard resumo
    var dashHtml = '<div class="prog-dash" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">' +
      '<div class="card prog-stat-card" style="padding:16px;text-align:center">' +
        '<div style="font-size:1.6rem;font-weight:700;color:var(--primary)">' + (stats.total || 0) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted)">Programas</div></div>' +
      '<div class="card prog-stat-card" style="padding:16px;text-align:center">' +
        '<div style="font-size:1.6rem;font-weight:700;color:var(--success)">' + (stats.ativos || 0) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted)">Ativos</div></div>' +
      '<div class="card prog-stat-card" style="padding:16px;text-align:center">' +
        '<div style="font-size:1.6rem;font-weight:700;color:var(--info)">' + (stats.totalInscritos || 0) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted)">Clientes Inscritos</div></div>' +
      '<div class="card prog-stat-card" style="padding:16px;text-align:center">' +
        '<div style="font-size:1.6rem;font-weight:700;color:var(--warning)">' + (stats.totalRegras || 0) + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-muted)">Regras Ativas</div></div>' +
    '</div>';

    var tipoLabels = { clube: 'Clube', convenio: 'Convênio', campanha: 'Campanha', tabela: 'Tabela' };
    var tipoColors = { clube: 'var(--primary)', convenio: 'var(--info)', campanha: 'var(--warning)', tabela: 'var(--success)' };
    var tipoIcons = { clube: 'crown', convenio: 'handshake', campanha: 'megaphone', tabela: 'list' };

    var cards = programas.map(function(p) {
      var totalRegras = (p.RegraDescontos || []).length;
      var totalClientes = (p.ClienteProgramas || []).filter(function(c) { return c.status === 'ativo'; }).length;
      var statusColor = p.ativo ? 'var(--success)' : 'var(--text-muted)';
      var statusLabel = p.ativo ? 'Ativo' : 'Inativo';
      var vigencia = '';
      if (p.data_inicio || p.data_fim) {
        vigencia = (p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : '∞') + 
                   ' — ' + (p.data_fim ? new Date(p.data_fim).toLocaleDateString('pt-BR') : '∞');
      }

      return '<div class="card clickable" style="padding:20px;cursor:pointer" data-onclick="Pages._detalharPrograma(' + p.id + ')">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:' + (tipoColors[p.tipo] || 'var(--primary)') + '15;color:' + (tipoColors[p.tipo] || 'var(--primary)') + '">' +
            '<i data-lucide="' + (tipoIcons[p.tipo] || 'tag') + '" style="width:20px;height:20px"></i></div>' +
          '<div style="flex:1">' +
            '<h4 style="margin:0;font-size:1rem">' + p.nome + '</h4>' +
            '<span class="badge" style="background:' + (tipoColors[p.tipo] || 'var(--primary)') + '15;color:' + (tipoColors[p.tipo] || 'var(--primary)') + ';font-size:0.7rem">' + (tipoLabels[p.tipo] || p.tipo) + '</span>' +
          '</div>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + '" title="' + statusLabel + '"></span>' +
        '</div>' +
        (p.descricao ? '<p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px">' + p.descricao + '</p>' : '') +
        '<div style="display:flex;gap:16px;font-size:0.8rem;color:var(--text-muted)">' +
          '<span><i data-lucide="percent" style="width:12px;height:12px"></i> ' + totalRegras + ' regra' + (totalRegras !== 1 ? 's' : '') + '</span>' +
          '<span><i data-lucide="users" style="width:12px;height:12px"></i> ' + totalClientes + ' cliente' + (totalClientes !== 1 ? 's' : '') + '</span>' +
          (vigencia ? '<span><i data-lucide="calendar" style="width:12px;height:12px"></i> ' + vigencia + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    if (!cards) {
      cards = '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">' +
        '<i data-lucide="tag" style="width:48px;height:48px;margin-bottom:12px;opacity:0.3"></i>' +
        '<p>Nenhum programa comercial criado</p>' +
        '<p style="font-size:0.85rem">Crie clubes de fidelidade, convênios ou campanhas de desconto.</p>' +
      '</div>';
    }

    Layout.render(
      dashHtml +
      '<div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">' +
        '<div class="search-box" style="flex:1"><span class="search-icon"><i data-lucide="search" style="width:16px;height:16px"></i></span>' +
          '<input type="text" class="form-control" id="programaBusca" placeholder="Buscar programa..." data-oninput="Pages._buscarProgramas(this.value)"></div>' +
        '<button class="btn btn-primary" data-onclick="Pages._novoPrograma()"><i data-lucide="plus" style="width:16px;height:16px"></i> Novo Programa</button>' +
      '</div>' +
      '<div id="programasGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">' + cards + '</div>',
      { title: 'Programas Comerciais' }
    );
  },

  _buscarProgramas: function(busca) {
    busca = (busca || '').toLowerCase();
    var filtrados = (Pages._programasData || []).filter(function(p) {
      return p.nome.toLowerCase().indexOf(busca) !== -1 || (p.tipo && p.tipo.indexOf(busca) !== -1);
    });
    // Re-render the grid with filtered data
    Pages._programasData._filtered = filtrados;
    // Simple approach: reload page with filter
    var tipoLabels = { clube: 'Clube', convenio: 'Convênio', campanha: 'Campanha', tabela: 'Tabela' };
    var tipoColors = { clube: 'var(--primary)', convenio: 'var(--info)', campanha: 'var(--warning)', tabela: 'var(--success)' };
    var tipoIcons = { clube: 'crown', convenio: 'handshake', campanha: 'megaphone', tabela: 'list' };
    var cards = filtrados.map(function(p) {
      var totalRegras = (p.RegraDescontos || []).length;
      var totalClientes = (p.ClienteProgramas || []).filter(function(c) { return c.status === 'ativo'; }).length;
      var statusColor = p.ativo ? 'var(--success)' : 'var(--text-muted)';
      return '<div class="card clickable" style="padding:20px;cursor:pointer" data-onclick="Pages._detalharPrograma(' + p.id + ')">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
          '<div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:' + (tipoColors[p.tipo] || 'var(--primary)') + '15;color:' + (tipoColors[p.tipo] || 'var(--primary)') + '">' +
            '<i data-lucide="' + (tipoIcons[p.tipo] || 'tag') + '" style="width:20px;height:20px"></i></div>' +
          '<div style="flex:1"><h4 style="margin:0;font-size:1rem">' + p.nome + '</h4>' +
            '<span class="badge" style="background:' + (tipoColors[p.tipo] || 'var(--primary)') + '15;color:' + (tipoColors[p.tipo] || 'var(--primary)') + ';font-size:0.7rem">' + (tipoLabels[p.tipo] || p.tipo) + '</span></div>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + statusColor + '"></span></div>' +
        '<div style="display:flex;gap:16px;font-size:0.8rem;color:var(--text-muted)">' +
          '<span>' + totalRegras + ' regra(s)</span><span>' + totalClientes + ' cliente(s)</span></div></div>';
    }).join('');
    document.getElementById('programasGrid').innerHTML = cards || '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">Nenhum resultado</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  _novoPrograma: function() {
    Modal.show('Novo Programa Comercial',
      '<div class="form-group"><label class="form-label">Nome *</label>' +
        '<input type="text" class="form-control" id="progNome" placeholder="Ex: Clube de Fidelidade"></div>' +
      '<div class="form-group"><label class="form-label">Tipo</label>' +
        '<select class="form-control" id="progTipo">' +
          '<option value="clube">Clube de Fidelidade</option>' +
          '<option value="convenio">Convênio</option>' +
          '<option value="campanha">Campanha Promocional</option>' +
          '<option value="tabela">Tabela de Preços</option></select></div>' +
      '<div class="form-group"><label class="form-label">Descrição</label>' +
        '<textarea class="form-control" id="progDescricao" rows="2" placeholder="Descrição opcional"></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-group"><label class="form-label">Data Início</label>' +
          '<input type="date" class="form-control" id="progDataInicio"></div>' +
        '<div class="form-group"><label class="form-label">Data Fim</label>' +
          '<input type="date" class="form-control" id="progDataFim"></div></div>' +
      '<div class="form-group"><label class="form-label">Prioridade</label>' +
        '<input type="number" class="form-control" id="progPrioridade" value="0" min="0" max="100">' +
        '<small class="text-muted">0 = máxima prioridade (menor número é aplicado primeiro)</small></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="progAcumulativo"> Acumulativo (descontos somam com outros programas)</label></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="progPadrao"> Programa Padrão (todo novo cliente é inscrito automaticamente)</label></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarPrograma()">Criar Programa</button>',
      'modal-md'
    );
  },

  _salvarPrograma: async function() {
    var nome = (document.getElementById('progNome') || {}).value;
    if (!nome) { Toast.error('Nome é obrigatório'); return; }
    try {
      await App.post('/programas', {
        nome: nome,
        tipo: (document.getElementById('progTipo') || {}).value || 'clube',
        descricao: (document.getElementById('progDescricao') || {}).value || '',
        data_inicio: (document.getElementById('progDataInicio') || {}).value || null,
        data_fim: (document.getElementById('progDataFim') || {}).value || null,
        prioridade: parseInt((document.getElementById('progPrioridade') || {}).value) || 0,
        acumulativo: (document.getElementById('progAcumulativo') || {}).checked || false,
        programa_padrao: (document.getElementById('progPadrao') || {}).checked || false
      });
      Toast.success('Programa criado!');
      Modal.close();
      Pages.programas();
    } catch(e) { Toast.error('Erro ao criar programa'); }
  },

  _detalharPrograma: async function(id) {
    try {
      var prog = await App.get('/programas/' + id);
      Pages._programaAtual = prog;

      // Regras
      var regras = (prog.RegraDescontos || []);
      var tipoRegraLabels = { percentual: '% Desconto', valor_fixo: 'R$ Fixo', preco_especial: 'Preço Especial' };
      var escopoLabels = { produto: 'Produto', categoria: 'Categoria', geral: 'Geral' };

      var regrasHtml = regras.length > 0 ? '<table><thead><tr><th>Tipo</th><th>Escopo</th><th>Alvo</th><th>Valor</th><th>Vigência</th><th>Acum.</th><th>Ativo</th><th></th></tr></thead><tbody>' +
        regras.map(function(r) {
          var alvo = r.escopo === 'geral' ? 'Todos' : (r.Produto ? Pages._escHtml(r.Produto.nome) : (r.Categoria ? Pages._escHtml(r.Categoria.nome) : '-'));
          var valorDisplay = r.tipo_regra === 'percentual' ? r.valor + '%' : Utils.currency(r.valor);
          var vigencia = '';
          if (r.data_inicio || r.data_fim) {
            var di = r.data_inicio ? new Date(r.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '...';
            var df = r.data_fim ? new Date(r.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '...';
            vigencia = '<small>' + di + ' a ' + df + '</small>';
          } else {
            vigencia = '<small class="text-muted">Permanente</small>';
          }
          return '<tr><td>' + (tipoRegraLabels[r.tipo_regra] || r.tipo_regra) + '</td>' +
            '<td>' + (escopoLabels[r.escopo] || r.escopo) + '</td>' +
            '<td>' + alvo + '</td>' +
            '<td class="fw-600">' + valorDisplay + '</td>' +
            '<td>' + vigencia + '</td>' +
            '<td>' + (r.acumulativo ? '<span style="color:var(--info)">✓</span>' : '-') + '</td>' +
            '<td>' + (r.ativo ? '<span style="color:var(--success)">Sim</span>' : '<span style="color:var(--text-muted)">Não</span>') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn-icon" data-onclick="Pages._editarRegra(' + r.id + ',' + id + ')" title="Editar">' +
                '<i data-lucide="pencil" style="width:14px;height:14px"></i></button>' +
              '<button class="btn-icon text-danger" data-onclick="Pages._removerRegra(' + r.id + ',' + id + ')" title="Remover">' +
                '<i data-lucide="trash-2" style="width:14px;height:14px"></i></button></td></tr>';
        }).join('') + '</tbody></table>' :
        '<p class="text-muted" style="text-align:center;padding:20px">Nenhuma regra de desconto. Adicione regras para ativar descontos automáticos.</p>';

      // Clientes inscritos
      var inscritos = (prog.ClienteProgramas || []).filter(function(cp) { return cp.status === 'ativo'; });
      var clientesHtml = inscritos.length > 0 ? '<table><thead><tr><th>Cliente</th><th>CPF</th><th>Telefone</th><th>Adesão</th><th></th></tr></thead><tbody>' +
        inscritos.map(function(cp) {
          var cl = cp.Cliente || {};
          return '<tr><td class="fw-500">' + Pages._escHtml(cl.nome || '-') + '</td>' +
            '<td>' + (cl.cpf ? Utils.maskCPF(cl.cpf) : '-') + '</td>' +
            '<td>' + Pages._escHtml(cl.telefone || '-') + '</td>' +
            '<td>' + (cp.data_adesao ? new Date(cp.data_adesao).toLocaleDateString('pt-BR') : '-') + '</td>' +
            '<td><button class="btn-icon text-danger" data-onclick="Pages._removerClientePrograma(' + id + ',' + cl.id + ')" title="Remover">' +
              '<i data-lucide="user-minus" style="width:14px;height:14px"></i></button></td></tr>';
        }).join('') + '</tbody></table>' :
        '<p class="text-muted" style="text-align:center;padding:20px">Nenhum cliente inscrito neste programa.</p>';

      var tipoLabels = { clube: 'Clube', convenio: 'Convênio', campanha: 'Campanha', tabela: 'Tabela' };
      var tipoColors = { clube: '--primary', convenio: '--info', campanha: '--warning', tabela: '--secondary' };
      var corTipo = tipoColors[prog.tipo] || '--primary';

      // Dados para aba Visão Geral
      var dataInicio = prog.data_inicio ? new Date(prog.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '<span class="text-muted">Sem data</span>';
      var dataFim = prog.data_fim ? new Date(prog.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '<span class="text-muted">Sem data</span>';

      var visaoGeralHtml =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px 32px;margin-bottom:20px">' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Nome</label>' +
            '<span style="font-size:1.05rem;font-weight:600;color:var(--text)">' + Pages._escHtml(prog.nome) + '</span>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Tipo</label>' +
            '<span class="badge" style="background:color-mix(in srgb, var(' + corTipo + ') 15%, transparent);color:var(' + corTipo + ')">' + (tipoLabels[prog.tipo] || prog.tipo) + '</span>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Status</label>' +
            '<span class="badge" style="background:' + (prog.ativo ? 'color-mix(in srgb, var(--success) 15%, transparent);color:var(--success)' : 'var(--bg-alt);color:var(--text-muted)') + '">' +
              (prog.ativo ? '● Ativo' : '● Inativo') + '</span>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Programa Padrão</label>' +
            (prog.programa_padrao
              ? '<span class="badge" style="background:color-mix(in srgb, var(--warning) 15%, transparent);color:var(--warning)">⭐ Sim — inscrição automática</span>'
              : '<span class="text-muted">Não</span>') +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Prioridade</label>' +
            '<span style="font-size:1.3rem;font-weight:700;color:var(--text)">' + (prog.prioridade_global || 0) + '</span>' +
            '<small style="margin-left:6px;color:var(--text-muted)">0 = máxima prioridade</small>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Acumulativo</label>' +
            (prog.acumulativo_global
              ? '<span style="color:var(--info);font-weight:500">✓ Sim — descontos somam com outros programas</span>'
              : '<span class="text-muted">Não</span>') +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Data Início</label>' +
            '<span>' + dataInicio + '</span>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:4px;display:block">Data Fim</label>' +
            '<span>' + dataFim + '</span>' +
          '</div>' +
        '</div>' +
        (prog.descricao
          ? '<div style="border-top:1px solid var(--border);padding-top:16px">' +
              '<label style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px;display:block">Descrição</label>' +
              '<p style="color:var(--text);margin:0;line-height:1.6">' + Pages._escHtml(prog.descricao) + '</p>' +
            '</div>'
          : '');

      Modal.show(prog.nome,
        // Tabs
        '<div class="tabs">' +
          '<button class="tab active" data-onclick="Pages._switchTab(event,\'progTabVisao\')">Visão Geral</button>' +
          '<button class="tab" data-onclick="Pages._switchTab(event,\'progTabRegras\')">Regras (' + regras.length + ')</button>' +
          '<button class="tab" data-onclick="Pages._switchTab(event,\'progTabClientes\')">Clientes (' + inscritos.length + ')</button>' +
        '</div>' +

        // Tab: Visão Geral
        '<div class="tab-content active" id="progTabVisao">' +
          visaoGeralHtml +
        '</div>' +

        // Tab: Regras
        '<div class="tab-content" id="progTabRegras">' +
          '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-sm btn-primary" data-onclick="Pages._novaRegraDesconto(' + id + ')">' +
              '<i data-lucide="plus" style="width:14px;height:14px"></i> Adicionar Regra</button>' +
            '<button class="btn btn-sm btn-outline" style="border-color:var(--info);color:var(--info)" data-onclick="Pages._imprimirEtiquetasPrograma(' + id + ')">' +
              '<i data-lucide="printer" style="width:14px;height:14px"></i> Imprimir Etiquetas</button>' +
          '</div>' +
          '<div class="table-container">' + regrasHtml + '</div>' +
        '</div>' +

        // Tab: Clientes
        '<div class="tab-content" id="progTabClientes">' +
          '<div style="margin-bottom:12px"><button class="btn btn-sm btn-primary" data-onclick="Pages._inscreverCliente(' + id + ')">' +
            '<i data-lucide="user-plus" style="width:14px;height:14px"></i> Inscrever Cliente</button></div>' +
          '<div class="table-container">' + clientesHtml + '</div>' +
        '</div>',

        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-secondary" data-onclick="Pages._editarPrograma(' + id + ')"><i data-lucide="edit" style="width:14px;height:14px"></i> Editar</button>' +
          '<button class="btn btn-' + (prog.ativo ? 'warning' : 'success') + '" data-onclick="Pages._toggleAtivoPrograma(' + id + ',' + !prog.ativo + ')">' +
            '<i data-lucide="' + (prog.ativo ? 'pause' : 'play') + '" style="width:14px;height:14px"></i> ' + (prog.ativo ? 'Desativar' : 'Ativar') + '</button>' +
          '<button class="btn btn-danger" data-onclick="Pages._excluirPrograma(' + id + ')"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Excluir</button>' +
        '</div>',
        'modal-lg'
      );
    } catch(e) {
      console.error(e);
      Toast.error('Erro ao carregar detalhes');
    }
  },

  _editarPrograma: function(id) {
    var prog = Pages._programaAtual;
    if (!prog) return;
    Modal.show('Editar Programa',
      '<div class="form-group"><label class="form-label">Nome *</label>' +
        '<input type="text" class="form-control" id="progEditNome" value="' + (prog.nome || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">Tipo</label>' +
        '<select class="form-control" id="progEditTipo">' +
          '<option value="clube"' + (prog.tipo === 'clube' ? ' selected' : '') + '>Clube de Fidelidade</option>' +
          '<option value="convenio"' + (prog.tipo === 'convenio' ? ' selected' : '') + '>Convênio</option>' +
          '<option value="campanha"' + (prog.tipo === 'campanha' ? ' selected' : '') + '>Campanha Promocional</option>' +
          '<option value="tabela"' + (prog.tipo === 'tabela' ? ' selected' : '') + '>Tabela de Preços</option></select></div>' +
      '<div class="form-group"><label class="form-label">Descrição</label>' +
        '<textarea class="form-control" id="progEditDescricao" rows="2">' + (prog.descricao || '') + '</textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-group"><label class="form-label">Data Início</label>' +
          '<input type="date" class="form-control" id="progEditDataInicio" value="' + (prog.data_inicio || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Data Fim</label>' +
          '<input type="date" class="form-control" id="progEditDataFim" value="' + (prog.data_fim || '') + '"></div></div>' +
      '<div class="form-group"><label class="form-label">Prioridade</label>' +
        '<input type="number" class="form-control" id="progEditPrioridade" value="' + (prog.prioridade_global || 0) + '" min="0" max="100">' +
        '<small class="text-muted">0 = máxima prioridade (menor número é aplicado primeiro)</small></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="progEditAcumulativo"' + (prog.acumulativo_global ? ' checked' : '') + '> Acumulativo</label></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="progEditPadrao"' + (prog.programa_padrao ? ' checked' : '') + '> Programa Padrão (inscrição automática)</label></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarEdicaoPrograma(' + id + ')">Salvar</button>',
      'modal-md'
    );
  },

  _salvarEdicaoPrograma: async function(id) {
    try {
      await App.put('/programas/' + id, {
        nome: (document.getElementById('progEditNome') || {}).value,
        tipo: (document.getElementById('progEditTipo') || {}).value,
        descricao: (document.getElementById('progEditDescricao') || {}).value,
        data_inicio: (document.getElementById('progEditDataInicio') || {}).value || null,
        data_fim: (document.getElementById('progEditDataFim') || {}).value || null,
        prioridade: parseInt((document.getElementById('progEditPrioridade') || {}).value) || 0,
        acumulativo: (document.getElementById('progEditAcumulativo') || {}).checked || false,
        programa_padrao: (document.getElementById('progEditPadrao') || {}).checked || false
      });
      Toast.success('Programa atualizado');
      Modal.close();
      Pages.programas();
    } catch(e) { Toast.error('Erro ao atualizar programa'); }
  },

  _toggleAtivoPrograma: async function(id, novoStatus) {
    try {
      await App.put('/programas/' + id, { ativo: novoStatus });
      Toast.success(novoStatus ? 'Programa ativado' : 'Programa desativado');
      Modal.close();
      Pages.programas();
    } catch(e) { Toast.error('Erro ao alterar status'); }
  },

  _excluirPrograma: function(id) {
    UI.confirm('Excluir Programa', 'Tem certeza que deseja excluir este programa e todas as regras? Esta ação é irreversível.', async function() {
      try {
        await App.delete('/programas/' + id);
        Toast.success('Programa excluído');
        Modal.close();
        Pages.programas();
      } catch(e) { Toast.error('Erro ao excluir'); }
    }, { confirmText: 'Excluir', danger: true });
  },

  // ── Regras de Desconto ──
  _novaRegraDesconto: function(programaId) {
    Modal.show('Nova Regra de Desconto',
      '<div class="form-group"><label class="form-label">Tipo de Regra</label>' +
        '<select class="form-control" id="regraTipo" data-onchange="Pages._onRegraEscopoChange()">' +
          '<option value="percentual">Desconto Percentual (%)</option>' +
          '<option value="valor_fixo">Desconto Fixo (R$)</option>' +
          '<option value="preco_especial">Preço Especial</option></select></div>' +
      '<div class="form-group"><label class="form-label">Escopo</label>' +
        '<select class="form-control" id="regraEscopo" data-onchange="Pages._onRegraEscopoChange()">' +
          '<option value="produto">Produto Específico</option>' +
          '<option value="categoria">Categoria Inteira</option>' +
          '<option value="geral">Geral (todos os produtos)</option></select></div>' +
      '<div class="form-group" id="regraProdutoGroup">' +
        '<label class="form-label">Produto</label>' +
        '<input type="text" class="form-control" id="regraProdutoBusca" placeholder="Buscar produto..." data-oninput="Pages._buscarProdutoRegra(this.value)">' +
        '<div id="regraProdutoResultados" style="max-height:150px;overflow-y:auto;margin-top:4px"></div>' +
        '<input type="hidden" id="regraProdutoId"></div>' +
      '<div class="form-group" id="regraCategoriaGroup" style="display:none">' +
        '<label class="form-label">Categoria</label>' +
        '<select class="form-control" id="regraCategoriaId"><option value="">Carregando...</option></select></div>' +
      '<div class="form-group"><label class="form-label" id="regraValorLabel">Valor do Desconto (%)</label>' +
        '<input type="text" class="form-control" id="regraValor" placeholder="Ex: 10" data-oninput="Utils.maskNumericInput(event)"></div>' +
      '<div class="form-group"><label class="form-label">Prioridade</label>' +
        '<input type="number" class="form-control" id="regraPrioridade" value="0" min="0" max="100"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-group"><label class="form-label">Vigência Início</label>' +
          '<input type="date" class="form-control" id="regraDataInicio"></div>' +
        '<div class="form-group"><label class="form-label">Vigência Fim</label>' +
          '<input type="date" class="form-control" id="regraDataFim"></div></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:6px;cursor:pointer">' +
        '<input type="checkbox" id="regraAcumulativo"> Regra acumulativa (soma com outras regras)</label></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarRegra(' + programaId + ')">Adicionar Regra</button>'
    );

    // Carregar categorias
    App.get('/categorias').then(function(cats) {
      cats = Array.isArray(cats) ? cats : (cats.data || []);
      var sel = document.getElementById('regraCategoriaId');
      if (sel) sel.innerHTML = '<option value="">Selecione...</option>' + cats.map(function(c) { return '<option value="' + c.id + '">' + c.nome + '</option>'; }).join('');
    }).catch(function() {});
  },

  _onRegraEscopoChange: function(suffix) {
    suffix = suffix || '';
    var escopo = (document.getElementById('regra' + suffix + 'Escopo') || {}).value;
    var tipo = (document.getElementById('regra' + suffix + 'Tipo') || {}).value;
    var prodGrp = document.getElementById('regra' + suffix + 'ProdutoGroup');
    var catGrp = document.getElementById('regra' + suffix + 'CategoriaGroup');
    var valorLabel = document.getElementById('regra' + suffix + 'ValorLabel');

    if (prodGrp) prodGrp.style.display = escopo === 'produto' ? '' : 'none';
    if (catGrp) catGrp.style.display = escopo === 'categoria' ? '' : 'none';
    if (valorLabel) {
      if (tipo === 'percentual') valorLabel.textContent = 'Valor do Desconto (%)';
      else if (tipo === 'valor_fixo') valorLabel.textContent = 'Valor do Desconto (R$)';
      else valorLabel.textContent = 'Preço Especial (R$)';
    }
  },

  _buscarProdutoRegra: async function(busca, suffix) {
    suffix = suffix || '';
    var container = document.getElementById('regra' + suffix + 'ProdutoResultados');
    if (!container || !busca || busca.length < 2) { if (container) container.innerHTML = ''; return; }
    try {
      var res = await App.get('/produtos?busca=' + encodeURIComponent(busca));
      var produtos = Array.isArray(res) ? res : (res.data || []);
      container.innerHTML = produtos.slice(0, 8).map(function(p) {
        return '<div class="pdv-search-result-item" style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--border)" ' +
          'data-onclick="Pages._selecionarProdutoRegra(' + p.id + ',\'' + Pages._escHtml(p.nome).replace(/'/g, "\\'") + '\',\'' + suffix + '\')">' +
          '<strong>' + Pages._escHtml(p.nome) + '</strong> <span class="text-muted">' + Utils.currency(p.preco_venda) + '</span></div>';
      }).join('') || '<div style="padding:8px;color:var(--text-muted)">Nenhum produto encontrado</div>';
    } catch(e) { container.innerHTML = ''; }
  },

  _selecionarProdutoRegra: function(id, nome, suffix) {
    suffix = suffix || '';
    document.getElementById('regra' + suffix + 'ProdutoId').value = id;
    document.getElementById('regra' + suffix + 'ProdutoBusca').value = nome;
    document.getElementById('regra' + suffix + 'ProdutoResultados').innerHTML = '';
  },

  _salvarRegra: async function(programaId) {
    var escopo = (document.getElementById('regraEscopo') || {}).value;
    var valor = parseFloat(((document.getElementById('regraValor') || {}).value || '0').replace(',', '.'));
    if (!valor) { Toast.error('Informe o valor da regra'); return; }

    var data = {
      tipo_regra: (document.getElementById('regraTipo') || {}).value || 'percentual',
      escopo: escopo,
      valor: valor,
      prioridade: parseInt((document.getElementById('regraPrioridade') || {}).value) || 0,
      acumulativo: (document.getElementById('regraAcumulativo') || {}).checked || false,
      data_inicio: (document.getElementById('regraDataInicio') || {}).value || null,
      data_fim: (document.getElementById('regraDataFim') || {}).value || null
    };

    if (escopo === 'produto') {
      data.produto_id = parseInt((document.getElementById('regraProdutoId') || {}).value);
      if (!data.produto_id) { Toast.error('Selecione um produto'); return; }
    } else if (escopo === 'categoria') {
      data.categoria_id = parseInt((document.getElementById('regraCategoriaId') || {}).value);
      if (!data.categoria_id) { Toast.error('Selecione uma categoria'); return; }
    }

    try {
      await App.post('/programas/' + programaId + '/regras', data);
      Toast.success('Regra adicionada!');
      Modal.close();
      Pages._detalharPrograma(programaId);
    } catch(e) { Toast.error('Erro ao criar regra'); }
  },

  _removerRegra: function(regraId, programaId) {
    UI.confirm('Remover Regra', 'Remover esta regra de desconto?', async function() {
      try {
        await App.delete('/programas/regras/' + regraId);
        Toast.success('Regra removida');
        Modal.close();
        Pages._detalharPrograma(programaId);
      } catch(e) { Toast.error('Erro ao remover regra'); }
    }, { confirmText: 'Remover', danger: true });
  },

  // ── Inscrição de Clientes ──
  _inscreverCliente: async function(programaId) {
    try {
      var res = await App.get('/clientes');
      var clientes = Array.isArray(res) ? res : (res.data || []);

      // Marcar quais já estão no programa
      var progData = Pages._programaAtual;
      var inscritosIds = ((progData && progData.ClienteProgramas) || [])
        .filter(function(cp) { return cp.status === 'ativo'; })
        .map(function(cp) { return cp.cliente_id || (cp.Cliente && cp.Cliente.id); });

      var disponiveis = clientes.filter(function(c) { return inscritosIds.indexOf(c.id) === -1; });

      if (disponiveis.length === 0) {
        Toast.info('Todos os clientes já estão inscritos');
        return;
      }

      var listaHtml = disponiveis.map(function(c) {
        return '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">' +
          '<input type="checkbox" value="' + c.id + '" class="prog-cl-check" style="width:18px;height:18px">' +
          '<div><strong>' + c.nome + '</strong><br><small class="text-muted">' + (c.cpf || 'Sem CPF') + ' · ' + (c.telefone || '') + '</small></div></label>';
      }).join('');

      Modal.show('Inscrever Clientes',
        '<p style="color:var(--text-muted);margin-bottom:12px">Selecione os clientes para inscrever no programa:</p>' +
        '<div style="max-height:350px;overflow-y:auto">' + listaHtml + '</div>',
        '<button class="btn btn-primary" data-onclick="Pages._confirmarInscricao(' + programaId + ')">Inscrever Selecionados</button>'
      );
    } catch(e) { Toast.error('Erro ao carregar clientes'); }
  },

  _confirmarInscricao: async function(programaId) {
    var checks = document.querySelectorAll('.prog-cl-check:checked');
    if (checks.length === 0) { Toast.warning('Selecione ao menos um cliente'); return; }
    var ids = [];
    checks.forEach(function(el) { ids.push(parseInt(el.value)); });

    try {
      var result = await App.post('/programas/' + programaId + '/clientes', { cliente_ids: ids });
      Toast.success(result.mensagem || 'Clientes inscritos');
      Modal.close();
      Pages._detalharPrograma(programaId);
    } catch(e) { Toast.error('Erro ao inscrever clientes'); }
  },

  _removerClientePrograma: function(programaId, clienteId) {
    UI.confirm('Remover Cliente', 'Remover este cliente do programa?', async function() {
      try {
        await App.delete('/programas/' + programaId + '/clientes/' + clienteId);
        Toast.success('Cliente removido do programa');
        Modal.close();
        Pages._detalharPrograma(programaId);
      } catch(e) { Toast.error('Erro ao remover'); }
    }, { confirmText: 'Remover', danger: true });
  },

  // ── Utilitário XSS ──
  _escHtml: function(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  // ── Editar Regra de Desconto ──
  _editarRegra: function(regraId, programaId) {
    var prog = Pages._programaAtual;
    if (!prog) return;
    var regra = (prog.RegraDescontos || []).find(function(r) { return r.id === regraId; });
    if (!regra) { Toast.error('Regra não encontrada'); return; }

    var tipoLabels = { percentual: 'Desconto Percentual (%)', valor_fixo: 'Desconto Fixo (R$)', preco_especial: 'Preço Especial' };
    var produtoDisplay = regra.escopo === 'produto' && regra.Produto ? regra.Produto.nome : '';

    Modal.show('Editar Regra de Desconto',
      '<div class="form-group"><label class="form-label">Tipo de Regra</label>' +
        '<select class="form-control" id="regraEditTipo" data-onchange="Pages._onRegraEscopoChange(\'Edit\')">' +
          '<option value="percentual"' + (regra.tipo_regra === 'percentual' ? ' selected' : '') + '>Desconto Percentual (%)</option>' +
          '<option value="valor_fixo"' + (regra.tipo_regra === 'valor_fixo' ? ' selected' : '') + '>Desconto Fixo (R$)</option>' +
          '<option value="preco_especial"' + (regra.tipo_regra === 'preco_especial' ? ' selected' : '') + '>Preço Especial</option></select></div>' +
      '<div class="form-group"><label class="form-label">Escopo</label>' +
        '<select class="form-control" id="regraEditEscopo" data-onchange="Pages._onRegraEscopoChange(\'Edit\')">' +
          '<option value="produto"' + (regra.escopo === 'produto' ? ' selected' : '') + '>Produto Específico</option>' +
          '<option value="categoria"' + (regra.escopo === 'categoria' ? ' selected' : '') + '>Categoria Inteira</option>' +
          '<option value="geral"' + (regra.escopo === 'geral' ? ' selected' : '') + '>Geral (todos)</option></select></div>' +
      '<div class="form-group" id="regraEditProdutoGroup"' + (regra.escopo !== 'produto' ? ' style="display:none"' : '') + '>' +
        '<label class="form-label">Produto</label>' +
        '<input type="text" class="form-control" id="regraEditProdutoBusca" placeholder="Buscar..." value="' + Pages._escHtml(produtoDisplay) + '" data-oninput="Pages._buscarProdutoRegra(this.value,\'Edit\')">' +
        '<div id="regraEditProdutoResultados" style="max-height:150px;overflow-y:auto;margin-top:4px"></div>' +
        '<input type="hidden" id="regraEditProdutoId" value="' + (regra.produto_id || '') + '"></div>' +
      '<div class="form-group" id="regraEditCategoriaGroup"' + (regra.escopo !== 'categoria' ? ' style="display:none"' : '') + '>' +
        '<label class="form-label">Categoria</label>' +
        '<select class="form-control" id="regraEditCategoriaId"><option value="">Carregando...</option></select></div>' +
      '<div class="form-group"><label class="form-label" id="regraEditValorLabel">' + (tipoLabels[regra.tipo_regra] || 'Valor') + '</label>' +
        '<input type="text" class="form-control" id="regraEditValor" value="' + regra.valor + '"></div>' +
      '<div class="form-group"><label class="form-label">Prioridade</label>' +
        '<input type="number" class="form-control" id="regraEditPrioridade" value="' + (regra.prioridade || 0) + '" min="0" max="100"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div class="form-group"><label class="form-label">Vigência Início</label>' +
          '<input type="date" class="form-control" id="regraEditDataInicio" value="' + (regra.data_inicio || '') + '"></div>' +
        '<div class="form-group"><label class="form-label">Vigência Fim</label>' +
          '<input type="date" class="form-control" id="regraEditDataFim" value="' + (regra.data_fim || '') + '"></div></div>' +
      '<div style="display:flex;gap:16px;align-items:center">' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="regraEditAcumulativo"' + (regra.acumulativo ? ' checked' : '') + '> Acumulativo</label>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="regraEditAtivo"' + (regra.ativo !== false ? ' checked' : '') + '> Ativo</label>' +
      '</div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarEdicaoRegra(' + regraId + ',' + programaId + ')">Salvar</button>'
    );

    // Carregar categorias e selecionar a atual
    App.get('/categorias').then(function(cats) {
      cats = Array.isArray(cats) ? cats : (cats.data || []);
      var sel = document.getElementById('regraEditCategoriaId');
      if (sel) sel.innerHTML = '<option value="">Selecione...</option>' + cats.map(function(c) {
        return '<option value="' + c.id + '"' + (c.id === regra.categoria_id ? ' selected' : '') + '>' + c.nome + '</option>';
      }).join('');
    }).catch(function() {});
  },

  _salvarEdicaoRegra: async function(regraId, programaId) {
    var valor = parseFloat(((document.getElementById('regraEditValor') || {}).value || '0').replace(',', '.'));
    if (isNaN(valor) || valor < 0) { Toast.error('Valor inválido'); return; }

    var escopo = (document.getElementById('regraEditEscopo') || {}).value;
    var data = {
      tipo_regra: (document.getElementById('regraEditTipo') || {}).value,
      escopo: escopo,
      valor: valor,
      prioridade: parseInt((document.getElementById('regraEditPrioridade') || {}).value) || 0,
      acumulativo: (document.getElementById('regraEditAcumulativo') || {}).checked || false,
      ativo: (document.getElementById('regraEditAtivo') || {}).checked !== false,
      data_inicio: (document.getElementById('regraEditDataInicio') || {}).value || null,
      data_fim: (document.getElementById('regraEditDataFim') || {}).value || null
    };
    if (escopo === 'produto') {
      data.produto_id = parseInt((document.getElementById('regraEditProdutoId') || {}).value);
      if (!data.produto_id) { Toast.error('Selecione um produto'); return; }
    } else if (escopo === 'categoria') {
      data.categoria_id = parseInt((document.getElementById('regraEditCategoriaId') || {}).value);
      if (!data.categoria_id) { Toast.error('Selecione uma categoria'); return; }
    }

    try {
      await App.put('/programas/regras/' + regraId, data);
      Toast.success('Regra atualizada!');
      Modal.close();
      Pages._detalharPrograma(programaId);
    } catch(e) { Toast.error((e && e.error) || 'Erro ao atualizar regra'); }
  },

  // ============================================================
  //  ETIQUETAS — módulo independente de impressão
  // ============================================================
  _etiquetasTab: 'padrao',
  _modelosEtiqueta: [],
  _etiquetasProdutos: [],
  _configImpressao: null,

  etiquetas: async function() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', { title: 'Etiquetas' });

    // Carregar modelos, produtos e config
    try {
      Pages._modelosEtiqueta = await App.get('/etiquetas') || [];
    } catch(e) { Pages._modelosEtiqueta = []; }
    try {
      Pages._etiquetasProdutos = await App.get('/produtos') || [];
      if (!Array.isArray(Pages._etiquetasProdutos)) Pages._etiquetasProdutos = Pages._etiquetasProdutos.data || [];
    } catch(e) { Pages._etiquetasProdutos = []; }
    try {
      Pages._configImpressao = await App.get('/etiquetas/config-impressao/atual') || null;
    } catch(e) { Pages._configImpressao = null; }

    // Seed modelos se vazio
    if (Pages._modelosEtiqueta.length === 0) {
      try {
        await App.post('/etiquetas/seed', {});
        Pages._modelosEtiqueta = await App.get('/etiquetas') || [];
      } catch(e) {}
    }

    Pages._renderEtiquetas();
  },

  _renderEtiquetas: function() {
    var tab = Pages._etiquetasTab || 'padrao';
    var modelos = Pages._modelosEtiqueta || [];
    var produtos = Pages._etiquetasProdutos || [];

    var tipoLabels = { padrao: 'Padrão', promocional: 'Promocional', clube: 'Clube Fidelidade' };
    var tipoColors = { padrao: 'var(--text-secondary)', promocional: 'var(--danger)', clube: 'var(--primary)' };

    // Stats cards
    var totalPadrao = modelos.filter(function(m) { return m.tipo === 'padrao'; }).length;
    var totalPromo = modelos.filter(function(m) { return m.tipo === 'promocional'; }).length;
    var totalClube = modelos.filter(function(m) { return m.tipo === 'clube'; }).length;

    var statsHtml =
      '<div class="stats-grid" style="margin-bottom:20px">' +
        '<div class="stat-card"><div class="stat-value">' + modelos.length + '</div><div class="stat-label">Total Modelos</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + totalPadrao + '</div><div class="stat-label">Padrão</div></div>' +
        '<div class="stat-card" style="border-left:3px solid var(--danger)"><div class="stat-value">' + totalPromo + '</div><div class="stat-label">Promocional</div></div>' +
        '<div class="stat-card" style="border-left:3px solid var(--primary)"><div class="stat-value">' + totalClube + '</div><div class="stat-label">Clube</div></div>' +
      '</div>';

    // Filtrar modelos por tipo
    var modelosFiltrados = modelos.filter(function(m) { return m.tipo === tab; });

    var modelosHtml = modelosFiltrados.length === 0
      ? '<p class="text-muted text-center" style="padding:40px">Nenhum modelo de etiqueta "' + tipoLabels[tab] + '" encontrado.</p>'
      : '<div class="etiqueta-modelos-grid">' + modelosFiltrados.map(function(m) {
          return '<div class="card etiqueta-modelo-card" style="cursor:pointer;border-left:3px solid ' + tipoColors[m.tipo] + '">' +
            '<div class="card-body" style="padding:16px">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                '<div>' +
                  '<h4 style="margin:0 0 4px;font-size:15px">' + m.nome + '</h4>' +
                  '<p class="text-muted" style="margin:0;font-size:12px">' + m.largura_mm + ' x ' + m.altura_mm + ' mm</p>' +
                '</div>' +
                '<span class="badge" style="background:' + (m.ativo ? 'var(--success-light);color:var(--success)' : 'var(--bg-alt);color:var(--text-muted)') + '">' + (m.ativo ? 'Ativo' : 'Inativo') + '</span>' +
              '</div>' +
              '<div style="display:flex;gap:8px;margin-top:12px">' +
                '<button class="btn btn-sm btn-primary" data-onclick="Pages._gerarEtiquetas(\'' + m.tipo + '\',' + m.id + ',\'' + m.nome.replace(/'/g, "\\'") + '\',' + m.largura_mm + ',' + m.altura_mm + ')"><i data-lucide="printer" style="width:12px;height:12px"></i> Gerar</button>' +
                '<button class="btn btn-sm btn-secondary" data-onclick="Pages._editarModeloEtiqueta(' + m.id + ')"><i data-lucide="edit" style="width:12px;height:12px"></i></button>' +
                '<button class="btn btn-sm btn-danger" data-onclick="Pages._excluirModeloEtiqueta(' + m.id + ')"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>' +
              '</div>' +
            '</div></div>';
        }).join('') + '</div>';

    // Busca rápida de produtos para impressão individual
    var buscaProdHtml =
      '<div class="card" style="margin-top:20px"><div class="card-body" style="padding:16px">' +
        '<h4 style="margin:0 0 12px;font-size:14px"><i data-lucide="search" style="width:14px;height:14px;vertical-align:middle"></i> Impressão Rápida por Produto</h4>' +
        '<div class="search-box"><span class="search-icon"><i data-lucide="search" style="width:16px;height:16px"></i></span>' +
          '<input type="text" class="form-control" placeholder="Buscar produto por nome ou código..." data-oninput="Pages._buscarProdutoEtiqueta(this.value)">' +
        '</div>' +
        '<div id="etiquetaProdResultados" style="margin-top:12px;max-height:300px;overflow-y:auto"></div>' +
      '</div></div>';

    Layout.render(
      statsHtml +
      '<div class="card"><div class="card-body" style="padding:16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
          '<div class="tabs" style="margin:0">' +
            '<button class="tab' + (tab === 'padrao' ? ' active' : '') + '" data-onclick="Pages._etiquetasTab=\'padrao\';Pages._renderEtiquetas()">Padrão</button>' +
            '<button class="tab' + (tab === 'promocional' ? ' active' : '') + '" data-onclick="Pages._etiquetasTab=\'promocional\';Pages._renderEtiquetas()">Promocional</button>' +
            '<button class="tab' + (tab === 'clube' ? ' active' : '') + '" data-onclick="Pages._etiquetasTab=\'clube\';Pages._renderEtiquetas()">Clube Fidelidade</button>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm" data-onclick="Pages._novoModeloEtiqueta()"><i data-lucide="plus" style="width:14px;height:14px"></i> Novo Modelo</button>' +
        '</div>' +
        modelosHtml +
      '</div></div>' +
      buscaProdHtml,
      {
        title: 'Etiquetas',
        moduleMenu: [
          { label: 'Etiquetas', icon: 'tag', active: true, action: "Pages.etiquetas()" },
          { label: 'Config. Impressão', icon: 'settings', active: false, action: "Pages._configImpressaoPage()" }
        ]
      }
    );
  },

  // ── Busca de produto para impressão rápida ──
  _buscarProdutoEtiqueta: function(busca) {
    var container = document.getElementById('etiquetaProdResultados');
    if (!container) return;
    if (!busca || busca.length < 2) { container.innerHTML = ''; return; }
    busca = busca.toLowerCase();
    var filtrados = (Pages._etiquetasProdutos || []).filter(function(p) {
      return p.nome.toLowerCase().indexOf(busca) !== -1 || (p.codigo_barras && p.codigo_barras.indexOf(busca) !== -1);
    }).slice(0, 20);

    if (filtrados.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Nenhum produto encontrado</p>';
      return;
    }
    container.innerHTML = filtrados.map(function(p) {
      return '<div class="etiqueta-prod-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border)">' +
        '<div>' +
          '<strong style="font-size:13px">' + p.nome + '</strong>' +
          '<span class="text-muted" style="font-size:11px;margin-left:8px">' + (p.codigo_barras || '-') + '</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span style="font-weight:600">' + Utils.currency(p.preco_venda) + '</span>' +
          '<button class="btn btn-sm btn-primary" data-onclick="Pages._abrirImprimirEtiquetaProduto(' + p.id + ',\'' + p.nome.replace(/'/g, "\\'") + '\',' + (p.preco_venda || 0) + ',\'' + (p.codigo_barras || '').replace(/'/g, "\\'") + '\')"><i data-lucide="printer" style="width:12px;height:12px"></i></button>' +
        '</div></div>';
    }).join('');
  },

  // ── Modal de impressão de etiqueta para um produto ──
  _abrirImprimirEtiquetaProduto: function(prodId, nome, preco, codBarras) {
    var modelos = Pages._modelosEtiqueta || [];
    var optsModelo = modelos.filter(function(m) { return m.ativo; }).map(function(m) {
      var tipoLabel = m.tipo === 'padrao' ? '📋' : (m.tipo === 'promocional' ? '🔴' : '🔵');
      return '<option value="' + m.id + '" data-tipo="' + m.tipo + '" data-largura="' + m.largura_mm + '" data-altura="' + m.altura_mm + '">' +
        tipoLabel + ' ' + m.nome + ' (' + m.largura_mm + 'x' + m.altura_mm + 'mm)</option>';
    }).join('');

    Modal.show('Imprimir Etiqueta',
      '<div style="margin-bottom:12px;padding:12px;background:var(--bg-alt);border-radius:8px">' +
        '<strong>' + nome + '</strong><br>' +
        '<span class="text-muted">Código: ' + (codBarras || '-') + ' | Preço: ' + Utils.currency(preco) + '</span>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Modelo de Etiqueta *</label>' +
        '<select class="form-control" id="etqModelo">' + optsModelo + '</select></div>' +
      '<div class="form-group"><label class="form-label">Quantidade de Cópias</label>' +
        '<input type="number" class="form-control" id="etqQtd" value="1" min="1" max="500" style="max-width:120px"></div>' +
      '<div id="etqPreviewContainer" style="margin-top:16px"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._executarImpressaoEtiqueta(' + prodId + ')"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir</button>' +
      '<button class="btn btn-secondary" data-onclick="Pages._previewEtiqueta(' + prodId + ',\'' + nome.replace(/'/g, "\\'") + '\',' + preco + ',\'' + (codBarras || '').replace(/'/g, "\\'") + '\')">Preview</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  // ── Preview de etiqueta ──
  _previewEtiqueta: function(prodId, nome, preco, codBarras) {
    var sel = document.getElementById('etqModelo');
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    var tipo = opt.getAttribute('data-tipo');
    var largura = parseFloat(opt.getAttribute('data-largura'));
    var altura = parseFloat(opt.getAttribute('data-altura'));

    var container = document.getElementById('etqPreviewContainer');
    if (!container) return;

    var html = Pages._renderEtiquetaHtml({
      tipo: tipo, nome: nome, preco_normal: preco, preco_promo: null, preco_clube: null,
      percentual_off: 0, codigo_barras: codBarras, largura_mm: largura, altura_mm: altura
    });
    container.innerHTML = '<h4 style="font-size:13px;margin-bottom:8px">Preview:</h4>' + html;
  },

  // ── Executar impressão de etiqueta de um produto ──
  _executarImpressaoEtiqueta: async function(prodId) {
    var sel = document.getElementById('etqModelo');
    var qtd = parseInt(document.getElementById('etqQtd').value) || 1;
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    var tipo = opt.getAttribute('data-tipo');
    var largura = parseFloat(opt.getAttribute('data-largura'));
    var altura = parseFloat(opt.getAttribute('data-altura'));

    // Carregar dados atualizados do produto
    var prod;
    try { prod = await App.get('/produtos/' + prodId); } catch(e) { return Toast.error('Erro ao carregar produto'); }

    var dados = {
      tipo: tipo, nome: prod.nome, preco_normal: parseFloat(prod.preco_venda),
      preco_promo: prod.preco_promocional ? parseFloat(prod.preco_promocional) : null,
      preco_clube: null, percentual_off: 0,
      codigo_barras: prod.codigo_barras || '', largura_mm: largura, altura_mm: altura
    };

    // Se tipo clube, simular preço
    if (tipo === 'clube') {
      try {
        // Buscar programas ativos do tipo clube
        var programas = await App.get('/programas');
        var clubes = (Array.isArray(programas) ? programas : (programas.data || [])).filter(function(p) {
          return p.ativo && (p.tipo === 'clube' || p.programa_padrao);
        });
        if (clubes.length > 0) {
          var simRes = await App.post('/etiquetas/simular-preco', { produto_ids: [prodId], programa_id: clubes[0].id });
          if (simRes.produtos && simRes.produtos.length > 0 && simRes.produtos[0].tem_desconto) {
            dados.preco_clube = simRes.produtos[0].preco_clube;
            dados.percentual_off = Math.round((1 - simRes.produtos[0].preco_clube / dados.preco_normal) * 100);
          }
        }
      } catch(e) { console.warn('Erro ao simular preço clube', e); }
    }

    // Se tipo promo, verificar preço promocional
    if (tipo === 'promocional') {
      if (dados.preco_promo) {
        dados.percentual_off = Math.round((1 - dados.preco_promo / dados.preco_normal) * 100);
      }
    }

    Pages._imprimirEtiquetas([dados], qtd, largura, altura);
  },

  // ── Geração de etiquetas em lote (pelo módulo Etiquetas) ──
  _gerarEtiquetas: async function(tipo, modeloId, modeloNome, largura, altura) {
    var produtos = Pages._etiquetasProdutos || [];

    // Seleção de produtos
    var rows = produtos.map(function(p) {
      return '<tr>' +
        '<td><input type="checkbox" class="etq-check" value="' + p.id + '"></td>' +
        '<td>' + (p.codigo_barras || '-') + '</td>' +
        '<td>' + p.nome + '</td>' +
        '<td class="text-right">' + Utils.currency(p.preco_venda) + '</td></tr>';
    }).join('');

    Modal.show('Gerar Etiquetas — ' + modeloNome,
      '<div style="margin-bottom:12px;display:flex;gap:12px;align-items:center">' +
        '<div class="search-box" style="flex:1"><span class="search-icon"><i data-lucide="search" style="width:16px;height:16px"></i></span>' +
          '<input type="text" class="form-control" placeholder="Filtrar produtos..." data-oninput="Pages._filtrarProdutosEtiqueta(this.value)"></div>' +
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap"><input type="checkbox" id="etqSelecionarTodos" data-onchange="Pages._selecionarTodosProdutosEtq(this.checked)"> Todos</label>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px;margin-bottom:2px">Cópias</label>' +
          '<input type="number" class="form-control" id="etqLoteQtd" value="1" min="1" max="500" style="width:70px"></div>' +
      '</div>' +
      '<div class="table-container" style="max-height:400px;overflow-y:auto">' +
        '<table><thead><tr><th style="width:30px"></th><th>Código</th><th>Produto</th><th class="text-right">Preço</th></tr></thead>' +
        '<tbody id="etqProdutosBody">' + rows + '</tbody></table></div>',
      '<button class="btn btn-primary" data-onclick="Pages._executarImpressaoLote(\'' + tipo + '\',' + largura + ',' + altura + ')"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir Selecionados</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-xl'
    );
  },

  _filtrarProdutosEtiqueta: function(busca) {
    var body = document.getElementById('etqProdutosBody');
    if (!body) return;
    busca = busca.toLowerCase();
    var rows = body.querySelectorAll('tr');
    rows.forEach(function(row) {
      var txt = row.textContent.toLowerCase();
      row.style.display = txt.indexOf(busca) !== -1 ? '' : 'none';
    });
  },

  _selecionarTodosProdutosEtq: function(checked) {
    var checks = document.querySelectorAll('.etq-check');
    checks.forEach(function(c) { c.checked = checked; });
  },

  _executarImpressaoLote: async function(tipo, largura, altura) {
    var checks = document.querySelectorAll('.etq-check:checked');
    if (checks.length === 0) return Toast.warning('Selecione pelo menos um produto');
    var qtd = parseInt(document.getElementById('etqLoteQtd').value) || 1;
    var prodIds = Array.from(checks).map(function(c) { return parseInt(c.value); });

    Toast.info('Preparando ' + prodIds.length + ' etiquetas...');

    var etiquetasDados = [];

    if (tipo === 'clube') {
      // Simular preço pelo motor
      try {
        var programas = await App.get('/programas');
        var clubes = (Array.isArray(programas) ? programas : (programas.data || [])).filter(function(p) {
          return p.ativo && (p.tipo === 'clube' || p.programa_padrao);
        });
        if (clubes.length > 0) {
          var simRes = await App.post('/etiquetas/simular-preco', { produto_ids: prodIds, programa_id: clubes[0].id });
          (simRes.produtos || []).forEach(function(sp) {
            etiquetasDados.push({
              tipo: 'clube', nome: sp.nome, preco_normal: sp.preco_normal,
              preco_promo: sp.preco_promocional, preco_clube: sp.tem_desconto ? sp.preco_clube : sp.preco_normal,
              percentual_off: sp.tem_desconto ? Math.round((1 - sp.preco_clube / sp.preco_normal) * 100) : 0,
              codigo_barras: sp.codigo_barras || '', largura_mm: largura, altura_mm: altura
            });
          });
        }
      } catch(e) { Toast.error('Erro ao simular preços clube'); return; }
    } else {
      // Padrao ou promocional — dados diretos
      prodIds.forEach(function(pid) {
        var p = (Pages._etiquetasProdutos || []).find(function(x) { return x.id === pid; });
        if (!p) return;
        var precoNormal = parseFloat(p.preco_venda);
        var precoPromo = p.preco_promocional ? parseFloat(p.preco_promocional) : null;
        var pctOff = precoPromo ? Math.round((1 - precoPromo / precoNormal) * 100) : 0;
        etiquetasDados.push({
          tipo: tipo, nome: p.nome, preco_normal: precoNormal,
          preco_promo: precoPromo, preco_clube: null, percentual_off: pctOff,
          codigo_barras: p.codigo_barras || '', largura_mm: largura, altura_mm: altura
        });
      });
    }

    if (etiquetasDados.length === 0) { Toast.warning('Nenhum dado para gerar etiquetas'); return; }
    Pages._imprimirEtiquetas(etiquetasDados, qtd, largura, altura);
  },

  // ── Impressão em lote pelo Programa Comercial ──
  _imprimirEtiquetasPrograma: async function(programaId) {
    Toast.info('Carregando produtos do programa...');
    try {
      var res = await App.get('/etiquetas/programa/' + programaId + '/produtos');
      if (!res || !res.produtos || res.produtos.length === 0) {
        return Toast.warning('Nenhum produto encontrado neste programa');
      }

      // Carregar modelos
      var modelos = Pages._modelosEtiqueta || [];
      if (modelos.length === 0) {
        try { modelos = await App.get('/etiquetas') || []; Pages._modelosEtiqueta = modelos; } catch(e) {}
      }

      var tipoPrograma = res.programa.tipo;
      var tipoEtiqueta = tipoPrograma === 'clube' ? 'clube' : 'promocional';

      var optsModelo = modelos.filter(function(m) { return m.ativo && m.tipo === tipoEtiqueta; }).map(function(m) {
        return '<option value="' + m.id + '" data-largura="' + m.largura_mm + '" data-altura="' + m.altura_mm + '">' +
          m.nome + ' (' + m.largura_mm + 'x' + m.altura_mm + 'mm)</option>';
      }).join('');
      if (!optsModelo) {
        optsModelo = modelos.filter(function(m) { return m.ativo; }).map(function(m) {
          return '<option value="' + m.id + '" data-largura="' + m.largura_mm + '" data-altura="' + m.altura_mm + '">' +
            m.nome + ' (' + m.largura_mm + 'x' + m.altura_mm + 'mm)</option>';
        }).join('');
      }

      var rows = res.produtos.map(function(p) {
        return '<tr>' +
          '<td><input type="checkbox" class="etq-prog-check" value="' + p.id + '" checked></td>' +
          '<td>' + p.nome + '</td>' +
          '<td class="text-right">' + Utils.currency(p.preco_normal) + '</td>' +
          '<td class="text-right fw-600" style="color:var(--success)">' + Utils.currency(p.preco_clube) + '</td>' +
          '<td class="text-right">' + (p.percentual_off > 0 ? p.percentual_off + '% OFF' : '-') + '</td></tr>';
      }).join('');

      // Guardar dados para impressão
      Pages._programaProdutosImprimir = res;

      Modal.show('Imprimir Etiquetas — ' + res.programa.nome,
        '<div style="margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<div class="form-group" style="margin:0;flex:1"><label class="form-label" style="font-size:11px;margin-bottom:2px">Modelo</label>' +
            '<select class="form-control" id="etqProgModelo">' + optsModelo + '</select></div>' +
          '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;padding-top:16px"><input type="checkbox" checked data-onchange="document.querySelectorAll(\'.etq-prog-check\').forEach(function(c){c.checked=event.target.checked})"> Todos</label>' +
          '<div class="form-group" style="margin:0"><label class="form-label" style="font-size:11px;margin-bottom:2px">Cópias</label>' +
            '<input type="number" class="form-control" id="etqProgQtd" value="1" min="1" max="500" style="width:70px"></div>' +
        '</div>' +
        '<div class="table-container" style="max-height:350px;overflow-y:auto"><table>' +
          '<thead><tr><th style="width:30px"></th><th>Produto</th><th class="text-right">Normal</th><th class="text-right">Clube</th><th class="text-right">Desc.</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="text-muted" style="font-size:12px;margin-top:8px">' + res.total + ' produtos encontrados</p>',
        '<button class="btn btn-primary" data-onclick="Pages._executarImpressaoPrograma(\'' + tipoEtiqueta + '\')"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir ' + res.total + ' Etiquetas</button>' +
        '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
        'modal-xl'
      );
    } catch(e) {
      Toast.error('Erro ao carregar produtos do programa');
      console.error(e);
    }
  },

  _executarImpressaoPrograma: function(tipoEtiqueta) {
    var data = Pages._programaProdutosImprimir;
    if (!data) return;

    var sel = document.getElementById('etqProgModelo');
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    var largura = parseFloat(opt.getAttribute('data-largura'));
    var altura = parseFloat(opt.getAttribute('data-altura'));
    var qtd = parseInt(document.getElementById('etqProgQtd').value) || 1;

    var checks = document.querySelectorAll('.etq-prog-check:checked');
    var selectedIds = Array.from(checks).map(function(c) { return parseInt(c.value); });

    var etiquetasDados = (data.produtos || []).filter(function(p) {
      return selectedIds.indexOf(p.id) !== -1;
    }).map(function(p) {
      return {
        tipo: tipoEtiqueta, nome: p.nome, preco_normal: p.preco_normal,
        preco_promo: p.preco_promocional || null,
        preco_clube: p.preco_clube, percentual_off: p.percentual_off || 0,
        codigo_barras: p.codigo_barras || '', largura_mm: largura, altura_mm: altura
      };
    });

    if (etiquetasDados.length === 0) return Toast.warning('Selecione pelo menos um produto');
    Pages._imprimirEtiquetas(etiquetasDados, qtd, largura, altura);
  },

  // ════════════════════════════════════════════
  //  RENDERIZAÇÃO HTML DE ETIQUETA
  // ════════════════════════════════════════════
  _renderEtiquetaHtml: function(dados) {
    var tipo = dados.tipo;
    var scale = Math.min(3, 300 / Math.max(dados.largura_mm, dados.altura_mm));
    var w = Math.round(dados.largura_mm * scale);
    var h = Math.round(dados.altura_mm * scale);

    // Tamanhos de fonte proporcionais
    var fontNome = Math.max(9, Math.round(h * 0.12));
    var fontPreco = Math.max(12, Math.round(h * 0.22));
    var fontSmall = Math.max(8, Math.round(h * 0.08));
    var fontOff = Math.max(10, Math.round(h * 0.14));

    if (tipo === 'padrao') {
      return '<div class="etiqueta etiqueta-padrao" style="width:' + w + 'px;height:' + h + 'px">' +
        '<div class="etiqueta-nome" style="font-size:' + fontNome + 'px">' + dados.nome + '</div>' +
        '<div class="etiqueta-barcode" style="font-size:' + fontSmall + 'px">' + (dados.codigo_barras || '') + '</div>' +
        '<div class="etiqueta-preco" style="font-size:' + fontPreco + 'px">' + Utils.currency(dados.preco_normal) + '</div>' +
      '</div>';
    }

    if (tipo === 'promocional') {
      var precoFinal = dados.preco_promo || dados.preco_normal;
      var precoDe = dados.preco_promo ? dados.preco_normal : null;
      var pctOff = dados.percentual_off || 0;

      return '<div class="etiqueta etiqueta-promo" style="width:' + w + 'px;height:' + h + 'px">' +
        '<div class="etiqueta-nome" style="font-size:' + fontNome + 'px">' + dados.nome + '</div>' +
        (precoDe ? '<div class="etiqueta-preco-de" style="font-size:' + fontSmall + 'px">DE: ' + Utils.currency(precoDe) + '</div>' : '') +
        '<div class="etiqueta-preco-por" style="font-size:' + fontPreco + 'px">POR: ' + Utils.currency(precoFinal) + '</div>' +
        (pctOff > 0 ? '<div class="etiqueta-off" style="font-size:' + fontOff + 'px">' + pctOff + '% OFF</div>' : '') +
      '</div>';
    }

    if (tipo === 'clube') {
      var precoClube = dados.preco_clube || dados.preco_normal;
      return '<div class="etiqueta etiqueta-clube" style="width:' + w + 'px;height:' + h + 'px">' +
        '<div class="etiqueta-clube-header" style="font-size:' + fontSmall + 'px"><i data-lucide="crown" style="width:' + fontSmall + 'px;height:' + fontSmall + 'px"></i> CLUBE FIDELIDADE</div>' +
        '<div class="etiqueta-nome" style="font-size:' + fontNome + 'px">' + dados.nome + '</div>' +
        '<div class="etiqueta-preco-normal" style="font-size:' + fontSmall + 'px">Normal: ' + Utils.currency(dados.preco_normal) + '</div>' +
        '<div class="etiqueta-preco-clube" style="font-size:' + fontPreco + 'px">' + Utils.currency(precoClube) + '</div>' +
        '<div class="etiqueta-clube-texto" style="font-size:' + Math.max(7, fontSmall - 1) + 'px">Preço exclusivo para membros do Clube</div>' +
      '</div>';
    }

    return '<div class="etiqueta">Tipo desconhecido</div>';
  },

  // ════════════════════════════════════════════
  //  IMPRESSÃO — abre janela de print
  // ════════════════════════════════════════════
  _imprimirEtiquetas: function(etiquetasDados, qtdCopias, largura, altura) {
    var config = Pages._configImpressao || {};
    var margemSup = config.margem_superior || 5;
    var margemLat = config.margem_lateral || 5;

    var htmlEtiquetas = '';
    for (var i = 0; i < etiquetasDados.length; i++) {
      for (var c = 0; c < qtdCopias; c++) {
        htmlEtiquetas += Pages._renderEtiquetaHtml(etiquetasDados[i]);
      }
    }

    var printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(
      '<!DOCTYPE html><html><head><title>Etiquetas</title>' +
      '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: Arial, sans-serif; padding: ' + margemSup + 'mm ' + margemLat + 'mm; }' +
        '.etiquetas-container { display: flex; flex-wrap: wrap; gap: 4px; }' +
        '.etiqueta { border: 1px solid #ccc; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; page-break-inside: avoid; }' +
        '.etiqueta-padrao { background: #fff; color: #333; }' +
        '.etiqueta-promo { background: #FEF2F2; color: #333; border-color: #EF4444; }' +
        '.etiqueta-clube { background: #EFF6FF; color: #333; border-color: #2563EB; }' +
        '.etiqueta-nome { font-weight: 600; text-align: center; line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }' +
        '.etiqueta-barcode { color: #666; text-align: center; margin-bottom: 4px; font-family: monospace; letter-spacing: 1px; }' +
        '.etiqueta-preco { font-weight: 800; text-align: center; color: #111; }' +
        '.etiqueta-preco-de { text-decoration: line-through; color: #999; text-align: center; }' +
        '.etiqueta-preco-por { font-weight: 800; color: #DC2626; text-align: center; }' +
        '.etiqueta-off { font-weight: 700; color: #fff; background: #DC2626; border-radius: 4px; padding: 2px 6px; text-align: center; }' +
        '.etiqueta-clube-header { font-weight: 700; color: #2563EB; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 2px; }' +
        '.etiqueta-preco-normal { color: #999; text-align: center; text-decoration: line-through; }' +
        '.etiqueta-preco-clube { font-weight: 800; color: #2563EB; text-align: center; }' +
        '.etiqueta-clube-texto { color: #4B7BE5; text-align: center; font-style: italic; margin-top: 2px; }' +
        '@media print { body { padding: ' + margemSup + 'mm ' + margemLat + 'mm; } .no-print { display: none; } }' +
      '</style></head><body>' +
      '<div class="no-print" style="text-align:center;padding:10px;background:#f0f0f0;margin-bottom:16px">' +
        '<button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#2563EB;color:#fff;border:none;border-radius:6px">🖨️ Imprimir</button>' +
        ' <button onclick="window.close()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:6px">Fechar</button>' +
        '<span style="margin-left:12px;color:#666">' + etiquetasDados.length + ' etiqueta(s) × ' + qtdCopias + ' cópia(s)</span>' +
      '</div>' +
      '<div class="etiquetas-container">' + htmlEtiquetas + '</div>' +
      '</body></html>'
    );
    printWindow.document.close();

    Toast.success(etiquetasDados.length * qtdCopias + ' etiqueta(s) gerada(s)!');
    Modal.close();
  },

  // ════════════════════════════════════════════
  //  CRUD DE MODELOS DE ETIQUETA
  // ════════════════════════════════════════════
  _novoModeloEtiqueta: function() {
    var tab = Pages._etiquetasTab || 'padrao';
    Modal.show('Novo Modelo de Etiqueta',
      '<div class="form-group"><label class="form-label">Nome *</label>' +
        '<input type="text" class="form-control" id="etqmNome" placeholder="Ex: Gôndola Pequena"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Largura (mm)</label>' +
          '<input type="number" class="form-control" id="etqmLargura" value="40" min="10" max="300"></div>' +
        '<div class="form-group"><label class="form-label">Altura (mm)</label>' +
          '<input type="number" class="form-control" id="etqmAltura" value="30" min="10" max="300"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Tipo *</label>' +
        '<select class="form-control" id="etqmTipo">' +
          '<option value="padrao"' + (tab === 'padrao' ? ' selected' : '') + '>Padrão</option>' +
          '<option value="promocional"' + (tab === 'promocional' ? ' selected' : '') + '>Promocional</option>' +
          '<option value="clube"' + (tab === 'clube' ? ' selected' : '') + '>Clube Fidelidade</option>' +
        '</select></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarModeloEtiqueta(null)"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _editarModeloEtiqueta: async function(id) {
    var modelo;
    try { modelo = await App.get('/etiquetas/' + id); } catch(e) { return Toast.error('Erro ao carregar modelo'); }

    Modal.show('Editar Modelo de Etiqueta',
      '<div class="form-group"><label class="form-label">Nome *</label>' +
        '<input type="text" class="form-control" id="etqmNome" value="' + (modelo.nome || '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Largura (mm)</label>' +
          '<input type="number" class="form-control" id="etqmLargura" value="' + (modelo.largura_mm || 40) + '" min="10" max="300"></div>' +
        '<div class="form-group"><label class="form-label">Altura (mm)</label>' +
          '<input type="number" class="form-control" id="etqmAltura" value="' + (modelo.altura_mm || 30) + '" min="10" max="300"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Tipo *</label>' +
        '<select class="form-control" id="etqmTipo">' +
          '<option value="padrao"' + (modelo.tipo === 'padrao' ? ' selected' : '') + '>Padrão</option>' +
          '<option value="promocional"' + (modelo.tipo === 'promocional' ? ' selected' : '') + '>Promocional</option>' +
          '<option value="clube"' + (modelo.tipo === 'clube' ? ' selected' : '') + '>Clube Fidelidade</option>' +
        '</select></div>' +
      '<div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="etqmAtivo"' + (modelo.ativo ? ' checked' : '') + '> Ativo</label></div>',
      '<button class="btn btn-primary" data-onclick="Pages._salvarModeloEtiqueta(' + id + ')"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _salvarModeloEtiqueta: async function(id) {
    var nome = document.getElementById('etqmNome').value.trim();
    var largura = parseFloat(document.getElementById('etqmLargura').value) || 40;
    var altura = parseFloat(document.getElementById('etqmAltura').value) || 30;
    var tipo = document.getElementById('etqmTipo').value;
    if (!nome) return Toast.warning('Nome é obrigatório');

    var data = { nome: nome, largura_mm: largura, altura_mm: altura, tipo: tipo };
    var ativoEl = document.getElementById('etqmAtivo');
    if (ativoEl) data.ativo = ativoEl.checked;

    try {
      if (id) { await App.put('/etiquetas/' + id, data); }
      else { await App.post('/etiquetas', data); }
      Toast.success('Modelo ' + (id ? 'atualizado' : 'criado') + '!');
      Modal.close();
      Pages.etiquetas();
    } catch(e) { Toast.error((e && e.error) || 'Erro ao salvar modelo'); }
  },

  _excluirModeloEtiqueta: async function(id) {
    if (!confirm('Excluir este modelo de etiqueta?')) return;
    try {
      await App.delete('/etiquetas/' + id);
      Toast.success('Modelo excluído!');
      Pages.etiquetas();
    } catch(e) { Toast.error('Erro ao excluir'); }
  },

  // ════════════════════════════════════════════
  //  CONFIGURAÇÃO DE IMPRESSÃO
  // ════════════════════════════════════════════
  _configImpressaoPage: async function() {
    var config = Pages._configImpressao || {};
    if (!config.tipo_impressora) {
      try { config = await App.get('/etiquetas/config-impressao/atual'); Pages._configImpressao = config; } catch(e) {}
    }

    Layout.render(
      '<div class="card"><div class="card-body" style="padding:24px">' +
        '<h3 style="margin:0 0 20px"><i data-lucide="settings" style="width:20px;height:20px;vertical-align:middle"></i> Configuração de Impressão</h3>' +
        '<div class="form-group"><label class="form-label">Tipo de Impressora</label>' +
          '<select class="form-control" id="cfgTipoImpressora" style="max-width:300px">' +
            '<option value="termica"' + (config.tipo_impressora === 'termica' ? ' selected' : '') + '>Térmica</option>' +
            '<option value="laser"' + (config.tipo_impressora === 'laser' || !config.tipo_impressora ? ' selected' : '') + '>Laser / Jato de Tinta</option>' +
          '</select></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Largura do Papel (mm)</label>' +
            '<input type="number" class="form-control" id="cfgLarguraPapel" value="' + (config.largura_papel_mm || 210) + '" min="30" max="300"></div>' +
          '<div class="form-group"><label class="form-label">Margem Superior (mm)</label>' +
            '<input type="number" class="form-control" id="cfgMargemSup" value="' + (config.margem_superior || 5) + '" min="0" max="50"></div>' +
          '<div class="form-group"><label class="form-label">Margem Lateral (mm)</label>' +
            '<input type="number" class="form-control" id="cfgMargemLat" value="' + (config.margem_lateral || 5) + '" min="0" max="50"></div>' +
          '<div class="form-group"><label class="form-label">DPI</label>' +
            '<input type="number" class="form-control" id="cfgDpi" value="' + (config.dpi || 203) + '" min="72" max="600"></div>' +
        '</div>' +
        '<button class="btn btn-primary" data-onclick="Pages._salvarConfigImpressao()" style="margin-top:16px"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar Configurações</button>' +
      '</div></div>',
      {
        title: 'Configuração de Impressão',
        moduleMenu: [
          { label: 'Etiquetas', icon: 'tag', active: false, action: "Pages.etiquetas()" },
          { label: 'Config. Impressão', icon: 'settings', active: true, action: "Pages._configImpressaoPage()" }
        ]
      }
    );
  },

  _salvarConfigImpressao: async function() {
    var data = {
      tipo_impressora: document.getElementById('cfgTipoImpressora').value,
      largura_papel_mm: parseFloat(document.getElementById('cfgLarguraPapel').value) || 210,
      margem_superior: parseFloat(document.getElementById('cfgMargemSup').value) || 5,
      margem_lateral: parseFloat(document.getElementById('cfgMargemLat').value) || 5,
      dpi: parseInt(document.getElementById('cfgDpi').value) || 203
    };
    try {
      var saved = await App.put('/etiquetas/config-impressao/atual', data);
      Pages._configImpressao = saved;
      Toast.success('Configurações salvas!');
    } catch(e) { Toast.error('Erro ao salvar configurações'); }
  },

  // ============================================================
  //  TUTORIAL - Central de Ajuda (abre em nova janela, permanece na home)
  // ============================================================
  tutorial: function() {
    window.open('/tutorial.html', '_blank');
    Router.navigate('home');
  },

  // ============================================================
  //  RELATORIOS - Painel completo de relatorios
  // ============================================================
  _relTab: 'vendas',

  relatorios: async function() {
    var tab = Pages._relTab || 'vendas';
    Layout.render('<div class="loading"><div class="spinner"></div></div>', {
      title: 'Relatorios',
      moduleMenu: [
        { label: 'Vendas', icon: 'shopping-bag', active: tab==='vendas', action: "Pages._relTab='vendas';Pages.relatorios()" },
        { label: 'Produtos', icon: 'package', active: tab==='produtos', action: "Pages._relTab='produtos';Pages.relatorios()" },
        { label: 'Caixa', icon: 'landmark', active: tab==='caixa', action: "Pages._relTab='caixa';Pages.relatorios()" },
        { label: 'Contas', icon: 'wallet', active: tab==='contas', action: "Pages._relTab='contas';Pages.relatorios()" },
        { label: 'DRE', icon: 'bar-chart-3', active: tab==='dre', action: "Pages._relTab='dre';Pages.relatorios()" },
        { label: 'Fluxo', icon: 'trending-up', active: tab==='fluxo', action: "Pages._relTab='fluxo';Pages.relatorios()" }
      ]
    });

    if (tab === 'vendas') await Pages._relVendas();
    else if (tab === 'produtos') await Pages._relProdutos();
    else if (tab === 'caixa') await Pages._relCaixas();
    else if (tab === 'contas') await Pages._relContas();
    else if (tab === 'dre') await Pages._relDre();
    else if (tab === 'fluxo') await Pages._relFluxo();
  },

  _relInicio: '',
  _relFim: '',

  _getRelPeriodo: function() {
    var hoje = new Date();
    var inicio = Pages._relInicio || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    var fim = Pages._relFim || hoje.toISOString().split('T')[0];
    return { inicio: inicio, fim: fim };
  },

  _relFiltroHtml: function() {
    var p = Pages._getRelPeriodo();
    return '<div class="card" style="margin-bottom:16px"><div class="card-body" style="padding:12px 16px">' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="margin-bottom:4px">Inicio</label>' +
          '<input type="date" class="form-control" id="relInicio" value="' + p.inicio + '"></div>' +
        '<div class="form-group" style="margin:0"><label class="form-label" style="margin-bottom:4px">Fim</label>' +
          '<input type="date" class="form-control" id="relFim" value="' + p.fim + '"></div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:18px" data-onclick="Pages._relInicio=document.getElementById(\'relInicio\').value;Pages._relFim=document.getElementById(\'relFim\').value;Pages.relatorios()">' +
          '<i data-lucide="search" style="width:14px;height:14px"></i> Filtrar</button>' +
      '</div></div></div>';
  },

  _relVendas: async function() {
    var p = Pages._getRelPeriodo();
    var res;
    try { res = await App.get('/relatorios/vendas?inicio=' + p.inicio + '&fim=' + p.fim); } catch(e) { res = { resumo: {}, por_pagamento: {}, vendas: [] }; }
    var r = res.resumo || {};

    var fpHtml = '';
    var fp = res.por_pagamento || {};
    Object.keys(fp).forEach(function(k) {
      fpHtml += '<tr><td class="fw-500">' + k + '</td><td class="text-right">' + fp[k].quantidade + '</td><td class="text-right fw-600">' + Utils.currency(fp[k].valor) + '</td></tr>';
    });

    var vendasRows = (res.vendas || []).slice(0, 50).map(function(v) {
      return '<tr data-onclick="Pages._verCupom(' + v.id + ')">' +
        '<td class="fw-500">#' + v.numero + '</td>' +
        '<td>' + new Date(v.data).toLocaleDateString('pt-BR') + '</td>' +
        '<td>' + (v.cliente || '-') + '</td>' +
        '<td>' + (v.forma_pagamento || '-') + '</td>' +
        '<td class="text-right">' + v.itens + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(v.total) + '</td>' +
        '<td class="text-right">' + Utils.currency(v.lucro || 0) + '</td></tr>';
    }).join('');

    Layout.render(
      Pages._relFiltroHtml() +
      '<div class="stats-grid" style="margin-bottom:16px">' +
        UI.statCard('Vendas', r.total_vendas || 0, 'shopping-bag', 'blue') +
        UI.statCard('Faturamento', Utils.currency(r.faturamento || 0), 'dollar-sign', 'green') +
        UI.statCard('Lucro Bruto', Utils.currency(r.lucro_bruto || 0), 'trending-up', 'teal') +
        UI.statCard('Ticket Medio', Utils.currency(r.ticket_medio || 0), 'receipt', 'purple') +
        UI.statCard('Margem', (r.margem || 0).toFixed(1) + '%', 'percent', 'amber') +
        UI.statCard('Descontos', Utils.currency(r.descontos || 0), 'tag', 'red') +
      '</div>' +
      (fpHtml ? '<div class="card" style="margin-bottom:16px"><div class="card-header"><h3>Por Forma de Pagamento</h3></div><div class="table-container"><table><thead><tr><th>Forma</th><th class="text-right">Qtd</th><th class="text-right">Valor</th></tr></thead><tbody>' + fpHtml + '</tbody></table></div></div>' : '') +
      '<div class="card"><div class="card-header"><h3>Vendas no Periodo</h3></div><div class="table-container"><table><thead><tr><th>Numero</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th class="text-right">Itens</th><th class="text-right">Total</th><th class="text-right">Lucro</th></tr></thead><tbody>' + (vendasRows || '<tr><td colspan="7" class="text-center text-muted" style="padding:40px">Nenhuma venda no periodo</td></tr>') + '</tbody></table></div></div>',
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: true, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: false, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: false, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: false, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: false, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: false, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _relProdutos: async function() {
    var p = Pages._getRelPeriodo();
    var res;
    try { res = await App.get('/relatorios/produtos-ranking?inicio=' + p.inicio + '&fim=' + p.fim + '&limit=50'); } catch(e) { res = { produtos: [] }; }

    var rows = (res.produtos || []).map(function(pr) {
      return '<tr><td class="fw-600">' + pr.posicao + '</td><td class="fw-500">' + pr.nome + '</td>' +
        '<td class="text-right">' + pr.quantidade + '</td>' +
        '<td class="text-right">' + pr.ocorrencias + '</td>' +
        '<td class="text-right fw-600">' + Utils.currency(pr.faturamento) + '</td></tr>';
    }).join('');

    Layout.render(
      Pages._relFiltroHtml() +
      '<div class="card"><div class="card-header"><h3>Ranking de Produtos</h3></div><div class="table-container"><table><thead><tr><th>#</th><th>Produto</th><th class="text-right">Qtd Vendida</th><th class="text-right">Ocorrencias</th><th class="text-right">Faturamento</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="text-center text-muted" style="padding:40px">Sem dados</td></tr>') + '</tbody></table></div></div>',
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: false, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: true, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: false, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: false, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: false, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: false, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _relCaixas: async function() {
    var res;
    try { res = await App.get('/caixa?limit=20'); } catch(e) { res = { data: [] }; }
    var caixas = res.data || res || [];

    var rows = (Array.isArray(caixas) ? caixas : []).map(function(cx) {
      return '<tr class="clickable" data-onclick="Pages._relDetalharCaixa(' + cx.id + ')">' +
        '<td class="fw-500">#' + (cx.numero_caixa || cx.id) + '</td>' +
        '<td>' + (cx.data_abertura ? new Date(cx.data_abertura).toLocaleDateString('pt-BR') : '-') + '</td>' +
        '<td>' + UI.badge(cx.status === 'aberto' ? 'Aberto' : 'Fechado', cx.status === 'aberto' ? 'green' : 'slate') + '</td>' +
        '<td class="text-right">' + Utils.currency(cx.total_vendas || 0) + '</td>' +
        '<td class="text-right">' + (cx.quantidade_vendas || 0) + '</td>' +
        '<td class="text-right">' + Utils.currency(cx.diferenca || 0) + '</td></tr>';
    }).join('');

    Layout.render(
      '<div class="card"><div class="card-header"><h3>Historico de Caixas</h3><p class="text-muted">Clique em um caixa para ver o relatorio completo</p></div><div class="table-container"><table><thead><tr><th>Caixa</th><th>Abertura</th><th>Status</th><th class="text-right">Total Vendas</th><th class="text-right">Qtd Vendas</th><th class="text-right">Diferenca</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhum caixa</td></tr>') + '</tbody></table></div></div>',
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: false, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: false, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: true, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: false, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: false, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: false, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _relDetalharCaixa: async function(id) {
    var res;
    try { res = await App.get('/relatorios/fechamento-caixa/' + id); } catch(e) { return Toast.error('Erro ao carregar relatorio'); }
    var v = res.valores || {};

    var movRows = (res.movimentacoes || []).map(function(m) {
      return '<tr><td>' + UI.badge(m.tipo, m.tipo === 'suprimento' ? 'green' : 'red') + '</td><td class="text-right fw-600">' + Utils.currency(m.valor) + '</td><td>' + (m.motivo || '-') + '</td><td>' + new Date(m.data).toLocaleTimeString('pt-BR') + '</td></tr>';
    }).join('');

    var vendaRows = (res.vendas || []).map(function(vd) {
      return '<tr><td class="fw-500">#' + vd.numero + '</td><td class="text-right fw-600">' + Utils.currency(vd.total) + '</td><td>' + (vd.forma_pagamento || '-') + '</td><td>' + new Date(vd.hora).toLocaleTimeString('pt-BR') + '</td></tr>';
    }).join('');

    Modal.show('Relatorio do Caixa #' + (res.caixa.numero_caixa || res.caixa.id),
      '<div class="stats-grid" style="margin-bottom:16px">' +
        UI.statCard('Abertura', Utils.currency(v.abertura), 'log-in', 'blue') +
        UI.statCard('Vendas', Utils.currency(v.total_vendas), 'shopping-bag', 'green') +
        UI.statCard('Sangrias', Utils.currency(v.sangrias), 'arrow-down-circle', 'red') +
        UI.statCard('Suprimentos', Utils.currency(v.suprimentos), 'arrow-up-circle', 'teal') +
        UI.statCard('Esperado', Utils.currency(v.esperado), 'target', 'purple') +
        UI.statCard('Diferenca', Utils.currency(v.diferenca), 'alert-circle', v.diferenca >= 0 ? 'green' : 'red') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:16px">' +
        '<div class="stat-card"><div class="stat-value">' + Utils.currency(v.dinheiro) + '</div><div class="stat-label">Dinheiro</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Utils.currency(v.pix) + '</div><div class="stat-label">PIX</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Utils.currency(v.debito) + '</div><div class="stat-label">Debito</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + Utils.currency(v.credito) + '</div><div class="stat-label">Credito</div></div>' +
      '</div>' +
      (movRows ? '<h4 style="margin:16px 0 8px">Movimentacoes</h4><div class="table-container"><table><thead><tr><th>Tipo</th><th class="text-right">Valor</th><th>Motivo</th><th>Hora</th></tr></thead><tbody>' + movRows + '</tbody></table></div>' : '') +
      (vendaRows ? '<h4 style="margin:16px 0 8px">Vendas (' + res.vendas_qtd + ')</h4><div class="table-container" style="max-height:300px;overflow-y:auto"><table><thead><tr><th>Numero</th><th class="text-right">Total</th><th>Pagamento</th><th>Hora</th></tr></thead><tbody>' + vendaRows + '</tbody></table></div>' : ''),
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>'
    );
  },

  _relContas: async function() {
    var res;
    try { res = await App.get('/relatorios/contas-pendentes'); } catch(e) { res = { resumo: {}, contas_pagar: [], contas_receber: [] }; }
    var r = res.resumo || {};

    var pagarRows = (res.contas_pagar || []).map(function(c) {
      var vencida = c.status === 'vencido' ? ' style="color:var(--danger)"' : '';
      return '<tr' + vencida + '><td class="fw-500">' + c.descricao + '</td><td>' + (c.fornecedor || '-') + '</td><td>' + (c.categoria || '-') + '</td><td>' + new Date(c.vencimento).toLocaleDateString('pt-BR') + '</td><td>' + UI.badge(c.status, c.status === 'vencido' ? 'red' : 'amber') + '</td><td class="text-right fw-600">' + Utils.currency(c.valor) + '</td></tr>';
    }).join('');

    var receberRows = (res.contas_receber || []).map(function(c) {
      var vencida = c.status === 'vencido' ? ' style="color:var(--danger)"' : '';
      return '<tr' + vencida + '><td class="fw-500">' + c.descricao + '</td><td>' + (c.cliente || '-') + '</td><td>' + new Date(c.vencimento).toLocaleDateString('pt-BR') + '</td><td>' + UI.badge(c.status, c.status === 'vencido' ? 'red' : 'amber') + '</td><td class="text-right fw-600">' + Utils.currency(c.valor) + '</td></tr>';
    }).join('');

    Layout.render(
      '<div class="stats-grid" style="margin-bottom:16px">' +
        UI.statCard('A Pagar', Utils.currency(r.total_pagar || 0), 'arrow-down-circle', 'red') +
        UI.statCard('A Receber', Utils.currency(r.total_receber || 0), 'arrow-up-circle', 'green') +
        UI.statCard('Saldo', Utils.currency(r.saldo || 0), 'scale', r.saldo >= 0 ? 'green' : 'red') +
        UI.statCard('Vencidas (Pagar)', r.vencidas_pagar || 0, 'alert-circle', 'red') +
      '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card-header"><h3>Contas a Pagar Pendentes</h3></div><div class="table-container"><table><thead><tr><th>Descricao</th><th>Fornecedor</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th class="text-right">Valor</th></tr></thead><tbody>' + (pagarRows || '<tr><td colspan="6" class="text-center text-muted" style="padding:40px">Nenhuma conta pendente</td></tr>') + '</tbody></table></div></div>' +
      '<div class="card"><div class="card-header"><h3>Contas a Receber Pendentes</h3></div><div class="table-container"><table><thead><tr><th>Descricao</th><th>Cliente</th><th>Vencimento</th><th>Status</th><th class="text-right">Valor</th></tr></thead><tbody>' + (receberRows || '<tr><td colspan="5" class="text-center text-muted" style="padding:40px">Nenhuma conta pendente</td></tr>') + '</tbody></table></div></div>',
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: false, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: false, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: false, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: true, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: false, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: false, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _relDre: async function() {
    var p = Pages._getRelPeriodo();
    var res;
    try { res = await App.get('/relatorios/dre?inicio=' + p.inicio + '&fim=' + p.fim); } catch(e) { res = { dre: {} }; }
    var d = res.dre || {};

    var despCatHtml = '';
    var despCat = d.despesas_por_categoria || {};
    Object.keys(despCat).forEach(function(k) {
      despCatHtml += '<tr><td style="padding-left:32px">' + k + '</td><td class="text-right">' + Utils.currency(despCat[k]) + '</td></tr>';
    });

    var dreTable =
      '<table style="width:100%">' +
        '<tr class="fw-600" style="background:var(--bg-secondary)"><td>Receita Bruta</td><td class="text-right">' + Utils.currency(d.receita_bruta || 0) + '</td></tr>' +
        '<tr style="color:var(--danger)"><td style="padding-left:20px">(-) Devolucoes</td><td class="text-right">' + Utils.currency(d.devolucoes || 0) + '</td></tr>' +
        '<tr class="fw-600" style="background:var(--bg-secondary)"><td>= Receita Liquida</td><td class="text-right">' + Utils.currency(d.receita_liquida || 0) + '</td></tr>' +
        '<tr style="color:var(--danger)"><td style="padding-left:20px">(-) Custo das Mercadorias (CMV)</td><td class="text-right">' + Utils.currency(d.cmv || 0) + '</td></tr>' +
        '<tr class="fw-600" style="background:var(--bg-secondary)"><td>= Lucro Bruto</td><td class="text-right">' + Utils.currency(d.lucro_bruto || 0) + '</td></tr>' +
        '<tr><td colspan="2" style="padding:4px"></td></tr>' +
        '<tr style="color:var(--danger)"><td style="padding-left:20px">(-) Despesas Operacionais</td><td class="text-right">' + Utils.currency(d.despesas_operacionais || 0) + '</td></tr>' +
        despCatHtml +
        '<tr class="fw-600" style="font-size:1.1rem;background:var(--bg-secondary);border-top:2px solid var(--border)"><td>= Lucro Operacional</td><td class="text-right" style="color:' + ((d.lucro_operacional || 0) >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + Utils.currency(d.lucro_operacional || 0) + '</td></tr>' +
      '</table>';

    Layout.render(
      Pages._relFiltroHtml() +
      '<div class="stats-grid" style="margin-bottom:16px">' +
        UI.statCard('Receita Liquida', Utils.currency(d.receita_liquida || 0), 'dollar-sign', 'blue') +
        UI.statCard('Lucro Bruto', Utils.currency(d.lucro_bruto || 0), 'trending-up', 'green') +
        UI.statCard('Margem Bruta', (d.margem_bruta || 0).toFixed(1) + '%', 'percent', 'teal') +
        UI.statCard('Lucro Operacional', Utils.currency(d.lucro_operacional || 0), 'target', (d.lucro_operacional || 0) >= 0 ? 'green' : 'red') +
      '</div>' +
      '<div class="card"><div class="card-header"><h3>DRE - Demonstrativo de Resultado</h3></div><div class="card-body">' + dreTable + '</div></div>',
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: false, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: false, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: false, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: false, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: true, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: false, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _relFluxo: async function() {
    var res;
    try { res = await App.get('/relatorios/fluxo-projetado?dias=90'); } catch(e) { res = { projecao: [], total_pagar: 0, total_receber: 0 }; }

    var projRows = (res.projecao || []).map(function(pr) {
      return '<tr>' +
        '<td class="fw-500">' + pr.periodo + '</td>' +
        '<td class="text-right" style="color:var(--success)">' + Utils.currency(pr.entradas_previstas) + '</td>' +
        '<td class="text-right" style="color:var(--danger)">' + Utils.currency(pr.saidas_previstas) + '</td>' +
        '<td class="text-right fw-600" style="color:' + (pr.saldo_projetado >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + Utils.currency(pr.saldo_projetado) + '</td></tr>';
    }).join('');

    var diarioHtml = '';
    var fluxoDiario = res.fluxo_diario || {};
    var dias = Object.keys(fluxoDiario).sort();
    var saldoAcumulado = 0;
    dias.slice(0, 30).forEach(function(dia) {
      var f = fluxoDiario[dia];
      saldoAcumulado += f.entradas - f.saidas;
      diarioHtml += '<tr><td>' + new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR') + '</td>' +
        '<td class="text-right" style="color:var(--success)">' + Utils.currency(f.entradas) + '</td>' +
        '<td class="text-right" style="color:var(--danger)">' + Utils.currency(f.saidas) + '</td>' +
        '<td class="text-right fw-600" style="color:' + (saldoAcumulado >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + Utils.currency(saldoAcumulado) + '</td></tr>';
    });

    Layout.render(
      '<div class="stats-grid" style="margin-bottom:16px">' +
        UI.statCard('A Receber (90d)', Utils.currency(res.total_receber || 0), 'arrow-up-circle', 'green') +
        UI.statCard('A Pagar (90d)', Utils.currency(res.total_pagar || 0), 'arrow-down-circle', 'red') +
        UI.statCard('Saldo Projetado', Utils.currency((res.total_receber || 0) - (res.total_pagar || 0)), 'scale', (res.total_receber || 0) >= (res.total_pagar || 0) ? 'green' : 'red') +
      '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card-header"><h3>Projecao por Periodo</h3></div><div class="table-container"><table><thead><tr><th>Periodo</th><th class="text-right">Entradas</th><th class="text-right">Saidas</th><th class="text-right">Saldo</th></tr></thead><tbody>' + (projRows || '<tr><td colspan="4" class="text-center text-muted">Sem projecao</td></tr>') + '</tbody></table></div></div>' +
      (diarioHtml ? '<div class="card"><div class="card-header"><h3>Fluxo Diario (proximos 30 dias)</h3></div><div class="table-container" style="max-height:400px;overflow-y:auto"><table><thead><tr><th>Data</th><th class="text-right">Entradas</th><th class="text-right">Saidas</th><th class="text-right">Saldo Acumulado</th></tr></thead><tbody>' + diarioHtml + '</tbody></table></div></div>' : ''),
      {
        title: 'Relatorios',
        moduleMenu: [
          { label: 'Vendas', icon: 'shopping-bag', active: false, action: "Pages._relTab='vendas';Pages.relatorios()" },
          { label: 'Produtos', icon: 'package', active: false, action: "Pages._relTab='produtos';Pages.relatorios()" },
          { label: 'Caixa', icon: 'landmark', active: false, action: "Pages._relTab='caixa';Pages.relatorios()" },
          { label: 'Contas', icon: 'wallet', active: false, action: "Pages._relTab='contas';Pages.relatorios()" },
          { label: 'DRE', icon: 'bar-chart-3', active: false, action: "Pages._relTab='dre';Pages.relatorios()" },
          { label: 'Fluxo', icon: 'trending-up', active: true, action: "Pages._relTab='fluxo';Pages.relatorios()" }
        ]
      }
    );
  },

  _verCupom: async function(vendaId) {
    var res;
    try { res = await App.get('/relatorios/cupom/' + vendaId); } catch(e) { return Toast.error('Erro ao carregar cupom'); }
    var c = res.cupom || {};
    var emp = c.empresa || {};
    var vd = c.venda || {};
    var totais = c.totais || {};
    var pag = c.pagamento || {};

    var itensHtml = (c.itens || []).map(function(i, idx) {
      return '<tr><td>' + (idx + 1) + '</td><td>' + i.nome + '</td><td class="text-right">' + i.qtd + '</td><td class="text-right">' + Utils.currency(i.unitario) + '</td><td class="text-right fw-600">' + Utils.currency(i.subtotal) + '</td></tr>';
    }).join('');

    var cupomHtml =
      '<div id="cupom-print" style="font-family:monospace;max-width:320px;margin:0 auto;font-size:0.8rem">' +
        '<div style="text-align:center;border-bottom:1px dashed #999;padding-bottom:8px;margin-bottom:8px">' +
          '<strong style="font-size:1rem">' + (emp.nome || 'Empresa') + '</strong><br>' +
          '<span>' + (emp.cnpj ? 'CNPJ: ' + emp.cnpj : '') + '</span><br>' +
          '<span style="font-size:0.7rem">' + (emp.endereco || '') + '</span><br>' +
          (emp.telefone ? '<span>Tel: ' + emp.telefone + '</span>' : '') +
        '</div>' +
        '<div style="border-bottom:1px dashed #999;padding-bottom:8px;margin-bottom:8px">' +
          '<strong>CUPOM NAO-FISCAL</strong><br>' +
          'Venda: #' + (vd.numero || '') + '<br>' +
          'Data: ' + (vd.data ? new Date(vd.data).toLocaleString('pt-BR') : '') + '<br>' +
          'Operador: ' + (vd.operador || '-') + '<br>' +
          (vd.cliente ? 'Cliente: ' + vd.cliente + '<br>' : '') +
          (vd.cpf ? 'CPF: ' + vd.cpf + '<br>' : '') +
        '</div>' +
        '<table style="width:100%;font-size:0.75rem"><thead><tr><th>#</th><th>Item</th><th class="text-right">Qtd</th><th class="text-right">Unit</th><th class="text-right">Sub</th></tr></thead><tbody>' + itensHtml + '</tbody></table>' +
        '<div style="border-top:1px dashed #999;margin-top:8px;padding-top:8px">' +
          '<div style="display:flex;justify-content:space-between"><span>Subtotal:</span><span>' + Utils.currency(totais.subtotal || 0) + '</span></div>' +
          (totais.desconto > 0 ? '<div style="display:flex;justify-content:space-between;color:var(--danger)"><span>Desconto:</span><span>-' + Utils.currency(totais.desconto) + '</span></div>' : '') +
          '<div style="display:flex;justify-content:space-between;font-size:1.1rem;font-weight:700;margin-top:4px"><span>TOTAL:</span><span>' + Utils.currency(totais.total || 0) + '</span></div>' +
        '</div>' +
        '<div style="border-top:1px dashed #999;margin-top:8px;padding-top:8px;font-size:0.75rem">' +
          '<strong>Pagamento: ' + (pag.forma || '') + '</strong><br>' +
          (pag.dinheiro > 0 ? 'Dinheiro: ' + Utils.currency(pag.dinheiro) + '<br>' : '') +
          (pag.pix > 0 ? 'PIX: ' + Utils.currency(pag.pix) + '<br>' : '') +
          (pag.debito > 0 ? 'Debito: ' + Utils.currency(pag.debito) + '<br>' : '') +
          (pag.credito > 0 ? 'Credito: ' + Utils.currency(pag.credito) + '<br>' : '') +
          (totais.troco > 0 ? '<strong>Troco: ' + Utils.currency(totais.troco) + '</strong>' : '') +
        '</div>' +
        '<div style="text-align:center;border-top:1px dashed #999;margin-top:8px;padding-top:8px;font-size:0.7rem">' +
          'NAO E DOCUMENTO FISCAL<br>VarlenSYS - varlem.com.br' +
        '</div>' +
      '</div>';

    Modal.show('Cupom Nao-Fiscal',
      cupomHtml,
      '<button class="btn btn-primary" data-onclick="Pages._imprimirCupom()"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Fechar</button>'
    );
  },

  _imprimirCupom: function() {
    var cupom = document.getElementById('cupom-print');
    if (!cupom) return;
    var win = window.open('', '_blank', 'width=350,height=600');
    win.document.write('<html><head><title>Cupom</title><style>body{font-family:monospace;margin:8px}table{width:100%;border-collapse:collapse}td,th{padding:2px 4px;text-align:left}.text-right{text-align:right}.fw-600{font-weight:600}@media print{body{margin:0}}</style></head><body>' + cupom.innerHTML + '<script>setTimeout(function(){window.print();},300)<\/script></body></html>');
    win.document.close();
  },

  // ============================================================
  //  IMPORTACAO CSV - Modal para importar produtos
  // ============================================================
  _importarProdutosCSV: function() {
    Modal.show('Importar Produtos via CSV',
      '<div style="margin-bottom:16px">' +
        '<p class="text-muted">Envie um arquivo CSV com os produtos. O arquivo deve ter cabecalho na primeira linha.</p>' +
        '<p class="text-muted" style="font-size:0.8rem">Campos obrigatorios: <strong>nome</strong>, <strong>preco_venda</strong></p>' +
        '<p class="text-muted" style="font-size:0.8rem">Campos opcionais: codigo_barras, preco_custo, estoque_atual, estoque_minimo, unidade, categoria, marca, ncm, descricao</p>' +
        '<a href="#" data-onclick="Pages._downloadTemplateCSV()" style="font-size:0.85rem"><i data-lucide="download" style="width:14px;height:14px"></i> Baixar template CSV</a>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Arquivo CSV</label>' +
        '<input type="file" class="form-control" id="csvFile" accept=".csv">' +
      '</div>' +
      '<div id="csvResult" style="margin-top:12px"></div>',
      '<button class="btn btn-primary" data-onclick="Pages._enviarCSV()"><i data-lucide="upload" style="width:16px;height:16px"></i> Importar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
  },

  _downloadTemplateCSV: async function() {
    try {
      var resp = await fetch('/api/importacao/template', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('varlen_token'), 'X-Tenant-Slug': App.slug }
      });
      var blob = await resp.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'template-produtos.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch(e) { Toast.error('Erro ao baixar template'); }
  },

  _enviarCSV: async function() {
    var input = document.getElementById('csvFile');
    if (!input || !input.files[0]) { Toast.error('Selecione um arquivo CSV'); return; }

    var formData = new FormData();
    formData.append('arquivo', input.files[0]);

    var resultDiv = document.getElementById('csvResult');
    if (resultDiv) resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      var resp = await fetch('/api/importacao', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('varlen_token'), 'X-Tenant-Slug': App.slug },
        body: formData
      });
      var data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro na importacao');

      var r = data.resultado || {};
      var errosHtml = '';
      if (r.erros && r.erros.length > 0) {
        errosHtml = '<div style="margin-top:8px;max-height:150px;overflow-y:auto;font-size:0.8rem;color:var(--danger)">' +
          r.erros.map(function(e) { return '<div>Linha ' + e.linha + ': ' + e.erro + '</div>'; }).join('') + '</div>';
      }

      if (resultDiv) {
        resultDiv.innerHTML =
          '<div class="card" style="background:var(--bg-secondary);padding:12px">' +
            '<div style="display:flex;gap:16px">' +
              '<div><strong style="color:var(--success)">' + (r.importados || 0) + '</strong> importados</div>' +
              '<div><strong style="color:var(--warning)">' + (r.atualizados || 0) + '</strong> atualizados</div>' +
              '<div><strong style="color:var(--danger)">' + (r.erros ? r.erros.length : 0) + '</strong> erros</div>' +
            '</div>' + errosHtml +
          '</div>';
      }
      Toast.success('Importacao concluida!');
    } catch(e) {
      if (resultDiv) resultDiv.innerHTML = '<div style="color:var(--danger)">' + e.message + '</div>';
      Toast.error(e.message);
    }
  },

  // ============================================================
  //  DEVOLUCAO PARCIAL - Modal
  // ============================================================
  _devolucaoParcial: async function(vendaId) {
    var res;
    try { res = await App.get('/vendas/' + vendaId); } catch(e) { return Toast.error('Erro ao carregar venda'); }
    var venda = res.venda || res;
    var itens = venda.VendaItems || venda.itens || [];

    var itensHtml = itens.map(function(item) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<input type="checkbox" id="devCheck_' + item.id + '" class="dev-check">' +
        '<div style="flex:1"><strong>' + item.produto_nome + '</strong><br>' +
          '<span class="text-muted" style="font-size:0.8rem">Qtd vendida: ' + parseFloat(item.quantidade) + ' - Unit: ' + Utils.currency(item.preco_unitario) + '</span></div>' +
        '<div class="form-group" style="margin:0;width:80px"><input type="number" class="form-control" id="devQtd_' + item.id + '" value="' + parseFloat(item.quantidade) + '" min="1" max="' + parseFloat(item.quantidade) + '" step="1" style="text-align:center"></div>' +
      '</div>';
    }).join('');

    Modal.show('Devolucao Parcial - Venda #' + (venda.numero || vendaId),
      '<p class="text-muted" style="margin-bottom:12px">Selecione os itens e quantidades a devolver:</p>' +
      itensHtml +
      '<div class="form-group" style="margin-top:12px"><label class="form-label">Motivo da devolucao</label>' +
        '<input type="text" class="form-control" id="devMotivo" placeholder="Ex: Produto avariado"></div>',
      '<button class="btn btn-warning" data-onclick="Pages._confirmarDevolucao(' + vendaId + ')"><i data-lucide="rotate-ccw" style="width:16px;height:16px"></i> Confirmar Devolucao</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
    Pages._devItens = itens;
  },

  _confirmarDevolucao: async function(vendaId) {
    var itens = [];
    (Pages._devItens || []).forEach(function(item) {
      var check = document.getElementById('devCheck_' + item.id);
      var qtd = document.getElementById('devQtd_' + item.id);
      if (check && check.checked && qtd) {
        itens.push({ item_id: item.id, quantidade: parseFloat(qtd.value) });
      }
    });
    if (itens.length === 0) { Toast.error('Selecione pelo menos um item'); return; }

    var motivo = (document.getElementById('devMotivo') || {}).value || '';

    var confirmado = await UI.confirm('Confirmar devolucao de ' + itens.length + ' item(ns)?');
    if (!confirmado) return;

    try {
      var res = await App.post('/vendas/' + vendaId + '/devolucao', { itens: itens, motivo: motivo });
      Toast.success('Devolucao registrada! Total devolvido: ' + Utils.currency(res.total_devolvido));
      Modal.close();
      Pages.vendas();
    } catch(e) {}
  }
};
