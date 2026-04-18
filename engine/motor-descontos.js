/* ═══════════════════════════════════════════════════════════════════
   VarlenSYS — Motor de Descontos  v1.0
   
   Motor de decisão determinístico para programas comerciais.
   
   Pipeline:
     1. Coleta regras aplicáveis ao produto (escopo match)
     2. Peso de escopo: produto=3, categoria=2, geral=1
     3. Ordena: escopo_weight DESC → regra.prioridade DESC → programa.prioridade DESC
     4. Separa acumulativas (programa.acumulativo=true) de não-acumulativas
     5. Não-acumulativas: pega a melhor (maior desconto em R$)
     6. Acumulativas: soma todas
     7. Total = melhor_nao_acum + soma_acum, capped em preco_original
     8. Retorna objeto de decisão com trilha de auditoria completa
   
   Regras de prioridade:
     Convênio > Campanha > Clube > Regra geral
     (via campo programa.prioridade — valores maiores = maior prioridade)
     
     Dentro de mesma prioridade de programa:
       escopo 'produto' (peso 3) > 'categoria' (peso 2) > 'geral' (peso 1)
     
     Dentro de mesmo escopo:
       regra.prioridade DESC → programa.prioridade DESC
   
   Desconto manual:
     Aplicado SEMPRE separadamente, APÓS o desconto automático.
     O motor NÃO trata desconto manual — apenas o automático.
   
   Uso:
     Backend:  const { avaliarDescontos, avaliarDescontosLote } = require('../engine/motor-descontos');
     Frontend: Lógica espelhada em pdv.js _calcularDescontoProduto()
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

// Pesos de escopo — quanto mais específico, maior o peso
const ESCOPO_PESO = { produto: 3, categoria: 2, geral: 1 };

/**
 * Filtra regras aplicáveis ao produto
 * @param {Array} regrasCliente - Todas as regras do cliente (flat, já com metadata do programa)
 * @param {number} produtoId
 * @param {number|null} categoriaId
 * @returns {Array} Regras que se aplicam a este produto
 */
function filtrarRegrasAplicaveis(regrasCliente, produtoId, categoriaId) {
  return regrasCliente.filter(function(r) {
    if (!r.ativo && r.ativo !== undefined) return false; // regra inativa
    if (r.escopo === 'geral') return true;
    if (r.escopo === 'produto' && r.produto_id === produtoId) return true;
    if (r.escopo === 'categoria' && categoriaId && r.categoria_id === categoriaId) return true;
    return false;
  });
}

/**
 * Ordena regras por prioridade determinística:
 *   1. escopo_peso DESC (produto > categoria > geral)
 *   2. regra.prioridade DESC
 *   3. programa_prioridade DESC
 *   4. valor de desconto DESC (tiebreaker final)
 */
function ordenarPorPrioridade(regras, precoOriginal) {
  return regras.slice().sort(function(a, b) {
    // 1. Peso do escopo
    var pesoA = ESCOPO_PESO[a.escopo] || 0;
    var pesoB = ESCOPO_PESO[b.escopo] || 0;
    if (pesoB !== pesoA) return pesoB - pesoA;

    // 2. Prioridade da regra
    var prioRegraA = a.prioridade || 0;
    var prioRegraB = b.prioridade || 0;
    if (prioRegraB !== prioRegraA) return prioRegraB - prioRegraA;

    // 3. Prioridade do programa
    var prioProgA = a.programa_prioridade || 0;
    var prioProgB = b.programa_prioridade || 0;
    if (prioProgB !== prioProgA) return prioProgB - prioProgA;

    // 4. Tiebreaker: maior desconto efetivo
    var descA = calcularDescontoRegra(a, precoOriginal);
    var descB = calcularDescontoRegra(b, precoOriginal);
    return descB - descA;
  });
}

/**
 * Calcula o desconto em R$ de uma única regra
 * @param {Object} regra
 * @param {number} precoOriginal
 * @returns {number} Valor do desconto em R$ (sempre >= 0)
 */
function calcularDescontoRegra(regra, precoOriginal) {
  var valor = parseFloat(regra.valor) || 0;
  var desconto = 0;

  switch (regra.tipo_regra) {
    case 'percentual':
      desconto = precoOriginal * (valor / 100);
      break;
    case 'valor_fixo':
      desconto = valor;
      break;
    case 'preco_especial':
      desconto = Math.max(0, precoOriginal - valor);
      break;
    default:
      desconto = 0;
  }

  return Math.max(0, desconto); // Nunca negativo
}

/**
 * ═══════════════════════════════════════════════
 *  FUNÇÃO PRINCIPAL DO MOTOR
 * ═══════════════════════════════════════════════
 * 
 * Avalia descontos automáticos para UM produto de UM cliente.
 * 
 * @param {Array} regrasCliente - Array flat de todas as regras ativas do cliente
 *   Cada regra deve ter: {
 *     regra_id, programa_id, programa_nome, programa_tipo,
 *     programa_acumulativo, programa_prioridade,
 *     tipo_regra, escopo, produto_id, categoria_id,
 *     valor, prioridade, acumulativo, ativo
 *   }
 * @param {Object} produto - { id, preco_venda, categoria_id }
 * @returns {Object|null} Decisão do motor ou null se nenhum desconto aplicável
 *   {
 *     preco_original,    // Preço de tabela
 *     preco_aplicado,    // Preço final após motor
 *     desconto_total,    // Valor total do desconto automático em R$
 *     tipo_desconto,     // 'percentual' | 'valor_fixo' | 'preco_especial' | 'acumulado'
 *     valor_desconto,    // Valor numérico da regra vencedora
 *     programa_id,       // ID do programa principal (regra vencedora)
 *     programa_nome,     // Nome do programa principal
 *     programa_tipo,     // Tipo: convenio, campanha, clube, etc.
 *     regra_vencedora,   // Objeto da regra que venceu a prioridade
 *     regras_aplicadas,  // Array de todas as regras efetivamente aplicadas
 *     regras_avaliadas,  // Array de todas as regras que foram consideradas (auditoria)
 *     trilha_auditoria   // JSON string para persistência
 *   }
 */
function avaliarDescontos(regrasCliente, produto) {
  if (!regrasCliente || regrasCliente.length === 0 || !produto) return null;

  var produtoId = produto.id;
  var categoriaId = produto.categoria_id || null;
  var precoOriginal = parseFloat(produto.preco_venda);

  if (isNaN(precoOriginal) || precoOriginal <= 0) return null;

  // ── 1. Filtrar regras aplicáveis ──
  var aplicaveis = filtrarRegrasAplicaveis(regrasCliente, produtoId, categoriaId);
  if (aplicaveis.length === 0) return null;

  // ── 2. Ordenar por prioridade determinística ──
  var ordenadas = ordenarPorPrioridade(aplicaveis, precoOriginal);

  // ── 3. Separar: programas acumulativos vs não-acumulativos ──
  // programa_acumulativo = permite que suas regras se SOMEM com regras de outros programas
  var acumulativas = ordenadas.filter(function(r) { return r.programa_acumulativo === true; });
  var naoAcumulativas = ordenadas.filter(function(r) { return r.programa_acumulativo !== true; });

  // ── 4. Não-acumulativas: pegar a MELHOR (maior desconto efetivo) ──
  var melhorNaoAcum = null;
  var melhorDescontoNaoAcum = 0;

  for (var i = 0; i < naoAcumulativas.length; i++) {
    var r = naoAcumulativas[i];
    var d = calcularDescontoRegra(r, precoOriginal);
    if (d > melhorDescontoNaoAcum) {
      melhorDescontoNaoAcum = d;
      melhorNaoAcum = r;
    }
  }

  // ── 5. Acumulativas: somar todas ──
  var somaAcumulativas = 0;
  var regrasAcumAplicadas = [];

  for (var j = 0; j < acumulativas.length; j++) {
    var ra = acumulativas[j];
    var da = calcularDescontoRegra(ra, precoOriginal);
    if (da > 0) {
      somaAcumulativas += da;
      regrasAcumAplicadas.push({
        regra_id: ra.regra_id,
        programa_id: ra.programa_id,
        programa_nome: ra.programa_nome,
        tipo_regra: ra.tipo_regra,
        escopo: ra.escopo,
        valor: ra.valor,
        desconto_calculado: Math.round(da * 100) / 100
      });
    }
  }

  // ── 6. Combinar e aplicar cap ──
  var descontoTotal = melhorDescontoNaoAcum + somaAcumulativas;
  descontoTotal = Math.min(descontoTotal, precoOriginal); // Nunca preço negativo
  descontoTotal = Math.round(descontoTotal * 100) / 100;  // Arredondar centavos

  if (descontoTotal <= 0) return null;

  var precoAplicado = Math.round((precoOriginal - descontoTotal) * 100) / 100;
  precoAplicado = Math.max(0, precoAplicado); // Safety cap

  // ── 7. Montar objeto de decisão ──
  var regrasAplicadas = [];
  var regraVencedora = melhorNaoAcum || (regrasAcumAplicadas.length > 0 ? acumulativas[0] : null);

  if (melhorNaoAcum) {
    regrasAplicadas.push({
      regra_id: melhorNaoAcum.regra_id,
      programa_id: melhorNaoAcum.programa_id,
      programa_nome: melhorNaoAcum.programa_nome,
      tipo_regra: melhorNaoAcum.tipo_regra,
      escopo: melhorNaoAcum.escopo,
      valor: melhorNaoAcum.valor,
      desconto_calculado: Math.round(melhorDescontoNaoAcum * 100) / 100,
      acumulativo: false
    });
  }

  regrasAcumAplicadas.forEach(function(ra) {
    ra.acumulativo = true;
    regrasAplicadas.push(ra);
  });

  // ── Determinar tipo_desconto final ──
  var tipoDesconto;
  var valorDesconto;
  if (regrasAplicadas.length > 1) {
    tipoDesconto = 'acumulado';
    valorDesconto = descontoTotal;
  } else if (regraVencedora) {
    tipoDesconto = regraVencedora.tipo_regra;
    valorDesconto = parseFloat(regraVencedora.valor);
  } else {
    tipoDesconto = null;
    valorDesconto = null;
  }

  // ── 8. Trilha de auditoria ──
  var trilha = {
    timestamp: new Date().toISOString(),
    produto_id: produtoId,
    categoria_id: categoriaId,
    preco_original: precoOriginal,
    total_regras_avaliadas: aplicaveis.length,
    total_regras_aplicadas: regrasAplicadas.length,
    regras_aplicadas: regrasAplicadas,
    regras_avaliadas: ordenadas.map(function(r) {
      return {
        regra_id: r.regra_id,
        programa_id: r.programa_id,
        programa_nome: r.programa_nome,
        escopo: r.escopo,
        tipo_regra: r.tipo_regra,
        valor: r.valor,
        desconto_potencial: Math.round(calcularDescontoRegra(r, precoOriginal) * 100) / 100,
        programa_acumulativo: r.programa_acumulativo,
        aplicada: regrasAplicadas.some(function(ra) { return ra.regra_id === r.regra_id; })
      };
    })
  };

  return {
    // Valores para VendaItem
    preco_original: precoOriginal,
    preco_aplicado: precoAplicado,
    desconto_total: descontoTotal,
    tipo_desconto: tipoDesconto,
    valor_desconto: valorDesconto,
    programa_id: regraVencedora ? regraVencedora.programa_id : null,
    programa_nome: regraVencedora ? regraVencedora.programa_nome : null,
    programa_tipo: regraVencedora ? regraVencedora.programa_tipo : null,

    // Auditoria
    regra_vencedora: regraVencedora,
    regras_aplicadas: regrasAplicadas,
    regras_avaliadas: ordenadas,
    trilha_auditoria: JSON.stringify(trilha)
  };
}

/**
 * Avalia descontos para LOTE de produtos (cache-friendly).
 * Chama avaliarDescontos() para cada produto.
 * Útil para recalcular o carrinho inteiro de uma vez.
 * 
 * @param {Array} regrasCliente - Array flat de regras do cliente
 * @param {Array} produtos - Array de { id, preco_venda, categoria_id }
 * @returns {Object} Map de produto_id → decisão do motor (ou null)
 */
function avaliarDescontosLote(regrasCliente, produtos) {
  var resultado = {};
  if (!regrasCliente || regrasCliente.length === 0 || !produtos) return resultado;

  for (var i = 0; i < produtos.length; i++) {
    var p = produtos[i];
    resultado[p.id] = avaliarDescontos(regrasCliente, p);
  }

  return resultado;
}

/**
 * Normaliza regras brutas do banco para o formato flat do motor.
 * Uso no backend: transforma resultado do Sequelize → input do motor.
 * 
 * @param {Array} inscricoes - ClientePrograma[] com ProgramaComercial.RegraDescontos
 * @returns {Array} Regras flat prontas para o motor
 */
function normalizarRegrasDB(inscricoes) {
  var regras = [];
  for (var i = 0; i < inscricoes.length; i++) {
    var insc = inscricoes[i];
    var prog = insc.ProgramaComercial;
    if (!prog || !prog.RegraDescontos) continue;
    for (var j = 0; j < prog.RegraDescontos.length; j++) {
      var regra = prog.RegraDescontos[j];
      regras.push({
        regra_id: regra.id,
        programa_id: prog.id,
        programa_nome: prog.nome,
        programa_tipo: prog.tipo,
        programa_acumulativo: prog.acumulativo_global,
        programa_prioridade: prog.prioridade_global || 0,
        tipo_regra: regra.tipo_regra,
        escopo: regra.escopo,
        produto_id: regra.produto_id,
        categoria_id: regra.categoria_id,
        valor: parseFloat(regra.valor),
        prioridade: regra.prioridade || 0,
        acumulativo: regra.acumulativo,
        ativo: regra.ativo !== false,
        data_inicio: regra.data_inicio || null,
        data_fim: regra.data_fim || null,
        produto_nome: regra.Produto ? regra.Produto.nome : null,
        categoria_nome: regra.Categoria ? regra.Categoria.nome : null
      });
    }
  }
  return regras;
}

module.exports = {
  avaliarDescontos,
  avaliarDescontosLote,
  normalizarRegrasDB,
  calcularDescontoRegra,
  filtrarRegrasAplicaveis,
  ESCOPO_PESO
};
