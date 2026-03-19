const router = require('express').Router();
const crypto = require('crypto');
const { sequelize, Venda, VendaItem, Produto, Caixa, EstoqueMovimentacao, ContaReceber, Cliente, Usuario, Lote, HistoricoAplicacaoPrograma, LogDesconto, LogPdv, SngpcMovimentacao, MedicamentoControlado } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// ═══════════════════════════════════════════════
//  LISTAR VENDAS (paginado)
// ═══════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const where = { empresa_id: req.empresa_id };

    // Filtros de período
    if (req.query.data_inicio || req.query.data_fim) {
      where.created_at = {};
      if (req.query.data_inicio) where.created_at[Op.gte] = new Date(req.query.data_inicio);
      if (req.query.data_fim) where.created_at[Op.lte] = new Date(req.query.data_fim + 'T23:59:59');
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.forma_pagamento) where.forma_pagamento = req.query.forma_pagamento;
    if (req.query.cliente_id) where.cliente_id = req.query.cliente_id;
    // Busca por número ou nome do cliente
    if (req.query.busca) {
      const busca = req.query.busca.trim();
      const num = parseInt(busca);
      if (!isNaN(num) && String(num) === busca) {
        where.numero = num;
      } else {
        where.cliente_nome = { [Op.iLike]: '%' + busca + '%' };
      }
    }
    // Faixa de valor
    if (req.query.valor_min || req.query.valor_max) {
      where.total = {};
      if (req.query.valor_min) where.total[Op.gte] = parseFloat(req.query.valor_min);
      if (req.query.valor_max) where.total[Op.lte] = parseFloat(req.query.valor_max);
    }

    const limit = Math.min(parseInt(req.query.limit) || 25, 200);
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const { count, rows } = await Venda.findAndCountAll({
      where,
      include: [
        { model: VendaItem },
        { model: Usuario, attributes: ['id', 'nome'] },
        { model: Cliente, attributes: ['id', 'nome', 'cpf'], required: false }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    // Resumo agregado do filtro inteiro (para cards)
    const resumoRaw = await Venda.findOne({
      attributes: [
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status='finalizada' THEN total ELSE 0 END")), 'faturamento'],
        [sequelize.fn('AVG', sequelize.literal("CASE WHEN status='finalizada' THEN total END")), 'ticket_medio'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status='cancelada' THEN 1 END")), 'canceladas'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status='finalizada' THEN 1 END")), 'finalizadas']
      ],
      where,
      raw: true
    });

    res.json({
      data: rows, total: count, page, pages: Math.ceil(count / limit),
      resumo: {
        faturamento: parseFloat(resumoRaw.faturamento) || 0,
        ticket_medio: parseFloat(resumoRaw.ticket_medio) || 0,
        canceladas: parseInt(resumoRaw.canceladas) || 0,
        finalizadas: parseInt(resumoRaw.finalizadas) || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

// ═══════════════════════════════════════════════
//  DETALHES DE UMA VENDA
// ═══════════════════════════════════════════════
router.get('/:id', auth, async (req, res) => {
  try {
    const venda = await Venda.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [
        { model: VendaItem, include: [{ model: Produto }] },
        { model: Usuario, attributes: ['id', 'nome'] },
        { model: Cliente, attributes: ['id', 'nome', 'cpf', 'telefone'], required: false }
      ]
    });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
    res.json(venda);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

// ═══════════════════════════════════════════════
//  REGISTRAR VENDA (PDV) — v2.0
// ═══════════════════════════════════════════════
router.post('/', auth, async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { itens, desconto, acrescimo, forma_pagamento, 
            valor_dinheiro, valor_pix, valor_debito, valor_credito,
            cliente_nome, cliente_cpf, cliente_id, observacoes, parcelas,
            desconto_manual_total, desconto_automatico_total,
            gerente_autorizador_id, log_descontos_cliente } = req.body;

    if (!itens || itens.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Venda deve ter pelo menos um item' });
    }

    // Verificar caixa aberto
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    if (!caixa) {
      await t.rollback();
      return res.status(400).json({ error: 'Nenhum caixa aberto. Abra o caixa primeiro.' });
    }

    // Calcular número da venda
    const ultimaVenda = await Venda.findOne({
      where: { empresa_id: req.empresa_id },
      order: [['numero', 'DESC']]
    });
    const numero = (ultimaVenda?.numero || 0) + 1;

    // Calcular subtotal e custo dos itens
    let subtotal = 0;
    let custoTotal = 0;
    const itensProcessados = [];

    for (const item of itens) {
      const produto = await Produto.findOne({
        where: { id: item.produto_id, empresa_id: req.empresa_id, ativo: true },
        lock: t.LOCK.UPDATE,
        transaction: t
      });

      if (!produto) {
        await t.rollback();
        return res.status(400).json({ error: `Produto ID ${item.produto_id} não encontrado` });
      }

      // ── SNGPC: Validar produto controlado ──
      if (produto.controlado) {
        const sngpc = item.sngpc || {};
        if (!sngpc.lote_id) {
          await t.rollback();
          return res.status(400).json({ error: `Produto controlado "${produto.nome}" exige seleção de lote` });
        }
        if (produto.necessita_receita) {
          if (!sngpc.cpf_paciente || !sngpc.nome_paciente || !sngpc.nome_medico ||
              !sngpc.crm_medico || !sngpc.uf_crm || !sngpc.numero_receita || !sngpc.data_receita) {
            await t.rollback();
            return res.status(400).json({ error: `Produto controlado "${produto.nome}" exige dados completos da receita (paciente, médico, CRM, receita)` });
          }
        }
        // Validar lote específico
        const loteControlado = await Lote.findOne({
          where: { id: sngpc.lote_id, produto_id: produto.id, empresa_id: req.empresa_id, status: 'ATIVO' },
          lock: t.LOCK.UPDATE, transaction: t
        });
        if (!loteControlado) { await t.rollback(); return res.status(400).json({ error: `Lote não encontrado ou esgotado para "${produto.nome}"` }); }
        if (parseFloat(loteControlado.quantidade_atual) < parseFloat(item.quantidade)) {
          await t.rollback();
          return res.status(400).json({ error: `Estoque insuficiente no lote ${loteControlado.numero_lote} para "${produto.nome}". Disponível: ${loteControlado.quantidade_atual}` });
        }
        const hojeSngpc = new Date().toISOString().split('T')[0];
        if (loteControlado.validade && loteControlado.validade < hojeSngpc) {
          await t.rollback();
          return res.status(400).json({ error: `Lote ${loteControlado.numero_lote} vencido! Validade: ${loteControlado.validade}` });
        }
      }

      const quantidade = parseFloat(item.quantidade);
      
      // Validar estoque (respeita flag permite_estoque_negativo)
      if (!produto.permite_estoque_negativo && parseFloat(produto.estoque_atual) < quantidade) {
        await t.rollback();
        return res.status(400).json({ 
          error: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque_atual}` 
        });
      }

      const preco = parseFloat(item.preco_unitario || produto.preco_venda);
      const precoCusto = parseFloat(produto.preco_custo || 0);
      const descontoItem = parseFloat(item.desconto_item || 0);
      const subtotalItem = (preco * quantidade) - descontoItem;
      const custoItem = precoCusto * quantidade;

      itensProcessados.push({
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade,
        preco_unitario: preco,
        preco_custo: precoCusto,
        desconto_item: descontoItem,
        subtotal: subtotalItem,
        ncm: produto.ncm || null,
        cfop: produto.cfop || null,
        aliquota_icms: produto.aliquota_icms || 0,
        // Motor de Descontos — auditoria completa
        programa_id: item.programa_id || null,
        preco_original: item.preco_original ? parseFloat(item.preco_original) : null,
        preco_aplicado: item.preco_aplicado ? parseFloat(item.preco_aplicado) : null,
        desconto_total: item.desconto_total ? parseFloat(item.desconto_total) : (item.desconto_programa ? parseFloat(item.desconto_programa) : 0),
        desconto_programa: item.desconto_programa ? parseFloat(item.desconto_programa) : 0,
        tipo_desconto: item.tipo_desconto || null,
        valor_desconto: item.valor_desconto ? parseFloat(item.valor_desconto) : null,
        programa_nome: item.programa_nome || null,
        origem_desconto: item.origem_desconto || null,
        _sngpc: item.sngpc || null,
        produto // referência para atualizar estoque
      });

      subtotal += subtotalItem;
      custoTotal += custoItem;
    }

    const descontoTotal = parseFloat(desconto || 0);
    const acrescimoTotal = parseFloat(acrescimo || 0);
    const total = subtotal - descontoTotal + acrescimoTotal;
    const lucroEstimado = total - custoTotal;

    // Calcular troco
    const totalPago = parseFloat(valor_dinheiro || 0) + parseFloat(valor_pix || 0) + 
                      parseFloat(valor_debito || 0) + parseFloat(valor_credito || 0);
    const troco = totalPago > total ? totalPago - total : 0;

    // Extrair IP do terminal
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.connection?.remoteAddress || req.ip;

    // Criar venda — com snapshot de integridade (congelado, NUNCA recalcular)
    const venda = await Venda.create({
      empresa_id: req.empresa_id,
      caixa_id: caixa.id,
      usuario_id: req.usuario.id,
      cliente_id: cliente_id || null,
      numero,
      cliente_nome,
      cliente_cpf,
      subtotal,
      desconto: descontoTotal,
      acrescimo: acrescimoTotal,
      total,
      custo_total: custoTotal,
      lucro_estimado: lucroEstimado,
      forma_pagamento: forma_pagamento || 'dinheiro',
      valor_dinheiro: valor_dinheiro || 0,
      valor_pix: valor_pix || 0,
      valor_debito: valor_debito || 0,
      valor_credito: valor_credito || 0,
      troco,
      observacoes,
      // ── Snapshot de integridade (Prioridade 5) ──
      subtotal_bruto: subtotal,
      desconto_automatico_total: parseFloat(desconto_automatico_total || 0),
      desconto_manual_total: parseFloat(desconto_manual_total || descontoTotal),
      versao_sistema: '5.0',
      ip_terminal: ip,
      operador_nome: req.usuario ? req.usuario.nome : null
    }, { transaction: t });

    // Criar itens e atualizar estoque
    for (const item of itensProcessados) {
      const vendaItem = await VendaItem.create({
        venda_id: venda.id,
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_custo: item.preco_custo,
        desconto_item: item.desconto_item,
        subtotal: item.subtotal,
        ncm: item.ncm,
        cfop: item.cfop,
        aliquota_icms: item.aliquota_icms,
        // Motor de Descontos — auditoria completa
        programa_id: item.programa_id,
        preco_original: item.preco_original,
        preco_aplicado: item.preco_aplicado,
        desconto_total: item.desconto_total,
        desconto_programa: item.desconto_programa,
        tipo_desconto: item.tipo_desconto,
        valor_desconto: item.valor_desconto,
        programa_nome: item.programa_nome,
        origem_desconto: item.origem_desconto
      }, { transaction: t });

      // Historico de aplicação de programa (auditoria granular)
      if (item.programa_id && item.origem_desconto) {
        try {
          const origemData = typeof item.origem_desconto === 'string' ? JSON.parse(item.origem_desconto) : item.origem_desconto;
          const regrasApl = origemData.regras_aplicadas || [];
          for (const ra of regrasApl) {
            await HistoricoAplicacaoPrograma.create({
              empresa_id: req.empresa_id,
              venda_id: venda.id,
              item_venda_id: vendaItem.id,
              programa_id: ra.programa_id || item.programa_id,
              regra_id: ra.regra_id || 0,
              valor_aplicado: ra.desconto_calculado || item.desconto_total || 0,
              tipo_regra: ra.tipo_regra || item.tipo_desconto,
              escopo: ra.escopo || null,
              preco_original: item.preco_original,
              preco_final: item.preco_aplicado
            }, { transaction: t });
          }
        } catch(parseErr) { /* silencioso — não impede a venda */ }
      }

      // Atualizar estoque
      const estoqueAnterior = parseFloat(item.produto.estoque_atual);
      const estoqueNovo = estoqueAnterior - item.quantidade;
      
      await Produto.update(
        { estoque_atual: estoqueNovo, ultima_venda: new Date() },
        { where: { id: item.produto_id }, transaction: t }
      );

      // ── SNGPC: Consumo de lote específico para controlados ──
      if (item.produto.controlado && item._sngpc?.lote_id) {
        const loteCtrl = await Lote.findOne({
          where: { id: item._sngpc.lote_id, empresa_id: req.empresa_id },
          lock: t.LOCK.UPDATE, transaction: t
        });
        if (loteCtrl) {
          const consumir = item.quantidade;
          const novaQtdCtrl = parseFloat(loteCtrl.quantidade_atual) - consumir;
          await loteCtrl.update({
            quantidade_atual: Math.max(0, novaQtdCtrl),
            status: novaQtdCtrl <= 0 ? 'ESGOTADO' : 'ATIVO',
            ativo: novaQtdCtrl > 0
          }, { transaction: t });

          await EstoqueMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            lote_id: loteCtrl.id,
            tipo: 'saida', origem: 'VENDA',
            quantidade: consumir,
            estoque_anterior: estoqueAnterior,
            estoque_posterior: estoqueNovo,
            motivo: `Venda #${numero} - Controlado - Lote ${loteCtrl.numero_lote}`,
            usuario_id: req.usuario.id,
            referencia: `venda_${venda.id}`,
            custo_unitario: loteCtrl.custo_unitario || item.preco_custo
          }, { transaction: t });

          // Movimentação SNGPC imutável
          const hashStr = [item.produto_id, loteCtrl.id, consumir, new Date().toISOString().split('T')[0], item._sngpc.cpf_paciente || '', item._sngpc.crm_medico || ''].join('|');
          await SngpcMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            lote_id: loteCtrl.id,
            tipo: 'saida',
            quantidade: consumir,
            data_movimentacao: new Date().toISOString().split('T')[0],
            cpf_paciente: item._sngpc.cpf_paciente || null,
            nome_paciente: item._sngpc.nome_paciente || null,
            nome_medico: item._sngpc.nome_medico || null,
            crm_medico: item._sngpc.crm_medico || null,
            uf_crm: item._sngpc.uf_crm || null,
            numero_receita: item._sngpc.numero_receita || null,
            data_receita: item._sngpc.data_receita || null,
            usuario_id: req.usuario.id,
            venda_id: venda.id,
            hash_integridade: crypto.createHash('sha256').update(hashStr).digest('hex')
          }, { transaction: t });

          // MedicamentoControlado legado
          try {
            await MedicamentoControlado.create({
              empresa_id: req.empresa_id,
              venda_id: venda.id,
              produto_id: item.produto_id,
              cliente_cpf: item._sngpc.cpf_paciente || req.body.cliente_cpf || '',
              cliente_nome: item._sngpc.nome_paciente || req.body.cliente_nome || '',
              medico_nome: item._sngpc.nome_medico,
              medico_crm: item._sngpc.crm_medico,
              medico_uf: item._sngpc.uf_crm,
              numero_receita: item._sngpc.numero_receita,
              data_receita: item._sngpc.data_receita,
              tipo_receita: item.produto.tipo_receita || 'branca',
              farmaceutico_id: req.usuario.id,
              quantidade_dispensada: consumir,
              lote: loteCtrl.numero_lote,
              data_venda: new Date()
            }, { transaction: t });
          } catch(mcErr) { /* não impede a venda */ }
        }
      } else if (item.produto.controla_lote || item.produto.controla_validade) {
      // FIFO: consumir lotes por ordem de validade (mais antigo primeiro)
        let qtdRestante = item.quantidade;
        const hoje = new Date().toISOString().split('T')[0];
        const lotesAtivos = await Lote.findAll({
          where: { 
            empresa_id: req.empresa_id, 
            produto_id: item.produto_id, 
            status: 'ATIVO',
            quantidade_atual: { [require('sequelize').Op.gt]: 0 },
            // Excluir lotes vencidos do consumo automático
            [require('sequelize').Op.or]: [
              { validade: null },
              { validade: { [require('sequelize').Op.gte]: hoje } }
            ]
          },
          order: [['validade', 'ASC NULLS LAST'], ['data_entrada', 'ASC']],
          lock: t.LOCK.UPDATE,
          transaction: t
        });
        for (const lote of lotesAtivos) {
          if (qtdRestante <= 0) break;
          const qtdLote = parseFloat(lote.quantidade_atual);
          const consumir = Math.min(qtdLote, qtdRestante);
          const novaQtd = qtdLote - consumir;
          const novoStatus = novaQtd <= 0 ? 'ESGOTADO' : 'ATIVO';
          await lote.update({ 
            quantidade_atual: novaQtd, 
            status: novoStatus, 
            ativo: novaQtd > 0 
          }, { transaction: t });

          // Movimentação por lote consumido (rastreabilidade)
          await EstoqueMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            lote_id: lote.id,
            tipo: 'saida',
            origem: 'VENDA',
            quantidade: consumir,
            estoque_anterior: estoqueAnterior,
            estoque_posterior: estoqueNovo,
            motivo: `Venda #${numero} - Lote ${lote.numero_lote}`,
            usuario_id: req.usuario.id,
            referencia: `venda_${venda.id}`,
            custo_unitario: lote.custo_unitario || item.preco_custo
          }, { transaction: t });

          qtdRestante -= consumir;
        }
      } else {
        // Produto sem controle de lote: movimentação única
        await EstoqueMovimentacao.create({
          empresa_id: req.empresa_id,
          produto_id: item.produto_id,
          tipo: 'saida',
          origem: 'VENDA',
          quantidade: item.quantidade,
          estoque_anterior: estoqueAnterior,
          estoque_posterior: estoqueNovo,
          motivo: `Venda #${numero}`,
          usuario_id: req.usuario.id,
          referencia: `venda_${venda.id}`,
          custo_unitario: item.preco_custo
        }, { transaction: t });
      }
    }

    // Atualizar totais do caixa
    await caixa.update({
      total_vendas: parseFloat(caixa.total_vendas) + total,
      quantidade_vendas: (caixa.quantidade_vendas || 0) + 1,
      total_dinheiro: parseFloat(caixa.total_dinheiro) + parseFloat(valor_dinheiro || 0),
      total_pix: parseFloat(caixa.total_pix) + parseFloat(valor_pix || 0),
      total_debito: parseFloat(caixa.total_debito) + parseFloat(valor_debito || 0),
      total_credito: parseFloat(caixa.total_credito) + parseFloat(valor_credito || 0)
    }, { transaction: t });

    // Atualizar métricas do cliente (se vinculado)
    if (cliente_id) {
      const cliente = await Cliente.findOne({
        where: { id: cliente_id, empresa_id: req.empresa_id },
        transaction: t
      });
      if (cliente) {
        const novoTotalCompras = parseFloat(cliente.total_compras || 0) + total;
        const novaQtdCompras = (cliente.quantidade_compras || 0) + 1;
        await cliente.update({
          total_compras: novoTotalCompras,
          quantidade_compras: novaQtdCompras,
          ticket_medio: novoTotalCompras / novaQtdCompras,
          ultima_compra: new Date()
        }, { transaction: t });
      }
    }

    // Se venda parcelada, criar contas a receber
    if (parcelas && parcelas > 1) {
      const valorParcela = (total / parcelas).toFixed(2);
      for (let i = 1; i <= parcelas; i++) {
        const vencimento = new Date();
        vencimento.setMonth(vencimento.getMonth() + i);
        
        await ContaReceber.create({
          empresa_id: req.empresa_id,
          descricao: `Venda #${numero} - Parcela ${i}/${parcelas}`,
          cliente_nome,
          cliente_cpf,
          cliente_id: cliente_id || null,
          valor: valorParcela,
          data_vencimento: vencimento,
          venda_id: venda.id,
          parcela: `${i}/${parcelas}`,
          usuario_id: req.usuario.id
        }, { transaction: t });
      }
    }

    await t.commit();

    // ── Auditoria Prioridade 5: Registrar logs APÓS commit (fire-and-forget) ──
    try {
      // 1. Audit log principal
      if (req.audit) {
        await req.audit('criar', 'vendas', venda.id, null, { 
          numero, total, subtotal, desconto: descontoTotal, cliente_id 
        }, `Venda #${numero} finalizada - Total: R$ ${total.toFixed(2)}`);
      }

      // 2. Log de descontos de cada item (automáticos do motor)
      const logsDesconto = [];
      for (const item of itensProcessados) {
        if (item.desconto_total > 0 && item.programa_id) {
          logsDesconto.push({
            empresa_id: req.empresa_id,
            venda_id: venda.id,
            tipo_desconto: 'automatico',
            regra_id: item.regra_aplicada_id || null,
            programa_id: item.programa_id,
            produto_id: item.produto_id,
            valor_original: item.preco_original || item.preco_unitario,
            valor_desconto: item.desconto_total,
            percentual_desconto: item.preco_original > 0 ? ((item.desconto_total / item.preco_original) * 100) : 0,
            valor_final: item.preco_aplicado || (item.preco_unitario - item.desconto_total),
            usuario_id: req.usuario.id,
            ip,
            data_hora: new Date()
          });
        }
      }

      // 3. Log de desconto manual global (se houver)
      if (descontoTotal > 0 && (!desconto_automatico_total || descontoTotal > parseFloat(desconto_automatico_total || 0))) {
        const descontoManual = descontoTotal - parseFloat(desconto_automatico_total || 0);
        if (descontoManual > 0) {
          logsDesconto.push({
            empresa_id: req.empresa_id,
            venda_id: venda.id,
            tipo_desconto: gerente_autorizador_id ? 'manual_gerente' : 'manual',
            produto_id: null,
            valor_original: subtotal,
            valor_desconto: descontoManual,
            percentual_desconto: subtotal > 0 ? ((descontoManual / subtotal) * 100) : 0,
            valor_final: subtotal - descontoManual,
            usuario_id: req.usuario.id,
            gerente_autorizador_id: gerente_autorizador_id || null,
            ip,
            data_hora: new Date()
          });
        }
      }

      if (logsDesconto.length > 0) {
        await LogDesconto.bulkCreate(logsDesconto);
      }

      // 4. Log PDV — finalização
      await LogPdv.create({
        empresa_id: req.empresa_id,
        venda_id: venda.id,
        usuario_id: req.usuario.id,
        acao: 'FINALIZAR_VENDA',
        estado_anterior: 'EM_PAGAMENTO',
        estado_novo: 'FINALIZADA',
        detalhes: { numero, total, forma_pagamento, itens_count: itens.length },
        ip,
        data_hora: new Date()
      });

    } catch (auditErr) {
      // Audit nunca deve impedir o fluxo — a venda já foi commitada
      console.error('[Audit] Erro ao registrar logs pós-venda:', auditErr.message);
    }

    // Recarregar venda com itens
    const vendaCompleta = await Venda.findByPk(venda.id, {
      include: [{ model: VendaItem }]
    });

    res.status(201).json(vendaCompleta);
  } catch (error) {
    await t.rollback();
    console.error('Erro na venda:', error);
    res.status(500).json({ error: 'Erro ao registrar venda' });
  }
});

// ═══════════════════════════════════════════════
//  SALVAR SNAPSHOT DO CUPOM (fire-and-forget do PDV)
// ═══════════════════════════════════════════════
router.put('/:id/snapshot', auth, async (req, res) => {
  try {
    const { snapshot_cupom, tipo_documento_emitido } = req.body;
    const venda = await Venda.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    const updateData = {};
    if (snapshot_cupom) updateData.snapshot_cupom = snapshot_cupom;
    if (tipo_documento_emitido) updateData.tipo_documento_emitido = tipo_documento_emitido;
    if (!venda.operador_nome && req.usuario && req.usuario.nome) {
      updateData.operador_nome = req.usuario.nome;
    }

    await venda.update(updateData);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao salvar snapshot:', error);
    res.status(500).json({ error: 'Erro ao salvar snapshot' });
  }
});

// ═══════════════════════════════════════════════
//  CANCELAR VENDA
// ═══════════════════════════════════════════════
router.put('/:id/cancelar', auth, perfil('administrador', 'gerente'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const venda = await Venda.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ model: VendaItem }]
    });
    if (!venda) { await t.rollback(); return res.status(404).json({ error: 'Venda não encontrada' }); }
    if (venda.status === 'cancelada') { await t.rollback(); return res.status(400).json({ error: 'Venda já cancelada' }); }

    // Devolver estoque e restaurar lotes
    for (const item of venda.VendaItems) {
      const produto = await Produto.findOne({
        where: { id: item.produto_id, empresa_id: req.empresa_id }
      });
      if (produto) {
        const estoqueAnterior = parseFloat(produto.estoque_atual);
        const estoqueNovo = estoqueAnterior + parseFloat(item.quantidade);
        await produto.update({ estoque_atual: estoqueNovo }, { transaction: t });

        // Restaurar lotes consumidos via movimentações registradas na venda
        const movimentacoesLote = await EstoqueMovimentacao.findAll({
          where: {
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            referencia: `venda_${venda.id}`,
            tipo: 'saida',
            lote_id: { [require('sequelize').Op.ne]: null }
          },
          transaction: t
        });

        if (movimentacoesLote.length > 0) {
          // Restaurar cada lote individualmente
          for (const mov of movimentacoesLote) {
            const lote = await Lote.findByPk(mov.lote_id, { transaction: t });
            if (lote) {
              const qtdAtual = parseFloat(lote.quantidade_atual);
              const qtdRestaurada = qtdAtual + parseFloat(mov.quantidade);
              await lote.update({
                quantidade_atual: qtdRestaurada,
                status: 'ATIVO',
                ativo: true
              }, { transaction: t });

              // Movimentação de devolução por lote
              await EstoqueMovimentacao.create({
                empresa_id: req.empresa_id,
                produto_id: item.produto_id,
                lote_id: lote.id,
                tipo: 'devolucao',
                origem: 'CANCELAMENTO',
                quantidade: mov.quantidade,
                estoque_anterior: estoqueAnterior,
                estoque_posterior: estoqueNovo,
                motivo: `Cancelamento venda #${venda.numero} - Lote ${lote.numero_lote}`,
                usuario_id: req.usuario.id,
                referencia: `cancelamento_venda_${venda.id}`
              }, { transaction: t });
            }
          }
        } else {
          // Produto sem lote: movimentação única de devolução
          await EstoqueMovimentacao.create({
            empresa_id: req.empresa_id,
            produto_id: item.produto_id,
            tipo: 'devolucao',
            origem: 'CANCELAMENTO',
            quantidade: item.quantidade,
            estoque_anterior: estoqueAnterior,
            estoque_posterior: estoqueNovo,
            motivo: `Cancelamento venda #${venda.numero}`,
            usuario_id: req.usuario.id,
            referencia: `cancelamento_venda_${venda.id}`
          }, { transaction: t });
        }
      }
    }

    // Reverter métricas do cliente
    if (venda.cliente_id) {
      const cliente = await Cliente.findOne({
        where: { id: venda.cliente_id, empresa_id: req.empresa_id },
        transaction: t
      });
      if (cliente) {
        const novoTotal = Math.max(0, parseFloat(cliente.total_compras || 0) - parseFloat(venda.total));
        const novaQtd = Math.max(0, (cliente.quantidade_compras || 0) - 1);
        await cliente.update({
          total_compras: novoTotal,
          quantidade_compras: novaQtd,
          ticket_medio: novaQtd > 0 ? novoTotal / novaQtd : 0
        }, { transaction: t });
      }
    }

    // Atualizar caixa
    const caixa = await Caixa.findOne({
      where: { id: venda.caixa_id, empresa_id: req.empresa_id }
    });
    if (caixa && caixa.status === 'aberto') {
      await caixa.update({
        total_vendas: parseFloat(caixa.total_vendas) - parseFloat(venda.total),
        quantidade_vendas: Math.max(0, (caixa.quantidade_vendas || 0) - 1),
        total_dinheiro: parseFloat(caixa.total_dinheiro) - parseFloat(venda.valor_dinheiro),
        total_pix: parseFloat(caixa.total_pix) - parseFloat(venda.valor_pix),
        total_debito: parseFloat(caixa.total_debito) - parseFloat(venda.valor_debito),
        total_credito: parseFloat(caixa.total_credito) - parseFloat(venda.valor_credito)
      }, { transaction: t });
    }

    await venda.update({ 
      status: 'cancelada',
      motivo_cancelamento: req.body.motivo || 'Sem motivo informado',
      cancelado_por: req.usuario.id,
      cancelado_em: new Date()
    }, { transaction: t });
    await t.commit();

    // ── Auditoria Prioridade 5: Registrar cancelamento (fire-and-forget) ──
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.connection?.remoteAddress || req.ip;

      if (req.audit) {
        await req.audit('cancelar', 'vendas', venda.id, 
          { status: 'finalizada' }, 
          { status: 'cancelada', motivo: req.body.motivo },
          `Venda #${venda.numero} cancelada por ${req.usuario.nome} - Motivo: ${req.body.motivo || 'Sem motivo'}`
        );
      }

      await LogPdv.create({
        empresa_id: req.empresa_id,
        venda_id: venda.id,
        usuario_id: req.usuario.id,
        acao: 'CANCELAR_VENDA',
        estado_anterior: 'FINALIZADA',
        estado_novo: 'CANCELADA',
        detalhes: { numero: venda.numero, total: venda.total, motivo: req.body.motivo },
        ip,
        data_hora: new Date()
      });
    } catch (auditErr) {
      console.error('[Audit] Erro ao registrar log de cancelamento:', auditErr.message);
    }

    res.json({ message: 'Venda cancelada com sucesso', motivo: req.body.motivo });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Erro ao cancelar venda' });
  }
});

module.exports = router;
