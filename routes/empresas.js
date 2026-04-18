const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Empresa } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Upload de logo - max 2MB, apenas imagens
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'logos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'logo-' + req.empresa_id + '-' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Formato de imagem nao permitido'));
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

// Atualizar dados da empresa - todos os campos editaveis
router.put('/', auth, perfil('administrador'), async (req, res) => {
  try {
    const campos = [
      'nome', 'nome_fantasia', 'cnpj', 'inscricao_estadual', 'inscricao_municipal',
      'tipo_negocio', 'regime_tributario',
      'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep', 'codigo_ibge',
      'telefone', 'email',
      'responsavel_tecnico', 'crf_responsavel',
      'ambiente_fiscal', 'serie_nfce', 'serie_nfe', 'csc_id', 'csc_token',
      'cor_primaria', 'cor_secundaria',
      'configuracoes'
    ];

    const dados = {};
    campos.forEach(c => { if (req.body[c] !== undefined) dados[c] = req.body[c]; });

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    await Empresa.update(dados, { where: { id: req.empresa_id } });
    const empresa = await Empresa.findByPk(req.empresa_id);

    res.json(empresa);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
});

// Upload de logo
router.post('/logo', auth, perfil('administrador'), (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande (max 2MB)' });
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    try {
      // Remover logo anterior
      const empresa = await Empresa.findByPk(req.empresa_id);
      if (empresa.logo_url) {
        const oldPath = path.resolve(path.join(__dirname, '..', 'public', empresa.logo_url));
        if (oldPath.startsWith(uploadDir) && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const logoUrl = '/uploads/logos/' + req.file.filename;
      await Empresa.update({ logo_url: logoUrl }, { where: { id: req.empresa_id } });
      const updated = await Empresa.findByPk(req.empresa_id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao salvar logo' });
    }
  });
});

// Remover logo
router.delete('/logo', auth, perfil('administrador'), async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.empresa_id);
    if (empresa.logo_url) {
      const filePath = path.resolve(path.join(__dirname, '..', 'public', empresa.logo_url));
      if (filePath.startsWith(uploadDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Empresa.update({ logo_url: null }, { where: { id: req.empresa_id } });
    res.json({ message: 'Logo removida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover logo' });
  }
});

module.exports = router;
