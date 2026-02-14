const router = require('express').Router();
const { Fornecedor } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Listar
router.get('/', auth, async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      where: { empresa_id: req.empresa_id, ativo: true },
      order: [['nome', 'ASC']]
    });
    res.json(fornecedores);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar fornecedores' });
  }
});

// Criar
router.post('/', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const fornecedor = await Fornecedor.create({
      empresa_id: req.empresa_id,
      ...req.body
    });
    res.status(201).json(fornecedor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// Atualizar
router.put('/:id', auth, perfil('administrador', 'financeiro'), async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!f) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    await f.update(req.body);
    res.json(f);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// Desativar
router.delete('/:id', auth, perfil('administrador'), async (req, res) => {
  try {
    await Fornecedor.update({ ativo: false }, { where: { id: req.params.id, empresa_id: req.empresa_id } });
    res.json({ message: 'Fornecedor desativado' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desativar fornecedor' });
  }
});

module.exports = router;
