/* ══════════════════════════════════════════════════════════════
   VarlenSYS — Rotas: Programas Comerciais  v3.0
   CRUD Programas, Regras de Desconto, Inscricao de Clientes
   Endpoint de consulta de descontos via Motor de Decisão
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, perfil, tenant } = require('../middleware/auth');
const { 
  sequelize, ProgramaComercial, RegraDesconto, ClientePrograma, 
  Cliente, Produto, Categoria, HistoricoAplicacaoPrograma 
} = require('../models');
const { avaliarDescontos, normalizarRegrasDB } = require('../engine/motor-descontos');

router.use(auth, tenant);

// ══════════════════════════════════════════════
//  HELPER: buscar regras ativas do cliente (cache-ready)
// ══════════════════════════════════════════════
async function buscarRegrasCliente(clienteId, empresaId) {
  const hoje = new Date().toISOString().split('T')[0];
  const inscricoes = await ClientePrograma.findAll({
    where: { cliente_id: clienteId, status: 'ativo' },
    include: [{
      model: ProgramaComercial,
      where: {
        empresa_id: empresaId, ativo: true,
        [Op.or]: [
          { data_inicio: null, data_fim: null },
          { data_inicio: { [Op.lte]: hoje }, data_fim: null },
          { data_inicio: null, data_fim: { [Op.gte]: hoje } },
          { data_inicio: { [Op.lte]: hoje }, data_fim: { [Op.gte]: hoje } }
        ]
      },
      include: [{
        model: RegraDesconto,
        where: {
          ativo: true,
          [Op.or]: [
            { data_inicio: null, data_fim: null },
            { data_inicio: { [Op.lte]: hoje }, data_fim: null },
            { data_inicio: null, data_fim: { [Op.gte]: hoje } },
            { data_inicio: { [Op.lte]: hoje }, data_fim: { [Op.gte]: hoje } }
          ]
        },
        required: false,
        include: [
          { model: Produto, attributes: ['id', 'nome'], required: false },
          { model: Categoria, attributes: ['id', 'nome'], required: false }
        ]
      }]
    }]
  });
  return normalizarRegrasDB(inscricoes);
}

// ══════════════════════════════════════════════
//  ROTAS ESTATICAS — devem ficar ANTES de /:id
// ══════════════════════════════════════════════

// GET /descontos/cliente/:clienteId — Todas as regras ativas (PDV cache)
router.get('/descontos/cliente/:clienteId', async (req, res) => {
  try {
    const regras = await buscarRegrasCliente(req.params.clienteId, req.empresa_id);
    regras.sort((a, b) => b.prioridade - a.prioridade);
    res.json(regras);
  } catch (err) {
    console.error('Erro ao buscar descontos do cliente:', err);
    res.status(500).json({ error: 'Erro ao buscar descontos' });
  }
});

// GET /descontos/produto/:produtoId/cliente/:clienteId — Motor de Decisão
router.get('/descontos/produto/:produtoId/cliente/:clienteId', async (req, res) => {
  try {
    const { produtoId, clienteId } = req.params;
    const produto = await Produto.findByPk(produtoId);
    if (!produto) return res.json({ desconto_total: 0, preco_original: 0, preco_aplicado: 0, regras_aplicadas: [] });

    const regrasCliente = await buscarRegrasCliente(clienteId, req.empresa_id);
    const decisao = avaliarDescontos(regrasCliente, {
      id: produto.id,
      preco_venda: produto.preco_venda,
      categoria_id: produto.categoria_id
    });

    if (!decisao) {
      return res.json({
        preco_original: parseFloat(produto.preco_venda),
        preco_aplicado: parseFloat(produto.preco_venda),
        desconto_total: 0,
        tipo_desconto: null,
        valor_desconto: null,
        programa_id: null,
        programa_nome: null,
        regras_aplicadas: [],
        regras_avaliadas: []
      });
    }

    res.json(decisao);
  } catch (err) {
    console.error('Erro ao calcular desconto (motor):', err);
    res.status(500).json({ error: 'Erro ao calcular desconto' });
  }
});

// GET /stats — Estatisticas / Dashboard
router.get('/stats', async (req, res) => {
  try {
    const total = await ProgramaComercial.count({ where: { empresa_id: req.empresa_id } });
    const ativos = await ProgramaComercial.count({ where: { empresa_id: req.empresa_id, ativo: true } });
    const totalInscritos = await ClientePrograma.count({
      where: { status: 'ativo' },
      include: [{ model: ProgramaComercial, where: { empresa_id: req.empresa_id }, attributes: [] }]
    });
    const totalRegras = await RegraDesconto.count({
      where: { ativo: true },
      include: [{ model: ProgramaComercial, where: { empresa_id: req.empresa_id }, attributes: [] }]
    });
    res.json({ total, ativos, totalInscritos, totalRegras });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar estatisticas' }); }
});

// GET / — Listar programas
router.get('/', async (req, res) => {
  try {
    const { tipo, ativo, busca } = req.query;
    const where = { empresa_id: req.empresa_id };
    if (tipo) where.tipo = tipo;
    if (ativo !== undefined) where.ativo = ativo === 'true';
    if (busca) where.nome = { [Op.iLike]: `%${busca}%` };
    const programas = await ProgramaComercial.findAll({
      where,
      include: [
        { model: RegraDesconto, include: [
          { model: Produto, attributes: ['id', 'nome', 'codigo_barras'], required: false },
          { model: Categoria, attributes: ['id', 'nome'], required: false }
        ]},
        { model: ClientePrograma, attributes: ['id', 'cliente_id', 'status'] }
      ],
      order: [['prioridade_global', 'DESC'], ['nome', 'ASC']]
    });
    res.json(programas);
  } catch (err) {
    console.error('Erro ao listar programas:', err);
    res.status(500).json({ error: 'Erro ao listar programas comerciais' });
  }
});

// GET /:id — Detalhes do programa
router.get('/:id', async (req, res) => {
  try {
    const programa = await ProgramaComercial.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [
        { model: RegraDesconto, include: [
          { model: Produto, attributes: ['id', 'nome', 'codigo_barras', 'preco_venda'], required: false },
          { model: Categoria, attributes: ['id', 'nome'], required: false }
        ]},
        { model: ClientePrograma, include: [
          { model: Cliente, attributes: ['id', 'nome', 'cpf', 'telefone'] }
        ]}
      ]
    });
    if (!programa) return res.status(404).json({ error: 'Programa nao encontrado' });
    res.json(programa);
  } catch (err) {
    console.error('Erro ao buscar programa:', err);
    res.status(500).json({ error: 'Erro ao buscar programa' });
  }
});

// POST / — Criar programa
router.post('/', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const { nome, tipo, descricao, ativo, data_inicio, data_fim, acumulativo, acumulativo_global, prioridade, prioridade_global, programa_padrao } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome eh obrigatorio' });
    if (data_inicio && data_fim && data_fim < data_inicio) {
      return res.status(400).json({ error: 'Data fim deve ser posterior a data inicio' });
    }
    // Se programa_padrao = true, desmarcar todos os outros da mesma empresa
    if (programa_padrao) {
      await ProgramaComercial.update(
        { programa_padrao: false },
        { where: { empresa_id: req.empresa_id, programa_padrao: true } }
      );
    }
    const programa = await ProgramaComercial.create({
      empresa_id: req.empresa_id,
      nome, tipo: tipo || 'clube', descricao,
      ativo: ativo !== false,
      programa_padrao: programa_padrao || false,
      data_inicio: data_inicio || null, data_fim: data_fim || null,
      acumulativo_global: acumulativo_global !== undefined ? acumulativo_global : (acumulativo || false),
      prioridade_global: prioridade_global !== undefined ? prioridade_global : (prioridade || 0)
    });
    res.status(201).json(programa);
  } catch (err) {
    console.error('Erro ao criar programa:', err);
    res.status(500).json({ error: 'Erro ao criar programa' });
  }
});

// PUT /:id — Atualizar programa
router.put('/:id', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const programa = await ProgramaComercial.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!programa) return res.status(404).json({ error: 'Programa nao encontrado' });
    const { nome, tipo, descricao, ativo, data_inicio, data_fim, acumulativo, acumulativo_global, prioridade, prioridade_global, programa_padrao } = req.body;
    const di = data_inicio !== undefined ? data_inicio : programa.data_inicio;
    const df = data_fim !== undefined ? data_fim : programa.data_fim;
    if (di && df && df < di) return res.status(400).json({ error: 'Data fim deve ser posterior a data inicio' });
    // Se marcando como padrão, desmarcar todos os outros da mesma empresa
    if (programa_padrao === true) {
      await ProgramaComercial.update(
        { programa_padrao: false },
        { where: { empresa_id: req.empresa_id, programa_padrao: true, id: { [Op.ne]: programa.id } } }
      );
    }
    // Aceita nomes antigos (acumulativo/prioridade) e novos (acumulativo_global/prioridade_global)
    const acumVal = acumulativo_global !== undefined ? acumulativo_global : acumulativo;
    const prioVal = prioridade_global !== undefined ? prioridade_global : prioridade;
    await programa.update({
      nome: nome || programa.nome, tipo: tipo || programa.tipo,
      descricao: descricao !== undefined ? descricao : programa.descricao,
      ativo: ativo !== undefined ? ativo : programa.ativo,
      programa_padrao: programa_padrao !== undefined ? programa_padrao : programa.programa_padrao,
      data_inicio: data_inicio !== undefined ? data_inicio : programa.data_inicio,
      data_fim: data_fim !== undefined ? data_fim : programa.data_fim,
      acumulativo_global: acumVal !== undefined ? acumVal : programa.acumulativo_global,
      prioridade_global: prioVal !== undefined ? prioVal : programa.prioridade_global
    });
    res.json(programa);
  } catch (err) {
    console.error('Erro ao atualizar programa:', err);
    res.status(500).json({ error: 'Erro ao atualizar programa' });
  }
});

// DELETE /:id — Remover programa (com transaction)
router.delete('/:id', perfil(['administrador', 'gerente']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const programa = await ProgramaComercial.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }, transaction: t
    });
    if (!programa) { await t.rollback(); return res.status(404).json({ error: 'Programa nao encontrado' }); }
    await RegraDesconto.destroy({ where: { programa_id: programa.id }, transaction: t });
    await ClientePrograma.destroy({ where: { programa_id: programa.id }, transaction: t });
    await programa.destroy({ transaction: t });
    await t.commit();
    res.json({ ok: true });
  } catch (err) {
    await t.rollback();
    console.error('Erro ao remover programa:', err);
    res.status(500).json({ error: 'Erro ao remover programa' });
  }
});

// ══════════════════════════════════════════════
//  REGRAS DE DESCONTO
// ══════════════════════════════════════════════

// POST /:id/regras
router.post('/:id/regras', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const programa = await ProgramaComercial.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!programa) return res.status(404).json({ error: 'Programa nao encontrado' });
    const { tipo_regra, escopo, produto_id, categoria_id, valor, prioridade, acumulativo, data_inicio, data_fim } = req.body;
    if (valor === undefined || valor === null || valor === '') return res.status(400).json({ error: 'Valor da regra obrigatorio' });
    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum < 0) return res.status(400).json({ error: 'Valor deve ser positivo' });
    if (tipo_regra === 'percentual' && valorNum > 100) return res.status(400).json({ error: 'Percentual nao pode exceder 100%' });
    if (escopo === 'produto' && !produto_id) return res.status(400).json({ error: 'Selecione um produto' });
    if (escopo === 'categoria' && !categoria_id) return res.status(400).json({ error: 'Selecione uma categoria' });
    if (data_inicio && data_fim && data_fim < data_inicio) return res.status(400).json({ error: 'Data fim deve ser posterior a data inicio' });
    const regra = await RegraDesconto.create({
      empresa_id: req.empresa_id,
      programa_id: programa.id, tipo_regra: tipo_regra || 'percentual',
      escopo: escopo || 'produto',
      produto_id: escopo === 'produto' ? produto_id : null,
      categoria_id: escopo === 'categoria' ? categoria_id : null,
      valor: valorNum, prioridade: prioridade || 0, acumulativo: acumulativo || false,
      data_inicio: data_inicio || null, data_fim: data_fim || null
    });
    res.status(201).json(regra);
  } catch (err) {
    console.error('Erro ao criar regra:', err);
    res.status(500).json({ error: 'Erro ao criar regra de desconto' });
  }
});

// PUT /regras/:regraId
router.put('/regras/:regraId', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const regra = await RegraDesconto.findByPk(req.params.regraId, {
      include: [{ model: ProgramaComercial, where: { empresa_id: req.empresa_id } }]
    });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });
    const { tipo_regra, escopo, produto_id, categoria_id, valor, prioridade, acumulativo, ativo, data_inicio, data_fim } = req.body;
    const tipoF = tipo_regra || regra.tipo_regra;
    const valorF = valor !== undefined ? parseFloat(valor) : parseFloat(regra.valor);
    if (isNaN(valorF) || valorF < 0) return res.status(400).json({ error: 'Valor deve ser positivo' });
    if (tipoF === 'percentual' && valorF > 100) return res.status(400).json({ error: 'Percentual nao pode exceder 100%' });
    const escopoF = escopo || regra.escopo;
    const diF = data_inicio !== undefined ? data_inicio : regra.data_inicio;
    const dfF = data_fim !== undefined ? data_fim : regra.data_fim;
    if (diF && dfF && dfF < diF) return res.status(400).json({ error: 'Data fim deve ser posterior a data inicio' });
    await regra.update({
      tipo_regra: tipoF, escopo: escopoF,
      produto_id: escopoF === 'produto' ? (produto_id || regra.produto_id) : null,
      categoria_id: escopoF === 'categoria' ? (categoria_id || regra.categoria_id) : null,
      valor: valorF, prioridade: prioridade !== undefined ? prioridade : regra.prioridade,
      acumulativo: acumulativo !== undefined ? acumulativo : regra.acumulativo,
      ativo: ativo !== undefined ? ativo : regra.ativo,
      data_inicio: data_inicio !== undefined ? data_inicio : regra.data_inicio,
      data_fim: data_fim !== undefined ? data_fim : regra.data_fim
    });
    res.json(regra);
  } catch (err) {
    console.error('Erro ao atualizar regra:', err);
    res.status(500).json({ error: 'Erro ao atualizar regra' });
  }
});

// DELETE /regras/:regraId
router.delete('/regras/:regraId', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const regra = await RegraDesconto.findByPk(req.params.regraId, {
      include: [{ model: ProgramaComercial, where: { empresa_id: req.empresa_id } }]
    });
    if (!regra) return res.status(404).json({ error: 'Regra nao encontrada' });
    await regra.destroy();
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao remover regra:', err);
    res.status(500).json({ error: 'Erro ao remover regra' });
  }
});

// ══════════════════════════════════════════════
//  INSCRICAO DE CLIENTES
// ══════════════════════════════════════════════

// POST /:id/clientes
router.post('/:id/clientes', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const programa = await ProgramaComercial.findOne({ where: { id: req.params.id, empresa_id: req.empresa_id } });
    if (!programa) return res.status(404).json({ error: 'Programa nao encontrado' });
    const { cliente_ids } = req.body;
    if (!cliente_ids || !Array.isArray(cliente_ids) || cliente_ids.length === 0) return res.status(400).json({ error: 'Informe ao menos um cliente' });
    const clientes = await Cliente.findAll({ where: { id: { [Op.in]: cliente_ids }, empresa_id: req.empresa_id } });
    if (clientes.length === 0) return res.status(400).json({ error: 'Nenhum cliente valido' });
    const inscritos = [], jaInscritos = [];
    for (const cl of clientes) {
      const [inscricao, created] = await ClientePrograma.findOrCreate({
        where: { cliente_id: cl.id, programa_id: programa.id },
        defaults: { empresa_id: req.empresa_id, status: 'ativo', data_adesao: new Date() }
      });
      if (created) inscritos.push(cl.nome);
      else if (inscricao.status !== 'ativo') { await inscricao.update({ status: 'ativo' }); inscritos.push(cl.nome + ' (reativado)'); }
      else jaInscritos.push(cl.nome);
    }
    res.json({ ok: true, inscritos, jaInscritos,
      mensagem: `${inscritos.length} cliente(s) inscrito(s)` + (jaInscritos.length > 0 ? `, ${jaInscritos.length} ja inscrito(s)` : '')
    });
  } catch (err) {
    console.error('Erro ao inscrever clientes:', err);
    res.status(500).json({ error: 'Erro ao inscrever clientes' });
  }
});

// DELETE /:id/clientes/:clienteId
router.delete('/:id/clientes/:clienteId', perfil(['administrador', 'gerente']), async (req, res) => {
  try {
    const inscricao = await ClientePrograma.findOne({
      where: { programa_id: req.params.id, cliente_id: req.params.clienteId },
      include: [{ model: ProgramaComercial, where: { empresa_id: req.empresa_id } }]
    });
    if (!inscricao) return res.status(404).json({ error: 'Inscricao nao encontrada' });
    await inscricao.update({ status: 'cancelado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao remover cliente do programa:', err);
    res.status(500).json({ error: 'Erro ao remover inscricao' });
  }
});

module.exports = router;