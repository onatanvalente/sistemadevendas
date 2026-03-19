/* ══════════════════════════════════════════════════════════════
   SngpcMovimentacaoService — Motor Regulatório SNGPC Fase 2
   
   Responsabilidades:
     ✔ Registrar ENTRADA, DISPENSAÇÃO, PERDA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO
     ✔ Validar regras obrigatórias (produto controlado, lote, período, estoque)
     ✔ Transaction SERIALIZABLE para evitar corrida de estoque
     ✔ Atualizar saldo regulatório (sngpc_estoque) separado do comercial
     ✔ Gerar hash SHA-256 de integridade
     ✔ Bloquear movimentação em período FECHADO/TRANSMITIDO/CANCELADO
   
   Regras:
     🚨 Movimentações são IMUTÁVEIS (somente INSERT)
     🚨 Estoque regulatório NUNCA negativo
     🚨 Data da movimentação DENTRO do período
     🚨 Período obrigatoriamente ABERTO
   ══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { Op, Transaction } = require('sequelize');
const {
  sequelize, Produto, Lote, SngpcMovimentacao, SngpcPeriodo, SngpcEstoque,
  EstoqueMovimentacao, MedicamentoControlado, Usuario
} = require('../models');
const { logger } = require('../config/logger');

// ── Tipos válidos de movimentação Fase 2 ──
const TIPOS_VALIDOS = ['ENTRADA', 'DISPENSACAO', 'PERDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'];
const TIPOS_ENTRADA = ['ENTRADA', 'AJUSTE_POSITIVO'];
const TIPOS_SAIDA = ['DISPENSACAO', 'PERDA', 'AJUSTE_NEGATIVO'];

class SngpcMovimentacaoService {

  /**
   * Gerar hash SHA-256 de integridade (imutável)
   */
  static gerarHash(dados) {
    const str = [
      dados.empresa_id,
      dados.produto_id,
      dados.lote_id,
      dados.tipo,
      dados.quantidade,
      dados.data_movimentacao,
      dados.cpf_paciente || '',
      dados.crm_medico || '',
      Date.now(),
      Math.random().toString(36).substring(2)
    ].join('|');
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Validações comuns obrigatórias
   */
  static async _validarBase(dados, transaction) {
    const { empresa_id, produto_id, lote_id, tipo, quantidade, data_movimentacao } = dados;

    // 1. Tipo válido
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new Error('Tipo de movimentação inválido. Permitidos: ' + TIPOS_VALIDOS.join(', '));
    }

    // 2. Quantidade positiva
    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // 3. Data obrigatória
    if (!data_movimentacao) {
      throw new Error('Data da movimentação é obrigatória');
    }

    // 4. Produto deve ser controlado
    const produto = await Produto.findOne({
      where: { id: produto_id, empresa_id, controlado: true },
      transaction
    });
    if (!produto) {
      throw new Error('Produto não encontrado ou não é controlado');
    }

    // 5. Lote pertence ao produto
    const lote = await Lote.findOne({
      where: { id: lote_id, produto_id, empresa_id },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!lote) {
      throw new Error('Lote não encontrado ou não pertence ao produto');
    }

    // 6. Período aberto e data dentro do range
    const periodo = await SngpcPeriodo.findOne({
      where: {
        empresa_id,
        status: 'aberto',
        data_inicio: { [Op.lte]: data_movimentacao },
        data_fim: { [Op.gte]: data_movimentacao }
      },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!periodo) {
      // Verificar se existe período fechado/transmitido para essa data
      const periodoFechado = await SngpcPeriodo.findOne({
        where: {
          empresa_id,
          status: { [Op.in]: ['fechado', 'transmitido', 'cancelado'] },
          data_inicio: { [Op.lte]: data_movimentacao },
          data_fim: { [Op.gte]: data_movimentacao }
        },
        transaction
      });
      if (periodoFechado) {
        throw new Error('Período ' + periodoFechado.data_inicio + ' a ' + periodoFechado.data_fim +
          ' está ' + periodoFechado.status.toUpperCase() + '. Movimentação bloqueada.');
      }
      throw new Error('Não existe período ABERTO que contenha a data ' + data_movimentacao);
    }

    // 7. Obter/criar saldo regulatório com lock
    let saldo = await SngpcEstoque.findOne({
      where: { empresa_id, produto_id, lote_id },
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!saldo) {
      saldo = await SngpcEstoque.create({
        empresa_id, produto_id, lote_id, saldo_atual: 0
      }, { transaction });
    }

    // 8. Para saídas, validar que estoque regulatório não fica negativo
    if (TIPOS_SAIDA.includes(tipo)) {
      const saldoAtual = parseFloat(saldo.saldo_atual);
      if (saldoAtual < qtd) {
        throw new Error('Estoque regulatório insuficiente. Saldo: ' + saldoAtual + ', Solicitado: ' + qtd);
      }
    }

    return { produto, lote, periodo, saldo, qtd };
  }

  /**
   * Atualizar saldo regulatório dentro da transaction
   */
  static async _atualizarSaldo(saldo, tipo, qtd, transaction) {
    const saldoAtual = parseFloat(saldo.saldo_atual);
    let novoSaldo;

    if (TIPOS_ENTRADA.includes(tipo)) {
      novoSaldo = saldoAtual + qtd;
    } else {
      novoSaldo = saldoAtual - qtd;
    }

    if (novoSaldo < 0) {
      throw new Error('Operação resultaria em estoque regulatório negativo: ' + novoSaldo);
    }

    await saldo.update({ saldo_atual: novoSaldo }, { transaction });
    return novoSaldo;
  }

  /**
   * Sincronizar estoque comercial (lote + produto)
   */
  static async _sincronizarEstoqueComercial(produto, lote, tipo, qtd, empresa_id, usuario_id, contexto, transaction) {
    const estoqueAnterior = parseFloat(produto.estoque_atual);
    let novoEstoqueProduto;
    let novoEstoqueLote;

    if (TIPOS_ENTRADA.includes(tipo)) {
      novoEstoqueLote = parseFloat(lote.quantidade_atual) + qtd;
      novoEstoqueProduto = estoqueAnterior + qtd;
    } else {
      novoEstoqueLote = parseFloat(lote.quantidade_atual) - qtd;
      novoEstoqueProduto = Math.max(0, estoqueAnterior - qtd);
    }

    await lote.update({
      quantidade_atual: Math.max(0, novoEstoqueLote),
      status: novoEstoqueLote <= 0 ? 'ESGOTADO' : 'ATIVO'
    }, { transaction });

    await produto.update({
      estoque_atual: novoEstoqueProduto
    }, { transaction });

    // Movimentação de estoque geral (tabela estoque_movimentacoes)
    await EstoqueMovimentacao.create({
      empresa_id,
      produto_id: produto.id,
      lote_id: lote.id,
      tipo: TIPOS_ENTRADA.includes(tipo) ? 'entrada' : 'saida',
      origem: 'SNGPC_' + tipo,
      quantidade: qtd,
      estoque_anterior: estoqueAnterior,
      estoque_posterior: novoEstoqueProduto,
      motivo: 'SNGPC Fase 2: ' + tipo + ' - ' + (contexto || ''),
      usuario_id,
      referencia: 'sngpc_fase2_' + tipo.toLowerCase(),
      lote: lote.numero_lote,
      validade: lote.validade
    }, { transaction });
  }

  // ══════════════════════════════════════════
  //  REGISTRAR ENTRADA
  // ══════════════════════════════════════════
  static async registrarEntrada(dados) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      dados.tipo = 'ENTRADA';
      const { produto, lote, periodo, saldo, qtd } = await this._validarBase(dados, t);

      // Atualizar saldo regulatório
      await this._atualizarSaldo(saldo, 'ENTRADA', qtd, t);

      // Sincronizar estoque comercial
      await this._sincronizarEstoqueComercial(produto, lote, 'ENTRADA', qtd,
        dados.empresa_id, dados.usuario_id, dados.documento_referencia || dados.numero_documento, t);

      // Criar movimentação SNGPC imutável
      const mov = await SngpcMovimentacao.create({
        empresa_id: dados.empresa_id,
        produto_id: dados.produto_id,
        lote_id: dados.lote_id,
        periodo_id: periodo.id,
        tipo: 'ENTRADA',
        quantidade: qtd,
        data_movimentacao: dados.data_movimentacao,
        numero_documento: dados.numero_documento || null,
        documento_referencia: dados.documento_referencia || null,
        profissional_responsavel: dados.profissional_responsavel || null,
        compra_id: dados.compra_id || null,
        usuario_id: dados.usuario_id,
        hash_integridade: this.gerarHash(dados)
      }, { transaction: t });

      return { movimentacao: mov, saldo_regulatorio: parseFloat(saldo.saldo_atual) };
    });
  }

  // ══════════════════════════════════════════
  //  REGISTRAR DISPENSAÇÃO
  // ══════════════════════════════════════════
  static async registrarDispensacao(dados) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      dados.tipo = 'DISPENSACAO';
      const { produto, lote, periodo, saldo, qtd } = await this._validarBase(dados, t);

      // Validar receita se produto exige
      if (produto.necessita_receita) {
        const campos = ['cpf_paciente', 'nome_paciente', 'nome_medico', 'crm_medico', 'uf_crm', 'numero_receita', 'data_receita'];
        for (const campo of campos) {
          if (!dados[campo]) {
            throw new Error('Produto exige receita. Campo obrigatório ausente: ' + campo);
          }
        }
      }

      // Validar validade do lote
      const hoje = new Date().toISOString().split('T')[0];
      if (lote.validade && lote.validade < hoje) {
        throw new Error('Lote vencido! Validade: ' + lote.validade);
      }

      // Atualizar saldo regulatório
      await this._atualizarSaldo(saldo, 'DISPENSACAO', qtd, t);

      // Sincronizar estoque comercial
      await this._sincronizarEstoqueComercial(produto, lote, 'DISPENSACAO', qtd,
        dados.empresa_id, dados.usuario_id, 'Dispensação receita ' + (dados.numero_receita || 'S/N'), t);

      // Criar movimentação SNGPC imutável
      const mov = await SngpcMovimentacao.create({
        empresa_id: dados.empresa_id,
        produto_id: dados.produto_id,
        lote_id: dados.lote_id,
        periodo_id: periodo.id,
        tipo: 'DISPENSACAO',
        quantidade: qtd,
        data_movimentacao: dados.data_movimentacao,
        cpf_paciente: dados.cpf_paciente,
        nome_paciente: dados.nome_paciente,
        nome_medico: dados.nome_medico,
        crm_medico: dados.crm_medico,
        uf_crm: dados.uf_crm,
        numero_receita: dados.numero_receita,
        data_receita: dados.data_receita,
        documento_referencia: dados.documento_referencia || dados.numero_receita || null,
        profissional_responsavel: dados.profissional_responsavel || null,
        venda_id: dados.venda_id || null,
        usuario_id: dados.usuario_id,
        hash_integridade: this.gerarHash(dados)
      }, { transaction: t });

      // Backward compat: MedicamentoControlado
      if (dados.cpf_paciente) {
        await MedicamentoControlado.create({
          empresa_id: dados.empresa_id,
          venda_id: dados.venda_id || null,
          produto_id: dados.produto_id,
          cliente_cpf: dados.cpf_paciente || '',
          cliente_nome: dados.nome_paciente || '',
          medico_nome: dados.nome_medico,
          medico_crm: dados.crm_medico,
          medico_uf: dados.uf_crm,
          numero_receita: dados.numero_receita,
          data_receita: dados.data_receita,
          tipo_receita: produto.tipo_receita || 'branca',
          farmaceutico_id: dados.usuario_id,
          quantidade_dispensada: qtd,
          lote: lote.numero_lote,
          data_venda: dados.data_movimentacao
        }, { transaction: t });
      }

      return { movimentacao: mov, saldo_regulatorio: parseFloat(saldo.saldo_atual) };
    });
  }

  // ══════════════════════════════════════════
  //  REGISTRAR PERDA
  // ══════════════════════════════════════════
  static async registrarPerda(dados) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      dados.tipo = 'PERDA';
      const { produto, lote, periodo, saldo, qtd } = await this._validarBase(dados, t);

      // Atualizar saldo regulatório
      await this._atualizarSaldo(saldo, 'PERDA', qtd, t);

      // Sincronizar estoque comercial
      await this._sincronizarEstoqueComercial(produto, lote, 'PERDA', qtd,
        dados.empresa_id, dados.usuario_id, 'Perda: ' + (dados.motivo_ajuste || dados.observacao || ''), t);

      // Criar movimentação SNGPC imutável
      const mov = await SngpcMovimentacao.create({
        empresa_id: dados.empresa_id,
        produto_id: dados.produto_id,
        lote_id: dados.lote_id,
        periodo_id: periodo.id,
        tipo: 'PERDA',
        quantidade: qtd,
        data_movimentacao: dados.data_movimentacao,
        motivo_ajuste: dados.motivo_ajuste || 'perda',
        observacao: dados.observacao || null,
        documento_referencia: dados.documento_referencia || null,
        profissional_responsavel: dados.profissional_responsavel || null,
        usuario_id: dados.usuario_id,
        hash_integridade: this.gerarHash(dados)
      }, { transaction: t });

      return { movimentacao: mov, saldo_regulatorio: parseFloat(saldo.saldo_atual) };
    });
  }

  // ══════════════════════════════════════════
  //  REGISTRAR AJUSTE (POSITIVO ou NEGATIVO)
  // ══════════════════════════════════════════
  static async registrarAjuste(dados) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      const qtdComSinal = parseFloat(dados.quantidade);
      if (qtdComSinal === 0) throw new Error('Quantidade não pode ser zero');

      dados.tipo = qtdComSinal > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO';
      dados.quantidade = Math.abs(qtdComSinal);

      const { produto, lote, periodo, saldo, qtd } = await this._validarBase(dados, t);

      // Atualizar saldo regulatório
      await this._atualizarSaldo(saldo, dados.tipo, qtd, t);

      // Sincronizar estoque comercial
      await this._sincronizarEstoqueComercial(produto, lote, dados.tipo, qtd,
        dados.empresa_id, dados.usuario_id, 'Ajuste: ' + (dados.motivo_ajuste || dados.observacao || ''), t);

      // Criar movimentação SNGPC imutável
      const mov = await SngpcMovimentacao.create({
        empresa_id: dados.empresa_id,
        produto_id: dados.produto_id,
        lote_id: dados.lote_id,
        periodo_id: periodo.id,
        tipo: dados.tipo,
        quantidade: qtd,
        data_movimentacao: dados.data_movimentacao,
        motivo_ajuste: dados.motivo_ajuste || null,
        observacao: dados.observacao || null,
        documento_referencia: dados.documento_referencia || null,
        profissional_responsavel: dados.profissional_responsavel || null,
        usuario_id: dados.usuario_id,
        hash_integridade: this.gerarHash(dados)
      }, { transaction: t });

      return { movimentacao: mov, saldo_regulatorio: parseFloat(saldo.saldo_atual) };
    });
  }

  // ══════════════════════════════════════════
  //  CONSULTAR SALDO REGULATÓRIO
  // ══════════════════════════════════════════
  static async consultarSaldo(empresa_id, produto_id, lote_id) {
    const where = { empresa_id };
    if (produto_id) where.produto_id = produto_id;
    if (lote_id) where.lote_id = lote_id;

    const saldos = await SngpcEstoque.findAll({
      where,
      include: [
        { model: Produto, attributes: ['id', 'nome', 'principio_ativo', 'classe_controlado'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'] }
      ],
      order: [['produto_id', 'ASC'], ['lote_id', 'ASC']]
    });

    return saldos;
  }

  /**
   * Calcular saldo dinamicamente (verificação de consistência)
   */
  static async calcularSaldoDinamico(empresa_id, produto_id, lote_id) {
    const [result] = await sequelize.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo IN ('ENTRADA', 'AJUSTE_POSITIVO', 'entrada', 'inventario') THEN quantidade ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo IN ('DISPENSACAO', 'PERDA', 'AJUSTE_NEGATIVO', 'saida') THEN quantidade ELSE 0 END), 0) AS saldo
      FROM sngpc_movimentacoes
      WHERE empresa_id = :empresa_id AND produto_id = :produto_id AND lote_id = :lote_id
    `, {
      replacements: { empresa_id, produto_id, lote_id }
    });

    return parseFloat(result[0]?.saldo || 0);
  }
}

module.exports = SngpcMovimentacaoService;
