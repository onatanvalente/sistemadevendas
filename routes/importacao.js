const router = require('express').Router();
const multer = require('multer');
const { Produto, Categoria, Fornecedor, sequelize } = require('../models');
const { auth, perfil } = require('../middleware/auth');
const { logger } = require('../config/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      return cb(null, true);
    }
    cb(new Error('Apenas arquivos CSV sao permitidos'));
  }
});

// =========================================================
//  IMPORT CSV DE PRODUTOS
// =========================================================
router.post('/', auth, perfil('administrador', 'gerente'), upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  const t = await sequelize.transaction();
  try {
    const conteudo = req.file.buffer.toString('utf-8');
    const linhas = conteudo.split(/\r?\n/).filter(l => l.trim());

    if (linhas.length < 2) {
      return res.status(400).json({ error: 'Arquivo vazio ou sem dados (minimo: cabecalho + 1 linha)' });
    }

    // Parse cabecalho
    const separador = linhas[0].includes(';') ? ';' : ',';
    const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase().replace(/['"]/g, ''));

    // Campos obrigatorios
    const camposObrigatorios = ['nome', 'preco_venda'];
    const faltando = camposObrigatorios.filter(c => !cabecalho.includes(c));
    if (faltando.length > 0) {
      return res.status(400).json({
        error: 'Campos obrigatorios faltando: ' + faltando.join(', '),
        campos_esperados: ['nome', 'preco_venda', 'preco_custo', 'codigo_barras', 'estoque_atual', 'estoque_minimo', 'unidade', 'categoria', 'marca']
      });
    }

    // Cache de categorias
    const categorias = await Categoria.findAll({ where: { empresa_id: req.empresa_id }, transaction: t });
    const catMap = {};
    categorias.forEach(c => { catMap[c.nome.toLowerCase()] = c.id; });

    const resultados = { importados: 0, atualizados: 0, erros: [] };

    for (let i = 1; i < linhas.length; i++) {
      try {
        const valores = parseCSVLine(linhas[i], separador);
        const dado = {};
        cabecalho.forEach((col, idx) => { dado[col] = (valores[idx] || '').trim().replace(/^["']|["']$/g, ''); });

        if (!dado.nome || !dado.preco_venda) {
          resultados.erros.push({ linha: i + 1, erro: 'Nome ou preco_venda vazio' });
          continue;
        }

        const precoVenda = parseNumber(dado.preco_venda);
        if (isNaN(precoVenda) || precoVenda <= 0) {
          resultados.erros.push({ linha: i + 1, erro: 'Preco de venda invalido: ' + dado.preco_venda });
          continue;
        }

        // Buscar categoria pelo nome
        let categoriaId = null;
        if (dado.categoria) {
          categoriaId = catMap[dado.categoria.toLowerCase()];
          if (!categoriaId) {
            // Criar categoria automaticamente
            const novaCat = await Categoria.create({
              empresa_id: req.empresa_id, nome: dado.categoria
            }, { transaction: t });
            catMap[dado.categoria.toLowerCase()] = novaCat.id;
            categoriaId = novaCat.id;
          }
        }

        const precoCusto = parseNumber(dado.preco_custo) || 0;
        const margem = precoVenda > 0 && precoCusto > 0
          ? (((precoVenda - precoCusto) / precoCusto) * 100)
          : 0;

        const produtoData = {
          empresa_id: req.empresa_id,
          nome: dado.nome,
          preco_venda: precoVenda,
          preco_custo: precoCusto,
          margem: margem,
          codigo_barras: dado.codigo_barras || null,
          codigo_interno: dado.codigo_interno || null,
          marca: dado.marca || null,
          unidade: dado.unidade || 'UN',
          estoque_atual: parseNumber(dado.estoque_atual) || 0,
          estoque_minimo: parseNumber(dado.estoque_minimo) || 0,
          categoria_id: categoriaId,
          ncm: dado.ncm || null,
          descricao: dado.descricao || null
        };

        // Verificar se produto ja existe por codigo_barras
        let produtoExistente = null;
        if (dado.codigo_barras) {
          produtoExistente = await Produto.findOne({
            where: { empresa_id: req.empresa_id, codigo_barras: dado.codigo_barras },
            transaction: t
          });
        }

        if (produtoExistente) {
          // Atualizar
          delete produtoData.empresa_id;
          delete produtoData.estoque_atual; // Nao sobrescrever estoque
          await produtoExistente.update(produtoData, { transaction: t });
          resultados.atualizados++;
        } else {
          await Produto.create(produtoData, { transaction: t });
          resultados.importados++;
        }
      } catch (lineError) {
        resultados.erros.push({ linha: i + 1, erro: lineError.message });
      }
    }

    await t.commit();

    logger.info('Import CSV concluido', {
      empresa_id: req.empresa_id,
      importados: resultados.importados,
      atualizados: resultados.atualizados,
      erros: resultados.erros.length
    });

    res.json({
      message: 'Importacao concluida',
      resultado: resultados
    });
  } catch (error) {
    await t.rollback();
    logger.error('Erro no import CSV', { error: error.message });
    res.status(500).json({ error: 'Erro ao importar produtos' });
  }
});

// Template CSV para download
router.get('/template', auth, (req, res) => {
  const template = 'nome;codigo_barras;preco_custo;preco_venda;estoque_atual;estoque_minimo;unidade;categoria;marca;ncm;descricao\n' +
    'Arroz 5kg;7891234567890;12.50;18.90;100;20;UN;Alimentos;Tio Joao;1006.30.21;\n' +
    'Feijao 1kg;7891234567891;6.80;9.90;80;15;UN;Alimentos;Kicaldo;0713.33.19;';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=template-produtos.csv');
  res.send(template);
});

// Parse linha CSV respeitando aspas
function parseCSVLine(line, sep) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === sep && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

// Parse numero (aceita , e . como decimal)
function parseNumber(str) {
  if (!str) return 0;
  str = str.trim().replace(/[^\d,.\-]/g, '');
  // Se tem virgula e ponto, virgula eh decimal (padrao BR)
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  return parseFloat(str);
}

module.exports = router;
