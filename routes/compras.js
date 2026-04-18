/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Rotas: Módulo de Compras v2.0
   Fluxo: ABERTA → Itens → FINALIZAR (gera lotes, estoque, financeiro)
   Governança: entrada fornecedor SOMENTE via Compras
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const { auth, perfil } = require('../middleware/auth');
const { logger } = require('../config/logger');
const {
  Compra, CompraItem, CompraParcela, Lote,
  Produto, Fornecedor, EstoqueMovimentacao, ContaPagar,
  SngpcMovimentacao, sequelize
} = require('../models');

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════

/**
 * Rateia valores proporcionalmente entre itens
 */
function ratearCustos(itens, valorFrete, valorDesconto, valorImpostos) {
  const totalProdutos = itens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
  if (totalProdutos <= 0) return itens;

  return itens.map(item => {
    const peso = parseFloat(item.valor_total || 0) / totalProdutos;
    const freteRateado = parseFloat((valorFrete * peso).toFixed(2));
    const descontoRateado = parseFloat((valorDesconto * peso).toFixed(2));
    const impostoRateado = parseFloat((valorImpostos * peso).toFixed(2));
    const qtd = parseFloat(item.quantidade) || 1;
    const custoTotalItem = parseFloat(item.valor_total || 0) + freteRateado + impostoRateado - descontoRateado;
    const custoFinalUnit = parseFloat((custoTotalItem / qtd).toFixed(4));
    return {
      ...item,
      frete_rateado: freteRateado,
      desconto_rateado: descontoRateado,
      imposto_rateado: impostoRateado,
      custo_final_unitario: custoFinalUnit
    };
  });
}

/**
 * Calcula custo médio ponderado
 * Fórmula: (Estoque_Atual × Custo_Médio + Qtd_Compra × Custo_Compra) / (Estoque_Atual + Qtd_Compra)
 */
function calcularCustoMedio(estoqueAtual, custoMedioAtual, qtdCompra, custoCompra) {
  const estAtu = parseFloat(estoqueAtual) || 0;
  const custoMed = parseFloat(custoMedioAtual) || 0;
  const qtdC = parseFloat(qtdCompra) || 0;
  const custoC = parseFloat(custoCompra) || 0;

  if (estAtu + qtdC <= 0) return custoC;
  if (estAtu <= 0 || custoMed <= 0) return custoC;

  return ((estAtu * custoMed) + (qtdC * custoC)) / (estAtu + qtdC);
}

// ──────────────────────────────────────────────
//  GET /  —  Listar compras
// ──────────────────────────────────────────────
router.get('/', auth, perfil('administrador', 'gerente', 'estoquista', 'financeiro'), async (req, res) => {
  try {
    const where = { empresa_id: req.empresa_id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.fornecedor_id) where.fornecedor_id = req.query.fornecedor_id;

    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 50);
    const offset = (page - 1) * limit;

    const { rows, count } = await Compra.findAndCountAll({
      where,
      include: [
        { model: Fornecedor, attributes: ['id', 'nome', 'cnpj_cpf'] },
        { model: CompraItem, attributes: ['id', 'produto_nome', 'quantidade', 'valor_unitario', 'valor_total', 'custo_final_unitario'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({ data: rows, total: count, page, pages: Math.ceil(count / limit) });
  } catch (error) {
    logger.error('Erro listar compras:', { message: error.message });
    res.status(500).json({ error: 'Erro ao listar compras' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id  —  Detalhe da compra
// ──────────────────────────────────────────────
router.get('/:id', auth, perfil('administrador', 'gerente', 'estoquista', 'financeiro'), async (req, res) => {
  try {
    const compra = await Compra.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [
        { model: Fornecedor, attributes: ['id', 'nome', 'cnpj_cpf'] },
        { model: CompraItem, include: [{ model: Produto, attributes: ['id', 'nome', 'codigo_barras'] }] },
        { model: CompraParcela, order: [['numero_parcela', 'ASC']] }
      ]
    });
    if (!compra) return res.status(404).json({ error: 'Compra não encontrada' });
    res.json(compra);
  } catch (error) {
    logger.error('Erro detalhe compra:', { message: error.message });
    res.status(500).json({ error: 'Erro ao buscar compra' });
  }
});

// ──────────────────────────────────────────────
//  POST /  —  Criar compra (status ABERTA)
//  Não toca estoque — apenas cria cabeçalho + itens
// ──────────────────────────────────────────────
router.post('/', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      fornecedor_id, tipo_documento, numero_nf, serie, chave_acesso,
      data_emissao, data_entrada, valor_frete, valor_desconto,
      valor_impostos, observacoes, itens, parcelas
    } = req.body;

    // Validar NF duplicada
    if (numero_nf && fornecedor_id) {
      const existe = await Compra.findOne({
        where: {
          empresa_id: req.empresa_id,
          numero_nf,
          fornecedor_id,
          status: { [Op.ne]: 'CANCELADA' }
        }
      });
      if (existe) {
        await t.rollback();
        return res.status(400).json({ error: 'Nota já lançada para este fornecedor.' });
      }
    }

    // Validar fornecedor
    if (fornecedor_id) {
      const forn = await Fornecedor.findOne({ where: { id: fornecedor_id, empresa_id: req.empresa_id } });
      if (!forn) {
        await t.rollback();
        return res.status(400).json({ error: 'Fornecedor não encontrado' });
      }
    }

    // Criar cabeçalho — status ABERTA
    const compra = await Compra.create({
      empresa_id: req.empresa_id,
      fornecedor_id: fornecedor_id || null,
      tipo_documento: tipo_documento || 'MANUAL',
      numero_nf: numero_nf || null,
      serie: serie || '1',
      chave_acesso: chave_acesso || null,
      data_emissao: data_emissao || null,
      data_entrada: data_entrada || new Date().toISOString().split('T')[0],
      valor_frete: parseFloat(valor_frete) || 0,
      valor_desconto: parseFloat(valor_desconto) || 0,
      valor_impostos: parseFloat(valor_impostos) || 0,
      valor_produtos: 0,
      valor_total: 0,
      status: 'ABERTA',
      observacoes: observacoes || null,
      usuario_id: req.usuario.id
    }, { transaction: t });

    // Se vieram itens, criar todos
    let valorProdutos = 0;
    if (itens && Array.isArray(itens) && itens.length > 0) {
      for (const item of itens) {
        const qtd = parseFloat(item.quantidade) || 1;
        const valorUnit = parseFloat(item.valor_unitario) || 0;
        const valorItem = parseFloat((valorUnit * qtd).toFixed(2));
        valorProdutos += valorItem;

        let produto = null;
        if (item.produto_id) {
          produto = await Produto.findOne({ where: { id: item.produto_id, empresa_id: req.empresa_id } });
        } else if (item.codigo_barras) {
          produto = await Produto.findOne({ where: { empresa_id: req.empresa_id, codigo_barras: item.codigo_barras, ativo: true } });
        }

        if (!produto && item.produto_nome) {
          produto = await Produto.create({
            empresa_id: req.empresa_id,
            nome: item.produto_nome,
            codigo_barras: item.codigo_barras || null,
            ncm: item.ncm || null,
            preco_custo: valorUnit,
            preco_venda: valorUnit,
            estoque_atual: 0,
            ativo: true
          }, { transaction: t });
        }

        await CompraItem.create({
          compra_id: compra.id,
          produto_id: produto ? produto.id : null,
          produto_nome: item.produto_nome || (produto ? produto.nome : 'Produto'),
          codigo_barras: item.codigo_barras || null,
          ncm: item.ncm || null,
          cfop: item.cfop || null,
          quantidade: qtd,
          valor_unitario: valorUnit,
          valor_total: valorItem,
          numero_lote: item.numero_lote || null,
          validade: item.validade || null
        }, { transaction: t });
      }

      const vFrete = parseFloat(valor_frete) || 0;
      const vDesc = parseFloat(valor_desconto) || 0;
      const vImp = parseFloat(valor_impostos) || 0;
      const vTotal = valorProdutos + vFrete + vImp - vDesc;

      await compra.update({
        valor_produtos: valorProdutos,
        valor_total: vTotal
      }, { transaction: t });
    }

    // Parcelas
    if (parcelas && Array.isArray(parcelas)) {
      for (const p of parcelas) {
        await CompraParcela.create({
          compra_id: compra.id,
          numero_parcela: p.numero_parcela,
          data_vencimento: p.data_vencimento,
          valor: p.valor,
          status: 'pendente'
        }, { transaction: t });
      }
    }

    await t.commit();

    const compraCompleta = await Compra.findByPk(compra.id, {
      include: [
        { model: Fornecedor, attributes: ['id', 'nome', 'cnpj_cpf'] },
        { model: CompraItem },
        { model: CompraParcela }
      ]
    });

    if (req.audit) await req.audit('criar', 'compras', compra.id, null, compra.toJSON(), 'Compra criada (ABERTA)');

    res.status(201).json(compraCompleta);
  } catch (error) {
    await t.rollback();
    logger.error('Erro criar compra:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao criar compra' });
  }
});

// ──────────────────────────────────────────────
//  POST /:id/itens  —  Adicionar item a compra ABERTA
// ──────────────────────────────────────────────
router.post('/:id/itens', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const compra = await Compra.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!compra) { await t.rollback(); return res.status(404).json({ error: 'Compra não encontrada' }); }
    if (compra.status !== 'ABERTA') { await t.rollback(); return res.status(400).json({ error: 'Só é possível adicionar itens em compras ABERTAS' }); }

    const { produto_id, produto_nome, codigo_barras, ncm, cfop, quantidade, valor_unitario, numero_lote, validade } = req.body;
    const qtd = parseFloat(quantidade) || 1;
    const valorUnit = parseFloat(valor_unitario) || 0;
    const valorItem = parseFloat((valorUnit * qtd).toFixed(2));

    let produto = null;
    if (produto_id) {
      produto = await Produto.findOne({ where: { id: produto_id, empresa_id: req.empresa_id } });
    } else if (codigo_barras) {
      produto = await Produto.findOne({ where: { empresa_id: req.empresa_id, codigo_barras, ativo: true } });
    }

    if (!produto && produto_nome) {
      produto = await Produto.create({
        empresa_id: req.empresa_id,
        nome: produto_nome,
        codigo_barras: codigo_barras || null,
        ncm: ncm || null,
        preco_custo: valorUnit,
        preco_venda: valorUnit,
        estoque_atual: 0,
        ativo: true
      }, { transaction: t });
    }

    const item = await CompraItem.create({
      compra_id: compra.id,
      produto_id: produto ? produto.id : null,
      produto_nome: produto_nome || (produto ? produto.nome : 'Produto'),
      codigo_barras: codigo_barras || null,
      ncm: ncm || null,
      cfop: cfop || null,
      quantidade: qtd,
      valor_unitario: valorUnit,
      valor_total: valorItem,
      numero_lote: numero_lote || null,
      validade: validade || null
    }, { transaction: t });

    // Recalcular totais
    const todosItens = await CompraItem.findAll({ where: { compra_id: compra.id }, transaction: t });
    const valorProdutos = todosItens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
    const vTotal = valorProdutos + parseFloat(compra.valor_frete || 0) + parseFloat(compra.valor_impostos || 0) - parseFloat(compra.valor_desconto || 0);

    await compra.update({ valor_produtos: valorProdutos, valor_total: vTotal }, { transaction: t });

    await t.commit();
    res.status(201).json(item);
  } catch (error) {
    await t.rollback();
    logger.error('Erro adicionar item:', { message: error.message });
    res.status(500).json({ error: 'Erro ao adicionar item' });
  }
});

// ──────────────────────────────────────────────
//  DELETE /:id/itens/:itemId  —  Remover item
// ──────────────────────────────────────────────
router.delete('/:id/itens/:itemId', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const compra = await Compra.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!compra) { await t.rollback(); return res.status(404).json({ error: 'Compra não encontrada' }); }
    if (compra.status !== 'ABERTA') { await t.rollback(); return res.status(400).json({ error: 'Só é possível remover itens de compras ABERTAS' }); }

    const item = await CompraItem.findOne({ where: { id: req.params.itemId, compra_id: compra.id } });
    if (!item) { await t.rollback(); return res.status(404).json({ error: 'Item não encontrado' }); }

    await item.destroy({ transaction: t });

    const todosItens = await CompraItem.findAll({ where: { compra_id: compra.id }, transaction: t });
    const valorProdutos = todosItens.reduce((s, i) => s + parseFloat(i.valor_total || 0), 0);
    const vTotal = valorProdutos + parseFloat(compra.valor_frete || 0) + parseFloat(compra.valor_impostos || 0) - parseFloat(compra.valor_desconto || 0);

    await compra.update({ valor_produtos: valorProdutos, valor_total: vTotal }, { transaction: t });

    await t.commit();
    res.json({ message: 'Item removido' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao remover item' });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id  —  Atualizar cabeçalho ABERTA
// ──────────────────────────────────────────────
router.put('/:id', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const compra = await Compra.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!compra) return res.status(404).json({ error: 'Compra não encontrada' });
    if (compra.status !== 'ABERTA') return res.status(400).json({ error: 'Só é possível editar compras ABERTAS' });

    const campos = ['fornecedor_id', 'numero_nf', 'serie', 'chave_acesso', 'data_emissao', 'data_entrada', 'valor_frete', 'valor_desconto', 'valor_impostos', 'observacoes'];
    const updates = {};
    for (const c of campos) {
      if (req.body[c] !== undefined) updates[c] = req.body[c];
    }

    if (updates.valor_frete !== undefined || updates.valor_desconto !== undefined || updates.valor_impostos !== undefined) {
      const vFrete = parseFloat(updates.valor_frete !== undefined ? updates.valor_frete : compra.valor_frete) || 0;
      const vDesc = parseFloat(updates.valor_desconto !== undefined ? updates.valor_desconto : compra.valor_desconto) || 0;
      const vImp = parseFloat(updates.valor_impostos !== undefined ? updates.valor_impostos : compra.valor_impostos) || 0;
      const vProd = parseFloat(compra.valor_produtos) || 0;
      updates.valor_total = vProd + vFrete + vImp - vDesc;
    }

    await compra.update(updates);
    res.json(compra);
  } catch (error) {
    logger.error('Erro atualizar compra:', { message: error.message });
    res.status(500).json({ error: 'Erro ao atualizar compra' });
  }
});

// ══════════════════════════════════════════════════════════════
//  PUT /:id/finalizar  —  FINALIZAR COMPRA
//  Executa atomicamente:
//    1. Ratear frete/desconto/impostos
//    2. Criar lotes (se controla_lote)
//    3. Atualizar estoque (estoque_atual += qtd)
//    4. Calcular custo médio ponderado
//    5. Registrar movimentações de estoque (origem=COMPRA)
//    6. Gerar contas a pagar (parcelas → financeiro)
//    7. Atualizar métricas do fornecedor
//    8. Marcar compra como FINALIZADA
// ══════════════════════════════════════════════════════════════
router.put('/:id/finalizar', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const compra = await Compra.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: CompraItem }, { model: CompraParcela }]
    });
    if (!compra) { await t.rollback(); return res.status(404).json({ error: 'Compra não encontrada' }); }
    if (compra.status !== 'ABERTA') { await t.rollback(); return res.status(400).json({ error: 'Apenas compras ABERTAS podem ser finalizadas' }); }
    if (!compra.CompraItems || compra.CompraItems.length === 0) { await t.rollback(); return res.status(400).json({ error: 'A compra precisa ter pelo menos um item' }); }

    const valorFrete = parseFloat(compra.valor_frete) || 0;
    const valorDesconto = parseFloat(compra.valor_desconto) || 0;
    const valorImpostos = parseFloat(compra.valor_impostos) || 0;

    // 1) Ratear custos
    const itensComRateio = ratearCustos(
      compra.CompraItems.map(i => i.toJSON()),
      valorFrete, valorDesconto, valorImpostos
    );

    // 2-5) Para cada item: lote + estoque + custo médio + movimentação
    for (const item of itensComRateio) {
      const qtd = parseFloat(item.quantidade) || 0;
      const custoFinalUnit = parseFloat(item.custo_final_unitario) || 0;

      // Salvar rateio no item
      await CompraItem.update({
        frete_rateado: item.frete_rateado,
        desconto_rateado: item.desconto_rateado,
        imposto_rateado: item.imposto_rateado,
        custo_final_unitario: custoFinalUnit
      }, { where: { id: item.id }, transaction: t });

      if (!item.produto_id) continue;

      const produto = await Produto.findByPk(item.produto_id, { transaction: t });
      if (!produto) continue;

      const estoqueAnterior = parseFloat(produto.estoque_atual) || 0;
      const estoqueNovo = estoqueAnterior + qtd;

      // Criar lote
      let loteId = null;
      if (item.numero_lote || produto.controla_lote || produto.controla_validade) {
        const lote = await Lote.create({
          empresa_id: req.empresa_id,
          produto_id: produto.id,
          compra_item_id: item.id,
          numero_lote: item.numero_lote || 'SL-' + Date.now(),
          validade: item.validade || null,
          quantidade_inicial: qtd,
          quantidade_atual: qtd,
          fornecedor_id: compra.fornecedor_id || null,
          data_entrada: compra.data_entrada || new Date(),
          custo_unitario: custoFinalUnit,
          status: 'ATIVO',
          ativo: true
        }, { transaction: t });
        loteId = lote.id;
        await CompraItem.update({ lote_id: lote.id }, { where: { id: item.id }, transaction: t });
      }

      // Custo médio ponderado
      const novoCustoMedio = calcularCustoMedio(
        estoqueAnterior,
        produto.preco_custo_medio || produto.preco_custo || 0,
        qtd,
        custoFinalUnit
      );

      await produto.update({
        estoque_atual: estoqueNovo,
        preco_custo: custoFinalUnit,
        preco_custo_medio: parseFloat(novoCustoMedio.toFixed(4)),
        ultimo_custo_pago: custoFinalUnit,
        ultima_compra: new Date()
      }, { transaction: t });

      // Margem
      const precoVenda = parseFloat(produto.preco_venda) || 0;
      if (custoFinalUnit > 0 && precoVenda > 0) {
        const margem = ((precoVenda - custoFinalUnit) / custoFinalUnit) * 100;
        await produto.update({ margem: parseFloat(margem.toFixed(2)) }, { transaction: t });
      }

      // Movimentação de estoque
      await EstoqueMovimentacao.create({
        empresa_id: req.empresa_id,
        produto_id: produto.id,
        lote_id: loteId,
        tipo: 'entrada',
        origem: 'COMPRA',
        quantidade: qtd,
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoqueNovo,
        custo_unitario: custoFinalUnit,
        motivo: 'Compra NF ' + (compra.numero_nf || 'S/N') + ' - Compra #' + compra.id,
        usuario_id: req.usuario.id,
        referencia: 'compra_' + compra.id,
        lote: item.numero_lote || null,
        validade: item.validade || null
      }, { transaction: t });

      // ── SNGPC: Auto-criar movimentação de entrada para controlados ──
      if (produto.controlado && loteId) {
        try {
          const hashStr = [produto.id, loteId, qtd, new Date().toISOString().split('T')[0], '', ''].join('|');
          await SngpcMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: produto.id,
            lote_id: loteId,
            tipo: 'entrada',
            quantidade: qtd,
            data_movimentacao: new Date().toISOString().split('T')[0],
            numero_documento: 'NF ' + (compra.numero_nf || 'S/N'),
            compra_id: compra.id,
            usuario_id: req.usuario.id,
            hash_integridade: crypto.createHash('sha256').update(hashStr).digest('hex')
          }, { transaction: t });
        } catch(sngpcErr) {
          logger.warn('SNGPC: Erro ao criar mov. entrada na compra', { message: sngpcErr.message });
        }

        // Atualizar nota_fiscal_compra no lote
        if (compra.numero_nf) {
          await Lote.update(
            { nota_fiscal_compra: compra.numero_nf },
            { where: { id: loteId }, transaction: t }
          );
        }
      }
    }

    // 6) Contas a pagar
    const parcelas = compra.CompraParcelas || [];
    if (parcelas.length > 0) {
      for (const p of parcelas) {
        await ContaPagar.create({
          empresa_id: req.empresa_id,
          descricao: 'NF ' + (compra.numero_nf || 'S/N') + ' - Parcela ' + p.numero_parcela,
          fornecedor_id: compra.fornecedor_id || null,
          valor: p.valor,
          data_vencimento: p.data_vencimento,
          categoria: 'fornecedor',
          status: 'pendente',
          observacoes: 'Gerado automaticamente pela Compra #' + compra.id,
          usuario_id: req.usuario.id
        }, { transaction: t });
      }
    }

    // 7) Métricas fornecedor
    if (compra.fornecedor_id) {
      const forn = await Fornecedor.findByPk(compra.fornecedor_id, { transaction: t });
      if (forn) {
        const novoTotal = parseFloat(forn.total_compras || 0) + parseFloat(compra.valor_total || 0);
        const novaQtd = parseInt(forn.quantidade_compras || 0) + 1;
        await forn.update({
          total_compras: novoTotal,
          quantidade_compras: novaQtd,
          valor_medio_compra: parseFloat((novoTotal / novaQtd).toFixed(2)),
          ultima_compra: new Date()
        }, { transaction: t });
      }
    }

    // 8) FINALIZAR
    await compra.update({
      status: 'FINALIZADA',
      finalizada_em: new Date(),
      finalizada_por: req.usuario.id
    }, { transaction: t });

    await t.commit();

    if (req.audit) await req.audit('finalizar', 'compras', compra.id, null, null, 'Compra #' + compra.id + ' finalizada');

    const compraFinal = await Compra.findByPk(compra.id, {
      include: [
        { model: Fornecedor, attributes: ['id', 'nome', 'cnpj_cpf'] },
        { model: CompraItem, include: [{ model: Produto, attributes: ['id', 'nome', 'codigo_barras'] }] },
        { model: CompraParcela }
      ]
    });

    res.json({ message: 'Compra finalizada com sucesso', compra: compraFinal });
  } catch (error) {
    await t.rollback();
    logger.error('Erro finalizar compra:', { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Erro ao finalizar compra: ' + (error.message || '') });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id/cancelar  —  Cancelar compra
// ──────────────────────────────────────────────
router.put('/:id/cancelar', auth, perfil('administrador'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const compra = await Compra.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: CompraItem }]
    });
    if (!compra) { await t.rollback(); return res.status(404).json({ error: 'Compra não encontrada' }); }
    if (compra.status === 'CANCELADA') { await t.rollback(); return res.status(400).json({ error: 'Compra já cancelada' }); }

    const motivo = req.body.motivo || 'Cancelamento pelo administrador';

    // Se FINALIZADA, reverter estoque
    if (compra.status === 'FINALIZADA') {
      for (const item of compra.CompraItems || []) {
        if (!item.produto_id) continue;

        const produto = await Produto.findByPk(item.produto_id, { transaction: t });
        if (!produto) continue;

        // Verificar quanto realmente resta no lote (pode ter sido parcialmente vendido)
        let qtdEstornar = parseFloat(item.quantidade) || 0;
        if (item.lote_id) {
          const lote = await Lote.findByPk(item.lote_id, { transaction: t });
          if (lote) {
            // Só estornar o que ainda resta no lote (não o total comprado)
            qtdEstornar = parseFloat(lote.quantidade_atual) || 0;
            await lote.update({ status: 'ESGOTADO', quantidade_atual: 0, ativo: false }, { transaction: t });
          }
        }

        const estoqueAnterior = parseFloat(produto.estoque_atual) || 0;
        const estoqueNovo = Math.max(0, estoqueAnterior - qtdEstornar);

        // Recalcular custo médio após estorno
        // Fórmula reversa: (Estoque_Atual × Custo_Médio - Qtd_Estornada × Custo_Compra) / (Estoque_Atual - Qtd_Estornada)
        let novoCustoMedio = parseFloat(produto.preco_custo_medio) || 0;
        const custoMedioAtual = parseFloat(produto.preco_custo_medio) || 0;
        const custoCompraItem = parseFloat(item.custo_final_unitario || item.valor_unitario) || 0;
        if (estoqueNovo > 0 && estoqueAnterior > 0) {
          novoCustoMedio = ((estoqueAnterior * custoMedioAtual) - (qtdEstornar * custoCompraItem)) / estoqueNovo;
          if (novoCustoMedio < 0) novoCustoMedio = custoMedioAtual; // fallback se der negativo
        } else if (estoqueNovo <= 0) {
          novoCustoMedio = 0; // sem estoque, custo zera
        }

        await produto.update({
          estoque_atual: estoqueNovo,
          preco_custo_medio: parseFloat(novoCustoMedio.toFixed(4))
        }, { transaction: t });

        if (qtdEstornar > 0) {
          await EstoqueMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            lote_id: item.lote_id || null,
            tipo: 'saida',
            origem: 'CANCELAMENTO',
            quantidade: qtdEstornar,
            estoque_anterior: estoqueAnterior,
            estoque_posterior: estoqueNovo,
            custo_unitario: custoCompraItem,
            motivo: 'Cancelamento Compra #' + compra.id + ' - ' + motivo + (qtdEstornar < parseFloat(item.quantidade) ? ' (estorno parcial: ' + qtdEstornar + '/' + item.quantidade + ')' : ''),
            usuario_id: req.usuario.id,
            referencia: 'cancel_compra_' + compra.id
          }, { transaction: t });
        }
      }

      await ContaPagar.update(
        { status: 'cancelado' },
        { where: { observacoes: { [Op.like]: '%Compra #' + compra.id + '%' }, empresa_id: req.empresa_id, status: 'pendente' }, transaction: t }
      );
    }

    await compra.update({
      status: 'CANCELADA',
      cancelada_em: new Date(),
      cancelada_por: req.usuario.id,
      motivo_cancelamento: motivo
    }, { transaction: t });

    await t.commit();

    if (req.audit) await req.audit('cancelar', 'compras', compra.id, null, null, 'Compra #' + compra.id + ' cancelada');

    res.json({ message: 'Compra cancelada', compra });
  } catch (error) {
    await t.rollback();
    logger.error('Erro cancelar compra:', { message: error.message });
    res.status(500).json({ error: 'Erro ao cancelar compra' });
  }
});

// ──────────────────────────────────────────────
//  POST /xml  —  Parse XML e retorna dados
// ──────────────────────────────────────────────
router.post('/xml', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { xml_content } = req.body;
    if (!xml_content) return res.status(400).json({ error: 'Conteúdo XML obrigatório' });

    const getTag = (xml, tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };

    const getTagBlock = (xml, tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
      const matches = [];
      let m;
      while ((m = regex.exec(xml)) !== null) matches.push(m[1]);
      return matches;
    };

    const nNF = getTag(xml_content, 'nNF');
    const serie = getTag(xml_content, 'serie');
    const chaveAcesso = getTag(xml_content, 'chNFe') || '';

    const emitBlock = getTagBlock(xml_content, 'emit')[0] || '';
    const emitNome = getTag(emitBlock, 'xNome');
    const emitCnpj = getTag(emitBlock, 'CNPJ');

    const totalBlock = getTagBlock(xml_content, 'ICMSTot')[0] || '';
    const vNF = getTag(totalBlock, 'vNF') || '0';
    const vFrete = getTag(totalBlock, 'vFrete') || '0';
    const vDesc = getTag(totalBlock, 'vDesc') || '0';
    const vIPI = getTag(totalBlock, 'vIPI') || '0';
    const vST = getTag(totalBlock, 'vST') || '0';

    const dhEmi = getTag(xml_content, 'dhEmi') || '';
    const dataEmissao = dhEmi ? dhEmi.substring(0, 10) : '';

    const detBlocks = getTagBlock(xml_content, 'det');
    const itens = detBlocks.map(det => {
      const prodBlock = getTagBlock(det, 'prod')[0] || det;
      return {
        produto_nome: getTag(prodBlock, 'xProd'),
        codigo_barras: getTag(prodBlock, 'cEAN') || getTag(prodBlock, 'cEANTrib') || '',
        ncm: getTag(prodBlock, 'NCM'),
        cfop: getTag(prodBlock, 'CFOP'),
        quantidade: parseFloat(getTag(prodBlock, 'qCom')) || 1,
        valor_unitario: parseFloat(getTag(prodBlock, 'vUnCom')) || 0,
        valor_total: parseFloat(getTag(prodBlock, 'vProd')) || 0
      };
    });

    const dupBlocks = getTagBlock(xml_content, 'dup');
    const parcelas = dupBlocks.map((dup, i) => ({
      numero_parcela: i + 1,
      data_vencimento: getTag(dup, 'dVenc'),
      valor: parseFloat(getTag(dup, 'vDup')) || 0
    }));

    if (nNF && emitCnpj) {
      const fornExistente = await Fornecedor.findOne({
        where: { empresa_id: req.empresa_id, cnpj_cpf: { [Op.iLike]: `%${emitCnpj}%` } }
      });
      if (fornExistente) {
        const nfExistente = await Compra.findOne({
          where: { empresa_id: req.empresa_id, numero_nf: nNF, fornecedor_id: fornExistente.id, status: { [Op.ne]: 'CANCELADA' } }
        });
        if (nfExistente) {
          return res.status(400).json({ error: 'Nota já lançada.' });
        }
      }
    }

    res.json({
      tipo_documento: 'NFE',
      numero_nf: nNF,
      serie,
      chave_acesso: chaveAcesso,
      data_emissao: dataEmissao,
      fornecedor: emitNome,
      cnpj_fornecedor: emitCnpj,
      valor_total: parseFloat(vNF),
      valor_frete: parseFloat(vFrete),
      valor_desconto: parseFloat(vDesc),
      valor_impostos: parseFloat(vIPI) + parseFloat(vST),
      itens,
      parcelas
    });
  } catch (error) {
    logger.error('Erro XML parse:', { message: error.message });
    res.status(500).json({ error: 'Erro ao processar XML' });
  }
});

module.exports = router;
