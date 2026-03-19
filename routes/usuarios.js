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
