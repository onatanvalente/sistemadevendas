/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Rotas de Auditoria v1.0
   Log de descontos, ações do PDV, validação de gerente
   Prioridade 5: Proteção contra fraude interna
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { sequelize, LogDesconto, LogPdv, Venda, VendaItem, Usuario, 
        HistoricoAplicacaoPrograma, ProgramaComercial, RegraDesconto } = require('../models');
const { auth, perfil } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// ═══════════════════════════════════════════════
//  REGISTRAR LOG DE AÇÃO DO PDV (fire-and-forget)
// ═══════════════════════════════════════════════
router.post('/log-pdv', auth, async (req, res) => {
  try {
    const { acao, estado_anterior, estado_novo, venda_id, detalhes } = req.body;
    
    if (!acao) return res.status(400).json({ error: 'Ação obrigatória' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.connection?.remoteAddress || req.ip;

    await LogPdv.create({
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      venda_id: venda_id || null,
      acao,
      estado_anterior: estado_anterior || null,
      estado_novo: estado_novo || null,
      detalhes: detalhes || null,
      ip,
      data_hora: new Date()
    });

    res.json({ ok: true });
  } catch (error) {
    // Log nunca deve falhar silenciosamente em produção, mas nunca bloqueia
    console.error('[Audit] Erro ao registrar log PDV:', error.message);
    res.json({ ok: true }); // Não retorna erro para não travar o PDV
  }
});

// ═══════════════════════════════════════════════
//  REGISTRAR LOTE DE LOGS DO PDV (batch)
// ═══════════════════════════════════════════════
router.post('/log-pdv/batch', auth, async (req, res) => {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) return res.json({ ok: true });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.connection?.remoteAddress || req.ip;

    const registros = logs.map(log => ({
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      venda_id: log.venda_id || null,
      acao: log.acao,
      estado_anterior: log.estado_anterior || null,
      estado_novo: log.estado_novo || null,
      detalhes: log.detalhes || null,
      ip,
      data_hora: log.data_hora || new Date()
    }));

    await LogPdv.bulkCreate(registros);
    res.json({ ok: true, registrados: registros.length });
  } catch (error) {
    console.error('[Audit] Erro ao registrar batch log PDV:', error.message);
    res.json({ ok: true });
  }
});

// ═══════════════════════════════════════════════
//  REGISTRAR LOG DE DESCONTO
// ═══════════════════════════════════════════════
router.post('/log-desconto', auth, async (req, res) => {
  try {
    const { venda_id, item_venda_id, tipo_desconto, regra_id, programa_id,
            produto_id, valor_original, valor_desconto, percentual_desconto,
            valor_final, gerente_autorizador_id, motivo } = req.body;

    if (!tipo_desconto || valor_original === undefined || valor_desconto === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios: tipo_desconto, valor_original, valor_desconto' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.connection?.remoteAddress || req.ip;

    await LogDesconto.create({
      empresa_id: req.empresa_id,
      venda_id: venda_id || null,
      item_venda_id: item_venda_id || null,
      tipo_desconto,
      regra_id: regra_id || null,
      programa_id: programa_id || null,
      produto_id: produto_id || null,
      valor_original: parseFloat(valor_original),
      valor_desconto: parseFloat(valor_desconto),
      percentual_desconto: percentual_desconto ? parseFloat(percentual_desconto) : null,
      valor_final: parseFloat(valor_final || (valor_original - valor_desconto)),
      usuario_id: req.usuario.id,
      gerente_autorizador_id: gerente_autorizador_id || null,
      motivo: motivo || null,
      ip,
      data_hora: new Date()
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[Audit] Erro ao registrar log desconto:', error.message);
    res.json({ ok: true });
  }
});

// ═══════════════════════════════════════════════
//  REGISTRAR LOTE DE LOGS DE DESCONTO (batch)
// ═══════════════════════════════════════════════
router.post('/log-desconto/batch', auth, async (req, res) => {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) return res.json({ ok: true });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
      || req.connection?.remoteAddress || req.ip;

    const registros = logs.map(log => ({
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      venda_id: log.venda_id || null,
      item_venda_id: log.item_venda_id || null,
      tipo_desconto: log.tipo_desconto,
      regra_id: log.regra_id || null,
      programa_id: log.programa_id || null,
      produto_id: log.produto_id || null,
      valor_original: parseFloat(log.valor_original),
      valor_desconto: parseFloat(log.valor_desconto),
      percentual_desconto: log.percentual_desconto ? parseFloat(log.percentual_desconto) : null,
      valor_final: parseFloat(log.valor_final || (log.valor_original - log.valor_desconto)),
      gerente_autorizador_id: log.gerente_autorizador_id || null,
      motivo: log.motivo || null,
      ip,
      data_hora: log.data_hora || new Date()
    }));

    await LogDesconto.bulkCreate(registros);
    res.json({ ok: true, registrados: registros.length });
  } catch (error) {
    console.error('[Audit] Erro ao registrar batch log desconto:', error.message);
    res.json({ ok: true });
  }
});

// ═══════════════════════════════════════════════
//  VALIDAR SENHA DE GERENTE (autorização de desconto)
// ═══════════════════════════════════════════════
router.post('/validar-gerente', auth, async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha do gerente são obrigatórios' });
    }

    const gerente = await Usuario.findOne({
      where: { 
        email, 
        empresa_id: req.empresa_id, 
        ativo: true,
        perfil: ['administrador', 'gerente'] // Apenas admin/gerente podem autorizar
      }
    });

    if (!gerente) {
      // Registrar tentativa falha
      console.warn('[Audit] Tentativa de validação de gerente falhou - email:', email, 'empresa:', req.empresa_id);
      return res.status(403).json({ error: 'Gerente não encontrado ou sem permissão' });
    }

    const senhaValida = await bcrypt.compare(senha, gerente.senha);
    if (!senhaValida) {
      console.warn('[Audit] Senha de gerente inválida - email:', email, 'empresa:', req.empresa_id);
      return res.status(403).json({ error: 'Senha do gerente inválida' });
    }

    // Registrar no log de auditoria
    if (req.audit) {
      await req.audit('validar_gerente', 'usuarios', gerente.id, null, null, 
        `Gerente ${gerente.nome} autorizou desconto para operador ${req.usuario.nome}`);
    }

    res.json({ 
      autorizado: true, 
      gerente: { 
        id: gerente.id, 
        nome: gerente.nome,
        perfil: gerente.perfil
      }
    });
  } catch (error) {
    console.error('[Audit] Erro na validação de gerente:', error);
    res.status(500).json({ error: 'Erro ao validar gerente' });
  }
});

// ═══════════════════════════════════════════════
//  CONSULTAR LIMITE DE DESCONTO DO USUÁRIO LOGADO
// ═══════════════════════════════════════════════
router.get('/limite-desconto', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      where: { id: req.usuario.id, empresa_id: req.empresa_id },
      attributes: ['id', 'nome', 'perfil', 'limite_desconto_percentual']
    });

    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Admin e gerente têm limite efetivo de 100% (sem restrição — podem autorizar a si mesmos)
    const limiteEfetivo = ['administrador', 'gerente'].includes(usuario.perfil) 
      ? 100 
      : parseFloat(usuario.limite_desconto_percentual || 5);

    res.json({
      usuario_id: usuario.id,
      perfil: usuario.perfil,
      limite_desconto_percentual: limiteEfetivo,
      requer_gerente: !['administrador', 'gerente'].includes(usuario.perfil)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar limite de desconto' });
  }
});

// ═══════════════════════════════════════════════
//  LISTAR LOG DE DESCONTOS (gerencial)
// ═══════════════════════════════════════════════
router.get('/log-descontos', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const where = { empresa_id: req.empresa_id };

    if (req.query.data_inicio && req.query.data_fim) {
      where.data_hora = {
        [Op.between]: [new Date(req.query.data_inicio), new Date(req.query.data_fim + 'T23:59:59')]
      };
    }
    if (req.query.tipo_desconto) where.tipo_desconto = req.query.tipo_desconto;
    if (req.query.usuario_id) where.usuario_id = req.query.usuario_id;
    if (req.query.venda_id) where.venda_id = req.query.venda_id;

    const logs = await LogDesconto.findAll({
      where,
      include: [
        { model: Usuario, as: 'Operador', attributes: ['id', 'nome', 'perfil'] },
        { model: Usuario, as: 'GerenteAutorizador', attributes: ['id', 'nome'], required: false }
      ],
      order: [['data_hora', 'DESC']],
      limit: parseInt(req.query.limit) || 200
    });

    res.json(logs);
  } catch (error) {
    console.error('[Audit] Erro ao listar log descontos:', error);
    res.status(500).json({ error: 'Erro ao listar log de descontos' });
  }
});

// ═══════════════════════════════════════════════
//  LISTAR LOG DO PDV (gerencial)
// ═══════════════════════════════════════════════
router.get('/log-pdv', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const where = { empresa_id: req.empresa_id };

    if (req.query.data_inicio && req.query.data_fim) {
      where.data_hora = {
        [Op.between]: [new Date(req.query.data_inicio), new Date(req.query.data_fim + 'T23:59:59')]
      };
    }
    if (req.query.usuario_id) where.usuario_id = req.query.usuario_id;
    if (req.query.venda_id) where.venda_id = req.query.venda_id;
    if (req.query.acao) where.acao = req.query.acao;

    const logs = await LogPdv.findAll({
      where,
      include: [
        { model: Usuario, attributes: ['id', 'nome', 'perfil'] }
      ],
      order: [['data_hora', 'DESC']],
      limit: parseInt(req.query.limit) || 200
    });

    res.json(logs);
  } catch (error) {
    console.error('[Audit] Erro ao listar log PDV:', error);
    res.status(500).json({ error: 'Erro ao listar log do PDV' });
  }
});

// ═══════════════════════════════════════════════
//  TRILHA COMPLETA DE UMA VENDA (audit trail)
// ═══════════════════════════════════════════════
router.get('/venda/:id/trilha', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const vendaId = parseInt(req.params.id);

    // 1. Buscar venda com itens
    const venda = await Venda.findOne({
      where: { id: vendaId, empresa_id: req.empresa_id },
      include: [
        { model: VendaItem },
        { model: Usuario, attributes: ['id', 'nome', 'perfil'] }
      ]
    });

    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    // 2. Buscar logs de descontos desta venda
    const logDescontos = await LogDesconto.findAll({
      where: { venda_id: vendaId, empresa_id: req.empresa_id },
      include: [
        { model: Usuario, as: 'Operador', attributes: ['id', 'nome'] },
        { model: Usuario, as: 'GerenteAutorizador', attributes: ['id', 'nome'], required: false }
      ],
      order: [['data_hora', 'ASC']]
    });

    // 3. Buscar logs de ações do PDV desta venda
    const logPdv = await LogPdv.findAll({
      where: { venda_id: vendaId, empresa_id: req.empresa_id },
      include: [
        { model: Usuario, attributes: ['id', 'nome'] }
      ],
      order: [['data_hora', 'ASC']]
    });

    // 4. Buscar histórico de aplicação de programa
    const historicoPrograma = await HistoricoAplicacaoPrograma.findAll({
      where: { venda_id: vendaId, empresa_id: req.empresa_id },
      include: [
        { model: ProgramaComercial, attributes: ['id', 'nome', 'tipo'] },
        { model: RegraDesconto, attributes: ['id', 'tipo_regra', 'escopo', 'valor'] }
      ],
      order: [['created_at', 'ASC']]
    });

    res.json({
      venda,
      log_descontos: logDescontos,
      log_pdv: logPdv,
      historico_programa: historicoPrograma,
      resumo: {
        total_descontos_automaticos: logDescontos.filter(l => l.tipo_desconto === 'automatico').length,
        total_descontos_manuais: logDescontos.filter(l => l.tipo_desconto !== 'automatico').length,
        total_acoes_pdv: logPdv.length,
        houve_cancelamento: logPdv.some(l => l.acao === 'CANCELAR_VENDA'),
        houve_troca_cliente: logPdv.filter(l => l.acao === 'IDENTIFICAR_CLIENTE').length > 1,
        houve_autorizacao_gerente: logDescontos.some(l => l.gerente_autorizador_id)
      }
    });
  } catch (error) {
    console.error('[Audit] Erro ao buscar trilha da venda:', error);
    res.status(500).json({ error: 'Erro ao buscar trilha de auditoria' });
  }
});

// ═══════════════════════════════════════════════
//  DASHBOARD DE AUDITORIA (métricas gerenciais)
// ═══════════════════════════════════════════════
router.get('/dashboard', auth, perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // Período padrão: últimos 30 dias
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);

    if (req.query.data_inicio) dataInicio.setTime(new Date(req.query.data_inicio).getTime());
    if (req.query.data_fim) dataFim.setTime(new Date(req.query.data_fim + 'T23:59:59').getTime());

    const whereData = { 
      empresa_id: req.empresa_id,
      data_hora: { [Op.between]: [dataInicio, dataFim] }
    };

    // % de vendas com desconto manual
    const totalDescontosManual = await LogDesconto.count({
      where: { ...whereData, tipo_desconto: { [Op.in]: ['manual', 'manual_gerente'] } }
    });

    const totalDescontosAuto = await LogDesconto.count({
      where: { ...whereData, tipo_desconto: 'automatico' }
    });

    // Operadores que mais concedem desconto
    const operadoresDesconto = await LogDesconto.findAll({
      where: { ...whereData, tipo_desconto: { [Op.in]: ['manual', 'manual_gerente'] } },
      attributes: [
        'usuario_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_descontos'],
        [sequelize.fn('SUM', sequelize.col('valor_desconto')), 'valor_total_descontos']
      ],
      include: [{ model: Usuario, as: 'Operador', attributes: ['nome', 'perfil'] }],
      group: ['usuario_id', 'Operador.id', 'Operador.nome', 'Operador.perfil'],
      order: [[sequelize.fn('SUM', sequelize.col('valor_desconto')), 'DESC']],
      limit: 10
    });

    // Descontos que precisaram de autorização gerente
    const comAutorizacaoGerente = await LogDesconto.count({
      where: { ...whereData, gerente_autorizador_id: { [Op.ne]: null } }
    });

    // Total de cancelamentos no período
    const totalCancelamentos = await LogPdv.count({
      where: { ...whereData, acao: 'CANCELAR_VENDA' }
    });

    res.json({
      periodo: { inicio: dataInicio, fim: dataFim },
      descontos: {
        total_manual: totalDescontosManual,
        total_automatico: totalDescontosAuto,
        com_autorizacao_gerente: comAutorizacaoGerente,
        percentual_manual: totalDescontosManual + totalDescontosAuto > 0 
          ? ((totalDescontosManual / (totalDescontosManual + totalDescontosAuto)) * 100).toFixed(1)
          : 0
      },
      operadores_destaque: operadoresDesconto,
      cancelamentos: totalCancelamentos
    });
  } catch (error) {
    console.error('[Audit] Erro no dashboard:', error);
    res.status(500).json({ error: 'Erro ao gerar dashboard de auditoria' });
  }
});

module.exports = router;
