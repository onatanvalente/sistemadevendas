/* ═══════════════════════════════════════════════════════════════════
   SGC — Rotas de Etiquetas  v1.0
   CRUD de modelos de etiqueta + geração/simulação de preço clube
   ═══════════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { auth, perfil } = require('../middleware/auth');
const {
  ModeloEtiqueta, ConfigImpressao, Produto, Categoria,
  ProgramaComercial, RegraDesconto, ClientePrograma, Empresa
} = require('../models');
const { avaliarDescontos, normalizarRegrasDB } = require('../engine/motor-descontos');

// Helper: validar FK pertence ao tenant
async function validarFKTenant(Model, id, empresa_id, nome) {
  if (!id) return null;
  const reg = await Model.findOne({ where: { id, empresa_id } });
  if (!reg) throw new Error(nome + ' não encontrado(a)');
  return reg;
}

// ════════════════════════════════════════════
//  MODELOS DE ETIQUETA — CRUD
// ════════════════════════════════════════════

// GET / — listar modelos
router.get('/', auth, async (req, res) => {
  try {
    const modelos = await ModeloEtiqueta.findAll({
      where: { empresa_id: req.empresa_id },
      order: [['tipo', 'ASC'], ['nome', 'ASC']]
    });
    res.json(modelos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:id — detalhe do modelo
router.get('/:id', auth, async (req, res) => {
  try {
    const m = await ModeloEtiqueta.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!m) return res.status(404).json({ error: 'Modelo não encontrado' });
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST / — criar modelo
router.post('/', auth, perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const { nome, largura_mm, altura_mm, tipo, layout_json, ativo } = req.body;
    if (!nome || !tipo) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
    if (!['padrao', 'promocional', 'clube'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo deve ser: padrao, promocional ou clube' });
    }
    const modelo = await ModeloEtiqueta.create({
      empresa_id: req.empresa_id,
      nome, largura_mm: largura_mm || 40, altura_mm: altura_mm || 30,
      tipo, layout_json: layout_json || null, ativo: ativo !== false
    });
    res.status(201).json(modelo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id — atualizar modelo
router.put('/:id', auth, perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const m = await ModeloEtiqueta.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!m) return res.status(404).json({ error: 'Modelo não encontrado' });
    const campos = ['nome', 'largura_mm', 'altura_mm', 'tipo', 'layout_json', 'ativo'];
    campos.forEach(c => { if (req.body[c] !== undefined) m[c] = req.body[c]; });
    await m.save();
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id — excluir modelo
router.delete('/:id', auth, perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const m = await ModeloEtiqueta.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!m) return res.status(404).json({ error: 'Modelo não encontrado' });
    await m.destroy();
    res.json({ message: 'Modelo excluído' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /seed — criar modelos padrão se não existirem (qualquer usuário autenticado)
router.post('/seed', auth, async (req, res) => {
  try {
    const existentes = await ModeloEtiqueta.count({ where: { empresa_id: req.empresa_id } });
    if (existentes > 0) return res.json({ message: 'Modelos já existem', total: existentes });

    const defaults = [
      { nome: 'Gôndola Pequena (40x30)', largura_mm: 40, altura_mm: 30, tipo: 'padrao' },
      { nome: 'Promo Destaque (60x40)', largura_mm: 60, altura_mm: 40, tipo: 'promocional' },
      { nome: 'Folha A4 Padrão', largura_mm: 210, altura_mm: 297, tipo: 'padrao' },
      { nome: 'Gôndola Pequena Promo (40x30)', largura_mm: 40, altura_mm: 30, tipo: 'promocional' },
      { nome: 'Clube Gôndola (40x30)', largura_mm: 40, altura_mm: 30, tipo: 'clube' },
      { nome: 'Clube Destaque (60x40)', largura_mm: 60, altura_mm: 40, tipo: 'clube' }
    ];
    const criados = await ModeloEtiqueta.bulkCreate(
      defaults.map(d => ({ ...d, empresa_id: req.empresa_id }))
    );
    res.status(201).json({ message: 'Modelos criados', total: criados.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════
//  CONFIG IMPRESSÃO
// ════════════════════════════════════════════

// GET /config-impressao — obter config (ou defaults)
router.get('/config-impressao/atual', auth, async (req, res) => {
  try {
    let config = await ConfigImpressao.findOne({ where: { empresa_id: req.empresa_id } });
    if (!config) {
      config = { tipo_impressora: 'laser', largura_papel_mm: 210, margem_superior: 5, margem_lateral: 5, dpi: 203 };
    }
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /config-impressao — salvar config
router.put('/config-impressao/atual', auth, perfil(['administrador']), async (req, res) => {
  try {
    const { tipo_impressora, largura_papel_mm, margem_superior, margem_lateral, dpi } = req.body;
    let config = await ConfigImpressao.findOne({ where: { empresa_id: req.empresa_id } });
    if (config) {
      if (tipo_impressora) config.tipo_impressora = tipo_impressora;
      if (largura_papel_mm !== undefined) config.largura_papel_mm = largura_papel_mm;
      if (margem_superior !== undefined) config.margem_superior = margem_superior;
      if (margem_lateral !== undefined) config.margem_lateral = margem_lateral;
      if (dpi !== undefined) config.dpi = dpi;
      await config.save();
    } else {
      config = await ConfigImpressao.create({
        empresa_id: req.empresa_id,
        tipo_impressora: tipo_impressora || 'laser',
        largura_papel_mm: largura_papel_mm || 210,
        margem_superior: margem_superior || 5,
        margem_lateral: margem_lateral || 5,
        dpi: dpi || 203
      });
    }
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════
//  SIMULAÇÃO DE PREÇO CLUBE — usa o mesmo motor do PDV
// ════════════════════════════════════════════

// POST /simular-preco — calcula preço clube para N produtos
// Body: { produto_ids: [1,2,3], programa_id: 5 }
router.post('/simular-preco', auth, async (req, res) => {
  try {
    const { produto_ids, programa_id } = req.body;
    if (!produto_ids || !Array.isArray(produto_ids) || produto_ids.length === 0) {
      return res.status(400).json({ error: 'produto_ids é obrigatório (array)' });
    }
    if (!programa_id) {
      return res.status(400).json({ error: 'programa_id é obrigatório' });
    }

    // Verificar programa existe e pertence ao tenant
    const programa = await ProgramaComercial.findOne({
      where: { id: programa_id, empresa_id: req.empresa_id, ativo: true },
      include: [{
        model: RegraDesconto,
        where: { ativo: true },
        required: false,
        include: [
          { model: Produto, attributes: ['id', 'nome'] },
          { model: Categoria, attributes: ['id', 'nome'] }
        ]
      }]
    });
    if (!programa) return res.status(404).json({ error: 'Programa não encontrado ou inativo' });

    // Montar regras no formato flat do motor (simular inscrição)
    const inscricaoFake = [{
      ProgramaComercial: {
        id: programa.id,
        nome: programa.nome,
        tipo: programa.tipo,
        acumulativo_global: programa.acumulativo_global,
        prioridade_global: programa.prioridade_global,
        RegraDescontos: programa.RegraDescontos || []
      }
    }];
    const regrasFlat = normalizarRegrasDB(inscricaoFake);

    // Filtrar por vigência (mesmo que o motor do PDV faz)
    const agora = new Date();
    const regrasVigentes = regrasFlat.filter(r => {
      if (r.data_inicio && new Date(r.data_inicio) > agora) return false;
      if (r.data_fim && new Date(r.data_fim) < agora) return false;
      return true;
    });

    // Carregar produtos
    const produtos = await Produto.findAll({
      where: { id: produto_ids, empresa_id: req.empresa_id },
      attributes: ['id', 'nome', 'codigo_barras', 'preco_venda', 'preco_promocional', 'categoria_id', 'imagem_url']
    });

    // Simular desconto para cada produto
    const resultados = produtos.map(p => {
      const prod = { id: p.id, preco_venda: parseFloat(p.preco_venda), categoria_id: p.categoria_id };
      const decisao = avaliarDescontos(regrasVigentes, prod);
      return {
        id: p.id,
        nome: p.nome,
        codigo_barras: p.codigo_barras,
        preco_normal: parseFloat(p.preco_venda),
        preco_promocional: p.preco_promocional ? parseFloat(p.preco_promocional) : null,
        preco_clube: decisao ? decisao.preco_aplicado : parseFloat(p.preco_venda),
        desconto_total: decisao ? decisao.desconto_total : 0,
        tipo_desconto: decisao ? decisao.tipo_desconto : null,
        valor_desconto: decisao ? decisao.valor_desconto : null,
        programa_nome: programa.nome,
        tem_desconto: !!decisao
      };
    });

    res.json({
      programa: { id: programa.id, nome: programa.nome, tipo: programa.tipo },
      produtos: resultados
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════
//  PRODUTOS DO PROGRAMA — lista produtos afetados pelas regras
// ════════════════════════════════════════════

// GET /programa/:id/produtos — lista produtos do programa para impressão em lote
router.get('/programa/:id/produtos', auth, async (req, res) => {
  try {
    const programa = await ProgramaComercial.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{
        model: RegraDesconto,
        where: { ativo: true },
        required: false,
        include: [
          { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'preco_venda', 'categoria_id'] },
          { model: Categoria, attributes: ['id', 'nome'] }
        ]
      }]
    });
    if (!programa) return res.status(404).json({ error: 'Programa não encontrado' });

    // Coletar produto_ids das regras
    const produtoIds = new Set();
    const regras = programa.RegraDescontos || [];

    for (const r of regras) {
      if (r.escopo === 'produto' && r.produto_id) {
        produtoIds.add(r.produto_id);
      } else if (r.escopo === 'categoria' && r.categoria_id) {
        // Buscar todos os produtos da categoria
        const prodsCat = await Produto.findAll({
          where: { categoria_id: r.categoria_id, empresa_id: req.empresa_id, ativo: true },
          attributes: ['id']
        });
        prodsCat.forEach(p => produtoIds.add(p.id));
      } else if (r.escopo === 'geral') {
        // Todos os produtos ativos
        const todos = await Produto.findAll({
          where: { empresa_id: req.empresa_id, ativo: true },
          attributes: ['id']
        });
        todos.forEach(p => produtoIds.add(p.id));
      }
    }

    // Carregar produtos completos
    const produtos = await Produto.findAll({
      where: { id: Array.from(produtoIds), empresa_id: req.empresa_id },
      attributes: ['id', 'nome', 'codigo_barras', 'preco_venda', 'preco_promocional', 'categoria_id'],
      order: [['nome', 'ASC']]
    });

    // Simular preço com motor
    const inscricaoFake = [{
      ProgramaComercial: {
        id: programa.id,
        nome: programa.nome,
        tipo: programa.tipo,
        acumulativo_global: programa.acumulativo_global,
        prioridade_global: programa.prioridade_global,
        RegraDescontos: regras
      }
    }];
    const regrasFlat = normalizarRegrasDB(inscricaoFake);

    const agora = new Date();
    const regrasVigentes = regrasFlat.filter(r => {
      if (r.data_inicio && new Date(r.data_inicio) > agora) return false;
      if (r.data_fim && new Date(r.data_fim) < agora) return false;
      return true;
    });

    const resultados = produtos.map(p => {
      const prod = { id: p.id, preco_venda: parseFloat(p.preco_venda), categoria_id: p.categoria_id };
      const decisao = avaliarDescontos(regrasVigentes, prod);
      return {
        id: p.id,
        nome: p.nome,
        codigo_barras: p.codigo_barras,
        preco_normal: parseFloat(p.preco_venda),
        preco_promocional: p.preco_promocional ? parseFloat(p.preco_promocional) : null,
        preco_clube: decisao ? decisao.preco_aplicado : parseFloat(p.preco_venda),
        desconto_total: decisao ? decisao.desconto_total : 0,
        percentual_off: decisao ? Math.round((decisao.desconto_total / parseFloat(p.preco_venda)) * 100) : 0,
        tem_desconto: !!decisao
      };
    });

    res.json({
      programa: { id: programa.id, nome: programa.nome, tipo: programa.tipo },
      total: resultados.length,
      produtos: resultados
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
