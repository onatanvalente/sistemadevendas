const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');
const { auth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'sgc_jwt_secret_default';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

// ── REGISTRO DE EMPRESA + ADMIN ──
router.post('/registro', async (req, res) => {
  try {
    const { empresa, usuario } = req.body;

    // Validações básicas
    if (!empresa?.nome || !empresa?.cnpj || !usuario?.nome || !usuario?.email || !usuario?.senha) {
      return res.status(400).json({ error: 'Dados obrigatórios: nome da empresa, CNPJ, nome do usuário, email e senha' });
    }

    // Verificar CNPJ único
    const cnpjExiste = await Empresa.findOne({ where: { cnpj: empresa.cnpj } });
    if (cnpjExiste) {
      return res.status(400).json({ error: 'CNPJ já cadastrado' });
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

    res.status(201).json({
      message: 'Empresa cadastrada com sucesso!',
      token,
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
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Empresa, attributes: ['id', 'nome', 'tipo_negocio', 'ativo'] }]
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    if (!usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    if (!usuario.Empresa?.ativo) {
      return res.status(401).json({ error: 'Empresa inativa' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Atualizar último login
    await usuario.update({ ultimo_login: new Date() });

    const token = jwt.sign(
      { id: usuario.id, empresa_id: usuario.empresa_id, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      },
      empresa: {
        id: usuario.Empresa.id,
        nome: usuario.Empresa.nome,
        tipo_negocio: usuario.Empresa.tipo_negocio
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
      tipo_negocio: req.usuario.Empresa.tipo_negocio
    }
  });
});

// ── ALTERAR SENHA ──
router.put('/senha', auth, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    
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

module.exports = router;
