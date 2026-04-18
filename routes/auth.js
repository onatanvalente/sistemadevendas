const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { Usuario, Empresa } = require('../models');
const { auth } = require('../middleware/auth');
const { resolveBySlug } = require('../middleware/tenantResolver');
const { logger } = require('../config/logger');
const { logSecurityEvent } = require('../middleware/validateTenantAccess');

const JWT_SECRET = process.env.JWT_SECRET || 'varlensys_jwt_secret_default';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_SECRET = (process.env.JWT_SECRET || 'varlensys_jwt_secret_default') + '_refresh';
const REFRESH_EXPIRES = '7d';

// ── REGISTRO DE EMPRESA + ADMIN ──
router.post('/registro', async (req, res) => {
  try {
    const { empresa, usuario } = req.body;

    // Validações básicas
    if (!empresa?.nome || !empresa?.cnpj || !usuario?.nome || !usuario?.email || !usuario?.senha) {
      return res.status(400).json({ error: 'Dados obrigatórios: nome da empresa, CNPJ, nome do usuário, email e senha' });
    }

    // Senha mínima 8 caracteres (§5.2)
    if (!usuario.senha || usuario.senha.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    // Verificar CNPJ único (mensagem genérica)
    const cnpjExiste = await Empresa.findOne({ where: { cnpj: empresa.cnpj } });
    if (cnpjExiste) {
      return res.status(400).json({ error: 'Não foi possível realizar o cadastro. Verifique os dados informados.' });
    }

    // Criar empresa
    const novaEmpresa = await Empresa.create({
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      tipo_negocio: empresa.tipo_negocio || 'mercado',
      regime_tributario: empresa.regime_tributario || 'simples_nacional',
      endereco: empresa.endereco,
      cidade: empresa.cidade,
      estado: empresa.estado,
      cep: empresa.cep,
      telefone: empresa.telefone,
      email: empresa.email,
      responsavel_tecnico: empresa.responsavel_tecnico,
      crf_responsavel: empresa.crf_responsavel
    });

    // Hash da senha
    const senhaHash = await bcrypt.hash(usuario.senha, 12);

    // Criar admin
    const novoUsuario = await Usuario.create({
      empresa_id: novaEmpresa.id,
      nome: usuario.nome,
      email: usuario.email,
      senha: senhaHash,
      perfil: 'administrador'
    });

    // Gerar token
    const token = jwt.sign(
      { id: novoUsuario.id, empresa_id: novaEmpresa.id, perfil: 'administrador' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    // Gerar refresh token
    const refreshToken = jwt.sign(
      { id: novoUsuario.id, empresa_id: novaEmpresa.id, tipo: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES }
    );

    res.status(201).json({
      message: 'Empresa cadastrada com sucesso!',
      token,
      refreshToken,
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        perfil: novoUsuario.perfil
      },
      empresa: {
        id: novaEmpresa.id,
        nome: novaEmpresa.nome,
        tipo_negocio: novaEmpresa.tipo_negocio
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao registrar empresa' });
  }
});

// ── LOGIN ──
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha obrigatória')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const { email, senha } = req.body;

    // ── ISOLAMENTO: Identificar o tenant da requisição ──
    const tenantSlug = (req.headers['x-tenant-slug'] || '').toLowerCase().trim();
    if (!tenantSlug) {
      return res.status(400).json({ error: 'Tenant não identificado. Acesse pelo endereço correto.' });
    }

    // Resolver a empresa a partir do slug
    const tenantEmpresa = await resolveBySlug(tenantSlug);
    if (!tenantEmpresa) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    if (!tenantEmpresa.ativo || tenantEmpresa.status === 'suspenso' || tenantEmpresa.status === 'cancelado') {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Buscar usuário pelo email E pela empresa (tenant)
    const usuario = await Usuario.findOne({
      where: { email, empresa_id: tenantEmpresa.id },
      include: [{ model: Empresa, attributes: ['id', 'nome', 'tipo_negocio', 'ativo', 'subdominio'] }]
    });

    if (!usuario) {
      // Logar tentativa de login cross-tenant (se o email existir em outra empresa)
      const existeEmOutra = await Usuario.findOne({ where: { email }, attributes: ['id', 'empresa_id'] });
      if (existeEmOutra) {
        logger.warn('ALERTA: Tentativa de login cross-tenant bloqueada', {
          tipo: 'cross_tenant_login',
          email,
          tenant_solicitado: tenantSlug,
          tenant_solicitado_id: tenantEmpresa.id,
          empresa_real_usuario: existeEmOutra.empresa_id,
          ip: req.ip
        });
        logSecurityEvent({
          empresa_id: tenantEmpresa.id,
          usuario_id: null,
          route: '/api/auth/login',
          method: 'POST',
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          action: 'cross_tenant_login',
          reason: 'Email ' + email + ' tentou login no tenant ' + tenantSlug + ' mas pertence a outra empresa',
          metadata: { email, tenant_slug: tenantSlug }
        });
      } else {
        logSecurityEvent({
          empresa_id: tenantEmpresa.id,
          usuario_id: null,
          route: '/api/auth/login',
          method: 'POST',
          ip: req.ip,
          user_agent: req.headers['user-agent'],
          action: 'login_failed',
          reason: 'Email não encontrado: ' + email,
          metadata: { email, tenant_slug: tenantSlug }
        });
      }
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    if (!usuario.ativo) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    if (!usuario.Empresa?.ativo) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      logSecurityEvent({
        empresa_id: tenantEmpresa.id,
        usuario_id: usuario.id,
        route: '/api/auth/login',
        method: 'POST',
        ip: req.ip,
        user_agent: req.headers['user-agent'],
        action: 'login_failed',
        reason: 'Senha incorreta para ' + email,
        metadata: { email, tenant_slug: tenantSlug }
      });
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // ── Dupla verificação: empresa_id do usuário deve bater com o tenant resolvido ──
    if (usuario.empresa_id !== tenantEmpresa.id) {
      logger.warn('ALERTA: empresa_id diverge do tenant no login', {
        tipo: 'cross_tenant_login_mismatch',
        usuario_id: usuario.id,
        empresa_usuario: usuario.empresa_id,
        tenant_slug: tenantSlug,
        tenant_id: tenantEmpresa.id,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Atualizar último login
    await usuario.update({ ultimo_login: new Date() });

    const token = jwt.sign(
      { id: usuario.id, empresa_id: usuario.empresa_id, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const refreshToken = jwt.sign(
      { id: usuario.id, empresa_id: usuario.empresa_id, tipo: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES }
    );

    res.json({
      token,
      refreshToken,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        limite_desconto_percentual: ['administrador', 'gerente'].includes(usuario.perfil) 
          ? 100 
          : parseFloat(usuario.limite_desconto_percentual || 5)
      },
      empresa: {
        id: usuario.Empresa.id,
        nome: usuario.Empresa.nome,
        tipo_negocio: usuario.Empresa.tipo_negocio,
        subdominio: usuario.Empresa.subdominio
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// ── DADOS DO USUÁRIO LOGADO ──
router.get('/me', auth, async (req, res) => {
  res.json({
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      email: req.usuario.email,
      perfil: req.usuario.perfil
    },
    empresa: {
      id: req.usuario.Empresa.id,
      nome: req.usuario.Empresa.nome,
      tipo_negocio: req.usuario.Empresa.tipo_negocio,
      subdominio: req.usuario.Empresa.subdominio
    }
  });
});

// ── ATUALIZAR PERFIL ──
router.put('/perfil', auth, async (req, res) => {
  try {
    const { nome, email } = req.body;
    if (!nome || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    await req.usuario.update({ nome, email });
    res.json({ message: 'Perfil atualizado', usuario: { id: req.usuario.id, nome, email, perfil: req.usuario.perfil } });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ error: 'Email já está em uso' });
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// ── ALTERAR SENHA ──
router.put('/senha', auth, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    
    if (!nova_senha || nova_senha.length < 8) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 8 caracteres' });
    }

    const valida = await bcrypt.compare(senha_atual, req.usuario.senha);
    if (!valida) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    const hash = await bcrypt.hash(nova_senha, 12);
    await req.usuario.update({ senha: hash });
    
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// ── REFRESH TOKEN ──
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token obrigatório' });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    if (decoded.tipo !== 'refresh') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const usuario = await Usuario.findByPk(decoded.id, {
      include: [{ model: Empresa, attributes: ['id', 'nome', 'tipo_negocio', 'ativo', 'subdominio'] }]
    });

    if (!usuario || !usuario.ativo || !usuario.Empresa?.ativo) {
      return res.status(401).json({ error: 'Acesso negado' });
    }

    // ── ISOLAMENTO: Validar que o refresh pertence ao mesmo tenant ──
    const tenantSlug = (req.headers['x-tenant-slug'] || '').toLowerCase().trim();
    if (tenantSlug) {
      const tenantEmpresa = await resolveBySlug(tenantSlug);
      if (!tenantEmpresa || tenantEmpresa.id !== usuario.empresa_id) {
        logger.warn('ALERTA: Tentativa de refresh cross-tenant bloqueada', {
          tipo: 'cross_tenant_refresh',
          usuario_id: usuario.id,
          empresa_usuario: usuario.empresa_id,
          tenant_slug: tenantSlug,
          tenant_id: tenantEmpresa?.id,
          ip: req.ip
        });
        return res.status(404).json({ error: 'Recurso não encontrado' });
      }
    }

    // Gerar novos tokens
    const newToken = jwt.sign(
      { id: usuario.id, empresa_id: usuario.empresa_id, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const newRefreshToken = jwt.sign(
      { id: usuario.id, empresa_id: usuario.empresa_id, tipo: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES }
    );

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Refresh token inválido' });
  }
});

module.exports = router;
