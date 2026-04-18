/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Feature Flags por Segmento
   Controla quais funcionalidades estão disponíveis
   com base no tipo_negocio da empresa (mercado | drogaria)
   ══════════════════════════════════════════════════════════════ */

const FEATURES = {
  // ── MERCADO ──
  mercado: {
    label: 'Mercado / Mercearia',
    modulos: {
      vendas: true,
      caixa: true,
      produtos: true,
      estoque: true,
      financeiro: true,
      fornecedores: true,
      categorias: true,
      clientes: true,
      usuarios: true,
      configuracoes: true,
      dashboard: true,
      // Farmácia-específicos
      sngpc: false,
      medicamentos_controlados: false,
      receitas: false,
      // Comuns avançados
      fiscal: true,
      combos: true,
      sugestoes: false,       // sugestões no PDV (default off p/ mercado)
      metas: true,
      centros_custo: true,
      contas_bancarias: true,
      audit_log: true,
    },
    produto: {
      campos_farmacia: false,       // principio_ativo, tipo_medicamento, etc
      campos_fiscal: true,          // NCM, CEST, CFOP
      controle_lote: false,         // lote e validade obrigatórios
      permite_fracionamento: true,  // peso
      curva_abc: true,
    },
    pdv: {
      sugestoes_automaticas: false,
      historico_cliente: false,
      combos: true,
      venda_controlado: false,
    },
    dashboard: {
      margem_lucro: true,
      curva_abc: true,
      giro_estoque: true,
      ranking_fornecedores: true,
      metas: true,
    }
  },

  // ── DROGARIA / FARMÁCIA ──
  drogaria: {
    label: 'Farmácia / Drogaria',
    modulos: {
      vendas: true,
      caixa: true,
      produtos: true,
      estoque: true,
      financeiro: true,
      fornecedores: true,
      categorias: true,
      clientes: true,
      usuarios: true,
      configuracoes: true,
      dashboard: true,
      // Farmácia-específicos
      sngpc: true,
      medicamentos_controlados: true,
      receitas: true,
      // Comuns avançados
      fiscal: true,
      combos: true,
      sugestoes: true,          // sugestões inteligentes no PDV
      metas: true,
      centros_custo: true,
      contas_bancarias: true,
      audit_log: true,
    },
    produto: {
      campos_farmacia: true,        // principio_ativo, tipo_medicamento, etc
      campos_fiscal: true,          // NCM, CEST, CFOP
      controle_lote: true,          // lote e validade obrigatórios
      permite_fracionamento: true,
      curva_abc: true,
    },
    pdv: {
      sugestoes_automaticas: true,  // sugere protetor gástrico, etc
      historico_cliente: true,      // mostra últimas compras no CPF
      combos: true,
      venda_controlado: true,       // workflow de receita no PDV
    },
    dashboard: {
      margem_lucro: true,
      curva_abc: true,
      giro_estoque: true,
      ranking_fornecedores: true,
      metas: true,
      sngpc_pendentes: true,       // alertas SNGPC
      medicamentos_vencendo: true,
    }
  }
};

/**
 * Retorna feature flags para o tipo de empresa
 * @param {string} tipo_negocio - 'mercado' ou 'drogaria'
 * @returns {object} Feature flags
 */
function getFeatures(tipo_negocio) {
  return FEATURES[tipo_negocio] || FEATURES.mercado;
}

/**
 * Verifica se um módulo está habilitado para o tipo de empresa
 * @param {string} tipo_negocio
 * @param {string} modulo
 * @returns {boolean}
 */
function isModuloEnabled(tipo_negocio, modulo) {
  const features = getFeatures(tipo_negocio);
  return features.modulos[modulo] === true;
}

/**
 * Middleware Express p/ verificar feature flag
 * Requer que auth() e tenant() já tenham sido chamados
 */
function requireFeature(modulo) {
  return (req, res, next) => {
    const tipo = req.empresa?.tipo_negocio || 'mercado';
    if (!isModuloEnabled(tipo, modulo)) {
      return res.status(403).json({ 
        error: `Módulo "${modulo}" não disponível para ${FEATURES[tipo]?.label || tipo}` 
      });
    }
    next();
  };
}

module.exports = { FEATURES, getFeatures, isModuloEnabled, requireFeature };
