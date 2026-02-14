const router = require('express').Router();
const { Categoria } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Listar categorias
router.get('/', auth, async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      order: [['nome', 'ASC']]
    });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar categorias' });
  }
});

// Criar categoria
router.post('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const categoria = await Categoria.create({
      empresa_id: req.empresa_id,
      nome: req.body.nome,
      descricao: req.body.descricao
    });
    res.status(201).json(categoria);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// Atualizar
router.put('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    const cat = await Categoria.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
    
    await cat.update({ nome: req.body.nome, descricao: req.body.descricao });
    res.json(cat);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Desativar
router.delete('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    await Categoria.update({ ativo: false }, { where: { id: req.params.id, empresa_id: req.empresa_id } });
    res.json({ message: 'Categoria desativada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar categoria' });
  }
});

module.exports = router;
