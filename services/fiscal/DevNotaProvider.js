/* ══════════════════════════════════════════════════════════════
   DevNotaProvider — Adapter para API DevNota (Camada 3)
   
   API Docs: https://devnota.com.br/docs
   
   Endpoints NFC-e:
     POST /api/nfc/gerar                       → Emitir NFC-e
     POST /api/nfc/cancelar                    → Cancelar NFC-e
     POST /api/nfc/cce                         → Carta de Correção
     GET  /api/consultar/protocolo/{protocolo} → Consultar status
   
   Headers obrigatórios:
     Authorization: Bearer {token}
     Company: {CNPJ da empresa}
     Content-Type: application/json
   
   Fluxo assíncrono:
     1. POST emitir → { protocolo, status: "processando" }
     2. Poll GET consultar/protocolo/{protocolo} → { protocolo, status, response, xml }
   ══════════════════════════════════════════════════════════════ */

const { FiscalProvider } = require('./FiscalProviderFactory');
const axios = require('axios');

// Códigos UF → IBGE
const UF_IBGE = {
  'AC': 12, 'AL': 27, 'AM': 13, 'AP': 16, 'BA': 29, 'CE': 23, 'DF': 53,
  'ES': 32, 'GO': 52, 'MA': 21, 'MG': 31, 'MS': 50, 'MT': 51, 'PA': 15,
  'PB': 25, 'PE': 26, 'PI': 22, 'PR': 41, 'RJ': 33, 'RN': 24, 'RO': 11,
  'RR': 14, 'RS': 43, 'SC': 42, 'SE': 28, 'SP': 35, 'TO': 17
};

class DevNotaProvider extends FiscalProvider {
  constructor(config) {
    super(config);
    this.nome = 'DEVNOTA';
    this.baseUrl = config.base_url || 'https://devnota.com.br';
    this.timeout = 30000;                     // 30s por request
    this.maxPollAttempts = 10;                // Máx tentativas de polling
    this.pollIntervalMs = 3000;               // 3s entre polls

    // Mapa config extra (ex: callback URL)
    const extra = config.config_extra || {};
    this.callbackUrl = extra.callback_url || null;
  }

  /**
   * Headers de autenticação
   */
  _headers(cnpj) {
    return {
      'Authorization': `Bearer ${this.getToken()}`,
      'Company': (cnpj || '').replace(/\D/g, ''),
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Ambiente DevNota: 'production' | 'developer'
   */
  _ambiente() {
    return this.ambiente === 'producao' ? 'production' : 'developer';
  }

  /**
   * Formata data para ISO com timezone
   */
  _formatDate(date) {
    return (date || new Date()).toISOString().replace('Z', '-03:00');
  }

  // ═══════════════════════════════════════════════
  //  EMITIR NFC-e
  // ═══════════════════════════════════════════════
  async emitirNfce(document) {
    const cnpj = document.emitente.cnpj;
    const body = this._buildEmissaoBody(document);

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/nfc/gerar`,
        body,
        { headers: this._headers(cnpj), timeout: this.timeout }
      );

      const data = res.data;
      // DevNota retorna { protocolo, status: "processando" }
      if (data.protocolo) {
        // Tentar poll para resultado (esperar processamento)
        const resultado = await this._pollProtocolo(data.protocolo, cnpj);
        return resultado;
      }

      // Resposta inesperada
      return {
        status: 'PENDENTE',
        motivo: 'DevNota retornou status: ' + (data.status || 'desconhecido'),
        idExterno: String(data.protocolo || '')
      };

    } catch (err) {
      return this._handleError(err, 'emitir');
    }
  }

  // ═══════════════════════════════════════════════
  //  CONSULTAR
  // ═══════════════════════════════════════════════
  async consultar(chaveOuProtocolo) {
    // Se recebemos uma chave de 44 dígitos, só temos o local — precisaríamos do protocolo
    // Se recebemos o protocolo DevNota, consultamos diretamente
    if (!chaveOuProtocolo) {
      throw new Error('Chave/protocolo não informado para consulta');
    }

    try {
      const protocolo = chaveOuProtocolo;
      const res = await axios.get(
        `${this.baseUrl}/api/consultar/protocolo/${protocolo}`,
        { headers: this._headers(this._lastCnpj || ''), timeout: this.timeout }
      );
      return this._parseConsultaResponse(res.data);
    } catch (err) {
      return this._handleError(err, 'consultar');
    }
  }

  // ═══════════════════════════════════════════════
  //  CANCELAR
  // ═══════════════════════════════════════════════
  async cancelar(chave, justificativa, protocolo) {
    if (!chave || chave.length !== 44) {
      throw new Error('Chave de acesso deve ter 44 dígitos');
    }
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }

    const cnpj = chave.substring(6, 20); // Posição 6-20 da chave = CNPJ emitente
    const body = {
      ambiente: this._ambiente(),
      chave: chave,
      protocolo: protocolo || '',
      justificativa: justificativa
    };
    if (this.callbackUrl) body.callback = this.callbackUrl;

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/nfc/cancelar`,
        body,
        { headers: this._headers(cnpj), timeout: this.timeout }
      );

      const data = res.data;
      if (data.protocolo) {
        return await this._pollProtocolo(data.protocolo, cnpj);
      }

      return {
        status: 'PENDENTE',
        motivo: 'Cancelamento em processamento',
        idExterno: String(data.protocolo || '')
      };

    } catch (err) {
      return this._handleError(err, 'cancelar');
    }
  }

  // ═══════════════════════════════════════════════
  //  CARTA DE CORREÇÃO
  // ═══════════════════════════════════════════════
  async cartaCorrecao(chave, correcao, sequencial = 1) {
    if (!chave || chave.length !== 44) {
      throw new Error('Chave de acesso deve ter 44 dígitos');
    }
    if (!correcao || correcao.length < 15) {
      throw new Error('Correção deve ter no mínimo 15 caracteres');
    }

    const cnpj = chave.substring(6, 20);
    const body = {
      ambiente: this._ambiente(),
      chave,
      correcao,
      sequencial
    };
    if (this.callbackUrl) body.callback = this.callbackUrl;

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/nfc/cce`,
        body,
        { headers: this._headers(cnpj), timeout: this.timeout }
      );

      const data = res.data;
      if (data.protocolo) {
        return await this._pollProtocolo(data.protocolo, cnpj);
      }

      return { status: 'PENDENTE', motivo: 'CCe em processamento', idExterno: String(data.protocolo || '') };
    } catch (err) {
      return this._handleError(err, 'cce');
    }
  }

  // ═══════════════════════════════════════════════
  //  POLLING DE PROTOCOLO (retorno assíncrono DevNota)
  // ═══════════════════════════════════════════════
  async _pollProtocolo(protocolo, cnpj) {
    this._lastCnpj = cnpj;

    for (let i = 0; i < this.maxPollAttempts; i++) {
      // Esperar antes de cada tentativa (exceto a primeira após já ter esperado 2s)
      await this._sleep(i === 0 ? 2000 : this.pollIntervalMs);

      try {
        const res = await axios.get(
          `${this.baseUrl}/api/consultar/protocolo/${protocolo}`,
          { headers: this._headers(cnpj), timeout: this.timeout }
        );

        const data = res.data;
        const status = (data.status || '').toLowerCase();

        if (status === 'processado' || status === 'autorizado' || status === 'rejeitado') {
          return this._parseConsultaResponse(data);
        }

        // Ainda processando, continuar poll
      } catch (pollErr) {
        // Erro no poll — não falhar, tentar de novo
        if (i === this.maxPollAttempts - 1) {
          return {
            status: 'PENDENTE',
            motivo: `Protocolo ${protocolo} ainda processando após ${this.maxPollAttempts} tentativas`,
            idExterno: String(protocolo)
          };
        }
      }
    }

    // Esgotou tentativas
    return {
      status: 'PENDENTE',
      motivo: `Protocolo ${protocolo} em processamento (poll timeout)`,
      idExterno: String(protocolo)
    };
  }

  // ═══════════════════════════════════════════════
  //  PARSE DE RESPOSTA DE CONSULTA
  // ═══════════════════════════════════════════════
  _parseConsultaResponse(data) {
    const status = (data.status || '').toLowerCase();

    // Resposta processada com sucesso
    if (status === 'processado' || status === 'autorizado') {
      const primeira = Array.isArray(data.response) ? data.response[0] : (data.response || {});
      
      return {
        status: 'AUTORIZADA',
        chaveAcesso: primeira.chave || primeira.chave_acesso || primeira.codigo_verificacao || null,
        protocolo: String(data.protocolo),
        xml: data.xml || null,
        pdf: null,
        pdfUrl: primeira.link || primeira.pdf || primeira.danfe || null,
        idExterno: String(data.protocolo),
        motivo: null,
        numero: primeira.numero || null,
        dataEmissao: primeira.data_emissao || null,
        _raw: data
      };
    }

    // Rejeitado
    if (status === 'rejeitado' || status === 'erro') {
      const motivo = data.message || data.motivo || 
        (Array.isArray(data.response) ? JSON.stringify(data.response) : String(data.response || ''));
      
      return {
        status: 'REJEITADA',
        motivo,
        protocolo: String(data.protocolo || ''),
        idExterno: String(data.protocolo || ''),
        xml: data.xml || null,
        _raw: data
      };
    }

    // Ainda processando
    return {
      status: 'PENDENTE',
      motivo: `Status: ${data.status || 'desconhecido'}`,
      protocolo: String(data.protocolo || ''),
      idExterno: String(data.protocolo || ''),
      _raw: data
    };
  }

  // ═══════════════════════════════════════════════
  //  CONSTRUIR BODY DE EMISSÃO (Canonical → DevNota)
  // ═══════════════════════════════════════════════
  _buildEmissaoBody(document) {
    const emit = document.emitente;
    const dest = document.destinatario;
    const uf = emit.endereco?.uf || 'SP';
    const cUF = UF_IBGE[uf.toUpperCase()] || 35;

    const body = {
      ambiente: this._ambiente(),
      ide: {
        cUF: cUF,
        natOp: document.natureza_operacao || 'VENDA AO CONSUMIDOR FINAL',
        serie: document.serie || 1,
        nNF: document.numero,
        dhEmi: this._formatDate(document.data_emissao),
        tpNF: 1,                    // 1=Saída
        idDest: 1,                  // 1=Operação interna
        cMunFG: parseInt(emit.endereco?.codigo_ibge) || 0,
        tpImp: 4,                   // 4=DANFE NFC-e
        tpEmis: 1,                  // 1=Normal, 9=Contingência offline NFC-e
        finNFe: 1,                  // 1=Normal
        indFinal: 1,               // 1=Consumidor final
        indPres: 1,                // 1=Presencial
        procEmi: 0,                // 0=Aplicativo do contribuinte
        verProc: 'SGC-Vendas 1.0'
      },
      emit: {
        CNPJ: emit.cnpj,
        xNome: emit.razao_social,
        xFant: emit.nome_fantasia || emit.razao_social,
        IE: emit.inscricao_estadual,
        CRT: emit.crt || 1
      },
      enderEmit: {
        xLgr: emit.endereco?.logradouro || '',
        nro: emit.endereco?.numero || 'SN',
        xCpl: emit.endereco?.complemento || '',
        xBairro: emit.endereco?.bairro || '',
        cMun: parseInt(emit.endereco?.codigo_ibge) || 0,
        xMun: emit.endereco?.cidade || '',
        UF: uf,
        CEP: (emit.endereco?.cep || '').replace(/\D/g, ''),
        cPais: 1058,
        xPais: 'BRASIL'
      },
      det: this._buildDet(document.itens),
      total: {
        ICMSTot: {
          vBC: document.totais.icms_base || 0,
          vICMS: document.totais.icms_valor || 0,
          vICMSDeson: 0,
          vFCP: 0,
          vBCST: 0,
          vST: 0,
          vFCPST: 0,
          vFCPSTRet: 0,
          vProd: document.totais.valor_produtos || 0,
          vFrete: 0,
          vSeg: 0,
          vDesc: document.totais.valor_desconto || 0,
          vII: 0,
          vIPI: 0,
          vIPIDevol: 0,
          vPIS: document.totais.pis_valor || 0,
          vCOFINS: document.totais.cofins_valor || 0,
          vOutro: 0,
          vNF: document.totais.valor_total || 0,
          vTotTrib: (document.totais.icms_valor || 0) + (document.totais.pis_valor || 0) + (document.totais.cofins_valor || 0)
        }
      },
      transp: {
        modFrete: 9   // 9=Sem frete (NFC-e)
      },
      pag: this._buildPag(document.pagamentos),
      infAdic: {
        infCpl: document.info_complementar || ''
      }
    };

    // Destinatário (opcional para NFC-e)
    if (dest && dest.cpf_cnpj) {
      const cpfCnpj = (dest.cpf_cnpj || '').replace(/\D/g, '');
      body.dest = {};
      if (cpfCnpj.length === 11) {
        body.dest.CPF = cpfCnpj;
      } else if (cpfCnpj.length === 14) {
        body.dest.CNPJ = cpfCnpj;
      }
      body.dest.xNome = dest.nome || 'CONSUMIDOR';
      body.dest.indIEDest = 9; // 9=Não contribuinte
    }

    // Callback URL
    if (this.callbackUrl) {
      body.callback = this.callbackUrl;
    }

    return body;
  }

  /**
   * Monta array det[] com itens no formato SEFAZ/DevNota
   */
  _buildDet(itens) {
    return (itens || []).map((item, index) => {
      const imp = item.impostos || {};
      const icms = imp.icms || {};
      const pis = imp.pis || {};
      const cofins = imp.cofins || {};

      // ICMS: se SN usa CSOSN, senão CST
      const icmsObj = { orig: 0 };
      if (icms.csosn) {
        icmsObj.CSOSN = icms.csosn;
      } else {
        icmsObj.CST = icms.cst || '00';
        icmsObj.modBC = 3; // 3=Valor da operação
        icmsObj.vBC = icms.base_calculo || 0;
        icmsObj.pICMS = icms.aliquota || 0;
        icmsObj.vICMS = icms.valor || 0;
      }

      return {
        nItem: index + 1,
        prod: {
          cProd: item.codigo || String(item.produto_id || index + 1),
          cEAN: 'SEM GTIN',
          xProd: item.descricao || `ITEM ${index + 1}`,
          NCM: (item.ncm || '00000000').padEnd(8, '0'),
          CEST: item.cest || undefined,
          CFOP: item.cfop || '5102',
          uCom: item.unidade || 'UN',
          qCom: item.quantidade || 1,
          vUnCom: item.valor_unitario || 0,
          vProd: item.valor_total || 0,
          cEANTrib: 'SEM GTIN',
          uTrib: item.unidade || 'UN',
          qTrib: item.quantidade || 1,
          vUnTrib: item.valor_unitario || 0,
          vDesc: item.valor_desconto || 0,
          indTot: 1  // 1=Compõe valor total
        },
        imposto: {
          vTotTrib: (icms.valor || 0) + (pis.valor || 0) + (cofins.valor || 0),
          ICMS: [icmsObj],
          PIS: [{
            CST: pis.cst || '99',
            vBC: pis.base_calculo || 0,
            pPIS: pis.aliquota || 0,
            vPIS: pis.valor || 0
          }],
          COFINS: [{
            CST: cofins.cst || '99',
            vBC: cofins.base_calculo || 0,
            pCOFINS: cofins.aliquota || 0,
            vCOFINS: cofins.valor || 0
          }]
        }
      };
    });
  }

  /**
   * Monta objeto pag{} com pagamentos no formato SEFAZ/DevNota
   */
  _buildPag(pagamentos) {
    const detPag = (pagamentos || []).map(pag => ({
      tPag: pag.tpag || pag.tPag || '01',  // Código SEFAZ
      vPag: pag.valor || 0
    }));

    // Calcular troco
    let vTroco = 0;
    for (const pag of (pagamentos || [])) {
      if (pag.troco) vTroco += pag.troco;
    }

    const result = { detPag };
    if (vTroco > 0) result.vTroco = vTroco;
    return result;
  }

  // ═══════════════════════════════════════════════
  //  GESTÃO DE EMPRESAS NO DEVNOTA
  // ═══════════════════════════════════════════════

  /**
   * Cadastra/atualiza empresa no DevNota
   */
  async cadastrarEmpresa(empresa) {
    const cnpj = (empresa.cnpj || '').replace(/\D/g, '');
    const body = {
      name: empresa.nome || empresa.razao_social,
      fantasy_name: empresa.nome_fantasia || empresa.nome,
      cnpj: cnpj,
      im: empresa.inscricao_municipal || '',
      ibge_code: empresa.codigo_ibge || ''
    };

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/companies`,
        body,
        { headers: this._headers(cnpj), timeout: this.timeout }
      );
      return { ok: true, data: res.data };
    } catch (err) {
      // Se 422, pode ser que já existe — tentar PUT
      if (err.response?.status === 422) {
        try {
          const resUpdate = await axios.put(
            `${this.baseUrl}/api/companies/${cnpj}`,
            body,
            { headers: this._headers(cnpj), timeout: this.timeout }
          );
          return { ok: true, data: resUpdate.data, updated: true };
        } catch (updateErr) {
          return this._handleError(updateErr, 'cadastrarEmpresa (update)');
        }
      }
      return this._handleError(err, 'cadastrarEmpresa');
    }
  }

  /**
   * Envia certificado digital para DevNota
   */
  async enviarCertificado(cnpj, certBase64, certPassword) {
    const cleanCnpj = (cnpj || '').replace(/\D/g, '');
    const body = {
      cert_file: certBase64,
      cert_pass: certPassword
    };

    try {
      const res = await axios.post(
        `${this.baseUrl}/api/companies/${cleanCnpj}/certificate`,
        body,
        { headers: this._headers(cleanCnpj), timeout: this.timeout }
      );
      return { ok: true, data: res.data };
    } catch (err) {
      return this._handleError(err, 'enviarCertificado');
    }
  }

  // ═══════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════

  _handleError(err, operacao) {
    const status = err.response?.status;
    const data = err.response?.data;

    // Erros de validação DevNota (422)
    if (status === 422 && data?.errors) {
      const msgs = Object.values(data.errors).flat().join('; ');
      throw new Error(`DevNota [${operacao}] validação: ${msgs}`);
    }

    // Erro de autenticação
    if (status === 401) {
      throw new Error(`DevNota [${operacao}]: Token inválido ou expirado. Verifique a configuração do provider.`);
    }

    // Erro de permissão
    if (status === 403) {
      throw new Error(`DevNota [${operacao}]: Sem permissão. Verifique o CNPJ no header Company.`);
    }

    // Erro genérico da API
    if (data?.message) {
      throw new Error(`DevNota [${operacao}]: ${data.message}`);
    }

    // Erro de conexão
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      throw new Error(`DevNota [${operacao}]: Erro de conexão (${err.code}). Verifique sua internet.`);
    }

    // Fallback
    throw new Error(`DevNota [${operacao}]: ${err.message || 'Erro desconhecido'}`);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DevNotaProvider;
