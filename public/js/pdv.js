/* ══════════════════════════════════════════════════════════════
   SGC - PDV (Ponto de Venda)
   Módulo completo com carrinho, busca, pagamento e atalhos
   ══════════════════════════════════════════════════════════════ */

const PDV = {
  carrinho: [],
  desconto: 0,
  acrescimo: 0,
  searchTimeout: null,

  init() {
    const input = document.getElementById('pdvSearch');
    if (!input) return;

    // Busca com debounce
    input.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.buscar(e.target.value), 300);
    });

    // Enter para busca por código de barras
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(this.searchTimeout);
        this.buscarBarcode(e.target.value);
      }
    });

    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
      if (App.currentPage !== 'pdv') return;

      // F12 = Finalizar
      if (e.key === 'F12') {
        e.preventDefault();
        this.finalizarVenda();
      }
      // F2 = Foco na busca
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('pdvSearch')?.focus();
      }
      // Escape = Limpar busca
      if (e.key === 'Escape') {
        const search = document.getElementById('pdvSearch');
        if (search) { search.value = ''; search.focus(); }
      }
    });

    this.renderCarrinho();
  },

  // ── Busca por nome ──
  async buscar(termo) {
    if (!termo || termo.length < 2) {
      document.getElementById('pdvResultados').innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon">🔍</div>
          <h3>Busque um produto</h3>
          <p>Digite o nome ou escaneie o código de barras</p>
          <p style="margin-top:12px;font-size:0.8rem;color:var(--text-muted)">
            <strong>F2</strong> Buscar &nbsp;|&nbsp; <strong>F12</strong> Finalizar &nbsp;|&nbsp; <strong>Esc</strong> Limpar
          </p>
        </div>`;
      return;
    }

    try {
      const produtos = await App.get(`/produtos?busca=${encodeURIComponent(termo)}`);
      this.renderProdutos(produtos);
    } catch (e) {
      document.getElementById('pdvResultados').innerHTML = '<p class="text-center text-muted">Erro na busca</p>';
    }
  },

  // ── Busca por código de barras ──
  async buscarBarcode(codigo) {
    if (!codigo) return;

    try {
      const produto = await App.get(`/produtos/barcode/${encodeURIComponent(codigo)}`);
      this.adicionarAoCarrinho(produto);
      const search = document.getElementById('pdvSearch');
      if (search) { search.value = ''; search.focus(); }
    } catch (e) {
      // Se não encontrou por barcode, buscar por nome
      this.buscar(codigo);
    }
  },

  // ── Renderizar lista de produtos ──
  renderProdutos(produtos) {
    const container = document.getElementById('pdvResultados');
    if (!produtos || produtos.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:30px"><h3>Nenhum produto encontrado</h3></div>';
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th class="text-right">Preço</th>
              <th class="text-right">Estoque</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${produtos.map(p => `
              <tr style="cursor:pointer" onclick='PDV.adicionarAoCarrinho(${JSON.stringify({id:p.id,nome:p.nome,preco_venda:p.preco_venda,estoque_atual:p.estoque_atual,controlado:p.controlado}).replace(/'/g,"&#39;")})'>
                <td>
                  <strong>${p.nome}</strong>
                  ${p.codigo_barras ? `<br><small class="text-muted">${p.codigo_barras}</small>` : ''}
                  ${p.controlado ? ' <span class="badge badge-danger">Controlado</span>' : ''}
                </td>
                <td class="text-right"><strong>${Utils.currency(p.preco_venda)}</strong></td>
                <td class="text-right">
                  <span class="${parseFloat(p.estoque_atual) <= 0 ? 'text-danger' : ''}">${Utils.number(p.estoque_atual, 0)}</span>
                </td>
                <td><button class="btn btn-primary btn-sm">+ Adicionar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  },

  // ── Adicionar produto ao carrinho ──
  adicionarAoCarrinho(produto) {
    if (parseFloat(produto.estoque_atual) <= 0) {
      Toast.warning('Produto sem estoque!');
      return;
    }

    const existente = this.carrinho.find(item => item.produto_id === produto.id);
    
    if (existente) {
      if (existente.quantidade >= parseFloat(produto.estoque_atual)) {
        Toast.warning('Estoque insuficiente!');
        return;
      }
      existente.quantidade++;
      existente.subtotal = existente.quantidade * existente.preco_unitario;
    } else {
      this.carrinho.push({
        produto_id: produto.id,
        nome: produto.nome,
        preco_unitario: parseFloat(produto.preco_venda),
        quantidade: 1,
        desconto_item: 0,
        subtotal: parseFloat(produto.preco_venda),
        estoque: parseFloat(produto.estoque_atual),
        controlado: produto.controlado
      });
    }

    Toast.success(`${produto.nome} adicionado`);
    this.renderCarrinho();
  },

  // ── Alterar quantidade ──
  alterarQtd(index, delta) {
    const item = this.carrinho[index];
    if (!item) return;

    const novaQtd = item.quantidade + delta;
    
    if (novaQtd <= 0) {
      this.removerItem(index);
      return;
    }

    if (novaQtd > item.estoque) {
      Toast.warning('Estoque insuficiente!');
      return;
    }

    item.quantidade = novaQtd;
    item.subtotal = item.quantidade * item.preco_unitario;
    this.renderCarrinho();
  },

  // ── Remover item ──
  removerItem(index) {
    this.carrinho.splice(index, 1);
    this.renderCarrinho();
  },

  // ── Limpar carrinho ──
  limparCarrinho() {
    if (this.carrinho.length === 0) return;
    if (!confirm('Limpar todo o carrinho?')) return;
    this.carrinho = [];
    this.desconto = 0;
    this.acrescimo = 0;
    this.renderCarrinho();
  },

  // ── Calcular totais ──
  getSubtotal() {
    return this.carrinho.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getTotal() {
    return this.getSubtotal() - this.desconto + this.acrescimo;
  },

  // ── Renderizar carrinho ──
  renderCarrinho() {
    const container = document.getElementById('pdvCartItems');
    const subtotalEl = document.getElementById('pdvSubtotal');
    const descontoEl = document.getElementById('pdvDesconto');
    const totalEl = document.getElementById('pdvTotal');

    if (!container) return;

    if (this.carrinho.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:30px"><p class="text-muted">Nenhum item</p></div>';
    } else {
      container.innerHTML = this.carrinho.map((item, i) => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="name">${item.nome}</div>
            <div class="price">${Utils.currency(item.preco_unitario)} / un</div>
          </div>
          <div class="cart-item-qty">
            <button onclick="PDV.alterarQtd(${i}, -1)">−</button>
            <span>${item.quantidade}</span>
            <button onclick="PDV.alterarQtd(${i}, 1)">+</button>
          </div>
          <div class="cart-item-total">${Utils.currency(item.subtotal)}</div>
          <button class="cart-item-remove" onclick="PDV.removerItem(${i})">✕</button>
        </div>
      `).join('');
    }

    if (subtotalEl) subtotalEl.textContent = Utils.currency(this.getSubtotal());
    if (descontoEl) descontoEl.textContent = `- ${Utils.currency(this.desconto)}`;
    if (totalEl) totalEl.textContent = Utils.currency(this.getTotal());
  },

  // ── Desconto ──
  aplicarDesconto() {
    Modal.show('Aplicar Desconto', `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Valor (R$)</label>
          <input type="number" step="0.01" class="form-control" id="descontoValor" value="${this.desconto}">
        </div>
        <div class="form-group">
          <label class="form-label">Ou Percentual (%)</label>
          <input type="number" step="0.1" class="form-control" id="descontoPercent" placeholder="0"
            oninput="document.getElementById('descontoValor').value = (PDV.getSubtotal() * this.value / 100).toFixed(2)">
        </div>
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" onclick="PDV.desconto = parseFloat(document.getElementById('descontoValor').value) || 0; PDV.renderCarrinho(); Modal.close();">Aplicar</button>
    `);
  },

  // ── Acréscimo ──
  aplicarAcrescimo() {
    Modal.show('Aplicar Acréscimo', `
      <div class="form-group">
        <label class="form-label">Valor (R$)</label>
        <input type="number" step="0.01" class="form-control" id="acrescimoValor" value="${this.acrescimo}">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-primary" onclick="PDV.acrescimo = parseFloat(document.getElementById('acrescimoValor').value) || 0; PDV.renderCarrinho(); Modal.close();">Aplicar</button>
    `);
  },

  // ── Finalizar Venda ──
  finalizarVenda() {
    if (this.carrinho.length === 0) {
      Toast.warning('Adicione itens ao carrinho');
      return;
    }

    const total = this.getTotal();

    Modal.show('Finalizar Venda', `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:0.9rem;color:var(--text-light)">Total da Venda</div>
        <div style="font-size:2.2rem;font-weight:700;color:var(--primary)">${Utils.currency(total)}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Forma de Pagamento</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="formaPagamento">
          <button class="btn btn-secondary forma-pgto active" data-forma="dinheiro" onclick="PDV.selectFormaPgto(this)">💵 Dinheiro</button>
          <button class="btn btn-secondary forma-pgto" data-forma="pix" onclick="PDV.selectFormaPgto(this)">📱 Pix</button>
          <button class="btn btn-secondary forma-pgto" data-forma="debito" onclick="PDV.selectFormaPgto(this)">💳 Débito</button>
          <button class="btn btn-secondary forma-pgto" data-forma="credito" onclick="PDV.selectFormaPgto(this)">💳 Crédito</button>
          <button class="btn btn-secondary forma-pgto" data-forma="multiplo" onclick="PDV.selectFormaPgto(this)" style="grid-column:1/-1">🔀 Múltiplas Formas</button>
        </div>
      </div>

      <div id="pgtoDetalhes">
        <div class="form-group" id="pgtoValorDinheiro">
          <label class="form-label">Valor Recebido</label>
          <input type="number" step="0.01" class="form-control" id="valorRecebido" value="${total.toFixed(2)}"
            oninput="PDV.calcularTroco()">
          <div class="form-text" id="trocoInfo"></div>
        </div>
      </div>

      <div id="pgtoMultiplo" class="hidden">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dinheiro</label>
            <input type="number" step="0.01" class="form-control" id="multDinheiro" value="0" oninput="PDV.calcMultiplo()">
          </div>
          <div class="form-group">
            <label class="form-label">Pix</label>
            <input type="number" step="0.01" class="form-control" id="multPix" value="0" oninput="PDV.calcMultiplo()">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Débito</label>
            <input type="number" step="0.01" class="form-control" id="multDebito" value="0" oninput="PDV.calcMultiplo()">
          </div>
          <div class="form-group">
            <label class="form-label">Crédito</label>
            <input type="number" step="0.01" class="form-control" id="multCredito" value="0" oninput="PDV.calcMultiplo()">
          </div>
        </div>
        <div class="form-text" id="multRestante" style="font-weight:600"></div>
      </div>

      <div class="form-row mt-1">
        <div class="form-group">
          <label class="form-label">Cliente (opcional)</label>
          <input type="text" class="form-control" id="vendaCliente" placeholder="Nome do cliente">
        </div>
        <div class="form-group">
          <label class="form-label">CPF (opcional)</label>
          <input type="text" class="form-control" id="vendaCPF" placeholder="000.000.000-00"
            oninput="this.value=Utils.maskCPF(this.value)">
        </div>
      </div>
    `, `
      <button class="btn btn-secondary btn-lg" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-success btn-lg" onclick="PDV.confirmarVenda()" id="btnConfirmarVenda">
        ✓ Confirmar Venda
      </button>
    `);

    PDV.calcularTroco();
  },

  selectedForma: 'dinheiro',

  selectFormaPgto(btn) {
    document.querySelectorAll('.forma-pgto').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.selectedForma = btn.dataset.forma;

    const detalhes = document.getElementById('pgtoDetalhes');
    const multiplo = document.getElementById('pgtoMultiplo');

    if (this.selectedForma === 'multiplo') {
      detalhes.classList.add('hidden');
      multiplo.classList.remove('hidden');
    } else {
      detalhes.classList.remove('hidden');
      multiplo.classList.add('hidden');
      
      if (this.selectedForma === 'dinheiro') {
        document.getElementById('pgtoValorDinheiro').classList.remove('hidden');
      } else {
        document.getElementById('pgtoValorDinheiro').classList.add('hidden');
      }
    }
  },

  calcularTroco() {
    const total = this.getTotal();
    const recebido = parseFloat(document.getElementById('valorRecebido')?.value || 0);
    const troco = recebido - total;
    const trocoEl = document.getElementById('trocoInfo');
    if (trocoEl) {
      if (troco >= 0) {
        trocoEl.innerHTML = `<strong style="color:var(--success);font-size:1.1rem">Troco: ${Utils.currency(troco)}</strong>`;
      } else {
        trocoEl.innerHTML = `<strong style="color:var(--danger)">Faltam: ${Utils.currency(Math.abs(troco))}</strong>`;
      }
    }
  },

  calcMultiplo() {
    const total = this.getTotal();
    const soma = parseFloat(document.getElementById('multDinheiro').value || 0)
               + parseFloat(document.getElementById('multPix').value || 0)
               + parseFloat(document.getElementById('multDebito').value || 0)
               + parseFloat(document.getElementById('multCredito').value || 0);
    const rest = total - soma;
    const el = document.getElementById('multRestante');
    if (el) {
      if (rest > 0.01) {
        el.innerHTML = `<span style="color:var(--danger)">Faltam: ${Utils.currency(rest)}</span>`;
      } else if (rest < -0.01) {
        el.innerHTML = `<span style="color:var(--success)">Troco: ${Utils.currency(Math.abs(rest))}</span>`;
      } else {
        el.innerHTML = `<span style="color:var(--success)">✓ Valores conferem</span>`;
      }
    }
  },

  // ── Confirmar venda ──
  async confirmarVenda() {
    const btn = document.getElementById('btnConfirmarVenda');
    btn.disabled = true;
    btn.textContent = 'Processando...';

    const total = this.getTotal();
    let dados = {
      itens: this.carrinho.map(item => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        desconto_item: item.desconto_item
      })),
      desconto: this.desconto,
      acrescimo: this.acrescimo,
      forma_pagamento: this.selectedForma,
      cliente_nome: document.getElementById('vendaCliente')?.value || null,
      cliente_cpf: document.getElementById('vendaCPF')?.value || null
    };

    if (this.selectedForma === 'dinheiro') {
      const recebido = parseFloat(document.getElementById('valorRecebido').value || 0);
      if (recebido < total) {
        Toast.error('Valor recebido insuficiente!');
        btn.disabled = false;
        btn.textContent = '✓ Confirmar Venda';
        return;
      }
      dados.valor_dinheiro = recebido;
    } else if (this.selectedForma === 'pix') {
      dados.valor_pix = total;
    } else if (this.selectedForma === 'debito') {
      dados.valor_debito = total;
    } else if (this.selectedForma === 'credito') {
      dados.valor_credito = total;
    } else if (this.selectedForma === 'multiplo') {
      dados.valor_dinheiro = parseFloat(document.getElementById('multDinheiro').value || 0);
      dados.valor_pix = parseFloat(document.getElementById('multPix').value || 0);
      dados.valor_debito = parseFloat(document.getElementById('multDebito').value || 0);
      dados.valor_credito = parseFloat(document.getElementById('multCredito').value || 0);
      
      const somaPgto = dados.valor_dinheiro + dados.valor_pix + dados.valor_debito + dados.valor_credito;
      if (somaPgto < total - 0.01) {
        Toast.error('Valores de pagamento insuficientes!');
        btn.disabled = false;
        btn.textContent = '✓ Confirmar Venda';
        return;
      }
    }

    try {
      const venda = await App.post('/vendas', dados);
      Modal.close();
      
      // Limpar carrinho
      this.carrinho = [];
      this.desconto = 0;
      this.acrescimo = 0;
      this.renderCarrinho();

      // Comprovante
      const troco = parseFloat(venda.troco || 0);
      Modal.show('✅ Venda Realizada!', `
        <div style="text-align:center">
          <div style="font-size:3rem;margin-bottom:8px">✅</div>
          <h2 style="color:var(--success)">Venda #${venda.numero}</h2>
          <div style="font-size:1.8rem;font-weight:700;margin:12px 0">${Utils.currency(venda.total)}</div>
          ${troco > 0 ? `<div style="font-size:1.2rem;color:var(--warning)">Troco: ${Utils.currency(troco)}</div>` : ''}
          <div style="margin-top:8px;color:var(--text-light)">${Utils.dateTime(venda.created_at)}</div>
          <div style="margin-top:4px;color:var(--text-light)">Pagamento: ${venda.forma_pagamento}</div>
        </div>
      `, `<button class="btn btn-primary btn-lg" onclick="Modal.close();document.getElementById('pdvSearch')?.focus()">OK (Nova Venda)</button>`);

      Toast.success(`Venda #${venda.numero} finalizada!`);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '✓ Confirmar Venda';
    }
  },

  // ── Abrir Caixa (modal) ──
  abrirCaixaModal() {
    Modal.show('Abrir Caixa', `
      <div class="form-group">
        <label class="form-label">Valor Inicial (dinheiro em caixa)</label>
        <input type="number" step="0.01" class="form-control" id="valorAbertura" value="0" placeholder="0,00">
      </div>
    `, `
      <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
      <button class="btn btn-success" onclick="PDV.abrirCaixa()">Abrir Caixa</button>
    `);
  },

  async abrirCaixa() {
    try {
      await App.post('/caixa/abrir', {
        valor_abertura: document.getElementById('valorAbertura').value || 0
      });
      Modal.close();
      Toast.success('Caixa aberto!');
      // Recarregar PDV
      Router.navigate('pdv');
    } catch (e) {}
  }
};
