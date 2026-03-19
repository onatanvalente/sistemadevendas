/* ══════════════════════════════════════════════════════════════
   ROTAS: Painel Master (Admin do SaaS)
   Acesso exclusivo para gerenciar todos os clientes/tenants
   JWT separado, autenticação isolada
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UsuarioMaster, Empresa, Usuario, Venda, sequelize } = require('../models');
const { Op } = require('sequelize');
const { invalidateCache } = require('../middleware/tenantResolver');

const MASTER_SECRET = process.env.MASTER_JWT_SECRET || 'sgc_master_secret_change_this';
const MASTER_EXPIRES = '8h';

// ── Auth Middleware Master (isolado do tenant) ──
async function masterAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token master não fornecido' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, MASTER_SECRET);
    
    const user = await UsuarioMaster.findByPk(decoded.id);
    if (!user || !user.ativo) {
      return res.status(401).json({ error: 'Usuário master inativo' });
    }
    req.masterUser = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token master inválido' });
  }
}

// ── LOGIN MASTER ──
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: 'Credenciais obrigatórias' });
    }

    // Mensagem genérica para não revelar se email existe
    const user = await UsuarioMaster.findOne({ where: { email } });
    if (!user || !user.ativo) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    await user.update({ ultimo_login: new Date() });

    const token = jwt.sign(
      { id: user.id, role: user.role, tipo: 'master' },
      MASTER_SECRET,
      { expiresIn: MASTER_EXPIRES }
    );

    res.json({
      token,
      usuario: { id: user.id, nome: user.nome, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('[Master Login]', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── ME (dados do master logado) ──
router.get('/me', masterAuth, (req, res) => {
  res.json({
    id: req.masterUser.id,
    nome: req.masterUser.nome,
    email: req.masterUser.email,
    role: req.masterUser.role
  });
});

// ── LISTAR TODOS OS CLIENTES (tenants) ──
router.get('/clientes', masterAuth, async (req, res) => {
  try {
    const clientes = await Empresa.findAll({
      attributes: ['id', 'nome', 'nome_fantasia', 'cnpj', 'tipo_negocio', 'subdominio',
        'email', 'telefone', 'plano', 'ativo', 'status', 'cor_primaria', 'logo_url',
        'max_usuarios', 'max_caixas', 'created_at', 'trial_ate', 'origem_cadastro'],
      order: [['created_at', 'DESC']]
    });

    // Contar usuários por empresa
    const counts = await Usuario.findAll({
      attributes: ['empresa_id', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['empresa_id'],
      raw: true
    });
    const countMap = {};
    counts.forEach(c => { countMap[c.empresa_id] = parseInt(c.total); });

    const result = clientes.map(c => ({
      ...c.toJSON(),
      total_usuarios: countMap[c.id] || 0,
      url_acesso: '/app/' + c.subdominio
    }));

    res.json(result);
  } catch (error) {
    console.error('[Master Clientes]', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// ── DETALHES DE UM CLIENTE ──
router.get('/clientes/:id', masterAuth, async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Cliente não encontrado' });

    const usuarios = await Usuario.findAll({
      where: { empresa_id: empresa.id },
      attributes: ['id', 'nome', 'email', 'perfil', 'ativo', 'ultimo_login', 'created_at']
    });

    // Estatísticas rápidas
    const totalVendas = await Venda.count({ where: { empresa_id: empresa.id } });
    const faturamento = await Venda.sum('total', { where: { empresa_id: empresa.id } }) || 0;

    res.json({
      empresa: empresa.toJSON(),
      usuarios,
      estatisticas: { total_vendas: totalVendas, faturamento_total: faturamento },
      url_acesso: '/app/' + empresa.subdominio
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar detalhes' });
  }
});

// ── ATIVAR / SUSPENDER CLIENTE ──
router.put('/clientes/:id/status', masterAuth, async (req, res) => {
  try {
    const { status } = req.body; // ativo, suspenso, cancelado
    if (!['ativo', 'suspenso', 'trial', 'cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Cliente não encontrado' });

    await empresa.update({
      status,
      ativo: status === 'ativo' || status === 'trial'
    });

    invalidateCache(empresa.subdominio);

    res.json({ message: `Status alterado para ${status}`, empresa: empresa.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
});

// ── EDITAR DADOS VISUAIS DO CLIENTE ──
router.put('/clientes/:id', masterAuth, async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Cliente não encontrado' });

    const campos = ['nome', 'nome_fantasia', 'email', 'telefone', 'plano',
      'cor_primaria', 'cor_secundaria', 'logo_url', 'max_usuarios', 'max_caixas',
      'trial_ate'];
    
    const update = {};
    campos.forEach(c => { if (req.body[c] !== undefined) update[c] = req.body[c]; });

    await empresa.update(update);
    invalidateCache(empresa.subdominio);

    res.json({ message: 'Cliente atualizado', empresa: empresa.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// ── IMPERSONAR CLIENTE (modo suporte) ──
router.post('/impersonar/:id', masterAuth, async (req, res) => {
  try {
    if (req.masterUser.role !== 'super_admin' && req.masterUser.role !== 'suporte') {
      return res.status(403).json({ error: 'Sem permissão' });
    }

    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Cliente não encontrado' });

    // Buscar admin da empresa
    const admin = await Usuario.findOne({
      where: { empresa_id: empresa.id, perfil: 'administrador' }
    });
    if (!admin) return res.status(404).json({ error: 'Admin da empresa não encontrado' });

    const JWT_SECRET = process.env.JWT_SECRET || 'sgc_jwt_secret_default';
    const token = jwt.sign(
      { id: admin.id, empresa_id: empresa.id, perfil: admin.perfil, impersonated: true },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      slug: empresa.subdominio,
      url: '/app/' + empresa.subdominio,
      empresa: { id: empresa.id, nome: empresa.nome },
      usuario: { id: admin.id, nome: admin.nome, email: admin.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao impersonar' });
  }
});

// ── DASHBOARD MASTER (visão geral do SaaS) ──
router.get('/dashboard', masterAuth, async (req, res) => {
  try {
    const totalClientes = await Empresa.count();
    const clientesAtivos = await Empresa.count({ where: { status: 'ativo' } });
    const clientesSuspensos = await Empresa.count({ where: { status: 'suspenso' } });
    const clientesTrial = await Empresa.count({ where: { status: 'trial' } });

    // Novos clientes últimos 30 dias
    const trintaDias = new Date();
    trintaDias.setDate(trintaDias.getDate() - 30);
    const novosUltimos30 = await Empresa.count({
      where: { created_at: { [Op.gte]: trintaDias } }
    });

    // Total de vendas no sistema
    const totalVendas = await Venda.count();
    const faturamentoTotal = await Venda.sum('total') || 0;

    // Clientes por plano
    const porPlano = await Empresa.findAll({
      attributes: ['plano', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['plano'],
      raw: true
    });

    // Clientes por tipo
    const porTipo = await Empresa.findAll({
      attributes: ['tipo_negocio', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['tipo_negocio'],
      raw: true
    });

    res.json({
      total_clientes: totalClientes,
      clientes_ativos: clientesAtivos,
      clientes_suspensos: clientesSuspensos,
      clientes_trial: clientesTrial,
      novos_ultimos_30_dias: novosUltimos30,
      total_vendas_sistema: totalVendas,
      faturamento_total_sistema: faturamentoTotal,
      por_plano: porPlano,
      por_tipo: porTipo
    });
  } catch (error) {
    console.error('[Master Dashboard]', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

module.exports = router;
