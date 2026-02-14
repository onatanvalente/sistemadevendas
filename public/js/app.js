/* ══════════════════════════════════════════════════════════════
   SGC - App Core
   SPA Router, API Client, Utilities
   ══════════════════════════════════════════════════════════════ */

const App = {
  token: localStorage.getItem('sgc_token'),
  usuario: JSON.parse(localStorage.getItem('sgc_usuario') || 'null'),
  empresa: JSON.parse(localStorage.getItem('sgc_empresa') || 'null'),
  currentPage: null,

  // ── API Client ──
  async api(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const res = await fetch(`/api${url}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const data = await res.json();
      
      if (res.status === 401) {
        this.logout();
        return null;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }

      return data;
    } catch (error) {
      if (error.message !== 'Failed to fetch') {
        Toast.error(error.message);
      }
      throw error;
    }
  },

  async get(url) { return this.api(url); },
  async post(url, body) { return this.api(url, { method: 'POST', body }); },
  async put(url, body) { return this.api(url, { method: 'PUT', body }); },
  async del(url) { return this.api(url, { method: 'DELETE' }); },

  // ── Auth ──
  setAuth(data) {
    this.token = data.token;
    this.usuario = data.usuario;
    this.empresa = data.empresa;
    localStorage.setItem('sgc_token', data.token);
    localStorage.setItem('sgc_usuario', JSON.stringify(data.usuario));
    localStorage.setItem('sgc_empresa', JSON.stringify(data.empresa));
  },

  logout() {
    this.token = null;
    this.usuario = null;
    this.empresa = null;
    localStorage.removeItem('sgc_token');
    localStorage.removeItem('sgc_usuario');
    localStorage.removeItem('sgc_empresa');
    Router.navigate('login');
  },

  isAuthenticated() {
    return !!this.token;
  },

  hasPermission(...perfis) {
    return this.usuario && perfis.includes(this.usuario.perfil);
  },

  isDrogaria() {
    return this.empresa?.tipo_negocio === 'drogaria';
  },

  // ── Theme ──
  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('sgc_theme', next);
  },

  loadTheme() {
    const theme = localStorage.getItem('sgc_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }
};

// ══════════════════════════════════════════════════
//  ROUTER (SPA)
// ══════════════════════════════════════════════════
const Router = {
  routes: {},

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = `#/${path}`;
  },

  async handleRoute() {
    const hash = window.location.hash.slice(2) || 'login';
    const page = hash.split('/')[0];

    // Auth guard
    if (page !== 'login' && page !== 'registro' && !App.isAuthenticated()) {
      return Router.navigate('login');
    }

    if (App.isAuthenticated() && (page === 'login' || page === 'registro')) {
      return Router.navigate('dashboard');
    }

    const handler = this.routes[page];
    if (handler) {
      App.currentPage = page;
      await handler();
      this.updateNavActive(page);
    } else {
      Router.navigate('dashboard');
    }
  },

  updateNavActive(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
  }
};

window.addEventListener('hashchange', () => Router.handleRoute());

// ══════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════
const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();
    
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning'); },
  info(msg) { this.show(msg, 'info'); }
};

// ══════════════════════════════════════════════════
//  MODAL HELPER
// ══════════════════════════════════════════════════
const Modal = {
  show(title, content, footer = '') {
    let overlay = document.querySelector('.modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="Modal.close()">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    requestAnimationFrame(() => overlay.classList.add('active'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close();
    });
  },

  close() {
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    }
  }
};

// ══════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════
const Utils = {
  currency(value) {
    return parseFloat(value || 0).toLocaleString('pt-BR', {
      style: 'currency', currency: 'BRL'
    });
  },

  number(value, decimals = 0) {
    return parseFloat(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },

  date(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  },

  dateTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  },

  // Debounce para busca
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // Máscara CNPJ
  maskCNPJ(value) {
    return value.replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  },

  // Máscara CPF
  maskCPF(value) {
    return value.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  },

  maskPhone(value) {
    return value.replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  }
};

// ══════════════════════════════════════════════════
//  LAYOUT RENDERER
// ══════════════════════════════════════════════════
const Layout = {
  render(pageContent, pageTitle = '') {
    const root = document.getElementById('app');
    
    const sidebarItems = [
      { icon: '📊', label: 'Dashboard', page: 'dashboard', perfis: ['administrador', 'vendedor', 'financeiro', 'farmaceutico'] },
      { section: 'VENDAS' },
      { icon: '🛒', label: 'PDV', page: 'pdv', perfis: ['administrador', 'vendedor', 'farmaceutico'] },
      { icon: '📋', label: 'Vendas', page: 'vendas', perfis: ['administrador', 'financeiro'] },
      { icon: '💵', label: 'Caixa', page: 'caixa', perfis: ['administrador', 'vendedor'] },
      { section: 'CADASTROS' },
      { icon: '📦', label: 'Produtos', page: 'produtos', perfis: ['administrador'] },
      { icon: '🏷️', label: 'Categorias', page: 'categorias', perfis: ['administrador'] },
      { icon: '🏭', label: 'Fornecedores', page: 'fornecedores', perfis: ['administrador', 'financeiro'] },
      { section: 'ESTOQUE' },
      { icon: '📊', label: 'Movimentações', page: 'estoque', perfis: ['administrador'] },
      { section: 'FINANCEIRO' },
      { icon: '💳', label: 'Contas a Pagar', page: 'contas-pagar', perfis: ['administrador', 'financeiro'] },
      { icon: '💰', label: 'Contas a Receber', page: 'contas-receber', perfis: ['administrador', 'financeiro'] },
      { section: 'SISTEMA' },
      { icon: '👥', label: 'Usuários', page: 'usuarios', perfis: ['administrador'] },
      { icon: '⚙️', label: 'Configurações', page: 'config', perfis: ['administrador'] },
    ];

    let navHTML = '';
    for (const item of sidebarItems) {
      if (item.section) {
        navHTML += `<div class="nav-section">${item.section}</div>`;
        continue;
      }
      if (!item.perfis.includes(App.usuario?.perfil)) continue;
      const active = App.currentPage === item.page ? 'active' : '';
      navHTML += `
        <a class="nav-item ${active}" data-page="${item.page}" href="#/${item.page}">
          <span class="icon">${item.icon}</span> ${item.label}
        </a>`;
    }

    root.innerHTML = `
      <div class="app-layout">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="logo-icon">💼</div>
            <h1>SGC</h1>
          </div>
          <nav class="sidebar-nav">${navHTML}</nav>
          <div class="sidebar-footer">
            <div style="font-size:0.85rem;color:#fff;margin-bottom:4px;">${App.usuario?.nome || ''}</div>
            <div style="font-size:0.75rem;">${App.empresa?.nome || ''}</div>
          </div>
        </aside>

        <main class="main-content">
          <header class="app-header">
            <div class="header-left">
              <button class="btn-menu-mobile" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button>
              <h2>${pageTitle}</h2>
            </div>
            <div class="header-right">
              <button class="btn btn-ghost btn-sm" onclick="App.toggleTheme()" title="Alternar tema">🌓</button>
              <span style="font-size:0.85rem;color:var(--text-light)">${App.usuario?.perfil || ''}</span>
              <button class="btn btn-ghost btn-sm" onclick="App.logout()" title="Sair">🚪 Sair</button>
            </div>
          </header>
          <div class="page-content">${pageContent}</div>
        </main>
      </div>`;
  }
};

// ══════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  App.loadTheme();
  Toast.init();

  // Registrar rotas
  Router.register('login', Pages.login);
  Router.register('registro', Pages.registro);
  Router.register('dashboard', Pages.dashboard);
  Router.register('pdv', Pages.pdv);
  Router.register('vendas', Pages.vendas);
  Router.register('caixa', Pages.caixa);
  Router.register('produtos', Pages.produtos);
  Router.register('categorias', Pages.categorias);
  Router.register('fornecedores', Pages.fornecedores);
  Router.register('estoque', Pages.estoque);
  Router.register('contas-pagar', Pages.contasPagar);
  Router.register('contas-receber', Pages.contasReceber);
  Router.register('usuarios', Pages.usuarios);
  Router.register('config', Pages.config);

  Router.handleRoute();
});
