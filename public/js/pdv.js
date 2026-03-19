/* ══════════════════════════════════════════════════════════════
   SGC - PDV v5.0  (Máquina de Estados + Motor de Descontos v2.0)
   Ponto de Venda em tela cheia, sem sidebar
   Fluxo: Abertura → Idle → CPF → Produtos → Pagamento → Cupom → Idle
   Busca de cliente por CPF, sugestões inteligentes, combos
   Multiplicador de quantidade (ex: 10*1234567890123)
   
   Máquina de Estados:
     INICIANDO → ABERTA → CLIENTE_IDENTIFICADO → EM_PAGAMENTO → FINALIZADA
                       ↘ EM_PAGAMENTO ↗           ↘ CANCELADA
                       ↘ CANCELADA
   ══════════════════════════════════════════════════════════════ */

// ── Constantes da Máquina de Estados ──
var STATUS_VENDA = {
  INICIANDO:              'INICIANDO',
  ABERTA:                 'ABERTA',
  CLIENTE_IDENTIFICADO:   'CLIENTE_IDENTIFICADO',
  EM_PAGAMENTO:           'EM_PAGAMENTO',
  FINALIZADA:             'FINALIZADA',
  CANCELADA:              'CANCELADA'
};

var TRANSICOES_PERMITIDAS = {
  INICIANDO:            ['ABERTA'],
  ABERTA:               ['CLIENTE_IDENTIFICADO', 'EM_PAGAMENTO', 'CANCELADA'],
  CLIENTE_IDENTIFICADO: ['ABERTA', 'EM_PAGAMENTO', 'CANCELADA'],
  EM_PAGAMENTO:         ['ABERTA', 'CLIENTE_IDENTIFICADO', 'FINALIZADA', 'CANCELADA'],
  FINALIZADA:           [],
  CANCELADA:            []
};

var ACOES_PERMITIDAS = {
  ADICIONAR_PRODUTO:    ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  REMOVER_PRODUTO:      ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  ALTERAR_QUANTIDADE:   ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  IDENTIFICAR_CLIENTE:  ['ABERTA'],
  LIMPAR_CLIENTE:       ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  BUSCAR_PRODUTO:       ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  DESCONTO_MANUAL:      ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  INICIAR_PAGAMENTO:    ['ABERTA', 'CLIENTE_IDENTIFICADO'],
  VOLTAR_PRODUTOS:      ['EM_PAGAMENTO'],
  SELECIONAR_PAGAMENTO: ['EM_PAGAMENTO'],
  FINALIZAR:            ['EM_PAGAMENTO'],
  CANCELAR:             ['ABERTA', 'CLIENTE_IDENTIFICADO', 'EM_PAGAMENTO']
};

const PDV = {
  cart: [],
  cliente: { nome: '', cpf: '' },
  clienteId: null,
  clienteData: null,
  formaPagamento: 'dinheiro',
  desconto: 0,
  descontoTipo: 'valor', // 'valor' ou 'percentual'
  acrescimo: 0,
  caixaAberto: false,
  sugestoes: [],
  combos: [],
  fase: 'idle', // fase visual: idle | cpf | produtos | pagamento
  status: STATUS_VENDA.INICIANDO, // ── Máquina de Estados v5.0 ──
  _finalizando: false, // flag anti-duplicação (redundante com status, mantido por segurança)
  _descontosCliente: [], // regras de desconto do programa comercial
  // ── Auditoria v5.0 (Prioridade 5) ──
  _logBuffer: [],        // buffer de logs do PDV para envio em batch
  _logFlushTimer: null,  // timer para flush periódico
  _limiteDesconto: 5,    // limite default, atualizado no login
  _gerenteAutorizadorId: null, // gerente que autorizou desconto acima do limite

  // ══════════════════════════════════════════════
  //  MÁQUINA DE ESTADOS — Guard Central
  // ══════════════════════════════════════════════

  /**
   * Verifica se uma ação é permitida no estado atual.
   * @param {string} acao — Chave de ACOES_PERMITIDAS
   * @returns {boolean}
   */
  podeExecutar(acao) {
    var permitidos = ACOES_PERMITIDAS[acao];
    if (!permitidos) { console.warn('[PDV] Ação desconhecida:', acao); return false; }
    return permitidos.indexOf(PDV.status) !== -1;
  },

  /**
   * Tenta executar uma ação. Se não permitida, mostra toast e retorna false.
   * Usar como guard no início de cada método.
   * @param {string} acao
   * @param {string} [mensagem] — Mensagem customizada
   * @returns {boolean} true se permitido
   */
  guardarAcao(acao, mensagem) {
    if (PDV.podeExecutar(acao)) return true;
    var msg = mensagem || 'Ação não permitida no estado atual (' + PDV.status + ')';
    Toast.warning(msg);
    console.warn('[PDV] Ação bloqueada:', acao, 'no estado', PDV.status);
    return false;
  },

  /**
   * Transiciona para um novo estado, validando a transição.
   * @param {string} novoStatus — Valor de STATUS_VENDA
   * @returns {boolean} true se a transição foi realizada
   */
  transitarEstado(novoStatus) {
    var permitidas = TRANSICOES_PERMITIDAS[PDV.status];
    if (!permitidas || permitidas.indexOf(novoStatus) === -1) {
      console.error('[PDV] Transição inválida:', PDV.status, '→', novoStatus);
      return false;
    }
    var anterior = PDV.status;
    PDV.status = novoStatus;
    console.log('[PDV] Estado:', anterior, '→', novoStatus);
    // ── Auditoria: registrar transição (fire-and-forget) ──
    PDV._logAcaoPDV('TRANSICAO_ESTADO', anterior, novoStatus);
    return true;
  },

  // ══════════════════════════════════════════════
  //  AUDITORIA — Logging de ações (fire-and-forget)
  // ══════════════════════════════════════════════

  /**
   * Registra ação do PDV no buffer de logs.
   * O buffer é enviado periodicamente ou no finalizar.
   */
  _logAcaoPDV(acao, estadoAnterior, estadoNovo, detalhes) {
    PDV._logBuffer.push({
      acao: acao,
      estado_anterior: estadoAnterior || PDV.status,
      estado_novo: estadoNovo || PDV.status,
      detalhes: detalhes || null,
      data_hora: new Date().toISOString()
    });
    // Flush automático a cada 10 segundos ou se buffer grande
    if (PDV._logBuffer.length >= 10) {
      PDV._flushLogBuffer();
    } else if (!PDV._logFlushTimer) {
      PDV._logFlushTimer = setTimeout(function() { PDV._flushLogBuffer(); }, 10000);
    }
  },

  /**
   * Envia logs acumulados para o backend em batch.
   */
  async _flushLogBuffer() {
    if (PDV._logFlushTimer) { clearTimeout(PDV._logFlushTimer); PDV._logFlushTimer = null; }
    if (PDV._logBuffer.length === 0) return;
    var logs = PDV._logBuffer.slice(); // cópia
    PDV._logBuffer = [];
    try {
      await App.post('/audit/log-pdv/batch', { logs: logs });
    } catch(e) {
      // Silencioso — auditoria nunca trava o PDV
      console.warn('[Audit] Falha ao enviar logs:', e.message);
    }
  },

  /**
   * Verifica se desconto manual excede o limite do operador.
   * Se exceder, exige senha de gerente.
   * @param {number} percentual — percentual do desconto
   * @param {function} callback — chamado com (autorizado, gerenteId) 
   */
  _verificarLimiteDesconto(percentual, callback) {
    var limite = PDV._limiteDesconto;
    var perfil = App.usuario ? App.usuario.perfil : 'vendedor';
    
    // Admin e gerente não têm limite
    if (perfil === 'administrador' || perfil === 'gerente') {
      callback(true, null);
      return;
    }

    if (percentual <= limite) {
      callback(true, null);
      return;
    }

    // Desconto acima do limite — exigir senha de gerente
    PDV._mostrarModalSenhaGerente(percentual, limite, callback);
  },

  /**
   * Modal de autorização de gerente para desconto acima do limite.
   */
  _mostrarModalSenhaGerente(percentualSolicitado, limiteOperador, callback) {
    var html = 
      '<div style="text-align:center;padding:8px 0">' +
        '<i data-lucide="shield-alert" style="width:48px;height:48px;color:var(--warning)"></i>' +
        '<h3 style="margin:12px 0 4px;color:var(--warning)">Autorização Necessária</h3>' +
        '<p class="text-muted" style="margin-bottom:16px">' +
          'Desconto de <strong>' + percentualSolicitado.toFixed(1) + '%</strong> excede o limite de ' +
          '<strong>' + limiteOperador.toFixed(1) + '%</strong> do seu perfil.' +
        '</p>' +
        '<p style="font-size:0.9rem;margin-bottom:16px">Um <strong>gerente</strong> precisa autorizar este desconto.</p>' +
        '<div class="form-group" style="text-align:left">' +
          '<label class="form-label">Email do Gerente</label>' +
          '<input type="email" class="form-control" id="gerenteEmail" placeholder="gerente@empresa.com" autocomplete="off">' +
        '</div>' +
        '<div class="form-group" style="text-align:left">' +
          '<label class="form-label">Senha do Gerente</label>' +
          '<input type="password" class="form-control" id="gerenteSenha" placeholder="Senha" autocomplete="off">' +
        '</div>' +
      '</div>';

    Modal.show('Autorização de Desconto', html, 
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>' +
      '<button class="btn btn-warning" id="btnAutorizarDesconto" data-onclick="PDV._validarSenhaGerente()">Autorizar</button>'
    );

    // Armazenar callback temporário
    PDV._descontoCallbackTemp = callback;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(function() { var el = document.getElementById('gerenteEmail'); if (el) el.focus(); }, 200);
  },

  /**
   * Valida a senha do gerente no backend.
   */
  async _validarSenhaGerente() {
    var email = (document.getElementById('gerenteEmail') || {}).value;
    var senha = (document.getElementById('gerenteSenha') || {}).value;

    if (!email || !senha) {
      Toast.warning('Preencha email e senha do gerente');
      return;
    }

    var btn = document.getElementById('btnAutorizarDesconto');
    if (btn) { btn.disabled = true; btn.textContent = 'Validando...'; }

    try {
      var result = await App.post('/audit/validar-gerente', { email: email, senha: senha });
      if (result.autorizado) {
        Modal.close();
        Toast.success('Desconto autorizado por ' + result.gerente.nome);
        PDV._gerenteAutorizadorId = result.gerente.id;
        PDV._logAcaoPDV('AUTORIZACAO_GERENTE', PDV.status, PDV.status, {
          gerente_id: result.gerente.id,
          gerente_nome: result.gerente.nome
        });
        if (PDV._descontoCallbackTemp) {
          PDV._descontoCallbackTemp(true, result.gerente.id);
          PDV._descontoCallbackTemp = null;
        }
      }
    } catch(e) {
      Toast.error(e.message || 'Credenciais inválidas');
      if (btn) { btn.disabled = false; btn.textContent = 'Autorizar'; }
    }
  },

  // ══════════════════════════════════════════════
  //  Abrir PDV fullscreen
  // ══════════════════════════════════════════════
  async open() {
    try {
      var status = await App.get('/caixa/status');
      PDV.caixaAberto = status.aberto;
    } catch(e) {
      PDV.caixaAberto = false;
    }

    if (!PDV.caixaAberto) {
      PDV.renderAbrirCaixa();
      return;
    }

    PDV.novaVenda();
    PDV.renderIdle();
  },

  // ══════════════════════════════════════════════
  //  Tela de abrir caixa (completa com operador, caixa, senha)
  // ══════════════════════════════════════════════
  renderAbrirCaixa() {
    var operadorNome = App.usuario ? App.usuario.nome : '';
    document.getElementById('app').innerHTML =
      '<div class="pdv-fullscreen">' +
        '<div class="pdv-header">' +
          '<div class="pdv-header-left">' +
            '<button class="btn-back" data-onclick="Router.navigate(\'home\')">' +
              '<i data-lucide="arrow-left" style="width:16px;height:16px"></i> Voltar</button>' +
            '<span class="pdv-header-brand">PDV - Ponto de Venda</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:center;align-items:center;height:calc(100vh - 60px)">' +
          '<div class="card" style="max-width:460px;width:100%"><div class="card-body">' +
            '<div style="text-align:center;margin-bottom:20px">' +
              '<i data-lucide="lock" style="width:48px;height:48px;color:var(--danger)"></i>' +
              '<h2 style="margin:8px 0 4px">Abertura de Caixa</h2>' +
              '<p class="text-muted">Preencha os dados para abrir o caixa</p>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Operador</label>' +
              '<input type="text" class="form-control" id="pdvOperador" value="' + operadorNome + '" readonly ' +
              'autocomplete="off" style="background:var(--bg);cursor:not-allowed"></div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label">Identificação do Caixa</label>' +
                '<select class="form-control" id="pdvCaixaNum">' +
                  '<option value="1">Caixa 01</option>' +
                  '<option value="2">Caixa 02</option>' +
                  '<option value="3">Caixa 03</option>' +
                  '<option value="4">Caixa 04</option>' +
                  '<option value="5">Caixa 05</option>' +
                '</select></div>' +
              '<div class="form-group"><label class="form-label">Valor de Abertura (R$)</label>' +
                '<input type="text" class="form-control" id="pdvValorAbertura" placeholder="0,00" ' +
                'autocomplete="off" data-oninput="Utils.maskNumericInput(event)"></div>' +
            '</div>' +
            '<div class="form-group"><label class="form-label">Senha do Operador</label>' +
              '<input type="password" class="form-control" id="pdvSenhaAbertura" placeholder="Digite sua senha" ' +
              'autocomplete="new-password" data-onenter="PDV.abrirCaixa()"></div>' +
            '<button class="btn btn-success btn-lg btn-block" data-onclick="PDV.abrirCaixa()" style="margin-top:8px">' +
              '<i data-lucide="lock-open" style="width:18px;height:18px"></i> Abrir Caixa</button>' +
          '</div></div></div></div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var senhaEl = document.getElementById('pdvSenhaAbertura');
    if (senhaEl) setTimeout(function() { senhaEl.focus(); }, 100);
  },

  async abrirCaixa() {
    var senha = (document.getElementById('pdvSenhaAbertura') || {}).value || '';
    if (!senha) { Toast.error('Digite sua senha para abrir o caixa'); return; }
    try {
      // Verificar senha fazendo login simulado
      await App.api('/auth/login', {
        method: 'POST',
        body: { email: App.usuario.email, senha: senha }
      });
    } catch(e) {
      Toast.error('Senha incorreta');
      return;
    }
    try {
      var valorStr = (document.getElementById('pdvValorAbertura').value || '0').replace(',', '.');
      var caixaNum = (document.getElementById('pdvCaixaNum') || {}).value || '1';
      await App.post('/caixa/abrir', { valor_abertura: valorStr, caixa_numero: caixaNum });
      Toast.success('Caixa ' + caixaNum.padStart(2, '0') + ' aberto!');
      PDV.caixaAberto = true;
      PDV.novaVenda();
      PDV.renderIdle();
    } catch(e) { 
      Toast.error('Erro ao abrir caixa: ' + (e.message || 'Tente novamente'));
    }
  },

  // ══════════════════════════════════════════════
  //  FASE IDLE — Tela inicial "Pressione Enter"
  // ══════════════════════════════════════════════
  renderIdle() {
    // Máquina de Estados: ao renderizar idle, estar em INICIANDO ou resetar
    if (PDV.status !== STATUS_VENDA.INICIANDO) {
      PDV.status = STATUS_VENDA.INICIANDO;
    }
    PDV.fase = 'idle';
    var operador = App.usuario ? App.usuario.nome : 'Operador';
    document.getElementById('app').innerHTML =
      '<div class="pdv-fullscreen">' +
        PDV._renderHeader() +
        '<div class="pdv-idle-screen">' +
          '<div class="pdv-idle-content">' +
            '<div class="pdv-idle-icon"><i data-lucide="shopping-cart" style="width:64px;height:64px"></i></div>' +
            '<h1 style="font-size:2rem;margin-bottom:8px">PDV Pronto</h1>' +
            '<p class="text-muted" style="font-size:1.1rem;margin-bottom:32px">Pressione <kbd>Enter</kbd> para iniciar nova venda</p>' +
            '<div style="display:flex;gap:12px;justify-content:center">' +
              '<button class="btn btn-success btn-lg" data-onclick="PDV.iniciarVenda()" style="padding:14px 40px;font-size:1.1rem">' +
                '<i data-lucide="plus" style="width:20px;height:20px"></i> Nova Venda</button>' +
            '</div>' +
            '<div class="pdv-idle-info">' +
              '<span><i data-lucide="user" style="width:14px;height:14px"></i> ' + operador + '</span>' +
              '<span><i data-lucide="clock" style="width:14px;height:14px"></i> ' +
                new Date().toLocaleDateString('pt-BR') + ' ' +
                new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        PDV._renderStatusBar() +
      '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.onkeydown = function(e) {
      if (e.key === 'Enter') { e.preventDefault(); PDV.iniciarVenda(); }
    };
  },

  iniciarVenda() {
    PDV.novaVenda();
    // Máquina de Estados: INICIANDO → ABERTA
    PDV.transitarEstado(STATUS_VENDA.ABERTA);
    PDV._logAcaoPDV('INICIAR_VENDA', STATUS_VENDA.INICIANDO, STATUS_VENDA.ABERTA);
    PDV.fase = 'cpf';
    PDV.renderCpfPrompt();
  },

  // ══════════════════════════════════════════════
  //  FASE CPF — Perguntar se deseja informar CPF
  // ══════════════════════════════════════════════
  renderCpfPrompt() {
    PDV.fase = 'cpf';
    document.getElementById('app').innerHTML =
      '<div class="pdv-fullscreen">' +
        PDV._renderHeader() +
        '<div class="pdv-idle-screen">' +
          '<div class="pdv-idle-content">' +
            '<div class="pdv-idle-icon" style="background:var(--info-light);color:var(--info)">' +
              '<i data-lucide="user-check" style="width:56px;height:56px"></i></div>' +
            '<h1 style="font-size:1.8rem;margin-bottom:8px">Identificar Cliente?</h1>' +
            '<p class="text-muted" style="font-size:1.05rem;margin-bottom:24px">Deseja informar o CPF na nota?</p>' +
            '<div style="max-width:360px;margin:0 auto 24px">' +
              '<input type="text" class="form-control" id="pdvCpfPrompt" placeholder="Digite o CPF do cliente..." ' +
                'style="font-size:1.15rem;padding:14px 18px;text-align:center" ' +
                'data-oninput="Utils.maskCPFInput(event)" ' +
                'data-onenter="PDV.confirmarCpf()">' +
            '</div>' +
            '<div style="display:flex;gap:12px;justify-content:center">' +
              '<button class="btn btn-success btn-lg" data-onclick="PDV.confirmarCpf()" style="padding:14px 36px;font-size:1.05rem">' +
                '<i data-lucide="check" style="width:20px;height:20px"></i> Sim, com CPF</button>' +
              '<button class="btn btn-secondary btn-lg" data-onclick="PDV.pularCpf()" style="padding:14px 36px;font-size:1.05rem">' +
                '<i data-lucide="arrow-right" style="width:20px;height:20px"></i> Não, sem CPF</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        PDV._renderStatusBar() +
      '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var cpfEl = document.getElementById('pdvCpfPrompt');
    if (cpfEl) setTimeout(function() { cpfEl.focus(); }, 100);
    document.onkeydown = function(e) {
      if (e.key === 'Escape') { e.preventDefault(); PDV.pularCpf(); }
    };
  },

  async confirmarCpf() {
    var cpfEl = document.getElementById('pdvCpfPrompt');
    var cpf = cpfEl ? cpfEl.value.replace(/\D/g, '') : '';
    if (cpf.length >= 11) {
      // Validação algorítmica do CPF
      if (!PDV._validarCPF(cpf)) {
        Toast.error('CPF inválido');
        return;
      }
      PDV.cliente.cpf = Utils.maskCPF(cpf);
      try {
        var res = await App.get('/clientes/buscar-cpf/' + cpf);
        var cl = res && res.cliente ? res.cliente : res;
        if (cl && cl.id) {
          PDV.clienteId = cl.id;
          PDV.clienteData = cl;
          PDV.cliente.nome = cl.nome;
          Toast.success('Cliente: ' + cl.nome);
          // Carregar descontos do programa comercial
          await PDV._carregarDescontosCliente(cl.id);
          // Recalcular preços de itens já no carrinho
          PDV._recalcularCarrinhoComDescontos();
        } else if (res && res.encontrado === false) {
          // Cliente não encontrado — abrir cadastro rápido
          PDV._abrirCadastroRapido(cpf);
          return;
        }
      } catch(e) {
        // Erro de rede — continua sem cliente
      }
    } else if (cpf.length > 0) {
      Toast.error('CPF deve ter 11 dígitos');
      return;
    }
    // Máquina de Estados: se tem cliente → CLIENTE_IDENTIFICADO, senão mantém ABERTA
    if (PDV.clienteId) {
      PDV.transitarEstado(STATUS_VENDA.CLIENTE_IDENTIFICADO);
    }
    PDV.fase = 'produtos';
    PDV.render();
  },

  // ══════════════════════════════════════════════
  //  VALIDAÇÃO ALGORÍTMICA DE CPF
  // ══════════════════════════════════════════════
  _validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    // Rejeitar sequências iguais (000.000.000-00, 111.111.111-11, etc.)
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    // Validar dígitos verificadores
    for (var t = 9; t < 11; t++) {
      var d = 0;
      for (var c = 0; c < t; c++) d += parseInt(cpf.charAt(c)) * ((t + 1) - c);
      d = ((10 * d) % 11) % 10;
      if (parseInt(cpf.charAt(t)) !== d) return false;
    }
    return true;
  },

  // ══════════════════════════════════════════════
  //  CADASTRO RÁPIDO NO PDV (< 20 segundos)
  // ══════════════════════════════════════════════
  _abrirCadastroRapido(cpf) {
    var cpfFormatado = Utils.maskCPF(cpf);
    Modal.show('Cliente não encontrado',
      '<p style="color:var(--text-muted);margin-bottom:16px;text-align:center">CPF <strong>' + cpfFormatado + '</strong> não está cadastrado.<br>Preencha os dados para cadastro rápido:</p>' +
      '<div class="form-group"><label class="form-label">Nome *</label>' +
        '<input type="text" class="form-control" id="pdvCadNome" placeholder="Nome do cliente" autofocus></div>' +
      '<div class="form-group"><label class="form-label">Telefone *</label>' +
        '<input type="text" class="form-control" id="pdvCadTel" placeholder="(00) 00000-0000" data-oninput="Utils.maskPhoneInput(event)"></div>' +
      '<div class="form-group" style="margin-top:8px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.9rem;color:var(--text-muted)">' +
        '<input type="checkbox" id="pdvCadMarketing"> Autoriza receber ofertas por WhatsApp/SMS</label></div>',
      '<button class="btn btn-success" data-onclick="PDV._salvarCadastroRapido(\'' + cpf + '\')" style="flex:1">' +
        '<i data-lucide="user-plus" style="width:16px;height:16px"></i> Cadastrar e continuar</button>' +
      '<button class="btn btn-secondary" data-onclick="PDV._cancelarCadastroRapido()" style="flex:1">Pular</button>'
    );
    // Foco no nome
    setTimeout(function() {
      var el = document.getElementById('pdvCadNome');
      if (el) el.focus();
    }, 200);
  },

  async _salvarCadastroRapido(cpf) {
    var nome = (document.getElementById('pdvCadNome') || {}).value;
    var telefone = (document.getElementById('pdvCadTel') || {}).value;
    var marketing = (document.getElementById('pdvCadMarketing') || {}).checked;

    if (!nome || nome.trim().length < 2) {
      Toast.error('Informe o nome do cliente');
      return;
    }
    if (!telefone || telefone.replace(/\D/g, '').length < 10) {
      Toast.error('Informe um telefone válido');
      return;
    }

    try {
      var cliente = await App.post('/clientes', {
        nome: nome.trim(),
        cpf: Utils.maskCPF(cpf),
        telefone: telefone,
        cadastro_incompleto: true,
        aceita_marketing: marketing,
        data_aceite_marketing: marketing ? new Date().toISOString() : null,
        aceite_origem: marketing ? 'pdv' : null
      });

      Modal.close();
      PDV.clienteId = cliente.id;
      PDV.clienteData = cliente;
      PDV.cliente.cpf = Utils.maskCPF(cpf);
      PDV.cliente.nome = cliente.nome;

      Toast.success('✅ ' + cliente.nome + ' cadastrado e inscrito no Clube!');

      // Carregar descontos imediatamente
      await PDV._carregarDescontosCliente(cliente.id);
      PDV._recalcularCarrinhoComDescontos();

      PDV.transitarEstado(STATUS_VENDA.CLIENTE_IDENTIFICADO);
      PDV.fase = 'produtos';
      PDV.render();
    } catch(e) {
      var msg = (e && e.error) || 'Erro ao cadastrar cliente';
      Toast.error(msg);
    }
  },

  _cancelarCadastroRapido() {
    Modal.close();
    // Continua com CPF avulso
    if (PDV.clienteId) {
      PDV.transitarEstado(STATUS_VENDA.CLIENTE_IDENTIFICADO);
    }
    PDV.fase = 'produtos';
    PDV.render();
  },

  pularCpf() {
    PDV.cliente = { nome: '', cpf: '' };
    PDV.clienteId = null;
    PDV.clienteData = null;
    PDV._descontosCliente = [];
    // Motor v2.0: reprocessar itens sem desconto (volta ao pre\u00e7o original)
    PDV.reprocessarTodosOsItens();
    PDV.fase = 'produtos';
    PDV.render();
  },

  // ══════════════════════════════════════════════
  //  Header e StatusBar reutilizáveis
  // ══════════════════════════════════════════════
  _renderHeader() {
    var operador = App.usuario ? App.usuario.nome : 'Operador';
    var agora = new Date();
    var hora = agora.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    var data = agora.toLocaleDateString('pt-BR');
    // Máquina de Estados: indicador visual de estado
    var statusLabel = {
      INICIANDO: 'Pronto',
      ABERTA: 'Venda aberta',
      CLIENTE_IDENTIFICADO: 'Cliente identificado',
      EM_PAGAMENTO: 'Em pagamento',
      FINALIZADA: 'Finalizada',
      CANCELADA: 'Cancelada'
    };
    var statusColor = {
      INICIANDO: 'var(--text-muted)',
      ABERTA: 'var(--primary)',
      CLIENTE_IDENTIFICADO: 'var(--success)',
      EM_PAGAMENTO: 'var(--warning)',
      FINALIZADA: 'var(--success)',
      CANCELADA: 'var(--danger)'
    };
    var estadoAtual = PDV.status || 'INICIANDO';
    return '<div class="pdv-header">' +
      '<div class="pdv-header-left">' +
        '<span class="pdv-header-brand">' + (App.empresa ? App.empresa.nome : 'PDV') + '</span>' +
      '</div>' +
      '<div class="pdv-header-center">' +
        '<span class="pdv-status-badge"><i data-lucide="check-circle" style="width:12px;height:12px"></i> Caixa aberto</span>' +
        '<span style="color:' + (statusColor[estadoAtual] || 'var(--text-muted)') + ';font-weight:600;font-size:0.8rem">' + (statusLabel[estadoAtual] || estadoAtual) + '</span>' +
        '<span>' + data + ' &middot; ' + hora + '</span>' +
      '</div>' +
      '<div class="pdv-header-right">' +
        '<span style="display:flex;align-items:center;gap:6px">' +
          '<i data-lucide="user" style="width:14px;height:14px"></i> ' + operador + '</span>' +
        '<button class="btn-pdv" data-onclick="PDV.menuConfig()" title="Configurações">' +
          '<i data-lucide="settings" style="width:16px;height:16px"></i></button>' +
      '</div>' +
    '</div>';
  },

  _renderStatusBar() {
    // Máquina de Estados: desabilitar pills conforme estado
    var podeDesconto = PDV.podeExecutar('DESCONTO_MANUAL');
    var podeRemover = PDV.podeExecutar('REMOVER_PRODUTO');
    var podePagar = PDV.podeExecutar('INICIAR_PAGAMENTO');
    var podeCpf = PDV.podeExecutar('IDENTIFICAR_CLIENTE');
    var podeCancelar = PDV.podeExecutar('CANCELAR');
    var disabledStyle = ';opacity:0.4;pointer-events:none';
    return '<div class="pdv-action-bar">' +
      '<button class="pdv-action-pill" data-onclick="PDV.atalhoDesconto()" style="' + (podeDesconto ? '' : disabledStyle) + '"><kbd>F2</kbd> Desconto</button>' +
      '<button class="pdv-action-pill" data-onclick="PDV.cancelarItemUI()" style="' + (podeRemover ? '' : disabledStyle) + '"><kbd>F3</kbd> Cancelar item</button>' +
      '<button class="pdv-action-pill" data-onclick="PDV.irParaPagamento()" style="' + (podePagar ? '' : disabledStyle) + '"><kbd>F4</kbd> Finalizar</button>' +
      '<button class="pdv-action-pill" data-onclick="PDV.pedirCpf()" style="' + (podeCpf ? '' : disabledStyle) + '"><kbd>F5</kbd> CPF</button>' +
      '<button class="pdv-action-pill" data-onclick="PDV.cancelarVenda()" style="' + (podeCancelar ? '' : disabledStyle) + '"><kbd>ESC</kbd> Cancelar venda</button>' +
    '</div>';
  },
  // ══════════════════════════════════════════════
  //  FASE PRODUTOS — Tela principal de venda
  // ══════════════════════════════════════════════
  render() {
    PDV.fase = 'produtos';
    var cartHtml = PDV.cart.length === 0
      ? '<div class="pdv-receipt-empty">' +
          '<i data-lucide="shopping-cart" style="width:40px;height:40px;color:var(--text-muted)"></i>' +
          '<p>Nenhum item adicionado</p></div>'
      : '<table class="pdv-cart-table"><thead><tr><th>Produto</th><th class="text-center">Qtd</th><th class="text-right">Unit.</th><th class="text-right">Subtotal</th><th></th></tr></thead><tbody>' +
        PDV.cart.map(function(item, idx) {
          var rowClass = item._new ? ' class="pdv-item-new"' : (item._highlight ? ' class="pdv-item-highlight"' : '');
          var hasDesconto = item.descontoPrograma && item.precoOriginal;
          var badgeHtml = '';
          if (hasDesconto) {
            var dp = item.descontoPrograma;
            if (dp.tipo_desconto === 'acumulado' && dp.regras_aplicadas && dp.regras_aplicadas.length > 1) {
              // Múltiplas regras: mostrar badge com contagem
              var nomes = [];
              dp.regras_aplicadas.forEach(function(ra) { if (nomes.indexOf(ra.programa_nome) === -1) nomes.push(ra.programa_nome); });
              badgeHtml = ' <span class="badge pdv-badge-desconto" title="' + nomes.join(' + ') + ' (' + dp.regras_aplicadas.length + ' regras)">' + nomes.join('+') + '</span>';
            } else {
              badgeHtml = ' <span class="badge pdv-badge-desconto">' + dp.programaNome + '</span>';
            }
          }
          var nomeTd = '<td class="fw-500">' + item.nome + badgeHtml + '</td>';
          var precoTd = hasDesconto
            ? '<td class="text-right"><span style="text-decoration:line-through;color:var(--text-muted);font-size:0.75rem;margin-right:4px">' + Utils.currency(item.precoOriginal) + '</span><span style="color:var(--success);font-weight:600">' + Utils.currency(item.preco) + '</span></td>'
            : '<td class="text-right">' + Utils.currency(item.preco) + '</td>';
          return '<tr data-product-id="' + item.id + '"' + rowClass + '>' +
            nomeTd +
            '<td class="text-center">' +
              '<div style="display:flex;align-items:center;justify-content:center;gap:4px">' +
                '<button class="btn-icon" data-onclick="PDV.decrementItem(' + idx + ')" style="width:24px;height:24px;padding:2px"><i data-lucide="minus" style="width:12px;height:12px"></i></button>' +
                '<span style="min-width:30px;text-align:center;font-weight:600">' + item.quantidade + '</span>' +
                '<button class="btn-icon" data-onclick="PDV.incrementItem(' + idx + ')" style="width:24px;height:24px;padding:2px"><i data-lucide="plus" style="width:12px;height:12px"></i></button>' +
              '</div></td>' +
            precoTd +
            '<td class="text-right fw-600">' + Utils.currency(item.quantidade * item.preco) + '</td>' +
            '<td><button class="btn-icon" data-onclick="PDV.removeItem(' + idx + ')" title="Remover" style="color:var(--danger)">' +
              '<i data-lucide="trash-2" style="width:14px;height:14px"></i></button></td>' +
          '</tr>';
        }).join('') + '</tbody></table>';

    var subtotal = PDV.getSubtotal();
    var total = PDV.getTotal();

    document.getElementById('app').innerHTML =
      '<div class="pdv-fullscreen">' +
        PDV._renderHeader() +

        // Barra do cliente (compacta)
        (PDV.clienteData || PDV.cliente.cpf ?
          '<div class="pdv-customer-bar">' +
            '<i data-lucide="user" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0"></i>' +
            '<span style="font-size:0.85rem">' +
              (PDV.clienteData ? '<strong>' + PDV.clienteData.nome + '</strong>' : '') +
              (PDV.cliente.cpf ? ' &middot; CPF: ' + PDV.cliente.cpf : '') +
            '</span>' +
            (PDV._descontosCliente.length > 0 ? 
              '<span class="badge" style="background:var(--success-light);color:var(--success);font-size:0.7rem;padding:2px 8px;display:flex;align-items:center;gap:4px">' +
                '<i data-lucide="tag" style="width:12px;height:12px"></i> Programa Ativo</span>' : '') +
            '<button class="btn btn-sm btn-ghost" data-onclick="PDV.limparCliente()" title="Limpar cliente" style="margin-left:auto">' +
              '<i data-lucide="x" style="width:14px;height:14px"></i></button>' +
          '</div>' : '') +

        // Barra de sugestões
        (PDV.sugestoes.length > 0 ? '<div class="pdv-suggestion-bar">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<i data-lucide="lightbulb" style="width:16px;height:16px;color:var(--accent)"></i>' +
            '<strong style="font-size:0.85rem">Sugestões para o cliente</strong>' +
            '<button class="btn-icon" data-onclick="PDV.sugestoes=[];PDV.render()" style="margin-left:auto;width:24px;height:24px">' +
              '<i data-lucide="x" style="width:12px;height:12px"></i></button>' +
          '</div>' +
          '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">' +
            PDV.sugestoes.map(function(s) {
              return '<div class="pdv-suggestion-item" data-onclick="PDV.addFromSearch(' + s.id + ')">' +
                '<span>' + s.nome + '</span>' +
                '<span style="color:var(--primary);font-weight:600">' + Utils.currency(s.preco_venda) + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' : '') +

        // Body — Layout 3 colunas  
        '<div class="pdv-body">' +
          // Coluna principal (busca + tabela de itens)
          '<div class="pdv-main">' +
            // Busca de produtos (flutuante)
            '<div class="pdv-search">' +
              '<div style="position:relative">' +
                '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted)">' +
                  '<i data-lucide="search" style="width:18px;height:18px"></i></span>' +
                '<input type="text" class="form-control" id="pdvBusca" ' +
                  'placeholder="Buscar produto por nome, c\u00f3digo ou quantidade*c\u00f3digo (ex: 3*7891234567890)..." ' +
                  'style="padding-left:44px;font-size:1rem" ' +
                  'data-oninput="PDV.buscarProduto(this.value)" autocomplete="off">' +
              '</div>' +
              '<div id="pdvResultados" class="pdv-search-results" style="display:none"></div>' +
            '</div>' +

            // Tabela de itens (Produto | Qtd | Valor | Subtotal)
            '<div class="pdv-receipt">' +
              '<div class="pdv-receipt-header">' +
                '<span>ITENS DA VENDA</span>' +
                '<span>' + PDV.cart.length + ' ite' + (PDV.cart.length === 1 ? 'm' : 'ns') + '</span>' +
              '</div>' +
              '<div class="pdv-receipt-items" id="pdvCartItems">' + cartHtml + '</div>' +
            '</div>' +
          '</div>' +

          // Coluna direita — Resumo da Venda
          '<div class="pdv-sidebar">' +
            // Header do resumo
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
              '<i data-lucide="receipt" style="width:18px;height:18px;color:var(--text-muted)"></i>' +
              '<span style="font-weight:600;font-size:0.9rem;color:var(--text);text-transform:uppercase;letter-spacing:0.5px">Resumo da Venda</span>' +
            '</div>' +

            // Card Subtotal (maior)
            '<div class="pdv-summary-card">' +
              '<div class="pdv-summary-card-label">Subtotal</div>' +
              '<div class="pdv-summary-card-value" style="font-size:1.4rem">' + Utils.currency(subtotal) + '</div>' +
            '</div>' +

            // Seção Descontos
            '<div class="pdv-summary-card" style="gap:10px;display:flex;flex-direction:column">' +
              '<div style="display:flex;align-items:center;gap:6px">' +
                '<i data-lucide="tag" style="width:14px;height:14px;color:var(--text-muted)"></i>' +
                '<span style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-muted)">Descontos</span>' +
              '</div>' +

              // Desconto do Clube (automático) — não editável
              (PDV._getEconomiaPrograma() > 0
                ? '<div style="background:color-mix(in srgb, var(--success) 8%, transparent);border:1px solid color-mix(in srgb, var(--success) 25%, transparent);border-radius:var(--radius);padding:10px 12px">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
                      '<i data-lucide="award" style="width:13px;height:13px;color:var(--success);flex-shrink:0"></i>' +
                      '<span style="font-size:0.75rem;font-weight:600;color:var(--success);text-transform:uppercase">Desconto Clube (Automático)</span>' +
                    '</div>' +
                    '<div style="display:flex;justify-content:space-between;align-items:center">' +
                      '<span style="font-size:0.85rem;color:var(--text)">' + (PDV._descontosCliente.length > 0 && PDV._descontosCliente[0].programaNome ? PDV._descontosCliente[0].programaNome : 'Programa Ativo') + '</span>' +
                      '<span style="font-weight:700;color:var(--success);font-size:1.05rem">- ' + Utils.currency(PDV._getEconomiaPrograma()) + '</span>' +
                    '</div>' +
                  '</div>'
                : '<div style="background:var(--bg-alt);border-radius:var(--radius);padding:10px 12px;text-align:center">' +
                    '<span style="font-size:0.8rem;color:var(--text-muted)">Nenhum desconto de programa</span>' +
                  '</div>') +

              // Desconto Manual — botão para abrir modal
              '<div style="border-top:1px solid var(--border);padding-top:10px">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
                  '<i data-lucide="edit-3" style="width:13px;height:13px;color:var(--text-muted)"></i>' +
                  '<span style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase">Desconto Manual</span>' +
                '</div>' +
                (PDV.desconto > 0
                  ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
                      '<div>' +
                        '<span style="font-weight:600;color:var(--danger);font-size:1rem">- ' + Utils.currency(PDV.getDescontoValor()) + '</span>' +
                        (PDV.descontoTipo === 'percentual' ? '<small style="color:var(--text-muted);margin-left:4px">(' + PDV.desconto + '%)</small>' : '') +
                      '</div>' +
                      '<div style="display:flex;gap:4px">' +
                        '<button class="btn btn-sm btn-outline" data-onclick="PDV.atalhoDesconto()" style="font-size:0.75rem;padding:4px 10px">Alterar</button>' +
                        '<button class="btn btn-sm btn-ghost" data-onclick="PDV._limparDescontoManual()" style="color:var(--danger);font-size:0.75rem;padding:4px 6px" title="Remover desconto">' +
                          '<i data-lucide="x" style="width:12px;height:12px"></i></button>' +
                      '</div>' +
                    '</div>'
                  : '<button class="btn btn-sm btn-outline btn-block" data-onclick="PDV.atalhoDesconto()" style="gap:6px">' +
                      '<i data-lucide="percent" style="width:14px;height:14px"></i> Aplicar Desconto <kbd style="font-size:0.65rem;padding:1px 5px;background:var(--bg-alt);border-radius:4px;margin-left:4px">F2</kbd></button>') +
              '</div>' +
            '</div>' +

            // Card TOTAL — destaque principal (maior e com borda)
            '<div class="pdv-total-card" style="border:2px solid var(--primary);box-shadow:0 2px 12px rgba(var(--primary-rgb, 59,130,246), 0.15)">' +
              '<div class="pdv-total-card-label" style="font-size:0.85rem;letter-spacing:1px;display:flex;align-items:center;justify-content:center;gap:6px"><i data-lucide="wallet" style="width:16px;height:16px"></i> TOTAL FINAL</div>' +
              '<div class="pdv-total-card-value" style="font-size:2rem">' + Utils.currency(total) + '</div>' +
            '</div>' +

            '<div style="flex:1"></div>' +

            // Botão Pagamento (grande, destaque)
            '<button class="btn btn-primary btn-lg btn-block" style="padding:16px;font-size:1.1rem;font-weight:700;gap:10px;border-radius:var(--radius-lg);box-shadow:0 4px 12px rgba(var(--primary-rgb, 59,130,246), 0.3)" ' +
              'data-onclick="PDV.irParaPagamento()" ' + (PDV.cart.length === 0 ? 'disabled' : '') + '>' +
              '<i data-lucide="shopping-bag" style="width:22px;height:22px"></i> Pagamento <kbd style="font-size:0.7rem;padding:2px 8px;background:rgba(255,255,255,0.2);border-radius:4px;margin-left:4px">F4</kbd></button>' +
          '</div>' +
        '</div>' +

        PDV._renderStatusBar() +
      '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
    var buscaEl = document.getElementById('pdvBusca');
    if (buscaEl) setTimeout(function() { buscaEl.focus(); }, 100);
    PDV.bindKeys();
  },

  // ══════════════════════════════════════════════
  //  FASE PAGAMENTO — Tela de pagamento
  // ══════════════════════════════════════════════
  irParaPagamento() {
    if (!PDV.guardarAcao('INICIAR_PAGAMENTO', 'Não é possível ir para pagamento no estado atual.')) return;
    if (PDV.cart.length === 0) { Toast.error('Adicione produtos ao carrinho'); return; }
    // Máquina de Estados: → EM_PAGAMENTO
    var anterior = PDV.status;
    PDV.transitarEstado(STATUS_VENDA.EM_PAGAMENTO);
    PDV._logAcaoPDV('INICIAR_PAGAMENTO', anterior, STATUS_VENDA.EM_PAGAMENTO, {
      itens: PDV.cart.length, subtotal: PDV.getSubtotal(), total: PDV.getTotal()
    });
    PDV.fase = 'pagamento';
    PDV.renderPagamento();
  },

  renderPagamento() {
    var subtotal = PDV.getSubtotal();
    var total = PDV.getTotal();
    var itensResumo = PDV.cart.map(function(item) {
      return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">' +
        '<span>' + item.quantidade + 'x ' + item.nome + '</span>' +
        '<span class="fw-600">' + Utils.currency(item.quantidade * item.preco) + '</span></div>';
    }).join('');

    document.getElementById('app').innerHTML =
      '<div class="pdv-fullscreen">' +
        PDV._renderHeader() +
        '<div class="pdv-body pdv-payment-layout">' +
          '<div class="pdv-payment-grid">' +

            // Resumo do pedido (lado esquerdo)
            '<div>' +
              '<h2 style="margin-bottom:16px"><i data-lucide="receipt" style="width:22px;height:22px"></i> Resumo do Pedido</h2>' +
              '<div class="card" style="height:calc(100% - 48px);display:flex;flex-direction:column">' +
                '<div class="card-body" style="max-height:calc(100vh - 380px);overflow-y:auto;flex:1">' +
                  itensResumo +
                '</div>' +
                '<div style="padding:16px 20px;border-top:2px solid var(--border);background:var(--bg);flex-shrink:0">' +
                  '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Subtotal</span><span>' + Utils.currency(subtotal) + '</span></div>' +
                  (PDV.desconto > 0 ? '<div style="display:flex;justify-content:space-between;color:var(--danger)"><span>Desconto Manual' + (PDV.descontoTipo === 'percentual' ? ' (' + PDV.desconto + '%)' : '') + '</span><span>-' + Utils.currency(PDV.getDescontoValor()) + '</span></div>' : '') +
                  (PDV._getEconomiaPrograma() > 0 ? '<div style="display:flex;justify-content:space-between;color:var(--success);font-size:0.85rem;align-items:center"><span style="display:flex;align-items:center;gap:5px"><i data-lucide="award" style="width:13px;height:13px"></i> Desconto Clube</span><span>-' + Utils.currency(PDV._getEconomiaPrograma()) + '</span></div>' : '') +
                  '<div style="display:flex;justify-content:space-between;font-size:1.4rem;font-weight:700;margin-top:8px;padding-top:8px;border-top:2px solid var(--border)">' +
                    '<span>TOTAL</span><span style="color:var(--primary)">' + Utils.currency(total) + '</span></div>' +
                '</div>' +
                '<div style="padding:16px 20px;border-top:1px solid var(--border);background:var(--bg-card);flex-shrink:0">' +
                  '<button class="btn btn-secondary btn-block" data-onclick="PDV.voltarProdutos()">' +
                    '<i data-lucide="arrow-left" style="width:16px;height:16px"></i> Voltar aos Produtos</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // Formas de pagamento (lado direito)
            '<div>' +
              '<h2 style="margin-bottom:16px"><i data-lucide="wallet" style="width:22px;height:22px"></i> Forma de Pagamento</h2>' +
              '<div class="card" style="height:calc(100% - 48px);display:flex;flex-direction:column">' +
                '<div class="card-body" style="flex:1;display:flex;flex-direction:column;gap:16px">' +
                  // Grid de botões de pagamento
                  '<div class="pdv-payment-buttons">' +
                    '<button class="pdv-payment-btn' + (PDV.formaPagamento === 'dinheiro' ? ' active' : '') + '" data-onclick="PDV.selectPayment(\'dinheiro\', event)">' +
                      '<i data-lucide="banknote" style="width:24px;height:24px"></i><span>Dinheiro</span></button>' +
                    '<button class="pdv-payment-btn' + (PDV.formaPagamento === 'pix' ? ' active' : '') + '" data-onclick="PDV.selectPayment(\'pix\', event)">' +
                      '<i data-lucide="smartphone" style="width:24px;height:24px"></i><span>Pix</span></button>' +
                    '<button class="pdv-payment-btn' + (PDV.formaPagamento === 'debito' ? ' active' : '') + '" data-onclick="PDV.selectPayment(\'debito\', event)">' +
                      '<i data-lucide="credit-card" style="width:24px;height:24px"></i><span>Débito</span></button>' +
                    '<button class="pdv-payment-btn' + (PDV.formaPagamento === 'credito' ? ' active' : '') + '" data-onclick="PDV.selectPayment(\'credito\', event)">' +
                      '<i data-lucide="credit-card" style="width:24px;height:24px"></i><span>Crédito</span></button>' +
                    '<button class="pdv-payment-btn' + (PDV.formaPagamento === 'voucher' ? ' active' : '') + '" data-onclick="PDV.selectPayment(\'voucher\', event)">' +
                      '<i data-lucide="ticket" style="width:24px;height:24px"></i><span>Voucher</span></button>' +
                  '</div>' +

                  // Crédito: parcelas
                  '<div id="pdvCreditoArea" style="' + (PDV.formaPagamento === 'credito' ? '' : 'display:none') + '">' +
                    '<div class="form-group" style="margin-bottom:0"><label class="form-label">Parcelas</label>' +
                      '<select class="form-control" id="pdvParcelas">' +
                        '<option value="1">1x de ' + Utils.currency(total) + ' (à vista)</option>' +
                        '<option value="2">2x de ' + Utils.currency(total/2) + '</option>' +
                        '<option value="3">3x de ' + Utils.currency(total/3) + '</option>' +
                        '<option value="4">4x de ' + Utils.currency(total/4) + '</option>' +
                        '<option value="6">6x de ' + Utils.currency(total/6) + '</option>' +
                        '<option value="10">10x de ' + Utils.currency(total/10) + '</option>' +
                        '<option value="12">12x de ' + Utils.currency(total/12) + '</option>' +
                      '</select></div>' +
                  '</div>' +

                  // Voucher: tipo
                  '<div id="pdvVoucherArea" style="' + (PDV.formaPagamento === 'voucher' ? '' : 'display:none') + '">' +
                    '<div class="form-group" style="margin-bottom:0"><label class="form-label">Tipo de Voucher</label>' +
                      '<select class="form-control" id="pdvVoucherTipo">' +
                        '<option value="vr">VR - Vale Refeição</option>' +
                        '<option value="va">VA - Vale Alimentação</option>' +
                        '<option value="outro">Outro</option>' +
                      '</select></div>' +
                  '</div>' +

                  // Dinheiro: troco
                  '<div id="pdvTrocoArea" style="' + (PDV.formaPagamento === 'dinheiro' ? '' : 'display:none') + '">' +
                    '<div class="form-group" style="margin-bottom:8px">' +
                      '<label class="form-label">Valor Recebido (R$)</label>' +
                      '<input type="text" class="form-control" id="pdvRecebido" placeholder="0,00" ' +
                        'style="font-size:1.2rem;padding:12px" ' +
                        'data-oninput="Utils.maskNumericInput(event)" data-onchange="PDV.calcTroco()"></div>' +
                    '<div id="pdvTrocoDisplay" style="text-align:center;font-size:1.3rem;font-weight:700;color:var(--success);margin:8px 0"></div>' +
                  '</div>' +

                  // Spacer para empurrar o botão para baixo
                  '<div style="flex:1"></div>' +

                  // Botão finalizar
                  '<button class="btn btn-success btn-lg btn-block" style="padding:16px;font-size:1.1rem" ' +
                    'data-onclick="PDV.finalizar()">' +
                    '<i data-lucide="check-circle" style="width:22px;height:22px"></i> Finalizar Venda (F9)</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        PDV._renderStatusBar() +
      '</div>';

    if (typeof lucide !== 'undefined') lucide.createIcons();
    PDV.bindKeys();
  },

  voltarProdutos() {
    if (!PDV.guardarAcao('VOLTAR_PRODUTOS', 'Não é possível voltar aos produtos no estado atual.')) return;
    // Máquina de Estados: EM_PAGAMENTO → ABERTA ou CLIENTE_IDENTIFICADO
    var novoStatus = PDV.clienteId ? STATUS_VENDA.CLIENTE_IDENTIFICADO : STATUS_VENDA.ABERTA;
    PDV.transitarEstado(novoStatus);
    PDV.fase = 'produtos';
    PDV.render();
  },

  // ══════════════════════════════════════════════
  //  Ações da barra de pills
  // ══════════════════════════════════════════════
  atalhoDesconto() {
    if (!PDV.podeExecutar('DESCONTO_MANUAL')) return;
    // Abrir modal de desconto manual (visível e direto)
    var subtotal = PDV.getSubtotal();
    if (subtotal <= 0) { Toast.warning('Adicione produtos antes de aplicar desconto'); return; }
    var descontoAtual = PDV.desconto || 0;
    var tipoAtual = PDV.descontoTipo || 'valor';
    Modal.show('Desconto Manual',
      '<p style="color:var(--text-muted);margin-bottom:16px">Subtotal: <strong>' + Utils.currency(subtotal) + '</strong></p>' +
      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="btn btn-sm ' + (tipoAtual === 'valor' ? 'btn-primary' : 'btn-outline') + '" id="descTipoValor" data-onclick="PDV._setDescontoTipoModal(\'valor\')">R$ Valor</button>' +
        '<button class="btn btn-sm ' + (tipoAtual === 'percentual' ? 'btn-primary' : 'btn-outline') + '" id="descTipoPerc" data-onclick="PDV._setDescontoTipoModal(\'percentual\')">% Percentual</button>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label" id="descLabel">' + (tipoAtual === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)') + '</label>' +
        '<input type="text" class="form-control" id="descModalValor" value="' + (descontoAtual > 0 ? descontoAtual : '') + '" ' +
          'placeholder="0,00" style="font-size:1.3rem;text-align:center;padding:12px" autofocus ' +
          'data-oninput="Utils.maskNumericInput(event)">' +
        '<small class="text-muted" id="descPreview" style="margin-top:6px;display:block"></small>' +
      '</div>',
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>' +
      '<button class="btn btn-primary" data-onclick="PDV._aplicarDescontoModal()">Aplicar Desconto</button>',
      'modal-sm'
    );
    setTimeout(function() {
      var el = document.getElementById('descModalValor');
      if (el) { el.focus(); el.select(); }
    }, 200);
  },

  _descontoTipoModal: null,
  _setDescontoTipoModal(tipo) {
    PDV._descontoTipoModal = tipo;
    var btnVal = document.getElementById('descTipoValor');
    var btnPerc = document.getElementById('descTipoPerc');
    var label = document.getElementById('descLabel');
    if (btnVal && btnPerc) {
      btnVal.className = 'btn btn-sm ' + (tipo === 'valor' ? 'btn-primary' : 'btn-outline');
      btnPerc.className = 'btn btn-sm ' + (tipo === 'percentual' ? 'btn-primary' : 'btn-outline');
    }
    if (label) label.textContent = tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)';
  },

  _aplicarDescontoModal() {
    var valor = parseFloat((document.getElementById('descModalValor').value || '0').replace(',', '.')) || 0;
    var tipo = PDV._descontoTipoModal || PDV.descontoTipo || 'valor';
    PDV.descontoTipo = tipo;

    // Validar percentual max 100
    if (tipo === 'percentual' && valor > 100) { Toast.error('Percentual não pode exceder 100%'); return; }
    if (valor < 0) { Toast.error('Valor inválido'); return; }

    var percentualEfetivo = tipo === 'percentual' ? valor : (PDV.getSubtotal() > 0 ? (valor / PDV.getSubtotal()) * 100 : 0);
    PDV._verificarLimiteDesconto(percentualEfetivo, function(autorizado, gerenteId) {
      if (!autorizado) {
        Toast.warning('Desconto limitado a ' + PDV._limiteDesconto.toFixed(1) + '% do seu perfil');
      } else {
        PDV.desconto = valor;
        if (gerenteId) {
          PDV._gerenteAutorizadorId = gerenteId;
          PDV._logAcaoPDV('DESCONTO_MANUAL_AUTORIZADO', PDV.status, PDV.status, {
            percentual: percentualEfetivo.toFixed(2), valor: valor, gerente_id: gerenteId
          });
        } else {
          PDV._logAcaoPDV('DESCONTO_MANUAL', PDV.status, PDV.status, {
            percentual: percentualEfetivo.toFixed(2), valor: valor
          });
        }
      }
      Modal.close();
      PDV.updateTotals();
      PDV._bumpTotal();
    });
  },

  // ── Cancelar Item com seleção (F3) ──
  cancelarItemUI() {
    if (!PDV.guardarAcao('REMOVER_PRODUTO', 'Não é possível remover produtos no estado atual.')) return;
    if (PDV.cart.length === 0) { Toast.warning('Nenhum item para remover'); return; }
    if (PDV.cart.length === 1) {
      // Apenas 1 item: confirmar direto
      var item = PDV.cart[0];
      UI.confirm('Remover Item', 'Remover <strong>"' + item.nome + '"</strong> do carrinho?', function() {
        PDV.cart.pop();
        PDV.recalcularTotais();
        PDV.render();
        Toast.info('Item removido');
      }, { confirmText: 'Remover', danger: true });
      return;
    }
    // Múltiplos itens: modal com lista para selecionar
    var listaHtml = PDV.cart.map(function(item, idx) {
      return '<div class="pdv-cancel-item" data-onclick="PDV._confirmarCancelItem(' + idx + ')" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:background 0.15s"' +
          ' onmouseover="this.style.background=\'var(--bg-alt)\'" onmouseout="this.style.background=\'transparent\'">' +
        '<span style="background:var(--bg-alt);color:var(--text-muted);font-weight:700;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:0.8rem;flex-shrink:0">' + (idx + 1) + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + item.nome + '</div>' +
          '<small class="text-muted">' + item.quantidade + 'x ' + Utils.currency(item.preco) + '</small>' +
        '</div>' +
        '<span style="font-weight:600;color:var(--text);flex-shrink:0">' + Utils.currency(item.preco * item.quantidade) + '</span>' +
        '<i data-lucide="trash-2" style="width:16px;height:16px;color:var(--danger);flex-shrink:0"></i>' +
      '</div>';
    }).join('');
    Modal.show('Cancelar Item',
      '<p style="color:var(--text-muted);margin-bottom:12px">Selecione o item que deseja remover:</p>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' + listaHtml + '</div>',
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Voltar</button>',
      'modal-md'
    );
  },

  _confirmarCancelItem(idx) {
    var item = PDV.cart[idx];
    if (!item) return;
    Modal.close();
    setTimeout(function() {
      UI.confirm('Remover Item', 'Remover <strong>"' + item.nome + '"</strong> (x' + item.quantidade + ') do carrinho?', function() {
        PDV.cart.splice(idx, 1);
        PDV.recalcularTotais();
        PDV.render();
        Toast.info('Item removido: ' + item.nome);
      }, { confirmText: 'Remover', danger: true });
    }, 250);
  },

  removerUltimoItem() {
    if (!PDV.guardarAcao('REMOVER_PRODUTO', 'Não é possível remover produtos no estado atual.')) return;
    if (PDV.cart.length === 0) { Toast.warning('Nenhum item para remover'); return; }
    var ultimo = PDV.cart[PDV.cart.length - 1];
    UI.confirm('Remover Item', 'Remover "' + ultimo.nome + '" do carrinho?', function() {
      PDV.cart.pop();
      PDV.recalcularTotais();
      PDV.render();
      Toast.info('Item removido');
    }, { confirmText: 'Remover', danger: true });
  },

  pedirCpf() {
    // Máquina de Estados: só pode identificar cliente se ABERTA
    if (!PDV.guardarAcao('IDENTIFICAR_CLIENTE', 'Não é possível alterar o cliente no estado atual.')) return;
    PDV.fase = 'cpf';
    PDV.renderCpfPrompt();
  },

  cancelarVenda() {
    if (!PDV.guardarAcao('CANCELAR', 'Não é possível cancelar a venda no estado atual.')) return;
    if (PDV.cart.length === 0) { Toast.warning('Nenhuma venda em andamento'); return; }
    // Pedir motivo do cancelamento (auditoria)
    var motivoHtml = 
      '<p>Cancelar toda a venda atual? Todos os itens serão removidos.</p>' +
      '<div class="form-group" style="margin-top:12px">' +
        '<label class="form-label">Motivo do cancelamento</label>' +
        '<input type="text" class="form-control" id="motivoCancelamento" placeholder="Informe o motivo..." autocomplete="off">' +
      '</div>';
    Modal.show('Cancelar Venda', motivoHtml,
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Voltar</button>' +
      '<button class="btn btn-danger" data-onclick="PDV._confirmarCancelamento()">Sim, cancelar</button>'
    );
    setTimeout(function() { var el = document.getElementById('motivoCancelamento'); if (el) el.focus(); }, 200);
  },

  _confirmarCancelamento() {
    var motivo = (document.getElementById('motivoCancelamento') || {}).value || 'Sem motivo informado';
    Modal.close();
    var estadoAnterior = PDV.status;
    // Máquina de Estados: → CANCELADA, depois RESET
    PDV.transitarEstado(STATUS_VENDA.CANCELADA);
    PDV._logAcaoPDV('CANCELAR_VENDA', estadoAnterior, STATUS_VENDA.CANCELADA, { 
      motivo: motivo, 
      itens_no_carrinho: PDV.cart.length,
      total_perdido: PDV.getTotal()
    });
    PDV._flushLogBuffer(); // Enviar logs imediatamente no cancelamento
    PDV.novaVenda();
    PDV.transitarEstado(STATUS_VENDA.ABERTA);
    PDV.fase = 'produtos';
    PDV.render();
    Toast.info('Venda cancelada — ' + motivo);
  },

  // ══════════════════════════════════════════════
  //  Atalhos de teclado
  // ══════════════════════════════════════════════
  bindKeys() {
    document.onkeydown = function(e) {
      // ESC fecha modal se estiver aberta
      if (e.key === 'Escape') {
        var modalAberta = document.querySelector('.modal-overlay.active');
        if (modalAberta) { e.preventDefault(); Modal.close(); return; }
        var resultados = document.getElementById('pdvResultados');
        if (resultados && resultados.style.display !== 'none') {
          resultados.style.display = 'none';
        } else if (PDV.fase === 'pagamento') {
          PDV.voltarProdutos();
        } else if (PDV.fase === 'produtos' && PDV.cart.length > 0) {
          PDV.cancelarVenda();
        }
        return;
      }

      // Ignorar atalhos se modal está aberta
      if (document.querySelector('.modal-overlay.active')) return;

      if (e.key === 'F2') {
        e.preventDefault();
        if (PDV.fase === 'produtos') PDV.atalhoDesconto();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (PDV.fase === 'produtos') PDV.cancelarItemUI();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (PDV.fase === 'produtos') PDV.irParaPagamento();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        if (PDV.fase === 'produtos') PDV.pedirCpf();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (PDV.fase === 'pagamento') PDV.finalizar();
      }
    };
  },

  // ══════════════════════════════════════════════
  //  Buscar produto
  // ══════════════════════════════════════════════
  _searchTimeout: null,
  _pendingMultiplier: 1,
  // Detectar EAN-13 com peso embutido (prefixo 2X)
  _parseWeightBarcode: function(code) {
    if (!code || code.length !== 13) return null;
    var prefix = code.substring(0, 1);
    if (prefix !== '2') return null;
    // Formato: 2PPPPP VVVVV C  (P=código produto 5 dígitos, V=peso/preço 5 dígitos, C=check)
    var codProduto = code.substring(1, 6);
    var valorRaw = code.substring(6, 11);
    // Peso em kg com 3 decimais (ex: 01250 = 1.250 kg)
    var peso = parseInt(valorRaw, 10) / 1000;
    if (peso <= 0) return null;
    return { codProduto: codProduto, peso: peso, barcode: code };
  },

  buscarProduto(valor) {
    if (!PDV.podeExecutar('BUSCAR_PRODUTO')) return;
    clearTimeout(PDV._searchTimeout);
    var resultados = document.getElementById('pdvResultados');

    // Suporte a multiplicador: 10*código ou 10*nome
    PDV._pendingMultiplier = 1;
    var multMatch = valor.match(/^(\d+)\*(.+)$/);
    if (multMatch) {
      PDV._pendingMultiplier = parseInt(multMatch[1]) || 1;
      valor = multMatch[2].trim();
    }

    // Detectar código de balança com peso embutido (EAN-13 prefixo 2)
    var weightData = PDV._parseWeightBarcode(valor);
    if (weightData) {
      clearTimeout(PDV._searchTimeout);
      PDV._searchTimeout = setTimeout(async function() {
        try {
          // Buscar pelo codigo_balanca OU codigo_barras parcial
          var res = await App.get('/produtos?busca=' + encodeURIComponent(weightData.codProduto));
          var produtos = Array.isArray(res) ? res : (res.data || []);
          var produto = produtos.find(function(p) {
            return p.codigo_balanca === weightData.codProduto || (p.codigo_barras && p.codigo_barras.indexOf(weightData.codProduto) !== -1);
          });
          if (produto) {
            PDV.addToCart(produto, weightData.peso);
            var buscaEl = document.getElementById('pdvBusca');
            if (buscaEl) { buscaEl.value = ''; buscaEl.focus(); }
            if (resultados) resultados.style.display = 'none';
            Toast.success(produto.nome + ' — ' + weightData.peso.toFixed(3) + ' kg');
          } else {
            Toast.error('Produto da balança não encontrado (código: ' + weightData.codProduto + ')');
          }
        } catch(e) { console.error(e); }
      }, 100);
      return;
    }

    if (!valor || valor.length < 2) {
      if (resultados) resultados.style.display = 'none';
      return;
    }
    PDV._searchTimeout = setTimeout(async function() {
      try {
        var res = await App.get('/produtos?busca=' + encodeURIComponent(valor));
        var produtos = Array.isArray(res) ? res : (res.data || []);
        if (!produtos || produtos.length === 0) {
          resultados.innerHTML = '<div class="pdv-search-result-item" style="color:var(--text-muted);cursor:default">Nenhum produto encontrado</div>';
          resultados.style.display = 'block';
          return;
        }
        var mult = PDV._pendingMultiplier;
        resultados.innerHTML = produtos.slice(0, 10).map(function(p) {
          var estoqueClass = parseFloat(p.estoque_atual) <= 0 ? 'text-danger' : '';
          return '<div class="pdv-search-result-item" data-onclick="PDV.addFromSearch(' + p.id + ',' + mult + ')">' +
            '<div><strong>' + p.nome + '</strong>' +
            (p.codigo_barras ? ' <small class="text-muted">(' + p.codigo_barras + ')</small>' : '') + '</div>' +
            '<div style="display:flex;gap:16px;margin-top:2px">' +
              '<span>' + Utils.currency(p.preco_venda) + '</span>' +
              '<span class="' + estoqueClass + '">Est: ' + Utils.number(p.estoque_atual, 0) + '</span>' +
              (mult > 1 ? '<span class="badge badge-info">x' + mult + '</span>' : '') +
            '</div></div>';
        }).join('');
        resultados.style.display = 'block';
      } catch(e) { console.error(e); }
    }, 300);
  },

  async addFromSearch(produtoId, quantidade) {
    // Máquina de Estados: guard delegado ao addToCart
    if (!PDV.podeExecutar('ADICIONAR_PRODUTO')) {
      Toast.warning('Não é possível adicionar produtos no estado atual.');
      return;
    }
    quantidade = quantidade || 1;
    try {
      var p = await App.get('/produtos/' + produtoId);
      var unidade = (p.unidade || 'UN').toUpperCase();
      var isPeso = ['KG','LT','ML','G','L'].indexOf(unidade) !== -1;

      // Se produto é pesável, pedir o peso
      if (isPeso && quantidade === 1) {
        PDV._produtoPesavel = p;
        PDV._showPesoDialog(p);
        return;
      }

      PDV.addToCart(p, quantidade);
      PDV.fetchSugestoes(produtoId);
      var buscaEl = document.getElementById('pdvBusca');
      if (buscaEl) { buscaEl.value = ''; buscaEl.focus(); }
      var resultados = document.getElementById('pdvResultados');
      if (resultados) resultados.style.display = 'none';
    } catch(e) { console.error(e); }
  },

  _showPesoDialog: function(produto) {
    var unidade = (produto.unidade || 'KG').toUpperCase();
    Modal.show('Produto Pesável — ' + unidade,
      '<div style="text-align:center;margin-bottom:16px">' +
        '<h3>' + produto.nome + '</h3>' +
        '<p class="text-muted">' + Utils.currency(produto.preco_venda) + ' / ' + unidade + '</p>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Peso / Quantidade (' + unidade + ')</label>' +
        '<input type="text" class="form-control" id="pdvPesoInput" placeholder="Ex: 0,500" ' +
          'style="font-size:1.5rem;text-align:center;padding:16px" ' +
          'data-oninput="Utils.maskNumericInput(event)" ' +
          'data-onenter="PDV._confirmarPeso()"></div>' +
      '<div id="pdvPesoPreview" style="text-align:center;font-size:1.2rem;font-weight:700;color:var(--primary);margin-top:8px"></div>',
      '<button class="btn btn-success btn-lg" data-onclick="PDV._confirmarPeso()">' +
        '<i data-lucide="check" style="width:18px;height:18px"></i> Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>'
    );
    setTimeout(function() {
      var el = document.getElementById('pdvPesoInput');
      if (el) { el.focus(); el.addEventListener('input', function() {
        var peso = parseFloat(el.value.replace(',', '.') || 0);
        var preview = document.getElementById('pdvPesoPreview');
        if (preview && peso > 0) preview.innerHTML = 'Total: ' + Utils.currency(peso * parseFloat(produto.preco_venda));
      }); }
    }, 200);
  },

  _confirmarPeso: function() {
    var pesoEl = document.getElementById('pdvPesoInput');
    var peso = parseFloat((pesoEl ? pesoEl.value : '0').replace(',', '.'));
    if (!peso || peso <= 0) { Toast.error('Digite um peso válido'); return; }
    var p = PDV._produtoPesavel;
    if (!p) return;
    Modal.close();
    PDV.addToCart(p, peso);
    PDV.fetchSugestoes(p.id);
    var buscaEl = document.getElementById('pdvBusca');
    if (buscaEl) { buscaEl.value = ''; buscaEl.focus(); }
    var resultados = document.getElementById('pdvResultados');
    if (resultados) resultados.style.display = 'none';
    PDV._produtoPesavel = null;
  },

  async fetchSugestoes(produtoId) {
    if (!App.hasFeature || !App.hasFeature('sngpc')) return; // só farmácia
    try {
      var sug = await App.get('/produtos/sugestoes/' + produtoId);
      if (sug && sug.length > 0) {
        // Filtrar itens já no carrinho
        PDV.sugestoes = sug.filter(function(s) {
          return !PDV.cart.find(function(c) { return c.id === s.ProdutoSugerido.id; });
        }).map(function(s) { return s.ProdutoSugerido; }).slice(0, 5);
        PDV.render();
      }
    } catch(e) { /* silencioso */ }
  },

  // ══════════════════════════════════════════════
  //  Carregar descontos do programa comercial
  // ══════════════════════════════════════════════
  async _carregarDescontosCliente(clienteId) {
    try {
      var descontos = await App.get('/programas/descontos/cliente/' + clienteId);
      PDV._descontosCliente = descontos || [];
      if (descontos && descontos.length > 0) {
        // Extrair nomes únicos de programas
        var nomes = [];
        descontos.forEach(function(d) { if (nomes.indexOf(d.programa_nome) === -1) nomes.push(d.programa_nome); });
        Toast.info('🏷️ ' + nomes.join(', ') + ' — ' + descontos.length + ' regra(s) de desconto ativa(s)');
      }
    } catch(e) {
      PDV._descontosCliente = [];
    }
  },

  // Legado — redireciona para o pipeline v2.0 idempotente
  _recalcularCarrinhoComDescontos() {
    var alterados = PDV.reprocessarTodosOsItens();
    if (alterados > 0) {
      Toast.info('🏷️ ' + alterados + ' item(ns) atualizado(s) com desconto de programa');
    }
  },

  // ══════════════════════════════════════════════
  //  MOTOR DE DESCONTOS LOCAL (espelha engine/motor-descontos.js)
  // ══════════════════════════════════════════════
  //  Pipeline determinístico:
  //   1. Filtra regras aplicáveis ao produto
  //   2. Peso de escopo: produto=3, categoria=2, geral=1
  //   3. Ordena: escopo → regra.prioridade → programa_prioridade
  //   4. Não-acumulativas: pega melhor; Acumulativas: soma
  //   5. Cap em preco_original, retorna decisão com auditoria
  // ══════════════════════════════════════════════

  _ESCOPO_PESO: { produto: 3, categoria: 2, geral: 1 },

  _calcularDescontoRegra(regra, precoOriginal) {
    var valor = parseFloat(regra.valor) || 0;
    var desc = 0;
    if (regra.tipo_regra === 'percentual') desc = precoOriginal * (valor / 100);
    else if (regra.tipo_regra === 'valor_fixo') desc = valor;
    else if (regra.tipo_regra === 'preco_especial') desc = Math.max(0, precoOriginal - valor);
    return Math.max(0, desc);
  },

  _calcularDescontoProduto(produtoId, categoriaId, precoOriginal) {
    if (!PDV._descontosCliente || PDV._descontosCliente.length === 0) return null;
    if (!precoOriginal || precoOriginal <= 0) return null;

    // 1. Filtrar regras aplicáveis
    var aplicaveis = PDV._descontosCliente.filter(function(r) {
      if (r.escopo === 'geral') return true;
      if (r.escopo === 'produto' && r.produto_id === produtoId) return true;
      if (r.escopo === 'categoria' && categoriaId && r.categoria_id === categoriaId) return true;
      return false;
    });
    if (aplicaveis.length === 0) return null;

    // 2. Ordenar por prioridade determinística
    var self = PDV;
    aplicaveis.sort(function(a, b) {
      var pesoA = self._ESCOPO_PESO[a.escopo] || 0;
      var pesoB = self._ESCOPO_PESO[b.escopo] || 0;
      if (pesoB !== pesoA) return pesoB - pesoA;
      var prioRA = a.prioridade || 0, prioRB = b.prioridade || 0;
      if (prioRB !== prioRA) return prioRB - prioRA;
      var prioPrA = a.programa_prioridade || 0, prioPrB = b.programa_prioridade || 0;
      if (prioPrB !== prioPrA) return prioPrB - prioPrA;
      return self._calcularDescontoRegra(b, precoOriginal) - self._calcularDescontoRegra(a, precoOriginal);
    });

    // 3. Separar acumulativas vs não-acumulativas (por programa)
    var acumulativas = aplicaveis.filter(function(r) { return r.programa_acumulativo === true; });
    var naoAcumulativas = aplicaveis.filter(function(r) { return r.programa_acumulativo !== true; });

    // 4. Melhor não-acumulativa
    var melhorNaoAcum = null, melhorDescNaoAcum = 0;
    for (var i = 0; i < naoAcumulativas.length; i++) {
      var d = self._calcularDescontoRegra(naoAcumulativas[i], precoOriginal);
      if (d > melhorDescNaoAcum) { melhorDescNaoAcum = d; melhorNaoAcum = naoAcumulativas[i]; }
    }

    // 5. Soma acumulativas
    var somaAcum = 0, regrasAcumAplicadas = [];
    for (var j = 0; j < acumulativas.length; j++) {
      var da = self._calcularDescontoRegra(acumulativas[j], precoOriginal);
      if (da > 0) {
        somaAcum += da;
        regrasAcumAplicadas.push({
          regra_id: acumulativas[j].regra_id,
          programa_id: acumulativas[j].programa_id,
          programa_nome: acumulativas[j].programa_nome,
          tipo_regra: acumulativas[j].tipo_regra,
          escopo: acumulativas[j].escopo,
          valor: acumulativas[j].valor,
          desconto_calculado: Math.round(da * 100) / 100
        });
      }
    }

    // 6. Combinar e cap
    var descontoTotal = Math.min(melhorDescNaoAcum + somaAcum, precoOriginal);
    descontoTotal = Math.round(descontoTotal * 100) / 100;
    if (descontoTotal <= 0) return null;

    var precoAplicado = Math.round((precoOriginal - descontoTotal) * 100) / 100;
    precoAplicado = Math.max(0, precoAplicado);

    var regraVencedora = melhorNaoAcum || (regrasAcumAplicadas.length > 0 ? acumulativas[0] : null);
    if (!regraVencedora) return null;

    // 7. Montar regras aplicadas
    var regrasAplicadas = [];
    if (melhorNaoAcum) {
      regrasAplicadas.push({
        regra_id: melhorNaoAcum.regra_id,
        programa_id: melhorNaoAcum.programa_id,
        programa_nome: melhorNaoAcum.programa_nome,
        tipo_regra: melhorNaoAcum.tipo_regra,
        escopo: melhorNaoAcum.escopo,
        valor: melhorNaoAcum.valor,
        desconto_calculado: Math.round(melhorDescNaoAcum * 100) / 100,
        acumulativo: false
      });
    }
    regrasAcumAplicadas.forEach(function(ra) { ra.acumulativo = true; regrasAplicadas.push(ra); });

    // Tipo de desconto final
    var tipoDesconto, valorDesconto;
    if (regrasAplicadas.length > 1) {
      tipoDesconto = 'acumulado';
      valorDesconto = descontoTotal;
    } else {
      tipoDesconto = regraVencedora.tipo_regra;
      valorDesconto = parseFloat(regraVencedora.valor);
    }

    return {
      preco_original: precoOriginal,
      preco_aplicado: precoAplicado,
      desconto_total: descontoTotal,
      tipo_desconto: tipoDesconto,
      valor_desconto: valorDesconto,
      programa_id: regraVencedora.programa_id,
      programa_nome: regraVencedora.programa_nome,
      programa_tipo: regraVencedora.programa_tipo,
      regra_vencedora: regraVencedora,
      regras_aplicadas: regrasAplicadas,
      // Compat com UI existente
      regra: regraVencedora,
      desconto: descontoTotal,
      precoFinal: precoAplicado,
      programaNome: regraVencedora.programa_nome,
      programaTipo: regraVencedora.programa_tipo,
      programaId: regraVencedora.programa_id
    };
  },

  // ══════════════════════════════════════════════
  //  MOTOR DE DECISÃO v2.0 — ALGORITMO COMPLETO
  //  Determinístico · Idempotente · Auditável
  //
  //  Regra fundamental: o PDV NUNCA "edita preço".
  //  Ele SEMPRE recalcula do zero a partir do preço original.
  //  Isso evita acumulação indevida e garante que
  //  reprocessar 10x gera exatamente o mesmo resultado.
  // ══════════════════════════════════════════════

  /**
   * FUNÇÃO 3 — Aplica o motor de desconto a UM item.
   * Sempre reseta ao preço original antes de recalcular.
   * Garante idempotência: chamar N vezes = mesmo resultado.
   * @param {Object} item - Item do carrinho com precoOriginal obrigatório
   */
  aplicarMotorDeDesconto(item) {
    // ── RESET completo ao preço original (garante idempotência) ──
    item.preco = item.precoOriginal;
    item.desconto_automatico = 0;
    item.regra_aplicada_id = null;
    item.programa_id = null;
    item.programa_nome = null;
    item.descontoPrograma = null;

    // Sem regras ativas → item mantém preço original
    if (!PDV._descontosCliente || PDV._descontosCliente.length === 0) return;

    // Avaliar motor com preço original (nunca com preço já descontado)
    var decisao = PDV._calcularDescontoProduto(item.id, item.categoria_id, item.precoOriginal);
    if (!decisao) return;

    // Aplicar resultado — novo preço nunca negativo
    var novo_preco = decisao.preco_aplicado;
    if (novo_preco < 0) novo_preco = 0;

    item.preco = novo_preco;
    item.desconto_automatico = Math.round((item.precoOriginal - novo_preco) * item.quantidade * 100) / 100;
    item.regra_aplicada_id = decisao.regra_vencedora ? decisao.regra_vencedora.regra_id : null;
    item.programa_id = decisao.programa_id;
    item.programa_nome = decisao.programa_nome;
    item.descontoPrograma = decisao;
  },

  /**
   * FUNÇÃO 7 — Reprocessa TODOS os itens do carrinho.
   * Chamado quando: cliente muda, CPF informado depois, cliente removido.
   * Cada item é recalculado do zero (preço original).
   * Garante idempotência completa da venda.
   * @returns {number} Quantidade de itens cujo preço mudou
   */
  reprocessarTodosOsItens() {
    if (PDV.cart.length === 0) return 0;
    var alterados = 0;
    var precoAntes;
    PDV.cart.forEach(function(item) {
      precoAntes = item.preco;
      PDV.aplicarMotorDeDesconto(item);
      if (item.preco !== precoAntes) alterados++;
    });
    PDV.recalcularTotais();
    return alterados;
  },

  /**
   * FUNÇÃO 8 — Recalcula TODOS os totais da venda.
   * Nunca usa valor visual como base — sempre calcula matematicamente.
   * subtotal_bruto = Σ(precoOriginal × quantidade)
   * desconto_automatico_total = Σ(item.desconto_automatico)
   * total_final = subtotal_bruto - desc_auto - desc_manual + acrescimo
   */
  recalcularTotais() {
    PDV._subtotal_bruto = 0;
    PDV._desconto_automatico_total = 0;
    PDV.cart.forEach(function(item) {
      PDV._subtotal_bruto += item.precoOriginal * item.quantidade;
      PDV._desconto_automatico_total += item.desconto_automatico || 0;
    });
    PDV._subtotal_bruto = Math.round(PDV._subtotal_bruto * 100) / 100;
    PDV._desconto_automatico_total = Math.round(PDV._desconto_automatico_total * 100) / 100;
  },

  addToCart(produto, qtdOverride) {
    // Máquina de Estados: só pode adicionar produto em ABERTA ou CLIENTE_IDENTIFICADO
    if (!PDV.guardarAcao('ADICIONAR_PRODUTO', 'Não é possível adicionar produtos no estado atual.')) return;

    // ── SNGPC: Interceptar produto controlado ──
    if (produto.controlado) {
      PDV._addControladoComModal(produto, qtdOverride);
      return;
    }

    PDV._addToCartInternal(produto, qtdOverride);
  },

  // SNGPC: Modal para colet de dados de receita e seleção de lote
  async _addControladoComModal(produto, qtdOverride) {
    var qty = qtdOverride || 1;
    // Buscar lotes disponíveis
    var lotes = [];
    try { lotes = await App.get('/sngpc/lotes/' + produto.id); } catch(e) { lotes = []; }
    if (!lotes || lotes.length === 0) {
      Toast.error('Produto controlado sem lotes disponíveis: ' + produto.nome);
      return;
    }
    var lotesOptions = lotes.map(function(l) {
      var valStr = l.validade ? ' (Val: ' + Utils.date(l.validade) + ')' : '';
      return '<option value="' + l.id + '">' + l.numero_lote + valStr + ' - Disp: ' + l.quantidade_atual + '</option>';
    }).join('');

    var needsReceita = produto.necessita_receita;
    var receitaHtml = '';
    if (needsReceita) {
      receitaHtml = '<h4 style="margin:12px 0 8px;color:var(--danger)">Dados da Receita (Obrigatório)</h4>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Nome do Paciente</label>' +
            '<input type="text" class="form-control" id="sngpcPdvNomePac" placeholder="Nome completo"></div>' +
          '<div class="form-group"><label class="form-label">CPF do Paciente</label>' +
            '<input type="text" class="form-control" id="sngpcPdvCpfPac" data-oninput="Utils.maskCPFInput(event)" placeholder="000.000.000-00"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">Nome do Médico</label>' +
            '<input type="text" class="form-control" id="sngpcPdvMedico" placeholder="Nome do prescritor"></div>' +
          '<div class="form-group"><label class="form-label">CRM</label>' +
            '<input type="text" class="form-control" id="sngpcPdvCRM" placeholder="CRM"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label class="form-label">UF CRM</label>' +
            '<input type="text" class="form-control" id="sngpcPdvUF" placeholder="UF" maxlength="2" style="max-width:100px"></div>' +
          '<div class="form-group"><label class="form-label">Nº Receita</label>' +
            '<input type="text" class="form-control" id="sngpcPdvNumRec" placeholder="Número da receita"></div>' +
          '<div class="form-group"><label class="form-label">Data Receita</label>' +
            '<input type="date" class="form-control" id="sngpcPdvDataRec"></div>' +
        '</div>';
    }

    Modal.show('Produto Controlado - ' + produto.nome,
      '<div class="alert alert-warning" style="margin-bottom:12px"><strong>Medicamento controlado</strong> — Exige seleção de lote' + (needsReceita ? ' e dados da receita' : '') + '.</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label class="form-label">Lote</label>' +
          '<select class="form-control" id="sngpcPdvLote">' + lotesOptions + '</select></div>' +
        '<div class="form-group"><label class="form-label">Quantidade</label>' +
          '<input type="number" class="form-control" id="sngpcPdvQtd" value="' + qty + '" min="1"></div>' +
      '</div>' +
      receitaHtml,
      '<button class="btn btn-success" id="sngpcPdvConfirm"><i data-lucide="check" style="width:16px;height:16px"></i> Confirmar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-lg'
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Bind do botão de confirmação
    var btnConfirm = document.getElementById('sngpcPdvConfirm');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', function() {
        var loteId = parseInt(document.getElementById('sngpcPdvLote').value);
        var qtdVal = parseInt(document.getElementById('sngpcPdvQtd').value) || 1;
        var loteSel = lotes.find(function(l) { return l.id === loteId; });
        if (!loteSel) { Toast.error('Selecione um lote'); return; }
        if (qtdVal > parseFloat(loteSel.quantidade_atual)) { Toast.error('Quantidade excede o disponível no lote (' + loteSel.quantidade_atual + ')'); return; }

        var sngpcData = { lote_id: loteId, lote_numero: loteSel.numero_lote };
        if (needsReceita) {
          sngpcData.nome_paciente = (document.getElementById('sngpcPdvNomePac') || {}).value || '';
          sngpcData.cpf_paciente = (document.getElementById('sngpcPdvCpfPac') || {}).value || '';
          sngpcData.nome_medico = (document.getElementById('sngpcPdvMedico') || {}).value || '';
          sngpcData.crm_medico = (document.getElementById('sngpcPdvCRM') || {}).value || '';
          sngpcData.uf_crm = (document.getElementById('sngpcPdvUF') || {}).value || '';
          sngpcData.numero_receita = (document.getElementById('sngpcPdvNumRec') || {}).value || '';
          sngpcData.data_receita = (document.getElementById('sngpcPdvDataRec') || {}).value || '';
          if (!sngpcData.nome_paciente || !sngpcData.cpf_paciente || !sngpcData.nome_medico ||
              !sngpcData.crm_medico || !sngpcData.uf_crm || !sngpcData.numero_receita || !sngpcData.data_receita) {
            Toast.error('Preencha todos os dados da receita');
            return;
          }
        }

        Modal.close();
        PDV._addToCartInternal(produto, qtdVal, sngpcData);
      });
    }
  },

  _addToCartInternal(produto, qtdOverride, sngpcData) {
    var unidade = (produto.unidade || 'UN').toUpperCase();
    var isPeso = ['KG','LT','ML','G','L'].indexOf(unidade) !== -1;
    var qty = qtdOverride || 1;
    var precoOriginal = parseFloat(produto.preco_venda);

    var existing = PDV.cart.find(function(item) { return item.id === produto.id; });
    var wasExisting = !!existing;
    if (existing && !sngpcData) {
      // Produtos normais: incrementar quantidade
      if (parseFloat(produto.estoque_atual) < existing.quantidade + qty) {
        Toast.error('Estoque insuficiente para ' + produto.nome);
        return;
      }
      existing.quantidade += qty;
      // Motor v2.0: re-aplicar desconto com nova quantidade (idempotente)
      PDV.aplicarMotorDeDesconto(existing);
      existing._highlight = true;
    } else if (existing && sngpcData) {
      // Controlado já no carrinho: não permite incrementar (cada lote/receita é único)
      Toast.warning('Produto controlado já está no carrinho. Remova antes de adicionar com outro lote/receita.');
      return;
    } else {
      if (parseFloat(produto.estoque_atual) <= 0) {
        Toast.error('Produto sem estoque: ' + produto.nome);
        return;
      }
      var item = {
        id: produto.id,
        nome: produto.nome,
        preco: precoOriginal,                // Será recalculado pelo motor
        precoOriginal: precoOriginal,        // SEMPRE o preço de tabela — nunca muda
        descontoPrograma: null,              // Decisão completa do motor (auditoria)
        desconto_automatico: 0,              // (original - aplicado) × quantidade
        regra_aplicada_id: null,             // ID da regra vencedora
        programa_id: null,                   // ID do programa principal
        programa_nome: null,                 // Nome do programa (display)
        categoria_id: produto.categoria_id || null,
        quantidade: qty,
        estoque: parseFloat(produto.estoque_atual),
        unidade: unidade,
        isPeso: isPeso,
        _sngpc: sngpcData || null,
        _new: true
      };
      // Motor v2.0: aplicar desconto a partir do preço original (idempotente)
      PDV.aplicarMotorDeDesconto(item);
      PDV.cart.push(item);
      if (item.descontoPrograma) {
        Toast.success('🏷️ Desconto ' + item.programa_nome + ': ' + Utils.currency(precoOriginal) + ' → ' + Utils.currency(item.preco));
      }
    }
    PDV.recalcularTotais();
    PDV.updateCartUI();
    PDV._animateCartChange(wasExisting ? produto.id : null);
    PDV._bumpTotal();
  },

  removeItem(idx) {
    if (!PDV.guardarAcao('REMOVER_PRODUTO', 'Não é possível remover produtos no estado atual.')) return;
    PDV.cart.splice(idx, 1);
    PDV.recalcularTotais();
    PDV.updateCartUI();
  },

  incrementItem(idx) {
    if (!PDV.guardarAcao('ALTERAR_QUANTIDADE', 'Não é possível alterar quantidade no estado atual.')) return;
    var item = PDV.cart[idx];
    if (item && item.quantidade < item.estoque) {
      item.quantidade++;
      // Motor v2.0: recalcular desconto do zero (idempotente)
      PDV.aplicarMotorDeDesconto(item);
      item._highlight = true;
      PDV.recalcularTotais();
      PDV.updateCartUI();
      PDV._animateCartChange(item.id);
      PDV._bumpTotal();
    } else {
      Toast.error('Estoque insuficiente');
    }
  },

  decrementItem(idx) {
    if (!PDV.guardarAcao('ALTERAR_QUANTIDADE', 'Não é possível alterar quantidade no estado atual.')) return;
    var item = PDV.cart[idx];
    if (item) {
      item.quantidade--;
      if (item.quantidade <= 0) {
        PDV.cart.splice(idx, 1);
      } else {
        // Motor v2.0: recalcular desconto do zero (idempotente)
        PDV.aplicarMotorDeDesconto(item);
        item._highlight = true;
      }
      PDV.recalcularTotais();
      PDV.updateCartUI();
      PDV._bumpTotal();
    }
  },

  getSubtotal() {
    return PDV.cart.reduce(function(sum, item) { return sum + (item.preco * item.quantidade); }, 0);
  },

  // Total economizado com programas comerciais (Motor v2.0)
  _getEconomiaPrograma() {
    return PDV.cart.reduce(function(sum, item) {
      return sum + (item.desconto_automatico || 0);
    }, 0);
  },

  // Retorna o desconto calculado em valor (R$)
  getDescontoValor() {
    if (PDV.descontoTipo === 'percentual') {
      return PDV.getSubtotal() * (PDV.desconto / 100);
    }
    return PDV.desconto;
  },

  getTotal() {
    var subtotal = PDV.getSubtotal();
    var descontoReal = PDV.getDescontoValor();
    var total = subtotal - descontoReal;
    return total < 0 ? 0 : total;
  },

  // ══════════════════════════════════════════════
  //  Update parcial + microinterações
  // ══════════════════════════════════════════════
  updateCartUI() {
    PDV.render();
    // Limpar flags de animação depois do render
    PDV.cart.forEach(function(item) { delete item._new; delete item._highlight; });
  },

  updateTotals() {
    PDV.render();
  },

  // ══════════════════════════════════════════════
  //  MICROINTERAÇÕES
  // ══════════════════════════════════════════════

  // Highlight flash no item alterado (quantidade mudou)
  _animateCartChange(productId) {
    if (!productId) return;
    setTimeout(function() {
      var rows = document.querySelectorAll('.pdv-cart-table tr[data-product-id]');
      rows.forEach(function(row) {
        if (row.getAttribute('data-product-id') === String(productId)) {
          row.classList.add('pdv-item-highlight');
          setTimeout(function() { row.classList.remove('pdv-item-highlight'); }, 600);
        }
      });
    }, 50);
  },

  // Bump animation no total
  _bumpTotal() {
    setTimeout(function() {
      var totalEl = document.querySelector('.pdv-total-card-value');
      if (!totalEl) return;
      totalEl.classList.add('pdv-total-bump');
      setTimeout(function() { totalEl.classList.remove('pdv-total-bump'); }, 400);
    }, 50);
  },

  // Feedback visual positivo ao finalizar venda
  _showSuccessAnimation(total) {
    var overlay = document.createElement('div');
    overlay.className = 'pdv-success-overlay';
    overlay.innerHTML =
      '<div class="pdv-success-card">' +
        '<div class="pdv-success-icon">' +
          '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"></polyline></svg>' +
        '</div>' +
        '<h2>Venda Finalizada!</h2>' +
        '<div class="pdv-success-total">' + Utils.currency(total) + '</div>' +
        '<p>Venda registrada com sucesso</p>' +
      '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(function() { overlay.remove(); }, 300);
    }, 2000);
  },

  selectPayment(forma, event) {
    if (!PDV.guardarAcao('SELECIONAR_PAGAMENTO', 'Não é possível alterar pagamento no estado atual.')) return;
    PDV.formaPagamento = forma;
    document.querySelectorAll('.pdv-payment-btn').forEach(function(btn) { btn.classList.remove('active'); });
    if (event && event.target) {
      var btn = event.target.closest('.pdv-payment-btn');
      if (btn) btn.classList.add('active');
    }
    var trocoArea = document.getElementById('pdvTrocoArea');
    if (trocoArea) trocoArea.style.display = forma === 'dinheiro' ? '' : 'none';
    var creditoArea = document.getElementById('pdvCreditoArea');
    if (creditoArea) creditoArea.style.display = forma === 'credito' ? '' : 'none';
    var voucherArea = document.getElementById('pdvVoucherArea');
    if (voucherArea) voucherArea.style.display = forma === 'voucher' ? '' : 'none';
  },

  calcTroco() {
    var recebido = parseFloat((document.getElementById('pdvRecebido').value || '0').replace(',', '.'));
    var total = PDV.getTotal();
    var troco = recebido - total;
    var display = document.getElementById('pdvTrocoDisplay');
    if (display) {
      if (recebido > 0 && troco >= 0) {
        display.innerHTML = 'Troco: ' + Utils.currency(troco);
        display.style.color = 'var(--success)';
      } else if (recebido > 0 && troco < 0) {
        display.innerHTML = 'Falta: ' + Utils.currency(Math.abs(troco));
        display.style.color = 'var(--danger)';
      } else {
        display.innerHTML = '';
      }
    }
  },

  // ══════════════════════════════════════════════
  //  Finalizar venda
  // ══════════════════════════════════════════════
  async finalizar() {
    // Máquina de Estados: só pode finalizar em EM_PAGAMENTO
    if (!PDV.guardarAcao('FINALIZAR', 'Não é possível finalizar a venda no estado atual.')) return;
    // Anti-duplicação: impede clique duplo
    if (PDV._finalizando) {
      Toast.warning('Venda já está sendo processada...');
      return;
    }

    if (PDV.cart.length === 0) {
      Toast.error('Adicione produtos ao carrinho');
      return;
    }

    var total = PDV.getTotal();
    var recebido = 0;
    var troco = 0;
    if (PDV.formaPagamento === 'dinheiro') {
      var recebidoEl = document.getElementById('pdvRecebido');
      recebido = parseFloat((recebidoEl ? recebidoEl.value : '0').replace(',', '.') || '0');
      if (recebido > 0 && recebido < total) {
        Toast.error('Valor recebido insuficiente');
        return;
      }
      troco = recebido > 0 ? recebido - total : 0;
    }

    // Desabilitar botão e ativar flag
    PDV._finalizando = true;
    var btnFinalizar = document.querySelector('[data-onclick="PDV.finalizar()"]');
    if (btnFinalizar) {
      btnFinalizar.disabled = true;
      btnFinalizar.innerHTML = '<i data-lucide="loader" style="width:22px;height:22px;animation:spin 1s linear infinite"></i> Processando...';
    }

    // Calcular desconto real em valor
    var descontoValor = PDV.desconto;
    if (PDV.descontoTipo === 'percentual') {
      descontoValor = PDV.getSubtotal() * (PDV.desconto / 100);
    }

    var vendaData = {
      itens: PDV.cart.map(function(item) {
        var itemData = {
          produto_id: item.id,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          desconto_item: 0,
          sngpc: item._sngpc || null
        };
        // Motor v2.0 — auditoria completa (SEMPRE envia preço original)
        itemData.preco_original = item.precoOriginal;
        itemData.preco_aplicado = item.preco;
        itemData.desconto_total = item.desconto_automatico || 0;
        if (item.descontoPrograma) {
          var dp = item.descontoPrograma;
          itemData.programa_id = item.programa_id || dp.programa_id || dp.programaId || null;
          itemData.desconto_programa = dp.desconto_total || dp.desconto;
          itemData.tipo_desconto = dp.tipo_desconto || null;
          itemData.valor_desconto = dp.valor_desconto || null;
          itemData.programa_nome = item.programa_nome || dp.programa_nome || dp.programaNome;
          itemData.regra_aplicada_id = item.regra_aplicada_id || null;
          itemData.origem_desconto = JSON.stringify({
            motor_versao: '2.0',
            timestamp: new Date().toISOString(),
            regras_aplicadas: dp.regras_aplicadas || [],
            tipo_desconto: dp.tipo_desconto,
            regra_vencedora_id: item.regra_aplicada_id
          });
        }
        return itemData;
      }),
      forma_pagamento: PDV.formaPagamento,
      desconto: descontoValor,
      acrescimo: 0,
      valor_recebido: recebido || total,
      cliente_nome: PDV.cliente.nome || null,
      cliente_cpf: PDV.cliente.cpf || null,
      cliente_id: PDV.clienteId || null,
      // ── Prioridade 5: Snapshot de auditoria anti-fraude ──
      desconto_automatico_total: PDV._desconto_automatico_total || 0,
      desconto_manual_total: descontoValor,
      gerente_autorizador_id: PDV._gerenteAutorizadorId || null
    };

    try {
      var result = await App.post('/vendas', vendaData);
      // Microinteração: feedback visual positivo ao finalizar
      PDV._showSuccessAnimation(total);
      Toast.success('Venda #' + result.numero + ' finalizada!');
      // Limpar carrinho imediatamente (anti-duplicação)
      // Máquina de Estados: → FINALIZADA
      PDV.transitarEstado(STATUS_VENDA.FINALIZADA);
      PDV._logAcaoPDV('FINALIZAR_VENDA', STATUS_VENDA.EM_PAGAMENTO, STATUS_VENDA.FINALIZADA, {
        venda_id: result.id, numero: result.numero, total: total
      });
      PDV._flushLogBuffer(); // Enviar todos os logs imediatamente ao finalizar
      PDV.cart = [];
      PDV.desconto = 0;
      PDV.acrescimo = 0;
      setTimeout(function() { PDV.showCupom(result, troco); }, 2200);
    } catch(e) {
      console.error(e);
      Toast.error('Erro ao finalizar venda: ' + (e.message || 'Tente novamente'));
      // Restaurar botão em caso de erro
      if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = '<i data-lucide="check-circle" style="width:22px;height:22px"></i> Finalizar Venda (F9)';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    } finally {
      PDV._finalizando = false;
    }
  },

  // ══════════════════════════════════════════════
  //  Sistema de Cupons v2.0 — Templates Separados
  //  Cupom Não Fiscal vs NFC-e
  // ══════════════════════════════════════════════

  // Configuração de impressão cacheada
  _configImpressao: null,

  async _loadConfigImpressao() {
    if (PDV._configImpressao) return PDV._configImpressao;
    try {
      PDV._configImpressao = await App.get('/etiquetas/config-impressao/atual');
    } catch(e) {
      PDV._configImpressao = {
        tipo_impressora: 'termica', largura_papel_mm: 80, tamanho_fonte_cupom: 12,
        margem_lateral: 5, tipo_documento_padrao: 'cupom_nao_fiscal',
        mensagem_rodape: 'Obrigado pela preferência!', imprimir_automatico: false
      };
    }
    return PDV._configImpressao;
  },

  // ── Constrói snapshot imutável da venda para reimpressão ──
  _buildSnapshot(venda, troco) {
    var itens = (venda.VendaItems || venda.itens || []);
    var agora = new Date();
    return {
      versao: '2.0',
      tipo_documento: venda.tipo_documento_emitido || 'cupom_nao_fiscal',
      empresa: {
        nome: App.empresa ? App.empresa.nome : 'SGC',
        cnpj: App.empresa ? (App.empresa.cnpj || '') : '',
        inscricao_estadual: App.empresa ? (App.empresa.inscricao_estadual || '') : '',
        endereco: App.empresa ? (App.empresa.endereco || '') : '',
        telefone: App.empresa ? (App.empresa.telefone || '') : ''
      },
      venda: {
        id: venda.id,
        numero: venda.numero,
        subtotal: parseFloat(venda.subtotal || 0),
        desconto: parseFloat(venda.desconto || 0),
        acrescimo: parseFloat(venda.acrescimo || 0),
        total: parseFloat(venda.total || 0),
        forma_pagamento: venda.forma_pagamento || PDV.formaPagamento,
        troco: troco || 0,
        subtotal_bruto: parseFloat(venda.subtotal_bruto || 0),
        desconto_automatico_total: parseFloat(venda.desconto_automatico_total || 0),
        desconto_manual_total: parseFloat(venda.desconto_manual_total || 0),
        status: venda.status || 'finalizada'
      },
      cliente: {
        nome: venda.cliente_nome || PDV.cliente.nome || '',
        cpf: venda.cliente_cpf || PDV.cliente.cpf || ''
      },
      operador: {
        nome: venda.operador_nome || (App.user ? App.user.nome : ''),
        id: venda.usuario_id || (App.user ? App.user.id : null)
      },
      itens: itens.map(function(i, idx) {
        return {
          seq: idx + 1,
          nome: i.produto_nome || i.nome,
          quantidade: parseFloat(i.quantidade),
          preco_unitario: parseFloat(i.preco_unitario || i.preco),
          subtotal: parseFloat(i.subtotal || (parseFloat(i.quantidade) * parseFloat(i.preco_unitario || i.preco))),
          preco_original: i.preco_original ? parseFloat(i.preco_original) : null,
          desconto_total: parseFloat(i.desconto_total || 0),
          programa_nome: i.programa_nome || null,
          ncm: i.ncm || null,
          cfop: i.cfop || null,
          aliquota_icms: parseFloat(i.aliquota_icms || 0)
        };
      }),
      data_emissao: agora.toISOString(),
      data_formatada: agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR')
    };
  },

  // ══════════════════════════════════════════════
  //  TEMPLATE: Cupom Não Fiscal (sem dados fiscais)
  // ══════════════════════════════════════════════
  _renderCupomNaoFiscal(snap, config) {
    var largura = parseInt(config.largura_papel_mm) || 80;
    var fontSize = parseInt(config.tamanho_fonte_cupom) || 12;
    var msgRodape = config.mensagem_rodape || 'Obrigado pela preferência!';
    var emp = snap.empresa;
    var v = snap.venda;
    var cli = snap.cliente;

    // Linhas dos itens
    var itensHtml = snap.itens.map(function(i) {
      var descInfo = '';
      if (i.desconto_total > 0 && i.programa_nome) {
        descInfo = '<div class="cupom-item-desconto"><span class="cupom-badge-clube">★ ' + i.programa_nome + ' -' + Utils.currency(i.desconto_total) + '</span></div>';
      }
      return '<div class="cupom-item">' +
        '<div class="cupom-item-row">' +
          '<span class="cupom-item-seq">' + i.seq + '</span>' +
          '<span class="cupom-item-nome">' + i.nome + '</span>' +
        '</div>' +
        '<div class="cupom-item-row cupom-item-valores">' +
          '<span>' + Utils.number(i.quantidade, i.quantidade % 1 !== 0 ? 3 : 0) + ' x ' + Utils.currency(i.preco_unitario) + '</span>' +
          '<span class="cupom-item-subtotal">' + Utils.currency(i.subtotal) + '</span>' +
        '</div>' +
        descInfo +
      '</div>';
    }).join('');

    return '<div class="receipt-preview receipt-' + largura + 'mm" style="font-size:' + fontSize + 'px">' +
      // ── Cabeçalho empresa ──
      '<div class="cupom-header">' +
        '<div class="cupom-empresa-nome">' + emp.nome + '</div>' +
        (emp.cnpj ? '<div>CNPJ: ' + emp.cnpj + '</div>' : '') +
        (emp.endereco ? '<div>' + emp.endereco + '</div>' : '') +
        (emp.telefone ? '<div>Tel: ' + emp.telefone + '</div>' : '') +
      '</div>' +
      // ── Tipo de documento ──
      '<div class="cupom-divisor"></div>' +
      '<div class="cupom-tipo-doc">' +
        '<strong>CUPOM NÃO FISCAL</strong><br>' +
        'Venda #' + v.numero +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Operador e Data ──
      '<div class="cupom-info-row">' +
        '<span>Operador: ' + snap.operador.nome + '</span>' +
        '<span>' + snap.data_formatada + '</span>' +
      '</div>' +
      // ── Cliente ──
      (cli.nome ? '<div class="cupom-info-row"><span>Cliente: ' + cli.nome + '</span></div>' : '') +
      (cli.cpf ? '<div class="cupom-info-row"><span>CPF: ' + cli.cpf + '</span></div>' : '') +
      '<div class="cupom-divisor"></div>' +
      // ── Cabeçalho itens ──
      '<div class="cupom-itens-header"><span>ITEM</span><span>QTD x UNIT = TOTAL</span></div>' +
      // ── Itens ──
      '<div class="cupom-itens">' + itensHtml + '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Totais ──
      '<div class="cupom-totais">' +
        '<div class="cupom-total-row"><span>Subtotal:</span><span>' + Utils.currency(v.subtotal) + '</span></div>' +
        (v.desconto_automatico_total > 0 ? '<div class="cupom-total-row cupom-desconto-clube"><span>★ Desc. Clube:</span><span>-' + Utils.currency(v.desconto_automatico_total) + '</span></div>' : '') +
        (v.desconto_manual_total > 0 ? '<div class="cupom-total-row cupom-desconto-manual"><span>Desc. Manual:</span><span>-' + Utils.currency(v.desconto_manual_total) + '</span></div>' : '') +
        (v.desconto > 0 && v.desconto_automatico_total <= 0 && v.desconto_manual_total <= 0 ? '<div class="cupom-total-row"><span>Desconto:</span><span>-' + Utils.currency(v.desconto) + '</span></div>' : '') +
        (v.acrescimo > 0 ? '<div class="cupom-total-row"><span>Acréscimo:</span><span>+' + Utils.currency(v.acrescimo) + '</span></div>' : '') +
        '<div class="cupom-total-row cupom-total-final"><span>TOTAL:</span><span>' + Utils.currency(v.total) + '</span></div>' +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Pagamento ──
      '<div class="cupom-pagamento">' +
        '<div>Pagamento: ' + Pages._formatPayment(v.forma_pagamento) + '</div>' +
        (v.troco > 0 ? '<div class="cupom-troco">Troco: ' + Utils.currency(v.troco) + '</div>' : '') +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Rodapé ──
      '<div class="cupom-rodape">' +
        '<div class="cupom-rodape-msg">' + msgRodape + '</div>' +
        '<div>' + emp.nome + '</div>' +
      '</div>' +
    '</div>';
  },

  // ══════════════════════════════════════════════
  //  TEMPLATE: NFC-e (Documento Fiscal)
  // ══════════════════════════════════════════════
  _renderNFCe(snap, config) {
    var largura = parseInt(config.largura_papel_mm) || 80;
    var fontSize = parseInt(config.tamanho_fonte_cupom) || 12;
    var emp = snap.empresa;
    var v = snap.venda;
    var cli = snap.cliente;

    // Itens com dados fiscais
    var itensHtml = snap.itens.map(function(i) {
      return '<div class="cupom-item">' +
        '<div class="cupom-item-row">' +
          '<span class="cupom-item-seq">' + i.seq + '</span>' +
          '<span class="cupom-item-nome">' + i.nome + '</span>' +
        '</div>' +
        '<div class="cupom-item-row cupom-item-valores">' +
          '<span>' + Utils.number(i.quantidade, i.quantidade % 1 !== 0 ? 3 : 0) + ' x ' + Utils.currency(i.preco_unitario) + '</span>' +
          '<span class="cupom-item-subtotal">' + Utils.currency(i.subtotal) + '</span>' +
        '</div>' +
        // Dados fiscais do item
        '<div class="cupom-item-fiscal">' +
          (i.ncm ? '<span>NCM: ' + i.ncm + '</span>' : '') +
          (i.cfop ? '<span>CFOP: ' + i.cfop + '</span>' : '') +
          (i.aliquota_icms > 0 ? '<span>ICMS: ' + Utils.number(i.aliquota_icms, 2) + '%</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    // Calcular tributos totais (aproximação)
    var totalICMS = snap.itens.reduce(function(acc, i) {
      return acc + (i.subtotal * (i.aliquota_icms / 100));
    }, 0);

    return '<div class="receipt-preview receipt-' + largura + 'mm receipt-nfce" style="font-size:' + fontSize + 'px">' +
      // ── Cabeçalho empresa ──
      '<div class="cupom-header">' +
        '<div class="cupom-empresa-nome">' + emp.nome + '</div>' +
        (emp.cnpj ? '<div>CNPJ: ' + emp.cnpj + '</div>' : '') +
        (emp.inscricao_estadual ? '<div>IE: ' + emp.inscricao_estadual + '</div>' : '') +
        (emp.endereco ? '<div>' + emp.endereco + '</div>' : '') +
        (emp.telefone ? '<div>Tel: ' + emp.telefone + '</div>' : '') +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Tipo de documento ──
      '<div class="cupom-tipo-doc">' +
        '<strong>DOCUMENTO AUXILIAR DA</strong><br>' +
        '<strong>NOTA FISCAL DE CONSUMIDOR ELETRÔNICA</strong><br>' +
        'NFC-e Venda #' + v.numero +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Data / Operador ──
      '<div class="cupom-info-row">' +
        '<span>Operador: ' + snap.operador.nome + '</span>' +
        '<span>' + snap.data_formatada + '</span>' +
      '</div>' +
      // ── Cliente ──
      (cli.nome ? '<div class="cupom-info-row"><span>Consumidor: ' + cli.nome + '</span></div>' : '<div class="cupom-info-row"><span>CONSUMIDOR NÃO IDENTIFICADO</span></div>') +
      (cli.cpf ? '<div class="cupom-info-row"><span>CPF: ' + cli.cpf + '</span></div>' : '') +
      '<div class="cupom-divisor"></div>' +
      // ── Cabeçalho itens ──
      '<div class="cupom-itens-header"><span>#  DESCRIÇÃO</span><span>QTD x UNIT = TOTAL</span></div>' +
      // ── Itens ──
      '<div class="cupom-itens">' + itensHtml + '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Totais ──
      '<div class="cupom-totais">' +
        '<div class="cupom-total-row"><span>Subtotal Produtos:</span><span>' + Utils.currency(v.subtotal) + '</span></div>' +
        (v.desconto > 0 ? '<div class="cupom-total-row"><span>Desconto:</span><span>-' + Utils.currency(v.desconto) + '</span></div>' : '') +
        (v.acrescimo > 0 ? '<div class="cupom-total-row"><span>Acréscimo:</span><span>+' + Utils.currency(v.acrescimo) + '</span></div>' : '') +
        '<div class="cupom-total-row cupom-total-final"><span>VALOR TOTAL:</span><span>' + Utils.currency(v.total) + '</span></div>' +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Pagamento ──
      '<div class="cupom-pagamento">' +
        '<div>Forma de Pagamento: ' + Pages._formatPayment(v.forma_pagamento) + '</div>' +
        (v.troco > 0 ? '<div class="cupom-troco">Troco: ' + Utils.currency(v.troco) + '</div>' : '') +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── Tributos ──
      '<div class="cupom-tributos">' +
        '<div class="cupom-total-row"><span>Valor aprox. tributos:</span><span>' + Utils.currency(totalICMS) + '</span></div>' +
        '<div class="cupom-tributos-nota">Fonte: IBPT — Lei 12.741/2012</div>' +
      '</div>' +
      '<div class="cupom-divisor"></div>' +
      // ── QR Code / Chave de Acesso (placeholder) ──
      '<div class="cupom-fiscal-info">' +
        '<div class="cupom-qrcode-box">' +
          '<div class="cupom-qrcode-placeholder">QR Code<br>NFC-e</div>' +
        '</div>' +
        '<div class="cupom-chave-acesso">' +
          '<div class="cupom-chave-label">Chave de Acesso:</div>' +
          '<div class="cupom-chave-valor">XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX</div>' +
        '</div>' +
        '<div class="cupom-protocolo">' +
          '<span>Protocolo de Autorização: ---</span>' +
        '</div>' +
        '<div class="cupom-consulta">' +
          'Consulte pela chave de acesso em:<br>' +
          '<strong>www.nfce.fazenda.gov.br</strong>' +
        '</div>' +
      '</div>' +
    '</div>';
  },

  // ── Renderiza cupom conforme tipo de documento ──
  _renderCupom(snap, config) {
    if (snap.tipo_documento === 'nfce') {
      return PDV._renderNFCe(snap, config);
    }
    return PDV._renderCupomNaoFiscal(snap, config);
  },

  // ══════════════════════════════════════════════
  //  Mostrar cupom após finalizar venda
  // ══════════════════════════════════════════════
  async showCupom(venda, troco) {
    var config = await PDV._loadConfigImpressao();
    var tipoDoc = config.tipo_documento_padrao || 'cupom_nao_fiscal';

    // Construir snapshot imutável
    var snap = PDV._buildSnapshot(venda, troco);
    snap.tipo_documento = tipoDoc;
    venda.tipo_documento_emitido = tipoDoc;

    // Salvar snapshot no servidor (fire-and-forget)
    PDV._salvarSnapshot(venda.id, snap, tipoDoc);

    var cupomHtml = PDV._renderCupom(snap, config);

    // Seletor de tipo de documento
    var seletorHtml =
      '<div class="cupom-tipo-seletor">' +
        '<label class="cupom-tipo-option' + (tipoDoc === 'cupom_nao_fiscal' ? ' active' : '') + '">' +
          '<input type="radio" name="tipoDocCupom" value="cupom_nao_fiscal"' + (tipoDoc === 'cupom_nao_fiscal' ? ' checked' : '') + '>' +
          '<span>Cupom Não Fiscal</span>' +
        '</label>' +
        '<label class="cupom-tipo-option' + (tipoDoc === 'nfce' ? ' active' : '') + '">' +
          '<input type="radio" name="tipoDocCupom" value="nfce"' + (tipoDoc === 'nfce' ? ' checked' : '') + '>' +
          '<span>NFC-e</span>' +
        '</label>' +
      '</div>';

    Modal.show('Venda #' + venda.numero + ' — Finalizada',
      seletorHtml +
      '<div id="cupomRenderArea">' + cupomHtml + '</div>',
      '<button class="btn btn-primary" data-onclick="PDV._finalizarCupomEVoltar()"><i data-lucide="plus-circle" style="width:16px;height:16px"></i> Nova Venda (Enter)</button>' +
      '<button class="btn btn-secondary" data-onclick="PDV.imprimirCupom()"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir</button>'
    );

    // Cache do snapshot e config para troca de tipo
    PDV._cupomSnapAtual = snap;
    PDV._cupomConfigAtual = config;
    PDV._cupomVendaIdAtual = venda.id;

    // Event listener para trocar tipo de documento
    setTimeout(function() {
      var radios = document.querySelectorAll('input[name="tipoDocCupom"]');
      radios.forEach(function(radio) {
        radio.addEventListener('change', function() {
          var novoTipo = this.value;
          PDV._cupomSnapAtual.tipo_documento = novoTipo;
          var area = document.getElementById('cupomRenderArea');
          if (area) {
            area.innerHTML = PDV._renderCupom(PDV._cupomSnapAtual, PDV._cupomConfigAtual);
          }
          // Atualizar visual do seletor
          document.querySelectorAll('.cupom-tipo-option').forEach(function(opt) {
            opt.classList.toggle('active', opt.querySelector('input').value === novoTipo);
          });
          // Atualizar snapshot no servidor
          PDV._salvarSnapshot(PDV._cupomVendaIdAtual, PDV._cupomSnapAtual, novoTipo);
        });
      });

      // Fechar modal via overlay/close
      var overlay = document.querySelector('.modal-overlay');
      var closeBtn = document.querySelector('.modal-close');
      if (overlay) {
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) PDV._finalizarCupomEVoltar();
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
          e.preventDefault();
          PDV._finalizarCupomEVoltar();
        });
      }

      // Imprimir automaticamente se configurado
      if (config.imprimir_automatico) {
        setTimeout(function() { PDV.imprimirCupom(); }, 500);
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 100);
  },

  // ── Salvar snapshot no backend (fire-and-forget) ──
  async _salvarSnapshot(vendaId, snap, tipoDoc) {
    try {
      await App.put('/vendas/' + vendaId + '/snapshot', {
        snapshot_cupom: snap,
        tipo_documento_emitido: tipoDoc
      });
    } catch(e) {
      console.warn('[Cupom] Erro ao salvar snapshot:', e.message);
    }
  },

  // ── Reimprimir cupom de uma venda já finalizada (chamado de pages.js) ──
  async reimprimirCupom(vendaId) {
    try {
      var venda = await App.get('/vendas/' + vendaId);
      var config = await PDV._loadConfigImpressao();
      var snap;

      if (venda.snapshot_cupom) {
        // Usar snapshot salvo — fidelidade total
        snap = venda.snapshot_cupom;
      } else {
        // Fallback: reconstruir do banco (vendas antigas sem snapshot)
        snap = PDV._buildSnapshot(venda, parseFloat(venda.troco || 0));
        snap.tipo_documento = venda.tipo_documento_emitido || 'cupom_nao_fiscal';
      }

      var cupomHtml = PDV._renderCupom(snap, config);

      Modal.show('Reimpressão — Venda #' + venda.numero,
        '<div class="cupom-reprint-badge"><i data-lucide="repeat" style="width:14px;height:14px"></i> REIMPRESSÃO</div>' +
        cupomHtml,
        '<button class="btn btn-secondary" data-onclick="PDV.imprimirCupom()"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir</button>' +
        '<button class="btn btn-ghost" data-onclick="Modal.close()">Fechar</button>'
      );
      setTimeout(function() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }, 100);
    } catch(e) {
      Toast.error('Erro ao carregar cupom: ' + (e.message || 'Tente novamente'));
    }
  },

  // Imprimir cupom e voltar para nova venda
  imprimirCupom() {
    // Aplicar classe de tamanho na impressão
    var receipt = document.querySelector('.receipt-preview');
    if (receipt) {
      var largura = receipt.classList.contains('receipt-58mm') ? '58mm' : '80mm';
      document.documentElement.style.setProperty('--receipt-print-width', largura);
    }
    window.print();
  },

  // Finalizar cupom e voltar para nova venda (chamado sempre ao sair do cupom)
  _finalizarCupomEVoltar() {
    PDV._cupomSnapAtual = null;
    PDV._cupomConfigAtual = null;
    PDV._cupomVendaIdAtual = null;
    PDV._configImpressao = null; // Limpar cache de config
    Modal.close();
    PDV.novaVenda();
    PDV.renderIdle();
  },

  novaVenda() {
    PDV.cart = [];
    PDV.cliente = { nome: '', cpf: '' };
    PDV.clienteId = null;
    PDV.clienteData = null;
    PDV.formaPagamento = 'dinheiro';
    PDV.desconto = 0;
    PDV.descontoTipo = 'valor';
    PDV.acrescimo = 0;
    PDV.sugestoes = [];
    PDV.combos = [];
    PDV.fase = 'idle';
    // ── Máquina de Estados v5.0: RESET forçado (bypass de transição) ──
    PDV.status = STATUS_VENDA.INICIANDO;
    PDV._finalizando = false;
    PDV._descontosCliente = [];
    // Motor v2.0 — estado computado da venda (auditoria)
    PDV._subtotal_bruto = 0;
    PDV._desconto_automatico_total = 0;
    // ── Auditoria v5.0: reset anti-fraude ──
    PDV._gerenteAutorizadorId = null;
    // Carregar limite de desconto do operador logado
    if (App.usuario && App.usuario.limite_desconto_percentual !== undefined) {
      PDV._limiteDesconto = parseFloat(App.usuario.limite_desconto_percentual);
    }
  },

  // ══════════════════════════════════════════════
  //  Busca de cliente por CPF
  // ══════════════════════════════════════════════
  async buscarClienteCPF() {
    // Máquina de Estados: só pode identificar cliente se ABERTA
    if (!PDV.guardarAcao('IDENTIFICAR_CLIENTE', 'Não é possível identificar cliente no estado atual.')) return;
    var cpfEl = document.getElementById('pdvClienteCPF');
    var cpf = cpfEl ? cpfEl.value.replace(/\D/g, '') : '';
    if (cpf.length < 11) {
      Toast.error('Digite um CPF válido (11 dígitos)');
      return;
    }
    try {
      var res = await App.get('/clientes/buscar-cpf/' + cpf);
      var cliente = res && res.cliente ? res.cliente : res;
      if (cliente && cliente.id) {
        PDV.clienteId = cliente.id;
        PDV.clienteData = cliente;
        PDV.cliente.nome = cliente.nome;
        PDV.cliente.cpf = cpf;
        Toast.success('Cliente encontrado: ' + cliente.nome);
        // Carregar descontos e reprocessar itens do carrinho
        await PDV._carregarDescontosCliente(cliente.id);
        // Máquina de Estados: ABERTA → CLIENTE_IDENTIFICADO
        PDV.transitarEstado(STATUS_VENDA.CLIENTE_IDENTIFICADO);
        PDV._logAcaoPDV('IDENTIFICAR_CLIENTE', STATUS_VENDA.ABERTA, STATUS_VENDA.CLIENTE_IDENTIFICADO, {
          cliente_id: cliente.id, cliente_nome: cliente.nome, cpf: cpf
        });
        var alterados = PDV.reprocessarTodosOsItens();
        if (alterados > 0) {
          Toast.info('🏷️ ' + alterados + ' item(ns) atualizado(s) com desconto de programa');
        }
        PDV.render();
      } else {
        Toast.info('Cliente não cadastrado. Dados serão salvos na venda.');
        PDV.clienteId = null;
        PDV.clienteData = null;
      }
    } catch(e) {
      Toast.info('Cliente não encontrado no cadastro');
      PDV.clienteId = null;
      PDV.clienteData = null;
    }
  },

  limparCliente() {
    if (!PDV.guardarAcao('LIMPAR_CLIENTE', 'Não é possível alterar o cliente no estado atual.')) return;
    var clienteAnterior = PDV.clienteId;
    PDV.clienteId = null;
    PDV.clienteData = null;
    PDV.cliente = { nome: '', cpf: '' };
    PDV._descontosCliente = [];
    // Motor v2.0: reprocessar itens (sem regras, volta tudo ao preço original)
    var alterados = PDV.reprocessarTodosOsItens();
    if (alterados > 0) {
      Toast.info('🏷️ ' + alterados + ' desconto(s) de programa removido(s)');
    }
    // Máquina de Estados: voltar para ABERTA (sem cliente)
    if (PDV.status === STATUS_VENDA.CLIENTE_IDENTIFICADO) {
      PDV.transitarEstado(STATUS_VENDA.ABERTA);
      PDV._logAcaoPDV('LIMPAR_CLIENTE', STATUS_VENDA.CLIENTE_IDENTIFICADO, STATUS_VENDA.ABERTA, {
        cliente_removido_id: clienteAnterior
      });
    }
    PDV.render();
  },

  // ══════════════════════════════════════════════
  //  Menu de configurações do PDV
  // ══════════════════════════════════════════════
  menuConfig() {
    Modal.show('Menu PDV',
      '<div class="pdv-menu-grid">' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();Pages.sangriaModal()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--warning-bg);color:var(--warning)">' +
            '<i data-lucide="arrow-down-circle" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Sangria</span>' +
          '<span class="pdv-menu-card-desc">Retirar dinheiro do caixa</span></button>' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();Pages.suprimentoModal()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--primary-bg);color:var(--primary)">' +
            '<i data-lucide="arrow-up-circle" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Suprimento</span>' +
          '<span class="pdv-menu-card-desc">Adicionar dinheiro ao caixa</span></button>' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();PDV.configImpressora()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--bg);color:var(--text-muted)">' +
            '<i data-lucide="printer" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Impressora</span>' +
          '<span class="pdv-menu-card-desc">Configurar impressora</span></button>' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();PDV.configPOS()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--bg);color:var(--text-muted)">' +
            '<i data-lucide="credit-card" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Máquina POS</span>' +
          '<span class="pdv-menu-card-desc">Configurar maquininha</span></button>' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();PDV.etiquetas()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--bg);color:var(--text-muted)">' +
            '<i data-lucide="tag" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Etiquetas</span>' +
          '<span class="pdv-menu-card-desc">Imprimir etiquetas</span></button>' +
        '<button class="pdv-menu-card" data-onclick="Modal.close();PDV.sair()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--violet-bg);color:var(--violet)">' +
            '<i data-lucide="log-out" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Sair do PDV</span>' +
          '<span class="pdv-menu-card-desc">Voltar ao sistema</span></button>' +
        '<button class="pdv-menu-card pdv-menu-card-danger" data-onclick="Modal.close();Pages.fecharCaixaModal()">' +
          '<div class="pdv-menu-card-icon" style="background:var(--danger-bg);color:var(--danger)">' +
            '<i data-lucide="lock" style="width:32px;height:32px"></i></div>' +
          '<span class="pdv-menu-card-title">Fechar Caixa</span>' +
          '<span class="pdv-menu-card-desc">Encerrar expediente</span></button>' +
      '</div>',
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Voltar</button>',
      'modal-lg'
    );
  },

  configImpressora() {
    var config = JSON.parse(localStorage.getItem('sgc_printer') || '{}');
    Modal.show('Configura\u00e7\u00e3o de Impressora',
      '<div class="form-group"><label class="form-label">Tipo de Impressora</label>' +
        '<select class="form-control" id="printerType">' +
          '<option value="thermal"' + (config.type === 'thermal' ? ' selected' : '') + '>T\u00e9rmica (80mm)</option>' +
          '<option value="thermal58"' + (config.type === 'thermal58' ? ' selected' : '') + '>T\u00e9rmica (58mm)</option>' +
          '<option value="a4"' + (config.type === 'a4' ? ' selected' : '') + '>A4 (Jato/Laser)</option>' +
        '</select></div>' +
      '<div class="form-group"><label class="form-label">Nome/IP da Impressora</label>' +
        '<input type="text" class="form-control" id="printerName" value="' + (config.name || '') + '" placeholder="Ex: EPSON TM-T20"></div>' +
      '<div class="form-group"><label class="form-label">Porta</label>' +
        '<input type="text" class="form-control" id="printerPort" value="' + (config.port || '') + '" placeholder="Ex: COM1 ou USB"></div>' +
      '<div class="form-group">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">' +
          '<input type="checkbox" id="printerAuto"' + (config.autoPrint ? ' checked' : '') + '>' +
          '<span>Imprimir automaticamente ap\u00f3s venda</span></label></div>',
      '<button class="btn btn-primary" data-onclick="PDV._salvarConfigImpressora()"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-md'
    );
  },

  _salvarConfigImpressora() {
    var config = {
      type: document.getElementById('printerType').value,
      name: document.getElementById('printerName').value,
      port: document.getElementById('printerPort').value,
      autoPrint: document.getElementById('printerAuto').checked
    };
    localStorage.setItem('sgc_printer', JSON.stringify(config));
    Toast.success('Configura\u00e7\u00e3o de impressora salva');
    Modal.close();
  },

  configPOS() {
    var config = JSON.parse(localStorage.getItem('sgc_pos') || '{}');
    Modal.show('Configura\u00e7\u00e3o M\u00e1quina POS',
      '<div class="form-group"><label class="form-label">Tipo de Integra\u00e7\u00e3o</label>' +
        '<select class="form-control" id="posType">' +
          '<option value="none"' + (config.type === 'none' || !config.type ? ' selected' : '') + '>Nenhuma (manual)</option>' +
          '<option value="tef"' + (config.type === 'tef' ? ' selected' : '') + '>TEF (Transfer\u00eancia Eletr\u00f4nica)</option>' +
          '<option value="sitef"' + (config.type === 'sitef' ? ' selected' : '') + '>SiTef</option>' +
          '<option value="stone"' + (config.type === 'stone' ? ' selected' : '') + '>Stone</option>' +
          '<option value="cielo"' + (config.type === 'cielo' ? ' selected' : '') + '>Cielo</option>' +
          '<option value="rede"' + (config.type === 'rede' ? ' selected' : '') + '>Rede</option>' +
        '</select></div>' +
      '<div class="form-group"><label class="form-label">IP do Servidor TEF</label>' +
        '<input type="text" class="form-control" id="posIP" value="' + (config.ip || '') + '" placeholder="Ex: 192.168.0.100"></div>' +
      '<div class="form-group"><label class="form-label">Porta</label>' +
        '<input type="text" class="form-control" id="posPort" value="' + (config.port || '4096') + '" placeholder="4096"></div>' +
      '<div class="form-group"><label class="form-label">Loja/Terminal</label>' +
        '<div class="form-row">' +
          '<input type="text" class="form-control" id="posLoja" value="' + (config.loja || '') + '" placeholder="C\u00f3d. Loja">' +
          '<input type="text" class="form-control" id="posTerminal" value="' + (config.terminal || '') + '" placeholder="Terminal">' +
        '</div></div>',
      '<button class="btn btn-primary" data-onclick="PDV._salvarConfigPOS()"><i data-lucide="save" style="width:16px;height:16px"></i> Salvar</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-md'
    );
  },

  _salvarConfigPOS() {
    var config = {
      type: document.getElementById('posType').value,
      ip: document.getElementById('posIP').value,
      port: document.getElementById('posPort').value,
      loja: document.getElementById('posLoja').value,
      terminal: document.getElementById('posTerminal').value
    };
    localStorage.setItem('sgc_pos', JSON.stringify(config));
    Toast.success('Configura\u00e7\u00e3o POS salva');
    Modal.close();
  },

  etiquetas() {
    Modal.show('Imprimir Etiquetas',
      '<p class="text-muted" style="margin-bottom:16px">Selecione os produtos para gerar etiquetas de pre\u00e7o.</p>' +
      '<div class="form-group"><label class="form-label">Buscar Produto</label>' +
        '<input type="text" class="form-control" id="etiqBusca" placeholder="Nome ou c\u00f3digo..." data-oninput="PDV._buscarEtiqueta(this.value)"></div>' +
      '<div id="etiqResultados" style="margin-bottom:12px"></div>' +
      '<div id="etiqLista" style="margin-bottom:12px"></div>' +
      '<div class="form-group"><label class="form-label">Modelo de Etiqueta</label>' +
        '<select class="form-control" id="etiqModelo">' +
          '<option value="30x25">30x25mm (Pre\u00e7o)</option>' +
          '<option value="50x30">50x30mm (C\u00f3d.Barras + Pre\u00e7o)</option>' +
          '<option value="gondola">G\u00f4ndola (pre\u00e7o grande)</option>' +
        '</select></div>',
      '<button class="btn btn-primary" data-onclick="Toast.success(\'Etiquetas enviadas para impress\u00e3o\');Modal.close()"><i data-lucide="printer" style="width:16px;height:16px"></i> Imprimir</button>' +
      '<button class="btn btn-secondary" data-onclick="Modal.close()">Cancelar</button>',
      'modal-md'
    );
  },

  _etiqProdutos: [],
  async _buscarEtiqueta(valor) {
    if (!valor || valor.length < 2) { document.getElementById('etiqResultados').innerHTML = ''; return; }
    try {
      var res = await App.get('/produtos?busca=' + encodeURIComponent(valor));
      var prods = Array.isArray(res) ? res : (res.data || []);
      document.getElementById('etiqResultados').innerHTML = prods.slice(0, 5).map(function(p) {
        return '<div style="padding:8px;cursor:pointer;border:1px solid var(--border);border-radius:4px;margin-top:4px" ' +
          'data-onclick="PDV._addEtiqueta(' + p.id + ',\'' + p.nome.replace(/'/g, "\\'") + '\',' + p.preco_venda + ')">' +
          '<strong>' + p.nome + '</strong> - ' + Utils.currency(p.preco_venda) + '</div>';
      }).join('');
    } catch(e) {}
  },

  _addEtiqueta(id, nome, preco) {
    if (!PDV._etiqProdutos.find(function(p) { return p.id === id; })) {
      PDV._etiqProdutos.push({ id: id, nome: nome, preco: preco, qtd: 1 });
    }
    document.getElementById('etiqResultados').innerHTML = '';
    document.getElementById('etiqBusca').value = '';
    PDV._refreshEtiquetas();
  },

  _refreshEtiquetas: function() {
    var html = PDV._etiqProdutos.map(function(p, i) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
        '<span style="flex:1">' + p.nome + ' - ' + Utils.currency(p.preco) + '</span>' +
        '<input type="number" value="' + p.qtd + '" min="1" style="width:60px;padding:4px;text-align:center" ' +
          'data-onchange="PDV.handleEtiqQtdChange(event,' + i + ')">' +
        '<button class="btn-icon" data-onclick="PDV.removeEtiqueta(' + i + ')" style="color:var(--danger)">' +
          '<i data-lucide="x" style="width:14px;height:14px"></i></button></div>';
    }).join('');
    document.getElementById('etiqLista').innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  sair() {
    if (PDV.cart.length > 0) {
      Modal.show('Sair do PDV',
        '<p style="margin-bottom:16px">Há <strong>' + PDV.cart.length + ' ite' + (PDV.cart.length === 1 ? 'm' : 'ns') + '</strong> no carrinho. O que deseja fazer?</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<button class="btn btn-primary btn-block" data-onclick="Modal.close()" style="justify-content:flex-start;gap:10px">' +
            '<i data-lucide="arrow-left" style="width:18px;height:18px"></i> Voltar ao PDV</button>' +
          '<button class="btn btn-danger btn-block" data-onclick="PDV._confirmarSair(true)" style="justify-content:flex-start;gap:10px">' +
            '<i data-lucide="x-circle" style="width:18px;height:18px"></i> Cancelar Venda e Sair</button>' +
        '</div>',
        ''
      );
      return;
    }
    PDV._confirmarSair(false);
  },

  _confirmarSair(cancelar) {
    Modal.close();
    document.onkeydown = null;
    if (cancelar) {
      PDV.cart = [];
      PDV.desconto = 0;
      PDV.acrescimo = 0;
    }
    PDV.cliente = {nome: '', cpf: ''};
    PDV.fase = 'idle';
    // Máquina de Estados: reset forçado ao sair
    PDV.status = STATUS_VENDA.INICIANDO;
    if (typeof Router !== 'undefined' && Router.goBack) {
      Router.goBack();
    } else {
      window.location.hash = '#/home';
    }
  },

  // ══════════════════════════════════════════════
  //  Abertura de caixa via modal (chamado de Pages.caixa)
  // ══════════════════════════════════════════════
  abrirCaixaModal() {
    Pages.abrirCaixaModal();
  },

  // ── Helpers para data-on* (CSP sem unsafe-eval) ──
  _limparDescontoManual: function() {
    PDV.desconto = 0;
    PDV.descontoTipo = 'valor';
    PDV.updateTotals();
    PDV._bumpTotal();
    Toast.info('Desconto manual removido');
  },
  toggleDescontoTipo: function(tipo) {
    PDV.descontoTipo = tipo;
    PDV.desconto = 0;
    PDV.render();
  },
  handleDescontoChange: function(e) {
    if (!PDV.podeExecutar('DESCONTO_MANUAL')) { Toast.warning('Não é possível alterar desconto no estado atual.'); return; }
    var valor = parseFloat((e.target.value || '0').replace(',', '.')) || 0;
    // Validar percentual max 100
    if (PDV.descontoTipo === 'percentual' && valor > 100) {
      valor = 100;
      e.target.value = '100';
    }
    // ── Prioridade 5: Limite de desconto por perfil ──
    var percentualEfetivo = PDV.descontoTipo === 'percentual' 
      ? valor 
      : (PDV.getSubtotal() > 0 ? (valor / PDV.getSubtotal()) * 100 : 0);
    
    PDV._verificarLimiteDesconto(percentualEfetivo, function(autorizado, gerenteId) {
      if (!autorizado) {
        // Reverter para o limite
        PDV.desconto = PDV.descontoTipo === 'percentual' 
          ? PDV._limiteDesconto 
          : (PDV.getSubtotal() * PDV._limiteDesconto / 100);
        e.target.value = PDV.desconto.toFixed(2);
        Toast.warning('Desconto limitado a ' + PDV._limiteDesconto.toFixed(1) + '% do seu perfil');
      } else {
        PDV.desconto = valor;
        if (gerenteId) {
          PDV._gerenteAutorizadorId = gerenteId;
          PDV._logAcaoPDV('DESCONTO_MANUAL_AUTORIZADO', PDV.status, PDV.status, {
            percentual: percentualEfetivo.toFixed(2),
            valor: valor,
            gerente_id: gerenteId
          });
        } else {
          PDV._logAcaoPDV('DESCONTO_MANUAL', PDV.status, PDV.status, {
            percentual: percentualEfetivo.toFixed(2),
            valor: valor
          });
        }
      }
      PDV.updateTotals();
      PDV._bumpTotal();
    });
  },
  handleAcrescimoChange: function(e) {
    if (!PDV.podeExecutar('DESCONTO_MANUAL')) { Toast.warning('Não é possível alterar acréscimo no estado atual.'); return; }
    PDV.acrescimo = parseFloat((e.target.value || '0').replace(',', '.')) || 0;
    PDV.updateTotals();
    PDV._bumpTotal();
  },
  handleEtiqQtdChange: function(e, i) {
    PDV._etiqProdutos[i].qtd = parseInt(e.target.value) || 1;
  },
  removeEtiqueta: function(i) {
    PDV._etiqProdutos.splice(i, 1);
    PDV._refreshEtiquetas();
  }
};

// Expor PDV globalmente para InlineAttrBridge
window.PDV = PDV;
