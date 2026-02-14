/* ══════════════════════════════════════════════════════════════
   SGC - Pages
   Todas as páginas do sistema
   ══════════════════════════════════════════════════════════════ */

const Pages = {

  // ══════════════════════════════════════════════
  //  LOGIN
  // ══════════════════════════════════════════════
  login() {
    document.getElementById('app').innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="logo">
            <div style="font-size:3rem;margin-bottom:8px">💼</div>
            <h1>SGC</h1>
            <p>Sistema de Gestão Comercial</p>
          </div>
          <form id="loginForm">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" id="loginEmail" placeholder="seu@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Senha</label>
              <input type="password" class="form-control" id="loginSenha" placeholder="Sua senha" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block btn-lg" id="btnLogin">Entrar</button>
          </form>
          <div class="mt-2 text-center">
            <a href="#/registro">Cadastrar nova empresa</a>
          </div>
        </div>
      </div>`;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnLogin');
      btn.disabled = true;
      btn.textContent = 'Entrando...';
      
      try {
        const data = await App.post('/auth/login', {
          email: document.getElementById('loginEmail').value,
          senha: document.getElementById('loginSenha').value
        });
        App.setAuth(data);
        Toast.success(`Bem-vindo, ${data.usuario.nome}!`);
        Router.navigate('dashboard');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });
  },

  // ══════════════════════════════════════════════
  //  REGISTRO
  // ══════════════════════════════════════════════
  registro() {
    document.getElementById('app').innerHTML = `
      <div class="auth-page">
        <div class="auth-card" style="max-width:560px">
          <div class="logo">
            <div style="font-size:3rem;margin-bottom:8px">💼</div>
            <h1>Cadastrar Empresa</h1>
            <p>Crie sua conta no SGC</p>
          </div>
          <form id="registroForm">
            <h4 style="margin-bottom:12px;color:var(--primary)">Dados da Empresa</h4>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nome da Empresa *</label>
                <input type="text" class="form-control" id="regEmpNome" required>
              </div>
              <div class="form-group">
                <label class="form-label">CNPJ *</label>
                <input type="text" class="form-control" id="regEmpCnpj" placeholder="00.000.000/0000-00" required
                  oninput="this.value=Utils.maskCNPJ(this.value)">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tipo de Negócio *</label>
                <select class="form-control" id="regEmpTipo">
                  <option value="mercado">Mercado / Varejo</option>
                  <option value="drogaria">Drogaria / Farmácia</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Regime Tributário</label>
                <select class="form-control" id="regEmpRegime">
                  <option value="simples_nacional">Simples Nacional</option>
                  <option value="mei">MEI</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="lucro_real">Lucro Real</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input type="text" class="form-control" id="regEmpTel" placeholder="(00) 00000-0000"
                oninput="this.value=Utils.maskPhone(this.value)">
            </div>

            <h4 style="margin:20px 0 12px;color:var(--primary)">Seu Acesso (Administrador)</h4>
            <div class="form-group">
              <label class="form-label">Nome Completo *</label>
              <input type="text" class="form-control" id="regNome" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Email *</label>
                <input type="email" class="form-control" id="regEmail" required>
              </div>
              <div class="form-group">
                <label class="form-label">Senha *</label>
                <input type="password" class="form-control" id="regSenha" minlength="6" required>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg mt-2" id="btnRegistro">Cadastrar Empresa</button>
          </form>
          <div class="mt-2 text-center">
            <a href="#/login">Já tem conta? Faça login</a>
          </div>
        </div>
      </div>`;

    document.getElementById('registroForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnRegistro');
      btn.disabled = true;
      btn.textContent = 'Cadastrando...';

      try {
        const data = await App.post('/auth/registro', {
          empresa: {
            nome: document.getElementById('regEmpNome').value,
            cnpj: document.getElementById('regEmpCnpj').value,
            tipo_negocio: document.getElementById('regEmpTipo').value,
            regime_tributario: document.getElementById('regEmpRegime').value,
            telefone: document.getElementById('regEmpTel').value
          },
          usuario: {
            nome: document.getElementById('regNome').value,
            email: document.getElementById('regEmail').value,
            senha: document.getElementById('regSenha').value
          }
        });
        App.setAuth(data);
        Toast.success('Empresa cadastrada com sucesso!');
        Router.navigate('dashboard');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Cadastrar Empresa';
      }
    });
  },

  // ══════════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════════
  async dashboard() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Dashboard');
    
    try {
      const data = await App.get('/dashboard');
      
      const content = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon blue">💰</div>
            <div class="stat-info">
              <h4>Faturamento Hoje</h4>
              <div class="value">${Utils.currency(data.faturamento_hoje)}</div>
              <div class="detail">${data.vendas_hoje} vendas</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">📈</div>
            <div class="stat-info">
              <h4>Faturamento Mês</h4>
              <div class="value">${Utils.currency(data.faturamento_mes)}</div>
              <div class="detail">${data.vendas_mes} vendas</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon purple">🎯</div>
            <div class="stat-info">
              <h4>Ticket Médio</h4>
              <div class="value">${Utils.currency(data.ticket_medio)}</div>
              <div class="detail">por venda hoje</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber">⚠️</div>
            <div class="stat-info">
              <h4>Estoque Crítico</h4>
              <div class="value">${data.estoque_critico}</div>
              <div class="detail">produtos abaixo do mínimo</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon red">📅</div>
            <div class="stat-info">
              <h4>Contas Vencendo</h4>
              <div class="value">${data.contas_vencendo}</div>
              <div class="detail">${data.contas_vencidas} vencidas</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">💵</div>
            <div class="stat-info">
              <h4>A Receber</h4>
              <div class="value">${Utils.currency(data.total_receber)}</div>
              <div class="detail">pendente</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>🏆 Produtos Mais Vendidos (Mês)</h3>
          </div>
          <div class="card-body">
            ${data.produtos_mais_vendidos?.length > 0 ? `
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Produto</th>
                      <th class="text-right">Qtd Vendida</th>
                      <th class="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.produtos_mais_vendidos.map((p, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td>${p.produto_nome}</td>
                        <td class="text-right">${Utils.number(p.total_vendido, 0)}</td>
                        <td class="text-right">${Utils.currency(p.total_faturado)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="empty-state"><div class="icon">📊</div><h3>Nenhuma venda no mês</h3><p>Comece a vender para ver os dados aqui.</p></div>'}
          </div>
        </div>`;

      Layout.render(content, 'Dashboard');
    } catch (err) {
      Layout.render('<div class="empty-state"><div class="icon">❌</div><h3>Erro ao carregar dashboard</h3></div>', 'Dashboard');
    }
  },

  // ══════════════════════════════════════════════
  //  PDV (PONTO DE VENDA)
  // ══════════════════════════════════════════════
  async pdv() {
    // Verificar caixa aberto
    let caixaStatus;
    try {
      caixaStatus = await App.get('/caixa/status');
    } catch (e) {
      caixaStatus = { aberto: false };
    }

    if (!caixaStatus.aberto) {
      Layout.render(`
        <div class="empty-state">
          <div class="icon">💵</div>
          <h3>Caixa Fechado</h3>
          <p>Abra o caixa para começar a vender.</p>
          <button class="btn btn-primary btn-lg mt-2" onclick="PDV.abrirCaixaModal()">Abrir Caixa</button>
        </div>`, 'PDV');
      return;
    }

    Layout.render(`
      <div class="pdv-layout">
        <div class="pdv-products">
          <div class="pdv-search search-box">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-control" id="pdvSearch" 
              placeholder="Buscar produto ou escanear código de barras..." 
              autofocus>
          </div>
          <div class="card flex-1">
            <div class="card-body pdv-item-list" id="pdvResultados">
              <div class="empty-state" style="padding:40px">
                <div class="icon">🔍</div>
                <h3>Busque um produto</h3>
                <p>Digite o nome ou escaneie o código de barras</p>
              </div>
            </div>
          </div>
        </div>

        <div class="pdv-cart">
          <div class="pdv-cart-header">
            <h3>🛒 Carrinho</h3>
            <button class="btn btn-ghost btn-sm" onclick="PDV.limparCarrinho()" title="Limpar">🗑️ Limpar</button>
          </div>
          <div class="pdv-cart-items" id="pdvCartItems">
            <div class="empty-state" style="padding:30px">
              <p class="text-muted">Nenhum item</p>
            </div>
          </div>
          <div class="pdv-cart-footer">
            <div class="cart-totals">
              <div class="cart-total-line">
                <span>Subtotal</span>
                <span id="pdvSubtotal">R$ 0,00</span>
              </div>
              <div class="cart-total-line">
                <span>Desconto</span>
                <span id="pdvDesconto">R$ 0,00</span>
              </div>
              <div class="cart-total-line total">
                <span>TOTAL</span>
                <span id="pdvTotal">R$ 0,00</span>
              </div>
            </div>
            <div class="pdv-actions">
              <button class="btn btn-secondary" onclick="PDV.aplicarDesconto()">% Desconto</button>
              <button class="btn btn-warning" onclick="PDV.aplicarAcrescimo()">+ Acréscimo</button>
              <button class="btn btn-success btn-finalize" onclick="PDV.finalizarVenda()" id="btnFinalizar">
                💳 Finalizar Venda (F12)
              </button>
            </div>
          </div>
        </div>
      </div>`, 'PDV');

    PDV.init();
  },

  // ══════════════════════════════════════════════
  //  VENDAS (LISTAGEM)
  // ══════════════════════════════════════════════
  async vendas() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Vendas');
    
    try {
      const vendas = await App.get('/vendas?limit=50');
      
      const content = `
        <div class="card">
          <div class="card-header">
            <h3>Histórico de Vendas</h3>
          </div>
          <div class="card-body">
            ${vendas.length > 0 ? `
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Data/Hora</th>
                      <th>Cliente</th>
                      <th>Itens</th>
                      <th>Pagamento</th>
                      <th class="text-right">Total</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${vendas.map(v => `
                      <tr>
                        <td><strong>#${v.numero}</strong></td>
                        <td>${Utils.dateTime(v.created_at)}</td>
                        <td>${v.cliente_nome || '-'}</td>
                        <td>${v.VendaItems?.length || 0} itens</td>
                        <td>${v.forma_pagamento}</td>
                        <td class="text-right"><strong>${Utils.currency(v.total)}</strong></td>
                        <td>${v.status === 'finalizada' 
                          ? '<span class="badge badge-success">Finalizada</span>' 
                          : '<span class="badge badge-danger">Cancelada</span>'}</td>
                        <td>
                          ${v.status === 'finalizada' ? `
                            <button class="btn btn-ghost btn-sm" onclick="Pages.cancelarVenda(${v.id})">Cancelar</button>
                          ` : ''}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="empty-state"><div class="icon">📋</div><h3>Nenhuma venda registrada</h3></div>'}
          </div>
        </div>`;

      Layout.render(content, 'Vendas');
    } catch (err) {
      Layout.render('<div class="empty-state"><h3>Erro ao carregar vendas</h3></div>', 'Vendas');
    }
  },

  async cancelarVenda(id) {
    if (!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
    try {
      await App.put(`/vendas/${id}/cancelar`);
      Toast.success('Venda cancelada');
      Pages.vendas();
    } catch (e) {}
  },

  // ══════════════════════════════════════════════
  //  CAIXA
  // ══════════════════════════════════════════════
  async caixa() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Caixa');

    try {
      const status = await App.get('/caixa/status');
      const historico = await App.get('/caixa/historico');

      const content = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon ${status.aberto ? 'green' : 'red'}">💵</div>
            <div class="stat-info">
              <h4>Status do Caixa</h4>
              <div class="value">${status.aberto ? 'ABERTO' : 'FECHADO'}</div>
              ${status.caixa ? `<div class="detail">Aberto em: ${Utils.dateTime(status.caixa.data_abertura)}</div>` : ''}
            </div>
          </div>
          ${status.caixa ? `
            <div class="stat-card">
              <div class="stat-icon blue">🛒</div>
              <div class="stat-info">
                <h4>Total Vendas</h4>
                <div class="value">${Utils.currency(status.caixa.total_vendas)}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon green">💵</div>
              <div class="stat-info">
                <h4>Dinheiro</h4>
                <div class="value">${Utils.currency(status.caixa.total_dinheiro)}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon purple">📱</div>
              <div class="stat-info">
                <h4>Pix</h4>
                <div class="value">${Utils.currency(status.caixa.total_pix)}</div>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="d-flex gap-1 mb-2" style="gap:8px;display:flex;flex-wrap:wrap">
          ${!status.aberto ? `
            <button class="btn btn-success" onclick="PDV.abrirCaixaModal()">💵 Abrir Caixa</button>
          ` : `
            <button class="btn btn-danger" onclick="Pages.fecharCaixaModal()">🔒 Fechar Caixa</button>
            <button class="btn btn-warning" onclick="Pages.sangriaModal()">⬇️ Sangria</button>
            <button class="btn btn-primary" onclick="Pages.suprimentoModal()">⬆️ Suprimento</button>
          `}
        </div>

        <div class="card mt-2">
          <div class="card-header"><h3>Histórico de Caixas</h3></div>
          <div class="card-body">
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Abertura</th>
                    <th>Fechamento</th>
                    <th class="text-right">Vendas</th>
                    <th class="text-right">Diferença</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${historico.map(c => `
                    <tr>
                      <td>${Utils.dateTime(c.data_abertura)}</td>
                      <td>${c.data_fechamento ? Utils.dateTime(c.data_fechamento) : '-'}</td>
                      <td class="text-right">${Utils.currency(c.total_vendas)}</td>
                      <td class="text-right ${parseFloat(c.diferenca) < 0 ? 'text-danger' : ''}">${Utils.currency(c.diferenca)}</td>
                      <td>${c.status === 'aberto' 
                        ? '<span class="badge badge-success">Aberto</span>' 
                        : '<span class="badge badge-neutral">Fechado</span>'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>`;

      Layout.render(content, 'Caixa');
    } catch (err) {
      Layout.render('<div class="empty-state"><h3>Erro ao carregar caixa</h3></div>', 'Caixa');
    }
  },

  fecharCaixaModal() {
    Modal.show('Fechar Caixa', `
      <div class="form-group">
        <label class="form-label">Valor em caixa (contagem física)</label>
        <input type="number" step="0.01" class="form-control" id="valorFechamento" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-control" id="obsFechamento" rows="2"></textarea>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-danger" onclick="Pages.fecharCaixa()">Fechar Caixa</button>
    `);
  },

  async fecharCaixa() {
    try {
      const data = await App.post('/caixa/fechar', {
        valor_fechamento: document.getElementById('valorFechamento').value,
        observacoes: document.getElementById('obsFechamento').value
      });
      Modal.close();
      Toast.success('Caixa fechado!');
      
      // Mostrar resumo
      const r = data.resumo;
      Modal.show('Resumo do Caixa', `
        <div style="font-size:0.95rem">
          <p><strong>Total Vendas:</strong> ${Utils.currency(r.total_vendas)}</p>
          <p><strong>Dinheiro:</strong> ${Utils.currency(r.total_dinheiro)}</p>
          <p><strong>Pix:</strong> ${Utils.currency(r.total_pix)}</p>
          <p><strong>Débito:</strong> ${Utils.currency(r.total_debito)}</p>
          <p><strong>Crédito:</strong> ${Utils.currency(r.total_credito)}</p>
          <hr style="margin:12px 0">
          <p><strong>Sangrias:</strong> ${Utils.currency(r.total_sangria)}</p>
          <p><strong>Suprimentos:</strong> ${Utils.currency(r.total_suprimento)}</p>
          <hr style="margin:12px 0">
          <p><strong>Valor Esperado:</strong> ${Utils.currency(r.valor_esperado)}</p>
          <p><strong>Valor Informado:</strong> ${Utils.currency(r.valor_fechamento)}</p>
          <p style="font-size:1.1rem;margin-top:8px"><strong>Diferença:</strong> 
            <span style="color:${parseFloat(r.diferenca) < 0 ? 'var(--danger)' : 'var(--success)'}">
              ${Utils.currency(r.diferenca)}
            </span></p>
          <p><strong>Quantidade de vendas:</strong> ${r.quantidade_vendas}</p>
        </div>
      `, '<button class="btn btn-primary" onclick="Modal.close();Pages.caixa()">OK</button>');
    } catch (e) {}
  },

  sangriaModal() {
    Modal.show('Sangria', `
      <div class="form-group">
        <label class="form-label">Valor</label>
        <input type="number" step="0.01" class="form-control" id="valorSangria" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Motivo</label>
        <input type="text" class="form-control" id="motivoSangria" placeholder="Ex: Pagamento fornecedor">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-warning" onclick="Pages.registrarSangria()">Registrar</button>
    `);
  },

  async registrarSangria() {
    try {
      await App.post('/caixa/sangria', {
        valor: document.getElementById('valorSangria').value,
        motivo: document.getElementById('motivoSangria').value
      });
      Modal.close();
      Toast.success('Sangria registrada');
      Pages.caixa();
    } catch (e) {}
  },

  suprimentoModal() {
    Modal.show('Suprimento', `
      <div class="form-group">
        <label class="form-label">Valor</label>
        <input type="number" step="0.01" class="form-control" id="valorSuprimento" placeholder="0,00">
      </div>
      <div class="form-group">
        <label class="form-label">Motivo</label>
        <input type="text" class="form-control" id="motivoSuprimento" placeholder="Ex: Troco">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" onclick="Pages.registrarSuprimento()">Registrar</button>
    `);
  },

  async registrarSuprimento() {
    try {
      await App.post('/caixa/suprimento', {
        valor: document.getElementById('valorSuprimento').value,
        motivo: document.getElementById('motivoSuprimento').value
      });
      Modal.close();
      Toast.success('Suprimento registrado');
      Pages.caixa();
    } catch (e) {}
  },

  // ══════════════════════════════════════════════
  //  PRODUTOS
  // ══════════════════════════════════════════════
  async produtos() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Produtos');

    try {
      const produtos = await App.get('/produtos');

      const content = `
        <div class="d-flex justify-between align-center mb-2" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div class="search-box" style="flex:1;max-width:400px">
            <span class="search-icon">🔍</span>
            <input type="text" class="form-control" id="buscaProduto" placeholder="Buscar produto..."
              oninput="Pages.filtrarProdutos(this.value)">
          </div>
          <button class="btn btn-primary" onclick="Pages.novoProdutoModal()">+ Novo Produto</button>
        </div>

        <div class="card">
          <div class="card-body">
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Código</th>
                    <th>Categoria</th>
                    <th class="text-right">Custo</th>
                    <th class="text-right">Venda</th>
                    <th class="text-right">Margem</th>
                    <th class="text-right">Estoque</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="tabelaProdutos">
                  ${produtos.map(p => `
                    <tr class="produto-row" data-nome="${p.nome.toLowerCase()}">
                      <td>
                        <strong>${p.nome}</strong>
                        ${p.controlado ? ' <span class="badge badge-danger">Controlado</span>' : ''}
                      </td>
                      <td>${p.codigo_barras || '-'}</td>
                      <td>${p.Categorium?.nome || '-'}</td>
                      <td class="text-right">${Utils.currency(p.preco_custo)}</td>
                      <td class="text-right"><strong>${Utils.currency(p.preco_venda)}</strong></td>
                      <td class="text-right">${Utils.number(p.margem, 1)}%</td>
                      <td class="text-right">
                        <span class="${parseFloat(p.estoque_atual) <= parseFloat(p.estoque_minimo) ? 'text-danger' : ''}">
                          ${Utils.number(p.estoque_atual, 0)}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-ghost btn-sm" onclick="Pages.editarProdutoModal(${p.id})">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="Pages.deletarProduto(${p.id})">🗑️</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ${produtos.length === 0 ? '<div class="empty-state mt-2"><div class="icon">📦</div><h3>Nenhum produto cadastrado</h3></div>' : ''}
          </div>
        </div>`;

      Layout.render(content, `Produtos (${produtos.length})`);
      window._produtos = produtos;
    } catch (err) {
      Layout.render('<div class="empty-state"><h3>Erro ao carregar produtos</h3></div>', 'Produtos');
    }
  },

  filtrarProdutos(busca) {
    const rows = document.querySelectorAll('.produto-row');
    const termo = busca.toLowerCase();
    rows.forEach(row => {
      row.style.display = row.dataset.nome.includes(termo) ? '' : 'none';
    });
  },

  novoProdutoModal() {
    Modal.show('Novo Produto', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input type="text" class="form-control" id="prodNome" required>
        </div>
        <div class="form-group">
          <label class="form-label">Código de Barras</label>
          <input type="text" class="form-control" id="prodCodigo">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Preço Custo</label>
          <input type="number" step="0.01" class="form-control" id="prodCusto" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Preço Venda *</label>
          <input type="number" step="0.01" class="form-control" id="prodVenda" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Estoque Inicial</label>
          <input type="number" class="form-control" id="prodEstoque" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Estoque Mínimo</label>
          <input type="number" class="form-control" id="prodEstoqueMin" value="5">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Unidade</label>
          <select class="form-control" id="prodUnidade">
            <option value="UN">Unidade (UN)</option>
            <option value="KG">Quilograma (KG)</option>
            <option value="LT">Litro (LT)</option>
            <option value="CX">Caixa (CX)</option>
            <option value="PCT">Pacote (PCT)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="prodControlado"> Controlado (ANVISA)
          </label>
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" onclick="Pages.salvarProduto()">Salvar</button>
    `);
  },

  async salvarProduto() {
    try {
      await App.post('/produtos', {
        nome: document.getElementById('prodNome').value,
        codigo_barras: document.getElementById('prodCodigo').value,
        preco_custo: document.getElementById('prodCusto').value,
        preco_venda: document.getElementById('prodVenda').value,
        estoque_atual: document.getElementById('prodEstoque').value,
        estoque_minimo: document.getElementById('prodEstoqueMin').value,
        unidade: document.getElementById('prodUnidade').value,
        controlado: document.getElementById('prodControlado').checked
      });
      Modal.close();
      Toast.success('Produto criado!');
      Pages.produtos();
    } catch (e) {}
  },

  async editarProdutoModal(id) {
    try {
      const p = await App.get(`/produtos/${id}`);
      Modal.show('Editar Produto', `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input type="text" class="form-control" id="editProdNome" value="${p.nome}">
          </div>
          <div class="form-group">
            <label class="form-label">Código de Barras</label>
            <input type="text" class="form-control" id="editProdCodigo" value="${p.codigo_barras || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Preço Custo</label>
            <input type="number" step="0.01" class="form-control" id="editProdCusto" value="${p.preco_custo}">
          </div>
          <div class="form-group">
            <label class="form-label">Preço Venda</label>
            <input type="number" step="0.01" class="form-control" id="editProdVenda" value="${p.preco_venda}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Estoque Mínimo</label>
            <input type="number" class="form-control" id="editProdEstoqueMin" value="${p.estoque_minimo}">
          </div>
          <div class="form-group">
            <label class="form-label">Unidade</label>
            <select class="form-control" id="editProdUnidade">
              <option value="UN" ${p.unidade === 'UN' ? 'selected' : ''}>UN</option>
              <option value="KG" ${p.unidade === 'KG' ? 'selected' : ''}>KG</option>
              <option value="LT" ${p.unidade === 'LT' ? 'selected' : ''}>LT</option>
              <option value="CX" ${p.unidade === 'CX' ? 'selected' : ''}>CX</option>
              <option value="PCT" ${p.unidade === 'PCT' ? 'selected' : ''}>PCT</option>
            </select>
          </div>
        </div>
      `, `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.atualizarProduto(${id})">Salvar</button>
      `);
    } catch(e) {}
  },

  async atualizarProduto(id) {
    try {
      await App.put(`/produtos/${id}`, {
        nome: document.getElementById('editProdNome').value,
        codigo_barras: document.getElementById('editProdCodigo').value,
        preco_custo: document.getElementById('editProdCusto').value,
        preco_venda: document.getElementById('editProdVenda').value,
        estoque_minimo: document.getElementById('editProdEstoqueMin').value,
        unidade: document.getElementById('editProdUnidade').value
      });
      Modal.close();
      Toast.success('Produto atualizado!');
      Pages.produtos();
    } catch (e) {}
  },

  async deletarProduto(id) {
    if (!confirm('Desativar este produto?')) return;
    try {
      await App.del(`/produtos/${id}`);
      Toast.success('Produto desativado');
      Pages.produtos();
    } catch (e) {}
  },

  // ══════════════════════════════════════════════
  //  CATEGORIAS
  // ══════════════════════════════════════════════
  async categorias() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Categorias');
    try {
      const cats = await App.get('/categorias');
      const content = `
        <div class="d-flex justify-between mb-2" style="display:flex;justify-content:space-between;align-items:center">
          <h3>${cats.length} categorias</h3>
          <button class="btn btn-primary" onclick="Pages.novaCategoriaModal()">+ Nova Categoria</button>
        </div>
        <div class="card">
          <div class="card-body">
            <div class="table-container">
              <table>
                <thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead>
                <tbody>
                  ${cats.map(c => `<tr>
                    <td><strong>${c.nome}</strong></td>
                    <td>${c.descricao || '-'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="Pages.editarCategoria(${c.id},${JSON.stringify(c.nome).replace(/'/g,'&#39;')},${JSON.stringify(c.descricao || '').replace(/'/g,'&#39;')})">✏️</button>
                      <button class="btn btn-ghost btn-sm" onclick="Pages.deletarCategoria(${c.id})">🗑️</button>
                    </td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            ${cats.length === 0 ? '<div class="empty-state"><h3>Nenhuma categoria</h3></div>' : ''}
          </div>
        </div>`;
      Layout.render(content, 'Categorias');
    } catch(e) {
      Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Categorias');
    }
  },

  novaCategoriaModal() {
    Modal.show('Nova Categoria', `
      <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="catNome"></div>
      <div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="catDesc"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.salvarCategoria()">Salvar</button>`);
  },

  async salvarCategoria() {
    try {
      await App.post('/categorias', { nome: document.getElementById('catNome').value, descricao: document.getElementById('catDesc').value });
      Modal.close(); Toast.success('Categoria criada!'); Pages.categorias();
    } catch(e) {}
  },

  editarCategoria(id, nome, desc) {
    Modal.show('Editar Categoria', `
      <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="editCatNome" value="${nome}"></div>
      <div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="editCatDesc" value="${desc}"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.atualizarCategoria(${id})">Salvar</button>`);
  },

  async atualizarCategoria(id) {
    try {
      await App.put(`/categorias/${id}`, { nome: document.getElementById('editCatNome').value, descricao: document.getElementById('editCatDesc').value });
      Modal.close(); Toast.success('Categoria atualizada!'); Pages.categorias();
    } catch(e) {}
  },

  async deletarCategoria(id) {
    if (!confirm('Desativar?')) return;
    await App.del(`/categorias/${id}`); Toast.success('Desativada'); Pages.categorias();
  },

  // ══════════════════════════════════════════════
  //  FORNECEDORES
  // ══════════════════════════════════════════════
  async fornecedores() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Fornecedores');
    try {
      const fornecedores = await App.get('/fornecedores');
      const content = `
        <div class="d-flex justify-between mb-2" style="display:flex;justify-content:space-between;align-items:center">
          <h3>${fornecedores.length} fornecedores</h3>
          <button class="btn btn-primary" onclick="Pages.novoFornecedorModal()">+ Novo Fornecedor</button>
        </div>
        <div class="card"><div class="card-body">
          <div class="table-container"><table>
            <thead><tr><th>Nome</th><th>CNPJ/CPF</th><th>Telefone</th><th>Email</th><th>Ações</th></tr></thead>
            <tbody>
              ${fornecedores.map(f => `<tr>
                <td><strong>${f.nome}</strong></td><td>${f.cnpj_cpf || '-'}</td>
                <td>${f.telefone || '-'}</td><td>${f.email || '-'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="Pages.deletarFornecedor(${f.id})">🗑️</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${fornecedores.length === 0 ? '<div class="empty-state"><h3>Nenhum fornecedor</h3></div>' : ''}
        </div></div>`;
      Layout.render(content, 'Fornecedores');
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Fornecedores'); }
  },

  novoFornecedorModal() {
    Modal.show('Novo Fornecedor', `
      <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-control" id="fornNome"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">CNPJ/CPF</label><input type="text" class="form-control" id="fornCnpj"></div>
        <div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="fornTel"></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="fornEmail"></div>
      <div class="form-group"><label class="form-label">Contato</label><input type="text" class="form-control" id="fornContato"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.salvarFornecedor()">Salvar</button>`);
  },

  async salvarFornecedor() {
    try {
      await App.post('/fornecedores', {
        nome: document.getElementById('fornNome').value,
        cnpj_cpf: document.getElementById('fornCnpj').value,
        telefone: document.getElementById('fornTel').value,
        email: document.getElementById('fornEmail').value,
        contato: document.getElementById('fornContato').value
      });
      Modal.close(); Toast.success('Fornecedor criado!'); Pages.fornecedores();
    } catch(e) {}
  },

  async deletarFornecedor(id) {
    if (!confirm('Desativar?')) return;
    await App.del(`/fornecedores/${id}`); Toast.success('Desativado'); Pages.fornecedores();
  },

  // ══════════════════════════════════════════════
  //  ESTOQUE (MOVIMENTAÇÕES)
  // ══════════════════════════════════════════════
  async estoque() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Estoque');
    try {
      const movs = await App.get('/estoque');
      const content = `
        <div class="d-flex gap-1 mb-2" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-success" onclick="Pages.entradaEstoqueModal()">⬆️ Entrada</button>
          <button class="btn btn-warning" onclick="Pages.ajusteEstoqueModal()">🔄 Ajuste</button>
          <button class="btn btn-danger" onclick="Pages.perdaEstoqueModal()">⬇️ Perda</button>
        </div>
        <div class="card"><div class="card-body">
          <div class="table-container"><table>
            <thead><tr>
              <th>Data</th><th>Produto</th><th>Tipo</th>
              <th class="text-right">Qtd</th><th class="text-right">Anterior</th><th class="text-right">Posterior</th>
              <th>Motivo</th>
            </tr></thead>
            <tbody>
              ${movs.map(m => `<tr>
                <td>${Utils.dateTime(m.created_at)}</td>
                <td>${m.Produto?.nome || '-'}</td>
                <td><span class="badge ${m.tipo === 'entrada' ? 'badge-success' : m.tipo === 'saida' ? 'badge-danger' : 'badge-warning'}">${m.tipo}</span></td>
                <td class="text-right">${Utils.number(m.quantidade, 0)}</td>
                <td class="text-right">${Utils.number(m.estoque_anterior, 0)}</td>
                <td class="text-right">${Utils.number(m.estoque_posterior, 0)}</td>
                <td>${m.motivo || '-'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${movs.length === 0 ? '<div class="empty-state"><h3>Nenhuma movimentação</h3></div>' : ''}
        </div></div>`;
      Layout.render(content, 'Movimentações de Estoque');
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Estoque'); }
  },

  async _selectProdutos() {
    const prods = window._produtos || await App.get('/produtos');
    window._produtos = prods;
    return prods.map(p => `<option value="${p.id}">${p.nome} (Est: ${p.estoque_atual})</option>`).join('');
  },

  async entradaEstoqueModal() {
    const opts = await Pages._selectProdutos();
    Modal.show('Entrada de Estoque', `
      <div class="form-group"><label class="form-label">Produto</label><select class="form-control" id="estProduto">${opts}</select></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Quantidade</label><input type="number" class="form-control" id="estQtd" value="1"></div>
        <div class="form-group"><label class="form-label">Preço Custo (novo)</label><input type="number" step="0.01" class="form-control" id="estCusto"></div>
      </div>
      <div class="form-group"><label class="form-label">Motivo</label><input type="text" class="form-control" id="estMotivo" value="Compra de mercadoria"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-success" onclick="Pages.salvarEntrada()">Registrar</button>`);
  },

  async salvarEntrada() {
    try {
      await App.post('/estoque/entrada', {
        produto_id: document.getElementById('estProduto').value,
        quantidade: document.getElementById('estQtd').value,
        preco_custo: document.getElementById('estCusto').value || undefined,
        motivo: document.getElementById('estMotivo').value
      });
      Modal.close(); Toast.success('Entrada registrada!'); Pages.estoque();
    } catch(e) {}
  },

  async ajusteEstoqueModal() {
    const opts = await Pages._selectProdutos();
    Modal.show('Ajuste de Estoque', `
      <div class="form-group"><label class="form-label">Produto</label><select class="form-control" id="ajProduto">${opts}</select></div>
      <div class="form-group"><label class="form-label">Quantidade Real (nova)</label><input type="number" class="form-control" id="ajQtd"></div>
      <div class="form-group"><label class="form-label">Motivo</label><input type="text" class="form-control" id="ajMotivo" value="Ajuste de inventário"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-warning" onclick="Pages.salvarAjuste()">Ajustar</button>`);
  },

  async salvarAjuste() {
    try {
      await App.post('/estoque/ajuste', {
        produto_id: document.getElementById('ajProduto').value,
        quantidade_nova: document.getElementById('ajQtd').value,
        motivo: document.getElementById('ajMotivo').value
      });
      Modal.close(); Toast.success('Ajuste registrado!'); Pages.estoque();
    } catch(e) {}
  },

  async perdaEstoqueModal() {
    const opts = await Pages._selectProdutos();
    Modal.show('Registrar Perda', `
      <div class="form-group"><label class="form-label">Produto</label><select class="form-control" id="perdaProduto">${opts}</select></div>
      <div class="form-group"><label class="form-label">Quantidade perdida</label><input type="number" class="form-control" id="perdaQtd" value="1"></div>
      <div class="form-group"><label class="form-label">Motivo</label><input type="text" class="form-control" id="perdaMotivo" value="Produto danificado"></div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-danger" onclick="Pages.salvarPerda()">Registrar</button>`);
  },

  async salvarPerda() {
    try {
      await App.post('/estoque/perda', {
        produto_id: document.getElementById('perdaProduto').value,
        quantidade: document.getElementById('perdaQtd').value,
        motivo: document.getElementById('perdaMotivo').value
      });
      Modal.close(); Toast.success('Perda registrada!'); Pages.estoque();
    } catch(e) {}
  },

  // ══════════════════════════════════════════════
  //  CONTAS A PAGAR
  // ══════════════════════════════════════════════
  async contasPagar() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Contas a Pagar');
    try {
      const contas = await App.get('/financeiro/pagar');
      const content = `
        <div class="d-flex justify-between mb-2" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge badge-warning">${contas.filter(c=>c.status==='pendente').length} pendentes</span>
            <span class="badge badge-danger" style="margin-left:8px">${contas.filter(c=>c.status==='vencido').length} vencidas</span>
          </div>
          <button class="btn btn-primary" onclick="Pages.novaContaPagarModal()">+ Nova Conta</button>
        </div>
        <div class="card"><div class="card-body">
          <div class="table-container"><table>
            <thead><tr><th>Descrição</th><th>Fornecedor</th><th>Vencimento</th><th class="text-right">Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${contas.map(c => `<tr>
                <td>${c.descricao}</td>
                <td>${c.Fornecedor?.nome || '-'}</td>
                <td>${Utils.date(c.data_vencimento)}</td>
                <td class="text-right"><strong>${Utils.currency(c.valor)}</strong></td>
                <td><span class="badge ${c.status==='pago'?'badge-success':c.status==='pendente'?'badge-warning':'badge-danger'}">${c.status}</span></td>
                <td>
                  ${c.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="Pages.quitarContaPagar(${c.id})">✓ Quitar</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${contas.length === 0 ? '<div class="empty-state"><h3>Nenhuma conta a pagar</h3></div>' : ''}
        </div></div>`;
      Layout.render(content, 'Contas a Pagar');
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Contas a Pagar'); }
  },

  novaContaPagarModal() {
    Modal.show('Nova Conta a Pagar', `
      <div class="form-group"><label class="form-label">Descrição *</label><input type="text" class="form-control" id="cpDesc"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="cpValor"></div>
        <div class="form-group"><label class="form-label">Vencimento *</label><input type="date" class="form-control" id="cpVencimento"></div>
      </div>
      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="cpCategoria">
          <option value="fornecedor">Fornecedor</option><option value="aluguel">Aluguel</option>
          <option value="salario">Salário</option><option value="imposto">Imposto</option>
          <option value="outros">Outros</option>
        </select>
      </div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.salvarContaPagar()">Salvar</button>`);
  },

  async salvarContaPagar() {
    try {
      await App.post('/financeiro/pagar', {
        descricao: document.getElementById('cpDesc').value,
        valor: document.getElementById('cpValor').value,
        data_vencimento: document.getElementById('cpVencimento').value,
        categoria: document.getElementById('cpCategoria').value
      });
      Modal.close(); Toast.success('Conta criada!'); Pages.contasPagar();
    } catch(e) {}
  },

  async quitarContaPagar(id) {
    if (!confirm('Marcar como pago?')) return;
    try {
      await App.put(`/financeiro/pagar/${id}/quitar`);
      Toast.success('Conta quitada!'); Pages.contasPagar();
    } catch(e) {}
  },

  // ══════════════════════════════════════════════
  //  CONTAS A RECEBER
  // ══════════════════════════════════════════════
  async contasReceber() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Contas a Receber');
    try {
      const contas = await App.get('/financeiro/receber');
      const content = `
        <div class="d-flex justify-between mb-2" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="badge badge-warning">${contas.filter(c=>c.status==='pendente').length} pendentes</span>
          </div>
          <button class="btn btn-primary" onclick="Pages.novaContaReceberModal()">+ Nova Conta</button>
        </div>
        <div class="card"><div class="card-body">
          <div class="table-container"><table>
            <thead><tr><th>Descrição</th><th>Cliente</th><th>Vencimento</th><th class="text-right">Valor</th><th>Parcela</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${contas.map(c => `<tr>
                <td>${c.descricao}</td>
                <td>${c.cliente_nome || '-'}</td>
                <td>${Utils.date(c.data_vencimento)}</td>
                <td class="text-right"><strong>${Utils.currency(c.valor)}</strong></td>
                <td>${c.parcela || '-'}</td>
                <td><span class="badge ${c.status==='recebido'?'badge-success':c.status==='pendente'?'badge-warning':'badge-danger'}">${c.status}</span></td>
                <td>
                  ${c.status === 'pendente' ? `<button class="btn btn-success btn-sm" onclick="Pages.quitarContaReceber(${c.id})">✓ Receber</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${contas.length === 0 ? '<div class="empty-state"><h3>Nenhuma conta a receber</h3></div>' : ''}
        </div></div>`;
      Layout.render(content, 'Contas a Receber');
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Contas a Receber'); }
  },

  novaContaReceberModal() {
    Modal.show('Nova Conta a Receber', `
      <div class="form-group"><label class="form-label">Descrição *</label><input type="text" class="form-control" id="crDesc"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="crValor"></div>
        <div class="form-group"><label class="form-label">Vencimento *</label><input type="date" class="form-control" id="crVencimento"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-control" id="crCliente"></div>
        <div class="form-group"><label class="form-label">CPF</label><input type="text" class="form-control" id="crCPF"></div>
      </div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.salvarContaReceber()">Salvar</button>`);
  },

  async salvarContaReceber() {
    try {
      await App.post('/financeiro/receber', {
        descricao: document.getElementById('crDesc').value,
        valor: document.getElementById('crValor').value,
        data_vencimento: document.getElementById('crVencimento').value,
        cliente_nome: document.getElementById('crCliente').value,
        cliente_cpf: document.getElementById('crCPF').value
      });
      Modal.close(); Toast.success('Conta criada!'); Pages.contasReceber();
    } catch(e) {}
  },

  async quitarContaReceber(id) {
    if (!confirm('Marcar como recebido?')) return;
    try {
      await App.put(`/financeiro/receber/${id}/quitar`);
      Toast.success('Recebimento registrado!'); Pages.contasReceber();
    } catch(e) {}
  },

  // ══════════════════════════════════════════════
  //  USUÁRIOS
  // ══════════════════════════════════════════════
  async usuarios() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Usuários');
    try {
      const usuarios = await App.get('/usuarios');
      const content = `
        <div class="d-flex justify-between mb-2" style="display:flex;justify-content:space-between;align-items:center">
          <h3>${usuarios.length} usuários</h3>
          <button class="btn btn-primary" onclick="Pages.novoUsuarioModal()">+ Novo Usuário</button>
        </div>
        <div class="card"><div class="card-body">
          <div class="table-container"><table>
            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th>Último Login</th><th>Ações</th></tr></thead>
            <tbody>
              ${usuarios.map(u => `<tr>
                <td><strong>${u.nome}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge badge-info">${u.perfil}</span></td>
                <td>${u.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>'}</td>
                <td>${u.ultimo_login ? Utils.dateTime(u.ultimo_login) : 'Nunca'}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="Pages.deletarUsuario(${u.id})">🗑️</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </div></div>`;
      Layout.render(content, 'Usuários');
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Usuários'); }
  },

  novoUsuarioModal() {
    const perfis = ['vendedor', 'financeiro', 'administrador'];
    if (App.isDrogaria()) perfis.push('farmaceutico');

    Modal.show('Novo Usuário', `
      <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-control" id="usrNome"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-control" id="usrEmail"></div>
        <div class="form-group"><label class="form-label">Senha *</label><input type="password" class="form-control" id="usrSenha"></div>
      </div>
      <div class="form-group"><label class="form-label">Perfil</label>
        <select class="form-control" id="usrPerfil">
          ${perfis.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>
    `, `<button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-primary" onclick="Pages.salvarUsuario()">Salvar</button>`);
  },

  async salvarUsuario() {
    try {
      await App.post('/usuarios', {
        nome: document.getElementById('usrNome').value,
        email: document.getElementById('usrEmail').value,
        senha: document.getElementById('usrSenha').value,
        perfil: document.getElementById('usrPerfil').value
      });
      Modal.close(); Toast.success('Usuário criado!'); Pages.usuarios();
    } catch(e) {}
  },

  async deletarUsuario(id) {
    if (!confirm('Desativar este usuário?')) return;
    try {
      await App.del(`/usuarios/${id}`);
      Toast.success('Usuário desativado'); Pages.usuarios();
    } catch(e) {}
  },

  // ══════════════════════════════════════════════
  //  CONFIGURAÇÕES
  // ══════════════════════════════════════════════
  async config() {
    Layout.render('<div class="loading"><div class="spinner"></div></div>', 'Configurações');
    try {
      const empresa = await App.get('/empresas');
      const content = `
        <div class="card">
          <div class="card-header"><h3>Dados da Empresa</h3></div>
          <div class="card-body">
            <form id="configForm">
              <div class="form-row">
                <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-control" id="cfgNome" value="${empresa.nome}"></div>
                <div class="form-group"><label class="form-label">CNPJ</label><input type="text" class="form-control" value="${empresa.cnpj}" disabled></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="cfgTel" value="${empresa.telefone || ''}"></div>
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" id="cfgEmail" value="${empresa.email || ''}"></div>
              </div>
              <div class="form-group"><label class="form-label">Endereço</label><input type="text" class="form-control" id="cfgEnd" value="${empresa.endereco || ''}"></div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Cidade</label><input type="text" class="form-control" id="cfgCidade" value="${empresa.cidade || ''}"></div>
                <div class="form-group"><label class="form-label">Estado</label><input type="text" class="form-control" id="cfgEstado" value="${empresa.estado || ''}" maxlength="2"></div>
                <div class="form-group"><label class="form-label">CEP</label><input type="text" class="form-control" id="cfgCEP" value="${empresa.cep || ''}"></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label class="form-label">Tipo</label><input class="form-control" value="${empresa.tipo_negocio}" disabled></div>
                <div class="form-group"><label class="form-label">Regime Tributário</label>
                  <select class="form-control" id="cfgRegime">
                    <option value="simples_nacional" ${empresa.regime_tributario==='simples_nacional'?'selected':''}>Simples Nacional</option>
                    <option value="mei" ${empresa.regime_tributario==='mei'?'selected':''}>MEI</option>
                    <option value="lucro_presumido" ${empresa.regime_tributario==='lucro_presumido'?'selected':''}>Lucro Presumido</option>
                    <option value="lucro_real" ${empresa.regime_tributario==='lucro_real'?'selected':''}>Lucro Real</option>
                  </select>
                </div>
              </div>
              <button type="submit" class="btn btn-primary mt-2">Salvar Alterações</button>
            </form>
          </div>
        </div>

        <div class="card mt-2">
          <div class="card-header"><h3>Alterar Senha</h3></div>
          <div class="card-body">
            <form id="senhaForm">
              <div class="form-row">
                <div class="form-group"><label class="form-label">Senha Atual</label><input type="password" class="form-control" id="senhaAtual"></div>
                <div class="form-group"><label class="form-label">Nova Senha</label><input type="password" class="form-control" id="senhaNova"></div>
              </div>
              <button type="submit" class="btn btn-secondary">Alterar Senha</button>
            </form>
          </div>
        </div>`;

      Layout.render(content, 'Configurações');

      document.getElementById('configForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await App.put('/empresas', {
            nome: document.getElementById('cfgNome').value,
            telefone: document.getElementById('cfgTel').value,
            email: document.getElementById('cfgEmail').value,
            endereco: document.getElementById('cfgEnd').value,
            cidade: document.getElementById('cfgCidade').value,
            estado: document.getElementById('cfgEstado').value,
            cep: document.getElementById('cfgCEP').value,
            regime_tributario: document.getElementById('cfgRegime').value
          });
          Toast.success('Dados atualizados!');
        } catch(e) {}
      });

      document.getElementById('senhaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await App.put('/auth/senha', {
            senha_atual: document.getElementById('senhaAtual').value,
            nova_senha: document.getElementById('senhaNova').value
          });
          Toast.success('Senha alterada!');
          document.getElementById('senhaForm').reset();
        } catch(e) {}
      });
    } catch(e) { Layout.render('<div class="empty-state"><h3>Erro</h3></div>', 'Configurações'); }
  }
};
