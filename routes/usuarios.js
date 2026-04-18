const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Listar usuários da empresa
router.get('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      where: { empresa_id: req.empresa_id },
      attributes: { exclude: ['senha'] },
      order: [['nome', 'ASC']]
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Criar usuário
router.post('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const { nome, email, senha, perfil: perfilUsuario } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Senha mínima 8 caracteres (§5.2)
    if (senha.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    const existe = await Usuario.findOne({ where: { email, empresa_id: req.empresa_id } });
    if (existe) {
      return res.status(400).json({ error: 'Email já cadastrado nesta empresa' });
    }

    const hash = await bcrypt.hash(senha, 12);
    const usuario = await Usuario.create({
      empresa_id: req.empresa_id,
      nome,
      email,
      senha: hash,
      perfil: perfilUsuario || 'vendedor'
    });

    res.status(201).json({
      id: usuario.id, nome: usuario.nome,
      email: usuario.email, perfil: usuario.perfil
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

    const dados = {};
    if (req.body.nome) dados.nome = req.body.nome;
    if (req.body.email) dados.email = req.body.email;
    if (req.body.perfil) dados.perfil = req.body.perfil;
    if (req.body.ativo !== undefined) dados.ativo = req.body.ativo;
    if (req.body.senha) {
      if (req.body.senha.length < 8) {
        return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
      }
      dados.senha = await bcrypt.hash(req.body.senha, 12);
    }

    await usuario.update(dados);
    res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil, ativo: usuario.ativo });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Trocar a propria senha (qualquer usuario logado)
router.put('/minha-senha', auth, async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias' });
    }
    if (nova_senha.length < 8) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 8 caracteres' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.usuario.id, empresa_id: req.empresa_id }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const senhaOk = await bcrypt.compare(senha_atual, usuario.senha);
    if (!senhaOk) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    const hash = await bcrypt.hash(nova_senha, 12);
    await usuario.update({ senha: hash });
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// Minha conta - dados do usuario logado
router.get('/me', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      where: { id: req.usuario.id, empresa_id: req.empresa_id },
      attributes: { exclude: ['senha'] }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

// Atualizar minha conta (nome, email)
router.put('/me', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      where: { id: req.usuario.id, empresa_id: req.empresa_id }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

    const dados = {};
    if (req.body.nome) dados.nome = req.body.nome;
    if (req.body.email) {
      const existe = await Usuario.findOne({
        where: { email: req.body.email, empresa_id: req.empresa_id }
      });
      if (existe && existe.id !== usuario.id) {
        return res.status(400).json({ error: 'Email ja cadastrado nesta empresa' });
      }
      dados.email = req.body.email;
    }

    await usuario.update(dados);
    res.json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar dados' });
  }
});

// Excluir (desativar) usuário
router.delete('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    const usuario = await Usuario.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (usuario.id === req.usuario.id) {
      return res.status(400).json({ error: 'Não é possível desativar a si mesmo' });
    }

    await usuario.update({ ativo: false });
    res.json({ message: 'Usuário desativado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
});

module.exports = router;
