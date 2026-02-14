const router = require('express').Router();
const { Caixa, CaixaMovimentacao, Venda } = require('../models');
const { auth, perfil } = require('../middleware/auth');

// Verificar se tem caixa aberto
router.get('/status', auth, async (req, res) => {
  try {
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    res.json({ aberto: !!caixa, caixa });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar caixa' });
  }
});

// Abrir caixa
router.post('/abrir', auth, async (req, res) => {
  try {
    // Verificar se já tem caixa aberto
    const caixaAberto = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    if (caixaAberto) {
      return res.status(400).json({ error: 'Já existe um caixa aberto', caixa: caixaAberto });
    }

    const caixa = await Caixa.create({
      empresa_id: req.empresa_id,
      usuario_id: req.usuario.id,
      valor_abertura: req.body.valor_abertura || 0
    });

    res.status(201).json({ message: 'Caixa aberto com sucesso', caixa });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao abrir caixa' });
  }
});

// Fechar caixa
router.post('/fechar', auth, async (req, res) => {
  try {
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' },
      include: [{ model: CaixaMovimentacao }]
    });
    if (!caixa) {
      return res.status(400).json({ error: 'Nenhum caixa aberto' });
    }

    const valorFechamento = parseFloat(req.body.valor_fechamento || 0);
    
    // Calcular valor esperado
    const esperado = parseFloat(caixa.valor_abertura) + 
                     parseFloat(caixa.total_dinheiro) + 
                     parseFloat(caixa.total_suprimento) - 
                     parseFloat(caixa.total_sangria);
    
    const diferenca = valorFechamento - esperado;

    await caixa.update({
      data_fechamento: new Date(),
      valor_fechamento: valorFechamento,
      diferenca: diferenca,
      status: 'fechado',
      observacoes: req.body.observacoes
    });

    // Buscar resumo de vendas
    const vendas = await Venda.findAll({
      where: { caixa_id: caixa.id, status: 'finalizada' }
    });

    res.json({
      message: 'Caixa fechado com sucesso',
      resumo: {
        abertura: caixa.valor_abertura,
        total_vendas: caixa.total_vendas,
        total_dinheiro: caixa.total_dinheiro,
        total_pix: caixa.total_pix,
        total_debito: caixa.total_debito,
        total_credito: caixa.total_credito,
        total_sangria: caixa.total_sangria,
        total_suprimento: caixa.total_suprimento,
        valor_esperado: esperado,
        valor_fechamento: valorFechamento,
        diferenca: diferenca,
        quantidade_vendas: vendas.length
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fechar caixa' });
  }
});

// Sangria
router.post('/sangria', auth, async (req, res) => {
  try {
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    if (!caixa) return res.status(400).json({ error: 'Nenhum caixa aberto' });

    const valor = parseFloat(req.body.valor);
    if (!valor || valor <= 0) return res.status(400).json({ error: 'Valor inválido' });

    await CaixaMovimentacao.create({
      caixa_id: caixa.id,
      tipo: 'sangria',
      valor,
      motivo: req.body.motivo || 'Sangria',
      usuario_id: req.usuario.id
    });

    await caixa.update({
      total_sangria: parseFloat(caixa.total_sangria) + valor
    });

    res.json({ message: 'Sangria registrada', total_sangria: caixa.total_sangria });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar sangria' });
  }
});

// Suprimento
router.post('/suprimento', auth, async (req, res) => {
  try {
    const caixa = await Caixa.findOne({
      where: { empresa_id: req.empresa_id, usuario_id: req.usuario.id, status: 'aberto' }
    });
    if (!caixa) return res.status(400).json({ error: 'Nenhum caixa aberto' });

    const valor = parseFloat(req.body.valor);
    if (!valor || valor <= 0) return res.status(400).json({ error: 'Valor inválido' });

    await CaixaMovimentacao.create({
      caixa_id: caixa.id,
      tipo: 'suprimento',
      valor,
      motivo: req.body.motivo || 'Suprimento',
      usuario_id: req.usuario.id
    });

    await caixa.update({
      total_suprimento: parseFloat(caixa.total_suprimento) + valor
    });

    res.json({ message: 'Suprimento registrado', total_suprimento: caixa.total_suprimento });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar suprimento' });
  }
});

// Histórico de caixas
router.get('/historico', auth, async (req, res) => {
  try {
    const caixas = await Caixa.findAll({
      where: { empresa_id: req.empresa_id },
      order: [['created_at', 'DESC']],
      limit: 30
    });
    res.json(caixas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar histórico' });
  }
});

module.exports = router;
