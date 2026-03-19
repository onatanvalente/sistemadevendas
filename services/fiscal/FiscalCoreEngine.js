/* ══════════════════════════════════════════════════════════════
   FiscalCoreEngine — Motor Fiscal Central (Camada 1)
   
   Responsável por:
   • Construir FiscalDocument a partir de uma Venda
   • Validar dados fiscais
   • Controlar numeração
   • Controlar status
   • Persistir no banco
   • Orquestrar emissão → Provider → Resposta
   
   Esta camada NÃO conhece DevNota, TecnoSpeed, nem nenhuma API.
   Trabalha apenas com: FiscalDocument, FiscalItem, FiscalPayment, FiscalResponse
   ══════════════════════════════════════════════════════════════ */

const { NotaFiscal, Venda, VendaItem, Produto, Empresa, FiscalProviderConfig } = require('../../models');
const FiscalTaxEngine = require('./FiscalTaxEngine');
const FiscalProviderFactory = require('./FiscalProviderFactory');
const { logger } = require('../../config/logger');

class FiscalCoreEngine {

  // ─────────────────────────────────────────────
  //  1. CONSTRUIR DOCUMENTO FISCAL (modelo canônico)
  // ─────────────────────────────────────────────
  static async buildDocument(vendaId, empresaId, opcoes = {}) {
    // Buscar venda com itens e produtos
    const venda = await Venda.findOne({
      where: { id: vendaId, empresa_id: empresaId },
      include: [{ model: VendaItem, include: [{ model: Produto }] }]
    });
    if (!venda) throw new Error('Venda não encontrada');
    if (venda.status !== 'finalizada') throw new Error('Apenas vendas finalizadas podem gerar NFC-e');

    // Buscar empresa
    const empresa = await Empresa.findByPk(empresaId);
    if (!empresa) throw new Error('Empresa não encontrada');

    // Validar empresa
    const validEmpresa = FiscalTaxEngine.validarEmpresa(empresa);
    if (!validEmpresa.valid) {
      throw new Error('Dados fiscais da empresa incompletos: ' + validEmpresa.errors.join('; '));
    }

    const regime = empresa.regime_tributario || 'simples_nacional';

    // Montar emitente
    const emitente = {
      cnpj: (empresa.cnpj || '').replace(/\D/g, ''),
      razao_social: empresa.nome,
      nome_fantasia: empresa.nome_fantasia || empresa.nome,
      inscricao_estadual: (empresa.inscricao_estadual || '').replace(/\D/g, ''),
      inscricao_municipal: (empresa.inscricao_municipal || '').replace(/\D/g, ''),
      regime_tributario: regime,
      // Código do Regime Tributário (CRT): 1=SN, 2=SN sublimite, 3=Regime Normal
      crt: (regime === 'simples_nacional' || regime === 'mei') ? 1 : 3,
      endereco: {
        logradouro: empresa.endereco || '',
        numero: empresa.numero || 'SN',
        complemento: empresa.complemento || '',
        bairro: empresa.bairro || '',
        cidade: empresa.cidade || '',
        uf: empresa.estado || '',
        cep: (empresa.cep || '').replace(/\D/g, ''),
        codigo_ibge: empresa.codigo_ibge || ''
      }
    };

    // Montar destinatário (opcional para NFC-e < R$ 5000)
    const destinatario = (venda.cliente_cpf || opcoes.dest_cpf_cnpj) ? {
      nome: opcoes.dest_nome || venda.cliente_nome || 'CONSUMIDOR',
      cpf_cnpj: ((opcoes.dest_cpf_cnpj || venda.cliente_cpf || '')).replace(/\D/g, '')
    } : null;

    // Montar itens
    const itens = [];
    const errosFiscais = [];
    
    for (const vi of (venda.VendaItems || [])) {
      const cfop = FiscalTaxEngine.getCFOP(vi);
      const ncm = vi.ncm || vi.Produto?.ncm || '';
      
      // Validação
      const validItem = FiscalTaxEngine.validarDadosFiscais({ ncm, cfop, descricao: vi.produto_nome });
      if (!validItem.valid) errosFiscais.push(...validItem.errors);

      const impostos = FiscalTaxEngine.calcularImpostos(vi, regime);

      itens.push({
        numero_item: itens.length + 1,
        produto_id: vi.produto_id,
        codigo: vi.Produto?.codigo_barras || vi.Produto?.codigo_interno || String(vi.produto_id),
        descricao: vi.produto_nome,
        ncm: ncm.replace(/\D/g, ''),
        cest: vi.Produto?.cest || '',
        cfop,
        unidade: vi.Produto?.unidade || 'UN',
        quantidade: parseFloat(vi.quantidade),
        valor_unitario: parseFloat(vi.preco_unitario),
        valor_total: parseFloat(vi.subtotal),
        valor_desconto: parseFloat(vi.desconto_item || 0),
        impostos
      });
    }

    // Se há erros fiscais e não é forçado, bloquear
    if (errosFiscais.length > 0 && !opcoes.forcar) {
      throw new Error('Erros fiscais nos itens: ' + errosFiscais.join('; '));
    }

    // Montar pagamentos
    const pagamentos = FiscalCoreEngine._buildPagamentos(venda);

    // Calcular totais de impostos
    const totaisImpostos = itens.reduce((acc, item) => {
      acc.icms_base += item.impostos.icms.base_calculo || 0;
      acc.icms_valor += item.impostos.icms.valor || 0;
      acc.pis_valor += item.impostos.pis.valor || 0;
      acc.cofins_valor += item.impostos.cofins.valor || 0;
      return acc;
    }, { icms_base: 0, icms_valor: 0, pis_valor: 0, cofins_valor: 0 });

    // Documento canônico
    const document = {
      tipo: opcoes.tipo || 'nfce',
      natureza_operacao: opcoes.natureza_operacao || 'VENDA AO CONSUMIDOR FINAL',
      serie: null,    // Preenchido no momento da emissão
      numero: null,   // Preenchido no momento da emissão
      data_emissao: new Date(),
      ambiente: empresa.ambiente_fiscal || 'homologacao',
      emitente,
      destinatario,
      itens,
      pagamentos,
      totais: {
        valor_produtos: parseFloat(venda.subtotal || venda.total),
        valor_desconto: parseFloat(venda.desconto || 0),
        valor_total: parseFloat(venda.total),
        icms_base: parseFloat(totaisImpostos.icms_base.toFixed(2)),
        icms_valor: parseFloat(totaisImpostos.icms_valor.toFixed(2)),
        pis_valor: parseFloat(totaisImpostos.pis_valor.toFixed(2)),
        cofins_valor: parseFloat(totaisImpostos.cofins_valor.toFixed(2))
      },
      info_complementar: opcoes.info_complementar || '',
      // Metadados internos (não vão para API)
      _venda_id: venda.id,
      _empresa_id: empresaId,
      _regime: regime,
      _warnings: errosFiscais
    };

    return document;
  }

  // ─────────────────────────────────────────────
  //  2. EMITIR NFC-e (orquestra todo o fluxo)
  // ─────────────────────────────────────────────
  static async emitirNfce(vendaId, empresaId, opcoes = {}) {
    // Verificar NF existente
    const existente = await NotaFiscal.findOne({
      where: { empresa_id: empresaId, venda_id: vendaId, status: ['pendente', 'autorizada'] }
    });
    if (existente) {
      throw new Error(`Já existe NF ${existente.status} para esta venda (#${existente.numero})`);
    }

    // Construir documento
    const document = await FiscalCoreEngine.buildDocument(vendaId, empresaId, opcoes);

    // Obter provider
    const provider = await FiscalProviderFactory.getProvider(empresaId);
    const providerNome = provider.nome;

    // Obter número/série
    const empresa = await Empresa.findByPk(empresaId);
    const campo = 'ultimo_numero_nfce';
    const numero = (empresa[campo] || 0) + 1;
    const serie = opcoes.serie || empresa.serie_nfce || 1;

    document.numero = numero;
    document.serie = serie;

    // Criar registro no banco (status pendente)
    const nf = await NotaFiscal.create({
      empresa_id: empresaId,
      venda_id: vendaId,
      tipo: 'nfce',
      numero,
      serie,
      status: 'pendente',
      valor_total: document.totais.valor_total,
      dest_nome: document.destinatario?.nome || null,
      dest_cpf_cnpj: document.destinatario?.cpf_cnpj || null,
      info_complementar: document.info_complementar,
      provider_usado: providerNome,
      ambiente: document.ambiente,
      xml_envio: JSON.stringify(document),
      tentativas_envio: 1,
      ultima_tentativa: new Date(),
      data_emissao: new Date()
    });

    // Atualizar número na empresa
    empresa[campo] = numero;
    await empresa.save();

    // Atualizar venda
    const venda = await Venda.findByPk(vendaId);
    if (venda) {
      venda.nota_fiscal_id = nf.id;
      venda.tipo_documento_emitido = 'nfce';
      await venda.save();
    }

    // Enviar para provider
    try {
      const response = await provider.emitirNfce(document);
      
      // Processar resposta
      await FiscalCoreEngine._processarResposta(nf, response);
      
      logger.info('NFC-e emitida', {
        tipo: 'fiscal_emissao',
        nf_id: nf.id,
        numero,
        status: response.status,
        provider: providerNome,
        chave: response.chaveAcesso
      });

      return { nf: await nf.reload(), response };

    } catch (err) {
      // Erro de conexão → contingência (NF fica pendente)
      nf.motivo_rejeicao = err.message;
      await nf.save();

      logger.warn('Erro ao emitir NFC-e — contingência', {
        tipo: 'fiscal_contingencia',
        nf_id: nf.id,
        numero,
        provider: providerNome,
        erro: err.message
      });

      return { nf: await nf.reload(), response: { status: 'PENDENTE', motivo: err.message } };
    }
  }

  // ─────────────────────────────────────────────
  //  3. CONSULTAR STATUS
  // ─────────────────────────────────────────────
  static async consultar(nfId, empresaId) {
    const nf = await NotaFiscal.findOne({
      where: { id: nfId, empresa_id: empresaId }
    });
    if (!nf) throw new Error('Nota fiscal não encontrada');
    if (!nf.chave_acesso && !nf.provider_id_externo) {
      throw new Error('Nota sem chave de acesso ou ID externo para consultar');
    }

    const provider = await FiscalProviderFactory.getProvider(empresaId);
    const response = await provider.consultar(nf.chave_acesso || nf.provider_id_externo);

    // Atualizar com resultado
    await FiscalCoreEngine._processarResposta(nf, response);

    return { nf: await nf.reload(), response };
  }

  // ─────────────────────────────────────────────
  //  4. CANCELAR NF
  // ─────────────────────────────────────────────
  static async cancelar(nfId, empresaId, justificativa) {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }

    const nf = await NotaFiscal.findOne({
      where: { id: nfId, empresa_id: empresaId }
    });
    if (!nf) throw new Error('Nota fiscal não encontrada');
    if (nf.status === 'cancelada') throw new Error('Nota já cancelada');

    // Se nunca foi autorizada (pendente/rejeitada), cancelar só localmente
    if (nf.status !== 'autorizada') {
      nf.status = 'cancelada';
      nf.motivo_cancelamento = justificativa;
      nf.data_cancelamento = new Date();
      await nf.save();
      return { nf: await nf.reload(), response: { status: 'AUTORIZADA', motivo: 'Cancelamento local (nota não autorizada na SEFAZ)' } };
    }

    // Autorizada → cancelar no provider
    const provider = await FiscalProviderFactory.getProvider(empresaId);
    const response = await provider.cancelar(nf.chave_acesso, justificativa);

    if (response.status === 'AUTORIZADA') {
      nf.status = 'cancelada';
      nf.motivo_cancelamento = justificativa;
      nf.data_cancelamento = new Date();
      if (response.xml) nf.xml_cancelamento = response.xml;
      if (response.protocolo) nf.protocolo_autorizacao = response.protocolo;
      await nf.save();

      logger.info('NFC-e cancelada', {
        tipo: 'fiscal_cancelamento',
        nf_id: nf.id,
        numero: nf.numero,
        chave: nf.chave_acesso
      });
    } else {
      nf.motivo_rejeicao = response.motivo;
      await nf.save();
    }

    return { nf: await nf.reload(), response };
  }

  // ─────────────────────────────────────────────
  //  5. REENVIAR PENDENTES (Contingência)
  // ─────────────────────────────────────────────
  static async reenviarPendentes(empresaId) {
    const pendentes = await NotaFiscal.findAll({
      where: {
        empresa_id: empresaId,
        status: 'pendente',
        tentativas_envio: { [require('sequelize').Op.lt]: 10 } // Máx 10 tentativas
      },
      order: [['created_at', 'ASC']],
      limit: 20
    });

    if (pendentes.length === 0) return { processadas: 0 };

    const provider = await FiscalProviderFactory.getProvider(empresaId);
    const resultados = [];

    for (const nf of pendentes) {
      try {
        // Recuperar documento original
        const document = JSON.parse(nf.xml_envio || '{}');
        
        nf.tentativas_envio = (nf.tentativas_envio || 0) + 1;
        nf.ultima_tentativa = new Date();
        await nf.save();

        const response = await provider.emitirNfce(document);
        await FiscalCoreEngine._processarResposta(nf, response);

        resultados.push({ nf_id: nf.id, numero: nf.numero, status: response.status });

        logger.info('Reenvio contingência', {
          tipo: 'fiscal_reenvio',
          nf_id: nf.id,
          numero: nf.numero,
          tentativa: nf.tentativas_envio,
          resultado: response.status
        });
      } catch (err) {
        nf.motivo_rejeicao = err.message;
        await nf.save();
        resultados.push({ nf_id: nf.id, numero: nf.numero, status: 'ERRO', motivo: err.message });
      }
    }

    return { processadas: resultados.length, resultados };
  }

  // ─────────────────────────────────────────────
  //  HELPERS INTERNOS
  // ─────────────────────────────────────────────

  /**
   * Processa resposta do provider e atualiza a NF no banco
   */
  static async _processarResposta(nf, response) {
    if (response.status === 'AUTORIZADA') {
      nf.status = 'autorizada';
      if (response.chaveAcesso) nf.chave_acesso = response.chaveAcesso;
      if (response.protocolo) nf.protocolo_autorizacao = response.protocolo;
      if (response.xml) nf.xml_retorno = response.xml;
      if (response.pdf) nf.pdf_base64 = response.pdf;
      if (response.pdfUrl) nf.pdf_url = response.pdfUrl;
      if (response.idExterno) nf.provider_id_externo = response.idExterno;
    } else if (response.status === 'REJEITADA') {
      nf.status = 'rejeitada';
      nf.motivo_rejeicao = response.motivo;
      if (response.xml) nf.xml_retorno = response.xml;
    } else {
      // PENDENTE — manter status
      if (response.motivo) nf.motivo_rejeicao = response.motivo;
      if (response.idExterno) nf.provider_id_externo = response.idExterno;
    }
    await nf.save();
  }

  /**
   * Monta array de pagamentos a partir da venda
   */
  static _buildPagamentos(venda) {
    const pagamentos = [];
    const forma = (venda.forma_pagamento || '').toLowerCase();

    if (forma === 'multiplo') {
      // Pagamento múltiplo — montar cada forma
      if (parseFloat(venda.valor_dinheiro) > 0) {
        pagamentos.push({ forma: 'dinheiro', ...FiscalTaxEngine.mapFormaPagamento('dinheiro'), valor: parseFloat(venda.valor_dinheiro) });
      }
      if (parseFloat(venda.valor_pix) > 0) {
        pagamentos.push({ forma: 'pix', ...FiscalTaxEngine.mapFormaPagamento('pix'), valor: parseFloat(venda.valor_pix) });
      }
      if (parseFloat(venda.valor_debito) > 0) {
        pagamentos.push({ forma: 'debito', ...FiscalTaxEngine.mapFormaPagamento('debito'), valor: parseFloat(venda.valor_debito) });
      }
      if (parseFloat(venda.valor_credito) > 0) {
        pagamentos.push({ forma: 'credito', ...FiscalTaxEngine.mapFormaPagamento('credito'), valor: parseFloat(venda.valor_credito) });
      }
    } else {
      pagamentos.push({
        forma,
        ...FiscalTaxEngine.mapFormaPagamento(forma),
        valor: parseFloat(venda.total)
      });
    }

    // Se troco
    const troco = parseFloat(venda.troco || 0);
    if (troco > 0) {
      pagamentos[0].troco = troco;
    }

    return pagamentos;
  }
}

module.exports = FiscalCoreEngine;
