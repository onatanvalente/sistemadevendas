/* ══════════════════════════════════════════════════════════════
   FiscalProviderFactory — Camada 2 (Interface + Factory)
   
   Responsável por:
   • Definir contrato padrão para qualquer provider
   • Instanciar o provider correto para cada empresa
   • Suportar fallback entre providers
   ══════════════════════════════════════════════════════════════ */

const { FiscalProviderConfig } = require('../../models');
const { decrypt } = require('./FiscalCrypto');

/**
 * Interface base — qualquer provider deve implementar esses métodos.
 * Em JavaScript, usamos uma classe abstrata.
 */
class FiscalProvider {
  constructor(config) {
    this.config = config;
    this.nome = config.provider_nome;
    this.ambiente = config.ambiente;
    this.baseUrl = config.base_url;
  }

  /**
   * Emite uma NFC-e
   * @param {object} document - FiscalDocument (modelo canônico)
   * @returns {Promise<FiscalResponse>} - { status, chaveAcesso, protocolo, xml, motivo, pdf, pdfUrl, idExterno }
   */
  async emitirNfce(document) {
    throw new Error('Método emitirNfce() não implementado no provider ' + this.nome);
  }

  /**
   * Consulta status de uma NFC-e
   * @param {string} chaveOuId - Chave de acesso de 44 dígitos ou ID externo
   * @returns {Promise<FiscalResponse>}
   */
  async consultar(chaveOuId) {
    throw new Error('Método consultar() não implementado no provider ' + this.nome);
  }

  /**
   * Cancela uma NFC-e
   * @param {string} chave - Chave de acesso
   * @param {string} justificativa - Motivo do cancelamento (mín 15 chars)
   * @returns {Promise<FiscalResponse>}
   */
  async cancelar(chave, justificativa) {
    throw new Error('Método cancelar() não implementado no provider ' + this.nome);
  }

  /**
   * Descriptografa o token armazenado
   */
  getToken() {
    if (!this.config.token_encrypted) return null;
    return decrypt(this.config.token_encrypted, this.config.token_iv, this.config.token_tag);
  }

  /**
   * Descriptografa a senha do certificado
   */
  getCertificadoSenha() {
    if (!this.config.certificado_senha_encrypted) return null;
    return decrypt(this.config.certificado_senha_encrypted, this.config.certificado_senha_iv, this.config.certificado_senha_tag);
  }
}

/**
 * Factory — instancia o provider correto
 */
class FiscalProviderFactory {

  /**
   * Obtém o provider ativo para uma empresa (por prioridade)
   * @param {number} empresaId
   * @returns {Promise<FiscalProvider>}
   */
  static async getProvider(empresaId) {
    const configs = await FiscalProviderConfig.findAll({
      where: { empresa_id: empresaId, ativo: true },
      order: [['prioridade', 'ASC']]
    });

    if (configs.length === 0) {
      throw new Error('Nenhum provider fiscal configurado para esta empresa. Acesse Fiscal > Configuração.');
    }

    // Tentar o de maior prioridade (menor número)
    const config = configs[0];
    return FiscalProviderFactory._instanciar(config);
  }

  /**
   * Obtém um provider específico por nome
   */
  static async getProviderByName(empresaId, providerNome) {
    const config = await FiscalProviderConfig.findOne({
      where: { empresa_id: empresaId, provider_nome: providerNome, ativo: true }
    });
    if (!config) {
      throw new Error(`Provider ${providerNome} não configurado ou inativo`);
    }
    return FiscalProviderFactory._instanciar(config);
  }

  /**
   * Lista providers disponíveis
   */
  static async listarProviders(empresaId) {
    return FiscalProviderConfig.findAll({
      where: { empresa_id: empresaId },
      attributes: ['id', 'provider_nome', 'ambiente', 'ativo', 'prioridade', 'created_at'],
      order: [['prioridade', 'ASC']]
    });
  }

  /**
   * Instancia o provider correto
   */
  static _instanciar(config) {
    const nome = (config.provider_nome || '').toUpperCase();

    switch (nome) {
      case 'DEVNOTA': {
        const DevNotaProvider = require('./DevNotaProvider');
        return new DevNotaProvider(config);
      }
      // ── FUTUROS PROVIDERS ──
      // case 'TECNOSPEED': {
      //   const TecnoSpeedProvider = require('./TecnoSpeedProvider');
      //   return new TecnoSpeedProvider(config);
      // }
      // case 'FOCUS': {
      //   const FocusProvider = require('./FocusProvider');
      //   return new FocusProvider(config);
      // }
      // case 'SEFAZ_DIRETO': {
      //   const SefazDirectProvider = require('./SefazDirectProvider');
      //   return new SefazDirectProvider(config);
      // }
      default:
        throw new Error(`Provider "${config.provider_nome}" não suportado. Disponíveis: DEVNOTA`);
    }
  }
}

module.exports = FiscalProviderFactory;
module.exports.FiscalProvider = FiscalProvider;
