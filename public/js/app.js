/* ══════════════════════════════════════════════════════════════
   SGC - App Core v3.0
   SPA Router, API Client, Layout (SEM SIDEBAR), Utilities
   - Header global com menu de perfil flutuante
   - Cada módulo é um "app" com menu próprio no header
   - Icons: Lucide | Font: Inter
   ══════════════════════════════════════════════════════════════ */

// ── Suprimir erros técnicos/stack traces no console em produção ──
(function() {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    window.addEventListener('error', function(e) { e.preventDefault(); });
    window.addEventListener('unhandledrejection', function(e) { e.preventDefault(); });
    var noop = function() {};
    console.error = noop;
    console.warn = noop;
    console.trace = noop;
  }
})();

const App = {
  token: localStorage.getItem('sgc_token'),
  usuario: JSON.parse(localStorage.getItem('sgc_usuario') || 'null'),
  empresa: JSON.parse(localStorage.getItem('sgc_empresa') || 'null'),
  features: JSON.parse(localStorage.getItem('sgc_features') || 'null'),
  currentPage: null,
  tenantSlug: null, // slug do tenant atual extraído da URL

  // ── Detectar tenant slug da URL /app/:slug ──
  detectTenant: function() {
    var path = window.location.pathname;
    var match = path.match(/^\/app\/([a-z0-9-]+)/i);
    if (match) {
      this.tenantSlug = match[1];
    }
    return this.tenantSlug;
  },

  // ── API Client (envia X-Tenant-Slug no header) ──
  async api(url, options = {}) {
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    if (this.tenantSlug) headers['X-Tenant-Slug'] = this.tenantSlug;
    try {
      var res = await fetch('/api' + url, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      var data = await res.json();
      // Tentar refresh automático se token expirou
      if (res.status === 401 && !options._retry) {
        var refreshed = await this.tryRefreshToken();
        if (refreshed) {
          options._retry = true;
          return this.api(url, options);
        }
        this.logout();
        return null;
      }
      if (!res.ok) throw new Error(data.error || 'Erro na requisição');
      return data;
    } catch (error) {
      if (error.message !== 'Failed to fetch') Toast.error(error.message);
      throw error;
    }
  },
  async get(url) { return this.api(url); },
  async post(url, body) { return this.api(url, { method: 'POST', body: body }); },
  async put(url, body) { return this.api(url, { method: 'PUT', body: body }); },
  async del(url) { return this.api(url, { method: 'DELETE' }); },

  // ── Auth ──
  setAuth(data) {
    this.token = data.token;
    this.usuario = data.usuario;
    this.empresa = data.empresa;
    localStorage.setItem('sgc_token', data.token);
    if (data.refreshToken) localStorage.setItem('sgc_refresh_token', data.refreshToken);
    localStorage.setItem('sgc_usuario', JSON.stringify(data.usuario));
    localStorage.setItem('sgc_empresa', JSON.stringify(data.empresa));
    // Sincronizar cookie para o server-side guard ler na navegação
    document.cookie = 'sgc_token=' + data.token + ';path=/;SameSite=Strict';
    // Carregar features após auth
    this.loadFeatures();
  },
  async tryRefreshToken() {
    var refreshToken = localStorage.getItem('sgc_refresh_token');
    if (!refreshToken) return false;
    try {
      var res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken })
      });
      if (!res.ok) return false;
      var data = await res.json();
      this.token = data.token;
      localStorage.setItem('sgc_token', data.token);
      if (data.refreshToken) localStorage.setItem('sgc_refresh_token', data.refreshToken);
      // Sincronizar cookie
      document.cookie = 'sgc_token=' + data.token + ';path=/;SameSite=Strict';
      return true;
    } catch(e) { return false; }
  },
  async loadFeatures() {
    try {
      var f = await this.get('/features');
      this.features = f;
      localStorage.setItem('sgc_features', JSON.stringify(f));
    } catch(e) { this.features = null; }
  },
  logout() {
    // Salvar última empresa para exibir no login
    var emp = localStorage.getItem('sgc_empresa');
    if (emp) localStorage.setItem('sgc_last_empresa', emp);
    this.token = null; this.usuario = null; this.empresa = null; this.features = null;
    localStorage.removeItem('sgc_token');
    localStorage.removeItem('sgc_refresh_token');
    localStorage.removeItem('sgc_usuario');
    localStorage.removeItem('sgc_empresa');
    localStorage.removeItem('sgc_features');
    // Limpar cookie do server-side guard
    document.cookie = 'sgc_token=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // Se estiver em /app/:slug, recarregar para mostrar login do tenant
    if (this.tenantSlug) {
      window.location.hash = '#/login';
      window.location.reload();
    } else {
      Router.navigate('login');
    }
  },
  isAuthenticated() { return !!this.token; },
  hasPermission() {
    var perfis = Array.prototype.slice.call(arguments);
    return this.usuario && perfis.indexOf(this.usuario.perfil) !== -1;
  },
  isDrogaria() { return this.empresa && this.empresa.tipo_negocio === 'drogaria'; },
  hasFeature(modulo) {
    if (!this.features || !this.features.modulos) return false;
    return !!this.features.modulos[modulo];
  },

  // ── Theme ──
  toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sgc_theme', next);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },
  loadTheme() {
    var theme = localStorage.getItem('sgc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  },
  getInitials(nome) {
    if (!nome) return '?';
    var parts = nome.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
};

// ══════════════════════════════════════════════════
//  ROUTER (SPA)
// ══════════════════════════════════════════════════
var Router = {
  routes: {},
  _history: [],
  _navigating: false,
  register: function(path, handler) { this.routes[path] = handler; },
  navigate: function(path) { window.location.hash = '#/' + path; },
  async handleRoute() {
    if (Router._navigating) return;
    Router._navigating = true;
    try {
      var hash = window.location.hash.slice(2) || 'login';
      var page = hash.split('/')[0];
      if (page !== 'login' && page !== 'registro' && !App.isAuthenticated()) { Router._navigating = false; return Router.navigate('login'); }
      if (App.isAuthenticated() && (page === 'login' || page === 'registro')) { Router._navigating = false; return Router.navigate('home'); }
      var handler = this.routes[page];
      if (handler) {
        // Track navigation history for back button
        if (App.currentPage && App.currentPage !== page) {
          Router._history.push(App.currentPage);
          if (Router._history.length > 20) Router._history.shift();
        }
        App.currentPage = page;
        await handler();
        if (typeof lucide !== 'undefined') lucide.createIcons();
      } else {
        Router._navigating = false;
        Router.navigate('home');
        return;
      }
    } finally { Router._navigating = false; }
  },
  goBack: function() {
    var prev = Router._history.pop();
    Router.navigate(prev || 'home');
  }
};
window.addEventListener('hashchange', function() { Router.handleRoute(); });

// ══════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════
var Toast = {
  container: null,
  init: function() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },
  show: function(message, type, duration) {
    type = type || 'info'; duration = duration || 3000;
    if (!this.container) this.init();
    var icons = { success: '&#10003;', error: '&#10007;', warning: '&#9888;', info: '&#8505;' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;
    this.container.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  },
  success: function(msg) { this.show(msg, 'success'); },
  error: function(msg) { this.show(msg, 'error', 5000); },
  warning: function(msg) { this.show(msg, 'warning'); },
  info: function(msg) { this.show(msg, 'info'); }
};

// ══════════════════════════════════════════════════
//  UI — COMPONENTES REUTILIZÁVEIS
//  Helpers para gerar HTML de componentes padronizados
// ══════════════════════════════════════════════════
var UI = {
  // ── Skeleton Loading para tabelas ──
  skeletonTable: function(rows, cols) {
    rows = rows || 5; cols = cols || 4;
    var headerCols = '';
    for (var c = 0; c < cols; c++) {
      var w = c === 0 ? '30%' : (c === cols - 1 ? '15%' : '20%');
      headerCols += '<div class="skeleton skeleton-text" style="width:' + w + ';height:12px;margin:0"></div>';
    }
    var bodyRows = '';
    for (var r = 0; r < rows; r++) {
      var rowCols = '';
      for (var cc = 0; cc < cols; cc++) {
        var ww = cc === 0 ? (60 + Math.random() * 30) + '%' : (40 + Math.random() * 40) + '%';
        rowCols += '<div class="skeleton skeleton-text" style="width:' + ww + ';margin:0"></div>';
      }
      bodyRows += '<div class="skeleton-row">' + rowCols + '</div>';
    }
    return '<div class="skeleton-table">' +
      '<div class="skeleton-table-header">' + headerCols + '</div>' +
      bodyRows + '</div>';
  },

  // ── Skeleton Loading para cards (stats) ──
  skeletonCards: function(count) {
    count = count || 4;
    var cards = '';
    for (var i = 0; i < count; i++) {
      cards += '<div class="stat-card" style="padding:20px">' +
        '<div class="skeleton skeleton-text short" style="height:12px"></div>' +
        '<div class="skeleton skeleton-text" style="height:28px;width:50%;margin:12px 0 8px"></div>' +
        '<div class="skeleton skeleton-text medium" style="height:10px"></div>' +
      '</div>';
    }
    return '<div class="stats-grid">' + cards + '</div>';
  },

  // ── Skeleton Loading para formulário ──
  skeletonForm: function(fields) {
    fields = fields || 4;
    var html = '';
    for (var i = 0; i < fields; i++) {
      html += '<div class="form-group">' +
        '<div class="skeleton skeleton-text" style="height:12px;width:25%;margin-bottom:6px"></div>' +
        '<div class="skeleton" style="height:38px;width:100%"></div>' +
      '</div>';
    }
    return html;
  },

  // ── Empty State reutilizável ──
  emptyState: function(icon, title, message, action) {
    return '<div class="empty-state">' +
      (icon ? '<i data-lucide="' + icon + '" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:12px"></i>' : '') +
      '<h3>' + title + '</h3>' +
      '<p>' + (message || '') + '</p>' +
      (action ? '<div style="margin-top:16px">' + action + '</div>' : '') +
    '</div>';
  },

  // ── Stat Card reutilizável ──
  statCard: function(opts) {
    var trend = '';
    if (opts.trend) {
      var isUp = opts.trend > 0;
      trend = '<span class="stat-trend ' + (isUp ? 'stat-up' : 'stat-down') + '">' +
        '<i data-lucide="' + (isUp ? 'trending-up' : 'trending-down') + '" style="width:14px;height:14px"></i> ' +
        Math.abs(opts.trend) + '%</span>';
    }
    return '<div class="stat-card">' +
      '<div class="stat-header"><span class="stat-label">' + opts.label + '</span>' + trend + '</div>' +
      '<div class="stat-value">' + opts.value + '</div>' +
      (opts.detail ? '<div class="stat-detail">' + opts.detail + '</div>' : '') +
    '</div>';
  },

  // ── Badge reutilizável ──
  badge: function(text, type) {
    type = type || 'default';
    return '<span class="badge badge-' + type + '">' + text + '</span>';
  },

  // ── Confirmação moderna (substitui confirm nativo) ──
  confirm: function(title, message, onConfirm, opts) {
    opts = opts || {};
    var btnLabel = opts.confirmLabel || 'Confirmar';
    var btnClass = opts.danger ? 'btn-danger' : 'btn-primary';
    var footer =
      '<button class="btn btn-secondary" data-action="modal-close">Cancelar</button>' +
      '<button class="btn ' + btnClass + '" data-action="run-js" data-js="' + (opts.confirmAction || '') + '">' + btnLabel + '</button>';

    if (onConfirm && !opts.confirmAction) {
      // Usar callback direto
      var callbackId = '_uiConfirm' + Date.now();
      window[callbackId] = function() {
        Modal.close();
        onConfirm();
        delete window[callbackId];
      };
      footer =
        '<button class="btn btn-secondary" data-action="modal-close">Cancelar</button>' +
        '<button class="btn ' + btnClass + '" data-onclick="window[\'' + callbackId + '\']()">' + btnLabel + '</button>';
    }

    Modal.show(title, '<p>' + message + '</p>', footer);
  },

  // ── Loading state para botão ──
  btnLoading: function(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn._originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;animation:spin 1s linear infinite"></i> Aguarde...';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._originalHTML || btn.innerHTML;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
};

// ══════════════════════════════════════════════════
//  MODAL HELPER
// ══════════════════════════════════════════════════
var Modal = {
  _closeTimer: null,
  show: function(title, content, footer, cssClass) {
    // Cancelar qualquer close pendente para evitar race condition
    if (Modal._closeTimer) { clearTimeout(Modal._closeTimer); Modal._closeTimer = null; }
    footer = footer || ''; cssClass = cssClass || '';
    var overlay = document.querySelector('.modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML =
      '<div class="modal ' + cssClass + '">' +
        '<div class="modal-header"><h3>' + title + '</h3>' +
          '<button class="modal-close" data-action="modal-close">&times;</button></div>' +
        '<div class="modal-body">' + content + '</div>' +
        (footer ? '<div class="modal-footer">' + footer + '</div>' : '') +
      '</div>';
    requestAnimationFrame(function() { overlay.classList.add('active'); });
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },
  close: function() {
    if (Modal._closeTimer) { clearTimeout(Modal._closeTimer); Modal._closeTimer = null; }
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) { overlay.classList.remove('active'); Modal._closeTimer = setTimeout(function() { overlay.remove(); Modal._closeTimer = null; }, 200); }
  }
};

// ══════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════
var Utils = {
  currency: function(value) {
    return parseFloat(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  number: function(value, decimals) {
    decimals = decimals || 0;
    return parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  date: function(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  },
  dateTime: function(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  },
  maskCNPJ: function(value) {
    return value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
  },
  maskCPF: function(value) {
    return value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);
  },
  maskPhone: function(value) {
    return value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
  },
  quantidade: function(value, unidade) {
    var v = parseFloat(value || 0);
    var unidadesPeso = ['kg', 'lt', 'ml', 'g', 'l'];
    if (unidade && unidadesPeso.indexOf(unidade.toLowerCase()) !== -1) {
      return v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    }
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },
  maskCEP: function(value) {
    return value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  },

  // ── Helpers para data-on* (CSP sem unsafe-eval) ──
  maskNumericInput: function(e) { e.target.value = e.target.value.replace(/[^0-9.,]/g, ''); },
  maskIntegerInput: function(e) { e.target.value = e.target.value.replace(/[^0-9]/g, ''); },
  maskCPFInput: function(e) { e.target.value = Utils.maskCPF(e.target.value); },
  maskPhoneInput: function(e) { e.target.value = Utils.maskPhone(e.target.value); },
  maskCNPJInput: function(e) { e.target.value = Utils.maskCNPJ(e.target.value); }
};

// ══════════════════════════════════════════════════
//  LAYOUT RENDERER (SEM SIDEBAR)
//  Cada módulo é um "app" — só o header é global
// ══════════════════════════════════════════════════
var Layout = {
  /**
   * render(pageContent, opts)
   * opts.title:      string  - Título do módulo
   * opts.backTo:     string  - rota do botão voltar (default='home')
   * opts.hideBack:   bool    - esconder botão voltar (para home)
   * opts.moduleMenu: [{label, icon, id, active, action}] - sub-nav do módulo
   */
  render: function(pageContent, opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    var root = document.getElementById('app');
    var initials = App.getInitials(App.usuario ? App.usuario.nome : '');
    var themeIcon = document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon';
    var userName = App.usuario ? App.usuario.nome : '';
    var userPerfil = App.usuario ? App.usuario.perfil : '';
    var perfilLabel = userPerfil ? userPerfil.charAt(0).toUpperCase() + userPerfil.slice(1) : '';
    var backTo = opts.backTo || 'home';

    // Header
    var headerLeft = '';
    if (!opts.hideBack) {
      headerLeft = '<button class="header-back-btn" data-action="go-back" title="Voltar">' +
        '<i data-lucide="arrow-left" style="width:18px;height:18px"></i></button>';
    } else {
      headerLeft = '<div class="header-logo"><div class="logo-icon">S</div><span>SGC</span></div>';
    }
    headerLeft += '<h2 class="header-title">' + (opts.title || '') + '</h2>';

    // Module sub-nav
    var moduleNav = '';
    if (opts.moduleMenu && opts.moduleMenu.length > 0) {
      var navItems = opts.moduleMenu.map(function(m) {
        return '<button class="module-nav-item' + (m.active ? ' active' : '') + '" data-action="run-js" data-js="' + m.action + '">' +
          (m.icon ? '<i data-lucide="' + m.icon + '" style="width:15px;height:15px"></i> ' : '') +
          m.label + '</button>';
      }).join('');
      moduleNav = '<div class="module-nav">' + navItems + '</div>';
    }

    root.innerHTML =
      '<div class="app-layout-v3">' +
        '<header class="global-header">' +
          '<div class="header-left">' + headerLeft + '</div>' +
          '<div class="header-right">' +
            '<button class="header-icon-btn" data-action="toggle-theme" title="Alternar tema">' +
              '<i data-lucide="' + themeIcon + '" style="width:18px;height:18px"></i></button>' +
            '<div class="user-menu-wrapper">' +
              '<button class="user-menu-trigger" data-action="toggle-user-menu">' +
                '<div class="user-info-compact">' +
                  '<span class="user-name">' + userName + '</span>' +
                  '<span class="user-role">' + perfilLabel + '</span>' +
                '</div>' +
                '<div class="user-avatar">' + initials + '</div>' +
              '</button>' +
              '<div class="user-dropdown" id="userDropdown">' +
                '<div class="user-dropdown-header">' +
                  '<div class="user-avatar" style="width:40px;height:40px;font-size:1rem">' + initials + '</div>' +
                  '<div><strong>' + userName + '</strong><br><span class="text-muted" style="font-size:0.8rem">' + (App.usuario ? App.usuario.email : '') + '</span></div>' +
                '</div>' +
                '<div class="user-dropdown-body">' +
                  '<a class="user-dropdown-item" style="cursor:pointer" data-action="run-js" data-js="Layout.closeUserMenu();Pages.perfilModal()">' +
                    '<i data-lucide="user" style="width:16px;height:16px"></i> Meu Perfil</a>' +
                  (App.hasPermission('administrador')
                    ? '<a class="user-dropdown-item" href="#/config" data-action="close-user-menu">' +
                        '<i data-lucide="settings" style="width:16px;height:16px"></i> Configurações</a>' +
                      '<a class="user-dropdown-item" href="#/usuarios" data-action="close-user-menu">' +
                        '<i data-lucide="users" style="width:16px;height:16px"></i> Usuários</a>'
                    : '') +
                '</div>' +
                '<div class="user-dropdown-footer">' +
                  '<a class="user-dropdown-item text-danger" data-action="logout">' +
                    '<i data-lucide="log-out" style="width:16px;height:16px"></i> Sair do Sistema</a>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</header>' +
        moduleNav +
        '<main class="module-content">' + pageContent + '</main>' +
      '</div>';
    
    // Renderizar ícones Lucide após atualizar DOM
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  toggleUserMenu: function() {
    var dd = document.getElementById('userDropdown');
    if (dd) {
      var isOpen = dd.classList.contains('open');
      dd.classList.toggle('open');
      if (!isOpen) {
        // Fechar ao clicar fora
        setTimeout(function() {
          document.addEventListener('click', Layout._closeUserMenuHandler, { once: true });
        }, 10);
      }
    }
  },
  _closeUserMenuHandler: function(e) {
    var wrapper = document.querySelector('.user-menu-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      Layout.closeUserMenu();
    } else {
      // Re-adiciona listener se clicou dentro
      document.addEventListener('click', Layout._closeUserMenuHandler, { once: true });
    }
  },
  closeUserMenu: function() {
    var dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('open');
  },
  runActionString: function(actionString, event) {
    if (!actionString) return;
    var calls = actionString.split(';').map(function(c) { return c.trim(); }).filter(Boolean);
    calls.forEach(function(call) {
      // Suporte a assignments: Pages._tab='valor'
      var assignMatch = call.match(/^([A-Za-z0-9_.]+)\s*=\s*(.+)$/);
      if (assignMatch) {
        var aPath = assignMatch[1].split('.');
        var aVal = assignMatch[2].trim();
        if ((aVal[0] === "'" && aVal[aVal.length-1] === "'") || (aVal[0] === '"' && aVal[aVal.length-1] === '"')) aVal = aVal.slice(1,-1);
        else if (aVal === 'true') aVal = true;
        else if (aVal === 'false') aVal = false;
        else if (aVal === 'null') aVal = null;
        else if (!isNaN(Number(aVal)) && aVal !== '') aVal = Number(aVal);
        var aObj = window;
        for (var k = 0; k < aPath.length - 1; k++) { if (!aObj[aPath[k]]) return; aObj = aObj[aPath[k]]; }
        aObj[aPath[aPath.length - 1]] = aVal;
        return;
      }
      var match = call.match(/^([A-Za-z0-9_$.]+)\((.*)\)$/);
      if (!match) return;
      var path = match[1].split('.');
      var target = window;
      for (var i = 0; i < path.length - 1; i++) {
        if (!target[path[i]]) return;
        target = target[path[i]];
      }
      var method = target[path[path.length - 1]];
      if (typeof method !== 'function') return;

      var rawArgs = match[2].trim();
      var args = [];
      if (rawArgs.length > 0) {
        var parts = rawArgs.split(/,(?=(?:[^'\"]|'[^']*'|\"[^\"]*\")*$)/).map(function(p) { return p.trim(); });
        args = parts.map(function(part) {
          if (part === 'event') return event;
          if (part === 'true') return true;
          if (part === 'false') return false;
          if (part === 'null') return null;
          if (/^-?\d+(?:\.\d+)?$/.test(part)) return Number(part);
          if ((part.startsWith('\"') && part.endsWith('\"')) || (part.startsWith("'") && part.endsWith("'"))) {
            return part.slice(1, -1);
          }
          return part;
        });
      }
      method.apply(target, args);
    });
  }
};

// ══════════════════════════════════════════════════
//  INLINE ATTR BRIDGE (CSP script-src-attr 'none')
//  Mantém compatibilidade dos módulos legados (pages.js/pdv.js)
// ══════════════════════════════════════════════════
var InlineAttrBridge = {
  // ── Safe dispatcher: resolve dot-path function calls sem new Function / eval ──
  exec: function(el, code, event) {
    if (!el || !code) return;
    // Separar múltiplas instruções por ";"
    var stmts = code.split(';');
    for (var i = 0; i < stmts.length; i++) {
      var s = stmts[i].trim();
      if (!s) continue;
      InlineAttrBridge._execOne(s, el, event);
    }
  },

  _execOne: function(stmt, el, event) {
    // Suporte a assignments: Pages._tab='valor'
    var assignMatch = stmt.match(/^([A-Za-z0-9_.]+)\s*=\s*(.+)$/);
    if (assignMatch) {
      var aPath = assignMatch[1].split('.');
      var aVal = assignMatch[2].trim();
      if ((aVal[0] === "'" && aVal[aVal.length-1] === "'") || (aVal[0] === '"' && aVal[aVal.length-1] === '"')) aVal = aVal.slice(1,-1);
      else if (aVal === 'true') aVal = true;
      else if (aVal === 'false') aVal = false;
      else if (aVal === 'null') aVal = null;
      else if (!isNaN(Number(aVal)) && aVal !== '') aVal = Number(aVal);
      var aObj = window;
      for (var k = 0; k < aPath.length - 1; k++) { if (!aObj[aPath[k]]) return; aObj = aObj[aPath[k]]; }
      aObj[aPath[aPath.length - 1]] = aVal;
      return;
    }
    // Encontrar a posição do primeiro "(" que abre o call
    var parenIdx = stmt.indexOf('(');
    if (parenIdx === -1) return; // não é chamada de função — ignorar

    // Extrair o caminho da função e a string de args
    var fnPath = stmt.substring(0, parenIdx).trim();
    // Encontrar o ")" de fechamento correspondente
    var depth = 0;
    var closeIdx = -1;
    for (var i = parenIdx; i < stmt.length; i++) {
      if (stmt[i] === '(') depth++;
      else if (stmt[i] === ')') { depth--; if (depth === 0) { closeIdx = i; break; } }
    }
    if (closeIdx === -1) return;
    var argsStr = stmt.substring(parenIdx + 1, closeIdx).trim();

    // Resolver a função no escopo global
    var parts = fnPath.split('.');
    var obj = window;
    for (var j = 0; j < parts.length - 1; j++) {
      if (obj == null) return;
      obj = obj[parts[j]];
    }
    if (obj == null) return;
    var fn = obj[parts[parts.length - 1]];
    if (typeof fn !== 'function') return;

    // Parsear argumentos e chamar
    var args = InlineAttrBridge._parseArgs(argsStr, el, event);
    try {
      fn.apply(obj, args);
    } catch (e) {
      // silenciar em produção
    }
  },

  _parseArgs: function(argsStr, el, event) {
    if (!argsStr) return [];
    var args = [];
    var current = '';
    var inStr = false;
    var strChar = '';
    var depth = 0;

    for (var i = 0; i < argsStr.length; i++) {
      var c = argsStr[i];
      if (inStr) {
        current += c;
        if (c === '\\' && i + 1 < argsStr.length) { current += argsStr[++i]; continue; }
        if (c === strChar) inStr = false;
      } else if (c === '\'' || c === '"') {
        inStr = true; strChar = c; current += c;
      } else if (c === '(') {
        depth++; current += c;
      } else if (c === ')') {
        depth--; current += c;
      } else if (c === ',' && depth === 0) {
        args.push(InlineAttrBridge._parseValue(current.trim(), el, event));
        current = '';
      } else {
        current += c;
      }
    }
    if (current.trim()) args.push(InlineAttrBridge._parseValue(current.trim(), el, event));
    return args;
  },

  _parseValue: function(val, el, event) {
    if (val === 'event') return event;
    if (val === 'this') return el;
    if (val === 'this.value') return el ? el.value : undefined;
    if (val === 'null') return null;
    if (val === 'true') return true;
    if (val === 'false') return false;
    // String entre aspas
    if ((val[0] === '\'' && val[val.length - 1] === '\'') ||
        (val[0] === '"'  && val[val.length - 1] === '"')) {
      return val.substring(1, val.length - 1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    // Número
    var num = Number(val);
    if (!isNaN(num) && val !== '') return num;
    // Fallback
    return val;
  },

  bind: function() {
    // Todos os handlers usam data-on* para não violar CSP script-src-attr
    // click / touch
    document.addEventListener('click', function(event) {
      var el = event.target.closest('[data-onclick]');
      if (!el) return;
      event.preventDefault();
      InlineAttrBridge.exec(el, el.getAttribute('data-onclick'), event);
    }, true);

    // input
    document.addEventListener('input', function(event) {
      var el = event.target.closest('[data-oninput]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-oninput'), event);
    }, true);

    // change
    document.addEventListener('change', function(event) {
      var el = event.target.closest('[data-onchange]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-onchange'), event);
    }, true);

    // keydown
    document.addEventListener('keydown', function(event) {
      var el = event.target.closest('[data-onkeydown]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-onkeydown'), event);
    }, true);

    // enter (convenience — só dispara se Enter)
    document.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter') return;
      var el = event.target.closest('[data-onenter]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-onenter'), event);
    }, true);

    // submit
    document.addEventListener('submit', function(event) {
      var el = event.target.closest('[data-onsubmit]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-onsubmit'), event);
    }, true);

    // dragover
    document.addEventListener('dragover', function(event) {
      var el = event.target.closest('[data-ondragover]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-ondragover'), event);
    }, true);

    // dragleave
    document.addEventListener('dragleave', function(event) {
      var el = event.target.closest('[data-ondragleave]');
      if (!el) return;
      InlineAttrBridge.exec(el, el.getAttribute('data-ondragleave'), event);
    }, true);
  }
};

// ══════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
  InlineAttrBridge.bind();

  document.addEventListener('click', function(event) {
    var el = event.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    if (action === 'modal-close') { event.preventDefault(); return Modal.close(); }
    if (action === 'navigate') { event.preventDefault(); return Router.navigate(el.getAttribute('data-route') || 'home'); }
    if (action === 'go-back') { event.preventDefault(); return Router.goBack(); }
    if (action === 'toggle-theme') { event.preventDefault(); return App.toggleTheme(); }
    if (action === 'toggle-user-menu') { event.preventDefault(); return Layout.toggleUserMenu(); }
    if (action === 'close-user-menu') { return Layout.closeUserMenu(); }
    if (action === 'logout') { event.preventDefault(); return App.logout(); }
    if (action === 'run-js') { event.preventDefault(); return Layout.runActionString(el.getAttribute('data-js'), event); }
  });

  App.loadTheme();
  Toast.init();

  // Detectar tenant slug da URL
  App.detectTenant();

  // Sincronizar cookie para que o server-side guard funcione em navegações futuras
  if (App.token) {
    document.cookie = 'sgc_token=' + App.token + ';path=/;SameSite=Strict';
  }

  // ══════════════════════════════════════════════════════════════
  //  GUARD CLIENT-SIDE: Se o usuário autenticado não pertence
  //  ao tenant da URL, BLOQUEAR COMPLETAMENTE (zero render).
  //  Verifica: subdomínio salvo, ou empresa_id via decode do JWT.
  // ══════════════════════════════════════════════════════════════
  if (App.tenantSlug && App.isAuthenticated()) {
    var urlSlug = App.tenantSlug.toLowerCase();
    var tenantMismatch = false;

    // Método 1: Comparar subdomínio salvo na empresa
    if (App.empresa) {
      var savedSlug = (App.empresa.subdominio || '').toLowerCase();
      if (savedSlug && savedSlug !== urlSlug) {
        tenantMismatch = true;
      }
    }

    // Método 2: Decodificar payload do JWT e comparar empresa_id (fallback robusto)
    if (!tenantMismatch && App.token && App.empresa) {
      try {
        var payloadB64 = App.token.split('.')[1];
        var payload = JSON.parse(atob(payloadB64));
        // Se temos empresa salva com id, e o JWT empresa_id não bate, é cross-tenant
        if (payload.empresa_id && App.empresa.id && payload.empresa_id !== App.empresa.id) {
          tenantMismatch = true;
        }
      } catch(e) { /* token malformado — será tratado no login */ }
    }

    if (tenantMismatch) {
      // Token pertence a outro tenant — limpar sessão e redirecionar
      App.token = null; App.usuario = null; App.empresa = null; App.features = null;
      localStorage.removeItem('sgc_token');
      localStorage.removeItem('sgc_refresh_token');
      localStorage.removeItem('sgc_usuario');
      localStorage.removeItem('sgc_empresa');
      localStorage.removeItem('sgc_features');
      document.cookie = 'sgc_token=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
      // Esconder TUDO antes de redirecionar (impedir flash de layout)
      document.body.style.display = 'none';
      window.location.replace('/404.html');
      return; // Parar toda inicialização — sem render, sem fetch, sem rotas
    }
  }

  // ── Guard passou: tornar body visível ──
  document.body.style.visibility = 'visible';

  // Se estiver em /app/:slug, carregar dados visuais do tenant
  if (App.tenantSlug) {
    fetch('/api/landing/tenant/' + App.tenantSlug)
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(tenant) {
        if (tenant) {
          App.tenantInfo = tenant;
          // Aplicar cores do tenant como CSS custom properties
          if (tenant.cor_primaria) {
            document.documentElement.style.setProperty('--primary', tenant.cor_primaria);
          }
          if (tenant.cor_secundaria) {
            document.documentElement.style.setProperty('--secondary', tenant.cor_secundaria);
          }
        }
      })
      .catch(function(){})
      .finally(function() {
        // Registrar rotas e iniciar
        _registerRoutes();
        Router.handleRoute();
      });
  } else {
    // Sem tenant — rota direta
    _registerRoutes();
    Router.handleRoute();
  }

  function _registerRoutes() {
    Router.register('login', Pages.login);
    Router.register('registro', Pages.registro);
    Router.register('home', Pages.home);
    Router.register('pdv', Pages.pdv);
    Router.register('vendas', Pages.vendas);
    Router.register('caixa', Pages.caixa);
    Router.register('produtos', Pages.produtos);
    Router.register('categorias', Pages.categorias);
    Router.register('fornecedores', Pages.fornecedores);
    Router.register('estoque', Pages.estoque);
    Router.register('financeiro', Pages.financeiro);
    Router.register('usuarios', Pages.usuarios);
    Router.register('config', Pages.config);
    Router.register('clientes', Pages.clientes);
    Router.register('programas', Pages.programas);
    Router.register('sngpc', Pages.sngpc);
    Router.register('fiscal', Pages.fiscal);
    Router.register('compras', Pages.compras);
    Router.register('etiquetas', Pages.etiquetas);
    Router.register('tutorial', Pages.tutorial);
    // aliases legados
    Router.register('contas-pagar', Pages.financeiro);
    Router.register('contas-receber', Pages.financeiro);
    Router.register('dashboard', Pages.home);
  }

  // Atalho global: Ctrl+K = Busca Flutuante
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (App.isAuthenticated() && typeof Pages._buscaFlutuante === 'function') Pages._buscaFlutuante();
    }
  });

  // ── formatBRL global alias ──
  window.formatBRL = Utils.currency;
});
