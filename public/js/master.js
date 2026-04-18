/* ══════════════════════════════════════════════════════════════
   VarlenSYS Master Panel — Admin SaaS
   Arquivo externo (CSP-compatible, sem inline)
   ══════════════════════════════════════════════════════════════ */
var Master = {
  token: localStorage.getItem('varlen_master_token'),
  usuario: JSON.parse(localStorage.getItem('varlen_master_usuario') || 'null'),
  currentTab: 'dashboard',
  clientes: [],
  dashboard: null,
  searchTerm: '',

  // ── API ──
  api: async function(url, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    var res = await fetch('/api/master' + url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    var data = await res.json();
    if (res.status === 401) { this.logout(); return null; }
    if (!res.ok) throw new Error(data.error || 'Erro');
    return data;
  },

  // ── Auth ──
  setAuth: function(data) {
    this.token = data.token;
    this.usuario = data.usuario;
    localStorage.setItem('varlen_master_token', data.token);
    localStorage.setItem('varlen_master_usuario', JSON.stringify(data.usuario));
  },
  logout: function() {
    this.token = null; this.usuario = null;
    localStorage.removeItem('varlen_master_token');
    localStorage.removeItem('varlen_master_usuario');
    this.render();
  },

  // ── RENDER ──
  render: function() {
    if (!this.token) return this.renderLogin();
    this.renderApp();
  },

  // ── LOGIN PAGE ──
  renderLogin: function() {
    document.getElementById('masterApp').innerHTML =
      '<div class="auth-page">' +
        '<div class="auth-card">' +
          '<div class="auth-logo">' +
            '<div style="width:56px;height:56px;background:#2563eb;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.3rem;margin:0 auto">M</div>' +
            '<h1>VarlenSYS Master</h1>' +
            '<p>Painel de Gest\u00e3o SaaS</p>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Email</label>' +
            '<input type="email" class="form-control" id="masterEmail" placeholder="admin@varlensys.com"></div>' +
          '<div class="form-group">' +
            '<label class="form-label">Senha</label>' +
            '<input type="password" class="form-control" id="masterSenha" placeholder="Senha"></div>' +
          '<button class="btn btn-primary" style="width:100%;padding:12px;margin-top:8px;font-size:.95rem" data-action="master-login" id="masterLoginBtn">' +
            '<i data-lucide="log-in" style="width:18px;height:18px"></i> Entrar</button>' +
          '<p style="text-align:center;margin-top:20px;font-size:.82rem"><a href="/">Voltar ao site</a></p>' +
        '</div></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  doLogin: async function() {
    var btn = document.getElementById('masterLoginBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" style="width:18px;height:18px;animation:spin 1s linear infinite"></i> Entrando...';
    try {
      var data = await this.api('/login', {
        method: 'POST',
        body: {
          email: document.getElementById('masterEmail').value,
          senha: document.getElementById('masterSenha').value
        }
      });
      if (data) { this.setAuth(data); this.render(); }
    } catch(e) {
      alert(e.message || 'Erro ao fazer login');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="log-in" style="width:18px;height:18px"></i> Entrar';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  },

  // ── MAIN APP ──
  renderApp: function() {
    var root = document.getElementById('masterApp');
    root.innerHTML =
      '<div class="master-layout">' +
        '<header class="master-header">' +
          '<div class="master-header-left">' +
            '<div class="master-header-logo">M</div>' +
            '<h2>VarlenSYS Master</h2>' +
          '</div>' +
          '<div class="master-header-right">' +
            '<div class="master-header-user">' +
              '<i data-lucide="shield-check" style="width:16px;height:16px;color:#94a3b8"></i> ' +
              '<span>' + (this.usuario ? this.usuario.nome : '') + '</span>' +
            '</div>' +
            '<button class="btn-white" title="Sair" data-action="master-logout">' +
              '<i data-lucide="log-out" style="width:18px;height:18px"></i></button>' +
          '</div>' +
        '</header>' +
        '<div class="master-content">' +
          '<div class="master-tabs">' +
            '<button class="master-tab' + (this.currentTab === 'dashboard' ? ' active' : '') + '" data-action="master-switch-tab" data-tab="dashboard">' +
              '<i data-lucide="layout-dashboard" style="width:15px;height:15px"></i> Dashboard</button>' +
            '<button class="master-tab' + (this.currentTab === 'clientes' ? ' active' : '') + '" data-action="master-switch-tab" data-tab="clientes">' +
              '<i data-lucide="building-2" style="width:15px;height:15px"></i> Clientes</button>' +
          '</div>' +
          '<div id="masterTabContent"><div class="loading"><div class="spinner"></div></div></div>' +
        '</div>' +
      '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    this.loadTab();
  },

  switchTab: function(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.master-tab').forEach(function(el) { el.classList.remove('active'); });
    var tabs = document.querySelectorAll('.master-tab');
    for (var i = 0; i < tabs.length; i++) {
      if ((tab === 'dashboard' && i === 0) || (tab === 'clientes' && i === 1)) {
        tabs[i].classList.add('active');
      }
    }
    document.getElementById('masterTabContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    this.loadTab();
  },

  loadTab: async function() {
    if (this.currentTab === 'dashboard') await this.loadDashboard();
    else if (this.currentTab === 'clientes') await this.loadClientes();
  },

  // ── DASHBOARD ──
  loadDashboard: async function() {
    try {
      this.dashboard = await this.api('/dashboard');
      var d = this.dashboard;
      var container = document.getElementById('masterTabContent');
      container.innerHTML =
        '<div class="stats-row">' +
          this._statCard('building-2', 'blue', d.total_clientes, 'Total de Clientes') +
          this._statCard('check-circle', 'green', d.clientes_ativos, 'Ativos') +
          this._statCard('alert-triangle', 'amber', d.clientes_trial, 'Em Trial') +
          this._statCard('x-circle', 'red', d.clientes_suspensos, 'Suspensos') +
        '</div>' +
        '<div class="stats-row">' +
          this._statCard('trending-up', 'green', d.novos_ultimos_30_dias, 'Novos (30 dias)') +
          this._statCard('shopping-cart', 'blue', this._num(d.total_vendas_sistema), 'Vendas no Sistema') +
          this._statCard('dollar-sign', 'green', this._currency(d.faturamento_total_sistema), 'Faturamento Total') +
          this._statCard('bar-chart-3', 'amber', (d.por_tipo || []).length, 'Segmentos') +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
          '<div class="table-card">' +
            '<div class="table-header"><h3>Por Plano</h3></div>' +
            '<table><thead><tr><th>Plano</th><th>Clientes</th></tr></thead><tbody>' +
            (d.por_plano || []).map(function(p) {
              return '<tr><td style="text-transform:capitalize">' + (p.plano || 'N/A') + '</td><td><strong>' + p.total + '</strong></td></tr>';
            }).join('') +
            '</tbody></table></div>' +
          '<div class="table-card">' +
            '<div class="table-header"><h3>Por Tipo</h3></div>' +
            '<table><thead><tr><th>Tipo</th><th>Clientes</th></tr></thead><tbody>' +
            (d.por_tipo || []).map(function(t) {
              return '<tr><td style="text-transform:capitalize">' + (t.tipo_negocio || 'N/A') + '</td><td><strong>' + t.total + '</strong></td></tr>';
            }).join('') +
            '</tbody></table></div>' +
        '</div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) {
      document.getElementById('masterTabContent').innerHTML = '<div class="empty-state"><p>Erro ao carregar dashboard: ' + e.message + '</p></div>';
    }
  },

  // ── CLIENTES LIST ──
  loadClientes: async function() {
    try {
      this.clientes = await this.api('/clientes');
      this.renderClientes();
    } catch(e) {
      document.getElementById('masterTabContent').innerHTML = '<div class="empty-state"><p>Erro: ' + e.message + '</p></div>';
    }
  },

  renderClientes: function() {
    var self = this;
    var term = this.searchTerm.toLowerCase();
    var filtered = this.clientes.filter(function(c) {
      if (!term) return true;
      return (c.nome || '').toLowerCase().indexOf(term) !== -1 ||
             (c.email || '').toLowerCase().indexOf(term) !== -1 ||
             (c.subdominio || '').toLowerCase().indexOf(term) !== -1;
    });

    var rows = filtered.map(function(c) {
      var statusBadge = self._statusBadge(c.status);
      var tipoBadge = c.tipo_negocio === 'drogaria'
        ? '<span class="badge badge-green">Drogaria</span>'
        : '<span class="badge badge-blue">Mercado</span>';
      return '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:10px">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:' + (c.cor_primaria || '#2563eb') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem;flex-shrink:0">' +
            (c.nome_fantasia || c.nome || '?').charAt(0).toUpperCase() + '</div>' +
          '<div><strong style="font-size:.9rem">' + (c.nome_fantasia || c.nome) + '</strong>' +
            '<div style="font-size:.78rem;color:var(--text-muted)">' + (c.subdominio || '-') + '</div></div>' +
        '</div></td>' +
        '<td>' + tipoBadge + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + (c.total_usuarios || 0) + '</td>' +
        '<td style="font-size:.82rem;color:var(--text-muted)">' + self._date(c.created_at) + '</td>' +
        '<td>' +
          '<div style="display:flex;gap:4px">' +
            '<button class="btn btn-sm btn-ghost" title="Detalhes" data-action="master-view-cliente" data-id="' + c.id + '">' +
              '<i data-lucide="eye" style="width:14px;height:14px"></i></button>' +
            '<a href="' + (c.url_acesso || '/app/' + c.subdominio) + '" target="_blank" class="btn btn-sm btn-ghost" title="Acessar">' +
              '<i data-lucide="external-link" style="width:14px;height:14px"></i></a>' +
          '</div></td></tr>';
    }).join('');

    document.getElementById('masterTabContent').innerHTML =
      '<div class="table-card">' +
        '<div class="table-header">' +
          '<h3>Clientes (' + filtered.length + ')</h3>' +
          '<input type="text" class="table-search" id="masterSearchInput" placeholder="Buscar cliente..." value="' + this.searchTerm + '">' +
        '</div>' +
        '<table>' +
          '<thead><tr><th>Empresa</th><th>Tipo</th><th>Status</th><th>Usu\u00e1rios</th><th>Criado em</th><th>A\u00e7\u00f5es</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="6" class="empty-state">Nenhum cliente encontrado</td></tr>') + '</tbody>' +
        '</table></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ── DETALHES CLIENTE ──
  viewCliente: async function(id) {
    document.getElementById('masterTabContent').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      var data = await this.api('/clientes/' + id);
      this.renderDetalheCliente(data);
    } catch(e) {
      document.getElementById('masterTabContent').innerHTML = '<div class="empty-state"><p>Erro: ' + e.message + '</p></div>';
    }
  },

  renderDetalheCliente: function(data) {
    var self = this;
    var e = data.empresa;
    var stats = data.estatisticas;
    var usuarios = data.usuarios || [];

    var statusOpts = ['ativo', 'suspenso', 'trial', 'cancelado'];
    var statusSelect = '<select class="form-control" id="detailStatus" style="display:inline;width:auto;padding:4px 10px;font-size:.82rem">' +
      statusOpts.map(function(s) { return '<option value="' + s + '"' + (e.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') +
      '</select> <button class="btn btn-sm btn-primary" data-action="master-change-status" data-id="' + e.id + '">Salvar</button>';

    var userRows = usuarios.map(function(u) {
      return '<tr><td>' + u.nome + '</td><td style="font-size:.82rem">' + u.email + '</td>' +
        '<td><span class="badge badge-blue">' + u.perfil + '</span></td>' +
        '<td>' + (u.ativo ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-red">Inativo</span>') + '</td></tr>';
    }).join('');

    document.getElementById('masterTabContent').innerHTML =
      '<button class="detail-back" data-action="master-switch-tab" data-tab="clientes">' +
        '<i data-lucide="arrow-left" style="width:16px;height:16px"></i> Voltar para lista</button>' +

      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">' +
        '<div style="width:56px;height:56px;border-radius:14px;background:' + (e.cor_primaria || '#2563eb') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem">' +
          (e.nome_fantasia || e.nome || '?').charAt(0).toUpperCase() + '</div>' +
        '<div><h2 style="font-size:1.3rem;font-weight:800">' + (e.nome_fantasia || e.nome) + '</h2>' +
          '<span style="font-size:.88rem;color:var(--text-muted)">/' + (e.subdominio || '') + ' &bull; ' + (e.tipo_negocio || '') + '</span></div>' +
        '<div style="margin-left:auto;display:flex;gap:8px">' +
          '<button class="btn btn-sm btn-outline" data-action="master-edit-cliente" data-id="' + e.id + '">' +
            '<i data-lucide="edit-3" style="width:14px;height:14px"></i> Editar</button>' +
          '<button class="btn btn-sm btn-primary" data-action="master-impersonar" data-id="' + e.id + '">' +
            '<i data-lucide="user-check" style="width:14px;height:14px"></i> Impersonar</button>' +
          '<a href="/app/' + (e.subdominio || '') + '" target="_blank" class="btn btn-sm btn-success">' +
            '<i data-lucide="external-link" style="width:14px;height:14px"></i> Acessar</a>' +
        '</div>' +
      '</div>' +

      '<div class="detail-grid">' +
        '<div class="detail-card">' +
          '<h4><i data-lucide="info" style="width:16px;height:16px"></i> Informa\u00e7\u00f5es</h4>' +
          '<div class="detail-row"><span class="label">Raz\u00e3o Social</span><span class="value">' + (e.nome || '-') + '</span></div>' +
          '<div class="detail-row"><span class="label">CNPJ</span><span class="value">' + (e.cnpj || '-') + '</span></div>' +
          '<div class="detail-row"><span class="label">Email</span><span class="value">' + (e.email || '-') + '</span></div>' +
          '<div class="detail-row"><span class="label">Telefone</span><span class="value">' + (e.telefone || '-') + '</span></div>' +
          '<div class="detail-row"><span class="label">Plano</span><span class="value" style="text-transform:capitalize">' + (e.plano || '-') + '</span></div>' +
          '<div class="detail-row"><span class="label">Origem</span><span class="value">' + (e.origem_cadastro || 'manual') + '</span></div>' +
          '<div class="detail-row"><span class="label">Criado em</span><span class="value">' + this._date(e.created_at || e.createdAt) + '</span></div>' +
        '</div>' +
        '<div class="detail-card">' +
          '<h4><i data-lucide="activity" style="width:16px;height:16px"></i> Status & Visual</h4>' +
          '<div class="detail-row"><span class="label">Status</span><span class="value">' + statusSelect + '</span></div>' +
          '<div class="detail-row"><span class="label">Cor Prim\u00e1ria</span><span class="value"><span class="color-swatch" style="background:' + (e.cor_primaria || '#2563eb') + '"></span> ' + (e.cor_primaria || '#2563eb') + '</span></div>' +
          '<div class="detail-row"><span class="label">Cor Secund\u00e1ria</span><span class="value"><span class="color-swatch" style="background:' + (e.cor_secundaria || '#10b981') + '"></span> ' + (e.cor_secundaria || '#10b981') + '</span></div>' +
          '<div class="detail-row"><span class="label">Logo URL</span><span class="value" style="font-size:.78rem;word-break:break-all">' + (e.logo_url || 'Sem logo') + '</span></div>' +
          '<div class="detail-row"><span class="label">Estat\u00edsticas</span><span></span></div>' +
          '<div class="detail-row"><span class="label">Total Vendas</span><span class="value">' + this._num(stats.total_vendas) + '</span></div>' +
          '<div class="detail-row"><span class="label">Faturamento</span><span class="value">' + this._currency(stats.faturamento_total) + '</span></div>' +
        '</div>' +

        '<div class="detail-card full">' +
          '<h4><i data-lucide="users" style="width:16px;height:16px"></i> Usu\u00e1rios (' + usuarios.length + ')</h4>' +
          '<table><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th></tr></thead>' +
          '<tbody>' + (userRows || '<tr><td colspan="4">Nenhum</td></tr>') + '</tbody></table>' +
        '</div>' +
      '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  // ── ACTIONS ──
  changeStatus: async function(id) {
    var status = document.getElementById('detailStatus').value;
    try {
      await this.api('/clientes/' + id + '/status', { method: 'PUT', body: { status: status } });
      alert('Status alterado para: ' + status);
      this.viewCliente(id);
    } catch(e) { alert('Erro: ' + e.message); }
  },

  impersonar: async function(id) {
    try {
      var data = await this.api('/impersonar/' + id, { method: 'POST' });
      if (data && data.token) {
        // Salvar token do tenant e redirecionar (namespace DIFERENTE do master)
        localStorage.setItem('varlen_token', data.token);
        localStorage.setItem('varlen_usuario', JSON.stringify(data.usuario));
        localStorage.setItem('varlen_empresa', JSON.stringify(data.empresa));
        window.open(data.url + '#/home', '_blank');
      }
    } catch(e) { alert('Erro: ' + e.message); }
  },

  editCliente: async function(id) {
    var emp = this.clientes.find(function(c) { return c.id === id; });
    if (!emp) {
      try { var det = await this.api('/clientes/' + id); emp = det.empresa; } catch(e) { return alert('Erro'); }
    }
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'editModal';
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head"><h3>Editar: ' + (emp.nome_fantasia || emp.nome) + '</h3>' +
          '<button class="modal-close-btn" data-action="master-close-edit-modal">&times;</button></div>' +
        '<div class="modal-bd">' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Cor Prim\u00e1ria</label>' +
              '<input type="color" class="form-control" id="editCorP" value="' + (emp.cor_primaria || '#2563eb') + '" style="height:42px;padding:4px"></div>' +
            '<div class="form-group"><label class="form-label">Cor Secund\u00e1ria</label>' +
              '<input type="color" class="form-control" id="editCorS" value="' + (emp.cor_secundaria || '#10b981') + '" style="height:42px;padding:4px"></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Logo URL</label>' +
            '<input type="text" class="form-control" id="editLogo" value="' + (emp.logo_url || '') + '" placeholder="https://..."></div>' +
          '<div class="form-group"><label class="form-label">Plano</label>' +
            '<select class="form-control" id="editPlano"><option value="basico"' + (emp.plano==='basico' ? ' selected' : '') + '>B\u00e1sico</option>' +
              '<option value="profissional"' + (emp.plano==='profissional' ? ' selected' : '') + '>Profissional</option>' +
              '<option value="empresarial"' + (emp.plano==='empresarial' ? ' selected' : '') + '>Empresarial</option></select></div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Max Usu\u00e1rios</label>' +
              '<input type="number" class="form-control" id="editMaxU" value="' + (emp.max_usuarios || 5) + '"></div>' +
            '<div class="form-group"><label class="form-label">Max Caixas</label>' +
              '<input type="number" class="form-control" id="editMaxC" value="' + (emp.max_caixas || 3) + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-ft">' +
          '<button class="btn btn-outline" data-action="master-close-edit-modal">Cancelar</button>' +
          '<button class="btn btn-primary" data-action="master-save-edit" data-id="' + id + '">Salvar</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
  },

  saveEdit: async function(id) {
    try {
      await this.api('/clientes/' + id, {
        method: 'PUT',
        body: {
          cor_primaria: document.getElementById('editCorP').value,
          cor_secundaria: document.getElementById('editCorS').value,
          logo_url: document.getElementById('editLogo').value || null,
          plano: document.getElementById('editPlano').value,
          max_usuarios: parseInt(document.getElementById('editMaxU').value) || 5,
          max_caixas: parseInt(document.getElementById('editMaxC').value) || 3
        }
      });
      var modal = document.getElementById('editModal');
      if (modal) modal.remove();
      this.viewCliente(id);
    } catch(e) { alert('Erro: ' + e.message); }
  },

  // ── HELPERS ──
  _statCard: function(icon, color, value, label) {
    return '<div class="stat-card">' +
      '<div class="stat-icon ' + color + '"><i data-lucide="' + icon + '" style="width:22px;height:22px"></i></div>' +
      '<div><div class="stat-value">' + (value != null ? value : '-') + '</div><div class="stat-label">' + label + '</div></div></div>';
  },
  _statusBadge: function(status) {
    var map = { ativo: 'green', suspenso: 'red', trial: 'amber', cancelado: 'gray' };
    return '<span class="badge badge-' + (map[status] || 'gray') + '">' + (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'N/A') + '</span>';
  },
  _date: function(d) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; },
  _num: function(v) { return v != null ? parseInt(v).toLocaleString('pt-BR') : '0'; },
  _currency: function(v) { return parseFloat(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
};

// ── Init (delegated event listeners, NO inline handlers) ──
document.addEventListener('DOMContentLoaded', function() {
  document.addEventListener('click', function(event) {
    var actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    var action = actionEl.getAttribute('data-action');
    var id = parseInt(actionEl.getAttribute('data-id') || '0', 10);
    var tab = actionEl.getAttribute('data-tab');

    if (action === 'master-login') return Master.doLogin();
    if (action === 'master-logout') return Master.logout();
    if (action === 'master-switch-tab' && tab) return Master.switchTab(tab);
    if (action === 'master-view-cliente' && id) return Master.viewCliente(id);
    if (action === 'master-change-status' && id) return Master.changeStatus(id);
    if (action === 'master-edit-cliente' && id) return Master.editCliente(id);
    if (action === 'master-impersonar' && id) return Master.impersonar(id);
    if (action === 'master-close-edit-modal') {
      var modal = document.getElementById('editModal');
      if (modal) modal.remove();
      return;
    }
    if (action === 'master-save-edit' && id) return Master.saveEdit(id);
  });

  document.addEventListener('input', function(event) {
    if (event.target && event.target.id === 'masterSearchInput') {
      Master.searchTerm = event.target.value;
      Master.renderClientes();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && event.target && event.target.id === 'masterSenha') {
      Master.doLogin();
    }
  });

  Master.render();
});
