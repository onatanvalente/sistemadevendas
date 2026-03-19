/* ══════════════════════════════════════════════════════════════
   SGC — Rotas: Clientes
   CRUD + histórico de compras + métricas
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op, fn, col, literal } = require('sequelize');
const { auth, perfil, tenant } = require('../middleware/auth');
const { Cliente, Venda, VendaItem, Produto, ProgramaComercial, ClientePrograma } = require('../models');

// Todas as rotas requerem autenticação + tenant
router.use(auth, tenant);

// ──────────────────────────────────────────────
//  POST /normalizar-cpfs  —  Limpa máscara de CPFs existentes (rodar 1x)
// ──────────────────────────────────────────────
router.post('/normalizar-cpfs', perfil('administrador'), async (req, res) => {
  try {
    const clientes = await Cliente.findAll({ where: { empresa_id: req.empresa_id } });
    let atualizados = 0;
    for (const c of clientes) {
      if (c.cpf && /\D/.test(c.cpf)) {
        c.cpf = c.cpf.replace(/\D/g, '');
        await c.save();
        atualizados++;
      }
    }
    res.json({ message: `${atualizados} CPF(s) normalizados`, total: clientes.length, atualizados });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao normalizar CPFs' });
  }
});

// ──────────────────────────────────────────────
//  GET /  —  Listar clientes
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { busca, ativo, cadastro_incompleto, page = 1, limit = 50 } = req.query;
    const where = { empresa_id: req.empresa_id };

    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${busca}%` } },
        { cpf: { [Op.iLike]: `%${busca}%` } },
        { telefone: { [Op.iLike]: `%${busca}%` } },
        { email: { [Op.iLike]: `%${busca}%` } }
      ];
    }

    if (ativo !== undefined) {
      where.ativo = ativo === 'true';
    }

    if (cadastro_incompleto !== undefined) {
      where.cadastro_incompleto = cadastro_incompleto === 'true';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows: clientes, count: total } = await Cliente.findAndCountAll({
      where,
      order: [['nome', 'ASC']],
      limit: parseInt(limit),
      offset
    });

    res.json({ data: clientes, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// ──────────────────────────────────────────────
//  GET /buscar-cpf/:cpf  —  Busca por CPF (usado no PDV)
//  Normaliza para somente dígitos antes de buscar
// ──────────────────────────────────────────────
router.get('/buscar-cpf/:cpf', async (req, res) => {
  try {
    const cpfDigitos = req.params.cpf.replace(/\D/g, '');
    if (!cpfDigitos || cpfDigitos.length < 11) {
      return res.json({ encontrado: false });
    }

    // Buscar flexível: CPF salvo com ou sem máscara
    const cliente = await Cliente.findOne({
      where: {
        empresa_id: req.empresa_id,
        [Op.or]: [
          { cpf: cpfDigitos },
          { cpf: cpfDigitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') },
          { cpf: { [Op.iLike]: `%${cpfDigitos}%` } }
        ]
      }
    });

    if (!cliente) {
      return res.json({ encontrado: false });
    }

    // Buscar últimas compras
    let ultimasCompras = [];
    try {
      ultimasCompras = await Venda.findAll({
        where: {
          empresa_id: req.empresa_id,
          [Op.or]: [
            { cliente_id: cliente.id },
            { cliente_cpf: { [Op.iLike]: `%${cpfDigitos}%` } }
          ],
          status: 'finalizada'
        },
        include: [{ model: VendaItem, include: [{ model: Produto, attributes: ['id', 'nome'] }] }],
        order: [['created_at', 'DESC']],
        limit: 5
      });
    } catch (vendaErr) {
      console.error('Erro ao buscar compras do cliente:', vendaErr.message);
      // Não impede retorno do cliente
    }

    res.json({ encontrado: true, cliente, ultimasCompras });
  } catch (err) {
    console.error('Erro ao buscar cliente por CPF:', err);
    // NUNCA retornar 500 para busca — retornar não encontrado
    res.json({ encontrado: false, erro: 'Erro na busca' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id  —  Detalhe do cliente + histórico
// ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });

    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    // Histórico de compras (últimas 20)
    let historico = [];
    try {
      historico = await Venda.findAll({
        where: { 
          empresa_id: req.empresa_id, 
          cliente_id: cliente.id,
          status: 'finalizada' 
        },
        include: [{ model: VendaItem, include: [{ model: Produto, attributes: ['id', 'nome', 'principio_ativo'] }] }],
        order: [['created_at', 'DESC']],
        limit: 20
      });
    } catch (errHistorico) {
      console.error('Erro ao buscar historico do cliente:', errHistorico.message);
    }

    // Produtos mais comprados
    let produtosMaisComprados = [];
    try {
      produtosMaisComprados = await VendaItem.findAll({
        attributes: [
          'produto_id', 'produto_nome',
          [fn('SUM', col('quantidade')), 'total_quantidade'],
          [fn('SUM', col('subtotal')), 'total_valor'],
          [fn('COUNT', col('VendaItem.id')), 'vezes_comprado']
        ],
        include: [{
          model: Venda,
          attributes: [],
          where: { empresa_id: req.empresa_id, cliente_id: cliente.id, status: 'finalizada' }
        }],
        group: ['produto_id', 'produto_nome'],
        order: [[fn('SUM', col('quantidade')), 'DESC']],
        limit: 10
      });
    } catch (errProdutos) {
      console.error('Erro ao buscar produtos mais comprados:', errProdutos.message);
    }

    res.json({ cliente, historico, produtosMaisComprados });
  } catch (err) {
    console.error('Erro ao buscar cliente:', err);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// ──────────────────────────────────────────────
//  POST /  —  Criar cliente
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { nome, cpf, telefone, email, data_nascimento, endereco, cidade, estado, cep, observacoes, cadastro_incompleto, aceita_marketing, data_aceite_marketing, aceite_origem } = req.body;

    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Padronizar CPF: sempre somente dígitos
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null;

    // Verificar CPF duplicado (se informado)
    if (cpfLimpo) {
      const existe = await Cliente.findOne({
        where: {
          empresa_id: req.empresa_id,
          [Op.or]: [
            { cpf: cpfLimpo },
            { cpf: cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') }
          ]
        }
      });
      if (existe) return res.status(400).json({ error: 'CPF já cadastrado' });
    }

    const cliente = await Cliente.create({
      empresa_id: req.empresa_id,
      nome, cpf: cpfLimpo, telefone, email, data_nascimento, endereco, cidade, estado, cep, observacoes,
      cadastro_incompleto: cadastro_incompleto !== undefined ? cadastro_incompleto : false,
      aceita_marketing: aceita_marketing || false,
      data_aceite_marketing: data_aceite_marketing || null,
      aceite_origem: aceite_origem || null
    });

    // Auto-inscrição no programa padrão (Clube Fidelidade)
    try {
      const programaPadrao = await ProgramaComercial.findOne({
        where: { empresa_id: req.empresa_id, programa_padrao: true, ativo: true }
      });
      if (programaPadrao) {
        const jaInscrito = await ClientePrograma.findOne({
          where: { cliente_id: cliente.id, programa_id: programaPadrao.id }
        });
        if (!jaInscrito) {
          await ClientePrograma.create({
            empresa_id: req.empresa_id,
            cliente_id: cliente.id,
            programa_id: programaPadrao.id,
            status: 'ativo'
          });
        }
      }
    } catch (errPrograma) {
      console.error('Erro ao inscrever cliente no programa padrão:', errPrograma);
      // Não falha a criação do cliente por causa disso
    }

    if (req.audit) await req.audit('criar', 'clientes', cliente.id, null, cliente.toJSON(), `Cliente ${nome} criado`);

    res.status(201).json(cliente);
  } catch (err) {
    console.error('Erro ao criar cliente:', err);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// ──────────────────────────────────────────────
//  PUT /:id  —  Atualizar cliente
// ──────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    const dadosAnteriores = cliente.toJSON();
    const campos = ['nome', 'cpf', 'telefone', 'email', 'data_nascimento', 'endereco', 'cidade', 'estado', 'cep', 'observacoes', 'ativo', 'cadastro_incompleto', 'aceita_marketing', 'data_aceite_marketing', 'aceite_origem'];
    campos.forEach(c => { if (req.body[c] !== undefined) cliente[c] = req.body[c]; });
    // Padronizar CPF: somente dígitos
    if (cliente.cpf) cliente.cpf = cliente.cpf.replace(/\D/g, '');
    await cliente.save();

    if (req.audit) await req.audit('editar', 'clientes', cliente.id, dadosAnteriores, cliente.toJSON(), `Cliente ${cliente.nome} editado`);

    res.json(cliente);
  } catch (err) {
    console.error('Erro ao atualizar cliente:', err);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// ──────────────────────────────────────────────
//  DELETE /:id  —  Desativar cliente (soft delete)
// ──────────────────────────────────────────────
router.delete('/:id', perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

    cliente.ativo = false;
    await cliente.save();

    if (req.audit) await req.audit('desativar', 'clientes', cliente.id, null, null, `Cliente ${cliente.nome} desativado`);

    res.json({ message: 'Cliente desativado' });
  } catch (err) {
    console.error('Erro ao desativar cliente:', err);
    res.status(500).json({ error: 'Erro ao desativar cliente' });
  }
});

module.exports = router;
