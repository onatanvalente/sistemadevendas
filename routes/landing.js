/* ══════════════════════════════════════════════════════════════
   ROTAS: Landing Page (Registro público de novos clientes)
   Endpoint público — NÃO requer autenticação
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Empresa, Usuario } = require('../models');
const { sequelize } = require('../config/database');
const { gerarSlug } = require('../middleware/tenantResolver');
const { logger } = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'sgc_jwt_secret_default';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_SECRET = (process.env.JWT_SECRET || 'sgc_jwt_secret_default') + '_refresh';
const REFRESH_EXPIRES = '7d';

// ── REGISTRO DE NOVO CLIENTE (Landing Page) ──
router.post('/registro', [
  body('empresa_nome').trim().notEmpty().withMessage('Nome da empresa é obrigatório')
    .isLength({ min: 3, max: 200 }).escape(),
  body('nome').trim().notEmpty().withMessage('Seu nome é obrigatório')
    .isLength({ min: 2, max: 200 }).escape(),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('senha').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres'),
  body('tipo_negocio').optional().isIn(['mercado', 'drogaria', 'padaria', 'loja', 'restaurante', 'outro']),
  body('telefone').optional().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { empresa_nome, tipo_negocio, nome, email, senha, telefone } = req.body;

    // Verificar email único (mensagem genérica)
    const emailExiste = await Usuario.findOne({ where: { email } });
    if (emailExiste) {
      return res.status(400).json({ error: 'Não foi possível criar a conta. Verifique os dados informados.' });
    }

    // Gerar slug único
    let slug = gerarSlug(empresa_nome);
    let slugBase = slug;
    let tentativa = 0;
    while (await Empresa.findOne({ where: { subdominio: slug } })) {
      tentativa++;
      slug = slugBase + '-' + tentativa;
    }

    // CNPJ placeholder único — será preenchido pelo cliente depois
    const cnpjTemp = '00.000.000/' + String(Date.now()).slice(-8, -4) + '-' + String(Date.now()).slice(-2);

    const senhaHash = await bcrypt.hash(senha, 12);

    // Transação: empresa + usuario criados juntos ou nenhum
    const { novaEmpresa, novoUsuario } = await sequelize.transaction(async (t) => {
      const novaEmpresa = await Empresa.create({
        nome: empresa_nome,
        nome_fantasia: empresa_nome,
        cnpj: cnpjTemp,
        tipo_negocio: (tipo_negocio === 'drogaria') ? 'drogaria' : 'mercado',
        subdominio: slug,
        telefone: telefone || null,
        email: email,
        status: 'ativo',
        ativo: true,
        plano: 'basico',
        origem_cadastro: 'landing_page',
        cor_primaria: tipo_negocio === 'drogaria' ? '#059669' : '#2563eb',
        cor_secundaria: tipo_negocio === 'drogaria' ? '#0ea5e9' : '#10b981'
      }, { transaction: t });

      const novoUsuario = await Usuario.create({
        empresa_id: novaEmpresa.id,
        nome: nome,
        email: email,
        senha: senhaHash,
        perfil: 'administrador'
      }, { transaction: t });

      return { novaEmpresa, novoUsuario };
    });

    const token = jwt.sign(
      { id: novoUsuario.id, empresa_id: novaEmpresa.id, perfil: 'administrador' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const refreshToken = jwt.sign(
      { id: novoUsuario.id, empresa_id: novaEmpresa.id, tipo: 'refresh' },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRES }
    );

    logger.info('Novo tenant criado via landing', { empresa: novaEmpresa.nome, slug, tipo_negocio: novaEmpresa.tipo_negocio });

    res.status(201).json({
      message: 'Conta criada com sucesso!',
      token,
      refreshToken,
      slug: slug,
      url_acesso: '/app/' + slug,
      usuario: { id: novoUsuario.id, nome: novoUsuario.nome, email: novoUsuario.email },
      empresa: { id: novaEmpresa.id, nome: novaEmpresa.nome, tipo_negocio: novaEmpresa.tipo_negocio }
    });
  } catch (error) {
    logger.error('[Landing Registro] Erro ao criar conta', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      sql: error.sql || undefined
    });
    res.status(500).json({ error: 'Erro ao criar conta', detail: error.message });
  }
});

// ── VERIFICAR DISPONIBILIDADE DE SLUG ──
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const slug = gerarSlug(req.params.slug);
    const existe = await Empresa.findOne({ where: { subdominio: slug } });
    res.json({ slug, disponivel: !existe });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar' });
  }
});

// ── BUSCAR DADOS PÚBLICOS DE UM TENANT (para login page) ──
// Protegido: se há token de outro tenant, retorna 404 silencioso
router.get('/tenant/:slug', async (req, res) => {
  try {
    // Verificar se há token de outro tenant (não revelar existência)
    const authHeader = req.headers.authorization || '';
    const tokenStr = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (tokenStr) {
      try {
        const decoded = jwt.verify(tokenStr, JWT_SECRET);
        if (decoded.empresa_id) {
          // Buscar empresa do slug
          const target = await Empresa.findOne({
            where: { subdominio: req.params.slug },
            attributes: ['id']
          });
          if (target && target.id !== decoded.empresa_id) {
            return res.status(404).json({ error: 'Não encontrado' });
          }
        }
      } catch(e) { /* token inválido — permitir (mostrará login) */ }
    }

    const empresa = await Empresa.findOne({
      where: { subdominio: req.params.slug },
      attributes: ['id', 'nome', 'nome_fantasia', 'tipo_negocio', 'subdominio',
        'cor_primaria', 'cor_secundaria', 'logo_url', 'ativo', 'status']
    });
    if (!empresa || !empresa.ativo) {
      return res.status(404).json({ error: 'Não encontrado' });
    }
    if (empresa.status === 'suspenso' || empresa.status === 'cancelado') {
      return res.status(404).json({ error: 'Não encontrado' });
    }
    res.json(empresa);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
