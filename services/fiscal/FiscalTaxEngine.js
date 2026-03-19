/* ══════════════════════════════════════════════════════════════
   FiscalTaxEngine — Motor Tributário Interno
   
   Responsável por:
   • Aplicar CSOSN/CST padrão por regime tributário
   • Calcular ICMS, PIS, COFINS
   • Validar NCM e CFOP obrigatórios
   • Independe de qualquer API externa
   ══════════════════════════════════════════════════════════════ */

/**
 * TABELA CSOSN — Simples Nacional (NFC-e)
 *  102 = Tributada sem permissão de crédito
 *  300 = Imune
 *  400 = Não tributada
 *  500 = ICMS cobrado por ST
 *  900 = Outros
 */
const CSOSN_PADRAO = '102'; // Mais comum para mercados/drogarias SN

/**
 * TABELA CST ICMS — Lucro Presumido/Real
 *  00 = Tributada integralmente
 *  10 = Tributada com cobrança de ST
 *  20 = Com redução de base de cálculo
 *  40 = Isenta
 *  41 = Não tributada
 *  60 = ICMS ST cobrado anteriormente
 */

/**
 * CFOP padrão para NFC-e (operação interna, venda ao consumidor)
 */
const CFOP_VENDA_CONSUMIDOR = '5102'; // Venda mercadoria adquirida
const CFOP_VENDA_PRODUCAO   = '5101'; // Venda produção própria

/**
 * PIS/COFINS — Regime Cumulativo (LP/LR) vs Não-Cumulativo
 * Para Simples Nacional: CST 99 (outras operações de saída)
 * Para LP: CST 01 (tributável - alíquotas 0.65% PIS, 3% COFINS)
 */
const PIS_COFINS = {
  simples_nacional: { cst_pis: '99', cst_cofins: '99', aliq_pis: 0, aliq_cofins: 0 },
  lucro_presumido:  { cst_pis: '01', cst_cofins: '01', aliq_pis: 0.65, aliq_cofins: 3.00 },
  lucro_real:       { cst_pis: '01', cst_cofins: '01', aliq_pis: 1.65, aliq_cofins: 7.60 },
  mei:              { cst_pis: '99', cst_cofins: '99', aliq_pis: 0, aliq_cofins: 0 }
};

class FiscalTaxEngine {

  /**
   * Valida se o produto/item tem dados fiscais mínimos
   * @param {{ ncm: string, cfop: string }} item
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validarDadosFiscais(item) {
    const errors = [];
    if (!item.ncm || item.ncm.length < 8) {
      errors.push(`NCM obrigatório (8 dígitos) — produto: ${item.descricao || item.produto_nome || 'N/A'}`);
    }
    if (!item.cfop || item.cfop.length < 4) {
      errors.push(`CFOP obrigatório (4 dígitos) — produto: ${item.descricao || item.produto_nome || 'N/A'}`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Calcula impostos de um item baseado no regime tributário da empresa
   * @param {object} item - Item com dados do produto
   * @param {string} regime - simples_nacional | lucro_presumido | lucro_real | mei
   * @returns {object} - Objeto de impostos formatado
   */
  static calcularImpostos(item, regime) {
    const valorTotal = parseFloat(item.valorTotal || item.subtotal || 0);
    const resultado = {
      icms: FiscalTaxEngine._calcularICMS(item, regime, valorTotal),
      pis:  FiscalTaxEngine._calcularPIS(item, regime, valorTotal),
      cofins: FiscalTaxEngine._calcularCOFINS(item, regime, valorTotal)
    };
    return resultado;
  }

  /**
   * ICMS — depende do regime
   */
  static _calcularICMS(item, regime, valorTotal) {
    // Origem: 0=Nacional, 1=Estrangeira importação direta, 2=Estrangeira adq. interna
    const origem = parseInt(item.origem || item.Produto?.origem || '0') || 0;

    if (regime === 'simples_nacional' || regime === 'mei') {
      // Simples Nacional → usa CSOSN
      const csosn = item.cst_icms || item.Produto?.cst_icms || CSOSN_PADRAO;
      return {
        origem,
        csosn,
        // Simples: não destaca ICMS na NFC-e (recolhido via DAS)
        base_calculo: 0,
        aliquota: 0,
        valor: 0
      };
    }

    // Lucro Presumido / Real → usa CST
    const cst = item.cst_icms || item.Produto?.cst_icms || '00';
    const aliquota = parseFloat(item.aliquota_icms || item.Produto?.aliquota_icms || 0);
    const baseCalculo = valorTotal; // Simplificado (sem redução)
    const valor = aliquota > 0 ? parseFloat((baseCalculo * aliquota / 100).toFixed(2)) : 0;

    return {
      origem,
      cst,
      base_calculo: parseFloat(baseCalculo.toFixed(2)),
      aliquota,
      valor
    };
  }

  /**
   * PIS
   */
  static _calcularPIS(item, regime, valorTotal) {
    const config = PIS_COFINS[regime] || PIS_COFINS.simples_nacional;
    const cst = item.cst_pis || item.Produto?.cst_pis || config.cst_pis;
    const aliquota = parseFloat(item.aliquota_pis || item.Produto?.aliquota_pis || config.aliq_pis);
    const base = aliquota > 0 ? valorTotal : 0;
    return {
      cst,
      base_calculo: parseFloat(base.toFixed(2)),
      aliquota,
      valor: parseFloat((base * aliquota / 100).toFixed(2))
    };
  }

  /**
   * COFINS
   */
  static _calcularCOFINS(item, regime, valorTotal) {
    const config = PIS_COFINS[regime] || PIS_COFINS.simples_nacional;
    const cst = item.cst_cofins || item.Produto?.cst_cofins || config.cst_cofins;
    const aliquota = parseFloat(item.aliquota_cofins || item.Produto?.aliquota_cofins || config.aliq_cofins);
    const base = aliquota > 0 ? valorTotal : 0;
    return {
      cst,
      base_calculo: parseFloat(base.toFixed(2)),
      aliquota,
      valor: parseFloat((base * aliquota / 100).toFixed(2))
    };
  }

  /**
   * Determina CFOP padrão se não definido no produto
   */
  static getCFOP(item) {
    if (item.cfop && item.cfop.length >= 4) return item.cfop;
    if (item.Produto?.cfop && item.Produto.cfop.length >= 4) return item.Produto.cfop;
    return CFOP_VENDA_CONSUMIDOR;
  }

  /**
   * Mapa de formas de pagamento para código SEFAZ
   * tPag (NFC-e/NF-e):
   *  01=Dinheiro, 02=Cheque, 03=Cartão Crédito, 04=Cartão Débito,
   *  05=Crédito Loja, 15=Boleto, 17=Pix, 99=Outros
   */
  static mapFormaPagamento(forma) {
    const mapa = {
      'dinheiro':  { tPag: '01', descricao: 'Dinheiro' },
      'pix':       { tPag: '17', descricao: 'Pagamento Instantâneo (PIX)' },
      'debito':    { tPag: '04', descricao: 'Cartão de Débito' },
      'credito':   { tPag: '03', descricao: 'Cartão de Crédito' },
      'cheque':    { tPag: '02', descricao: 'Cheque' },
      'boleto':    { tPag: '15', descricao: 'Boleto Bancário' },
      'multiplo':  { tPag: '99', descricao: 'Outros / Múltiplo' },
      'cortesia':  { tPag: '99', descricao: 'Sem pagamento' }
    };
    return mapa[forma?.toLowerCase()] || { tPag: '99', descricao: 'Outros' };
  }

  /**
   * Valida dados mínimos da empresa para emissão fiscal
   */
  static validarEmpresa(empresa) {
    const errors = [];
    if (!empresa.cnpj) errors.push('CNPJ da empresa não configurado');
    if (!empresa.inscricao_estadual && empresa.regime_tributario !== 'mei') {
      errors.push('Inscrição Estadual não configurada');
    }
    if (!empresa.endereco) errors.push('Endereço da empresa não configurado');
    if (!empresa.cidade) errors.push('Cidade da empresa não configurada');
    if (!empresa.estado) errors.push('Estado (UF) da empresa não configurado');
    if (!empresa.cep) errors.push('CEP da empresa não configurado');
    return { valid: errors.length === 0, errors };
  }
}

module.exports = FiscalTaxEngine;
