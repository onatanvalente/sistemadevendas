/* ══════════════════════════════════════════════════════════════
   SngpcArquivoService — Geração de Arquivo Oficial SNGPC Fase 3
   
   Responsabilidades:
     ✔ Validar período para geração (FECHADO, com hash, sem saldo negativo)
     ✔ Gerar estrutura TXT com cabeçalho, corpo e rodapé
     ✔ Calcular hash SHA-256 do conteúdo gerado
     ✔ Persistir arquivo em sngpc_arquivos (1 período → 1 arquivo)
     ✔ Impedir geração duplicada
     ✔ Transaction SERIALIZABLE para garantir atomicidade
   
   Regras:
     🚨 período.status DEVE ser FECHADO
     🚨 período.hash_integridade DEVE existir
     🚨 NÃO pode estar TRANSMITIDO
     🚨 Nenhum saldo regulatório negativo
     🚨 Todas movimentações devem pertencer ao período
     🚨 1 período → 1 arquivo ativo
   ══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { Op, Transaction } = require('sequelize');
const {
  sequelize, SngpcPeriodo, SngpcMovimentacao, SngpcEstoque,
  SngpcConfiguracao, SngpcArquivo, Produto, Lote
} = require('../models');
const { logger } = require('../config/logger');

class SngpcArquivoService {

  // ══════════════════════════════════════════
  //  VALIDAR PERÍODO PARA GERAÇÃO
  // ══════════════════════════════════════════
  static async validarPeriodoParaGeracao(empresa_id, periodo_id, transaction) {
    const periodo = await SngpcPeriodo.findOne({
      where: { id: periodo_id, empresa_id },
      transaction
    });

    if (!periodo) throw new Error('Período não encontrado');

    // Deve estar FECHADO
    if (periodo.status !== 'fechado') {
      throw new Error('Período deve estar FECHADO para gerar arquivo. Status atual: ' + periodo.status.toUpperCase());
    }

    // Hash de integridade deve existir
    if (!periodo.hash_integridade) {
      throw new Error('Período não possui hash de integridade. Feche o período corretamente.');
    }

    // Verificar se já existe arquivo para este período
    const arquivoExistente = await SngpcArquivo.findOne({
      where: { periodo_id, empresa_id },
      transaction
    });
    if (arquivoExistente) {
      throw new Error('Já existe um arquivo gerado para este período (id=' + arquivoExistente.id + ')');
    }

    // Verificar que não há saldo regulatório negativo
    const saldoNegativo = await SngpcEstoque.findOne({
      where: {
        empresa_id,
        saldo_atual: { [Op.lt]: 0 }
      },
      transaction
    });
    if (saldoNegativo) {
      throw new Error('Existe saldo regulatório negativo (produto_id=' + saldoNegativo.produto_id +
        ', lote_id=' + saldoNegativo.lote_id + '). Corrija antes de gerar o arquivo.');
    }

    // Verificar que todas movimentações pertencem ao período
    const movOrfas = await SngpcMovimentacao.count({
      where: {
        empresa_id,
        periodo_id: null,
        tipo: { [Op.in]: ['ENTRADA', 'DISPENSACAO', 'PERDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] }
      },
      transaction
    });
    if (movOrfas > 0) {
      throw new Error('Existem ' + movOrfas + ' movimentações sem período vinculado.');
    }

    return periodo;
  }

  // ══════════════════════════════════════════
  //  GERAR ESTRUTURA DO PERÍODO
  // ══════════════════════════════════════════
  static async gerarEstruturaPeriodo(empresa_id, periodo_id, transaction) {
    // Buscar configuração SNGPC
    const config = await SngpcConfiguracao.findOne({
      where: { empresa_id },
      transaction
    });
    if (!config) {
      throw new Error('Configuração SNGPC não encontrada. Configure antes de gerar arquivo.');
    }

    // Buscar período
    const periodo = await SngpcPeriodo.findOne({
      where: { id: periodo_id, empresa_id },
      transaction
    });

    // Buscar movimentações ordenadas
    const movimentacoes = await SngpcMovimentacao.findAll({
      where: { empresa_id, periodo_id },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'principio_ativo', 'registro_anvisa', 'classe_controlado'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'] }
      ],
      order: [['data_movimentacao', 'ASC'], ['id', 'ASC']],
      transaction
    });

    // Buscar saldos regulatórios
    const saldos = await SngpcEstoque.findAll({
      where: { empresa_id },
      include: [
        { model: Produto, attributes: ['id', 'nome', 'principio_ativo', 'registro_anvisa'] },
        { model: Lote, attributes: ['id', 'numero_lote', 'validade'] }
      ],
      transaction
    });

    return { config, periodo, movimentacoes, saldos };
  }

  // ══════════════════════════════════════════
  //  GERAR ARQUIVO TXT ESTRUTURADO
  // ══════════════════════════════════════════
  static gerarArquivoTXT(estrutura) {
    const { config, periodo, movimentacoes, saldos } = estrutura;
    const linhas = [];

    // ── CABEÇALHO ──
    linhas.push('===== ARQUIVO SNGPC - SISTEMA NACIONAL DE GERENCIAMENTO DE PRODUTOS CONTROLADOS =====');
    linhas.push('DATA_GERACAO|' + new Date().toISOString());
    linhas.push('CNPJ|' + config.cnpj);
    linhas.push('RAZAO_SOCIAL|' + config.razao_social);
    linhas.push('RESPONSAVEL_TECNICO|' + config.responsavel_tecnico_nome);
    linhas.push('CRF|' + config.responsavel_tecnico_crf);
    linhas.push('UF|' + config.responsavel_tecnico_uf);
    linhas.push('PERIODO_INICIO|' + periodo.data_inicio);
    linhas.push('PERIODO_FIM|' + periodo.data_fim);
    linhas.push('HASH_PERIODO|' + periodo.hash_integridade);
    linhas.push('TOTAL_MOVIMENTACOES|' + movimentacoes.length);
    linhas.push('===== MOVIMENTACOES =====');

    // ── CORPO — MOVIMENTAÇÕES ──
    linhas.push('DATA|TIPO|REGISTRO_ANVISA|LOTE|QUANTIDADE|DOCUMENTO_REFERENCIA|CPF_PACIENTE|NOME_MEDICO|CRM|HASH');
    for (const mov of movimentacoes) {
      const campos = [
        mov.data_movimentacao,
        mov.tipo,
        (mov.Produto ? mov.Produto.registro_anvisa : '') || '',
        (mov.Lote ? mov.Lote.numero_lote : '') || '',
        mov.quantidade.toString(),
        mov.documento_referencia || mov.numero_documento || '',
        mov.cpf_paciente || '',
        mov.nome_medico || '',
        mov.crm_medico || '',
        mov.hash_integridade
      ];
      linhas.push(campos.join('|'));
    }

    // ── RODAPÉ — SALDOS FINAIS ──
    linhas.push('===== SALDOS FINAIS =====');
    linhas.push('PRODUTO|REGISTRO_ANVISA|LOTE|SALDO');
    for (const s of saldos) {
      if (parseFloat(s.saldo_atual) !== 0) {
        linhas.push([
          s.Produto ? s.Produto.nome : 'ID:' + s.produto_id,
          s.Produto ? (s.Produto.registro_anvisa || '') : '',
          s.Lote ? s.Lote.numero_lote : 'ID:' + s.lote_id,
          s.saldo_atual.toString()
        ].join('|'));
      }
    }

    linhas.push('===== HASH_PERIODO|' + periodo.hash_integridade + ' =====');
    linhas.push('===== FIM DO ARQUIVO SNGPC =====');

    return linhas.join('\n');
  }

  // ══════════════════════════════════════════
  //  CALCULAR HASH DO ARQUIVO
  // ══════════════════════════════════════════
  static calcularHashArquivo(conteudo) {
    return crypto.createHash('sha256').update(conteudo, 'utf8').digest('hex');
  }

  // ══════════════════════════════════════════
  //  SALVAR ARQUIVO (persistir em sngpc_arquivos)
  // ══════════════════════════════════════════
  static async salvarArquivo({ empresa_id, periodo_id, conteudo, hash_arquivo, usuario_id }, transaction) {
    const nomeArquivo = 'SNGPC_' + empresa_id + '_P' + periodo_id + '_' +
      new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14) + '.txt';

    const arquivo = await SngpcArquivo.create({
      empresa_id,
      periodo_id,
      nome_arquivo: nomeArquivo,
      hash_arquivo,
      conteudo,
      criado_por: usuario_id,
      criado_em: new Date()
    }, { transaction });

    return arquivo;
  }

  // ══════════════════════════════════════════
  //  PIPELINE COMPLETO: GERAR + SALVAR
  // ══════════════════════════════════════════
  static async gerarArquivoCompleto({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // 1. Validar
      const periodo = await this.validarPeriodoParaGeracao(empresa_id, periodo_id, t);

      // 2. Gerar estrutura
      const estrutura = await this.gerarEstruturaPeriodo(empresa_id, periodo_id, t);

      // 3. Gerar TXT
      const conteudo = this.gerarArquivoTXT(estrutura);

      // 4. Hash do arquivo
      const hash_arquivo = this.calcularHashArquivo(conteudo);

      // 5. Persistir
      const arquivo = await this.salvarArquivo({
        empresa_id, periodo_id, conteudo, hash_arquivo, usuario_id
      }, t);

      return {
        arquivo: arquivo.toJSON(),
        hash_arquivo,
        total_movimentacoes: estrutura.movimentacoes.length,
        tamanho_bytes: Buffer.byteLength(conteudo, 'utf8')
      };
    });
  }

  // ══════════════════════════════════════════
  //  REGENERAR ARQUIVO (após rejeição)
  //  Deleta arquivo anterior e gera novo
  // ══════════════════════════════════════════
  static async regenerarArquivo({ empresa_id, periodo_id, usuario_id }) {
    return sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    }, async (t) => {
      // Período deve estar FECHADO (rejeição volta p/ FECHADO)
      const periodo = await SngpcPeriodo.findOne({
        where: { id: periodo_id, empresa_id },
        transaction: t
      });
      if (!periodo) throw new Error('Período não encontrado');
      if (periodo.status !== 'fechado') {
        throw new Error('Período deve estar FECHADO para regenerar arquivo. Status: ' + periodo.status.toUpperCase());
      }

      // Deletar arquivo anterior (se existir)
      await SngpcArquivo.destroy({
        where: { periodo_id, empresa_id },
        transaction: t
      });

      // Gerar nova estrutura + TXT + hash
      const estrutura = await this.gerarEstruturaPeriodo(empresa_id, periodo_id, t);
      const conteudo = this.gerarArquivoTXT(estrutura);
      const hash_arquivo = this.calcularHashArquivo(conteudo);

      // Persistir novo arquivo
      const arquivo = await this.salvarArquivo({
        empresa_id, periodo_id, conteudo, hash_arquivo, usuario_id
      }, t);

      return {
        arquivo: arquivo.toJSON(),
        hash_arquivo,
        regenerado: true,
        total_movimentacoes: estrutura.movimentacoes.length
      };
    });
  }
}

module.exports = SngpcArquivoService;
