const router = require('express').Router();
const { Empresa } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Atualizar dados da empresa
router.put('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const campos = ['nome', 'endereco', 'cidade', 'estado', 'cep', 'telefone', 'email',
      'responsavel_tecnico', 'crf_responsavel', 'regime_tributario'];
    
    const dados = {};
    campos.forEach(c => { if (req.body[c] !== undefined) dados[c] = req.body[c]; });

    await Empresa.update(dados, { where: { id: req.empresa_id } });
    const empresa = await Empresa.findByPk(req.empresa_id);
    
    res.json(empresa);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
});

// Dados da empresa
router.get('/', auth, async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.empresa_id);
    res.json(empresa);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar empresa' });
  }
});

module.exports = router;
