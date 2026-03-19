/* ══════════════════════════════════════════════════════════════
   SGC — Rotas: Módulo Fiscal Desacoplado (NFC-e)
   
   Arquitetura 3 camadas:
     Core Engine  → Provider Factory → DevNota/TecnoSpeed/etc
   
   Rotas:
     GET    /                        Listar notas
     GET    /dashboard               Resumo fiscal do mês
     GET    /providers               Listar providers configurados
     POST   /providers               Criar/atualizar provider config
     PUT    /providers/:id           Editar provider
     DELETE /providers/:id           Remover provider
     POST   /providers/:id/testar    Testar conexão + cadastrar empresa
     POST   /emitir                  Emitir NFC-e via Core Engine
     POST   /reenviar-pendentes      Reenvio em contingência
     GET    /:id                     Detalhe da NF
     POST   /:id/consultar           Consultar status na SEFAZ
     POST   /:id/cancelar            Cancelar NF via provider
     POST   /:id/carta-correcao      Carta de correção
   ══════════════════════════════════════════════════════════════ */

const router = require('express').Router();
const { Op, fn, col } = require('sequelize');
const { auth, perfil, tenant } = require('../middleware/auth');
const { NotaFiscal, Venda, VendaItem, Produto, Empresa, FiscalProviderConfig } = require('../models');
const FiscalCoreEngine = require('../services/fiscal/FiscalCoreEngine');
const FiscalProviderFactory = require('../services/fiscal/FiscalProviderFactory');
const { encrypt } = require('../services/fiscal/FiscalCrypto');
const { logger } = require('../config/logger');

router.use(auth, tenant);

/* ═══════════════════════════════════════════════════════════════
   NOTAS FISCAIS — LISTING / DASHBOARD / DETAIL
   ═══════════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────
//  GET /  —  Listar notas fiscais (com paginação)
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { tipo, status, provider, data_inicio, data_fim, page = 1, limit = 50 } = req.query;
    const where = { empresa_id: req.empresa_id };

    if (tipo) where.tipo = tipo;
    if (status) where.status = status;
    if (provider) where.provider_usado = provider;
    if (data_inicio && data_fim) {
      where.data_emissao = { [Op.between]: [data_inicio, data_fim] };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { rows, count } = await NotaFiscal.findAndCountAll({
      where,
      include: [{ model: Venda, attributes: ['id', 'numero', 'total', 'forma_pagamento'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({ data: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    console.error('Erro fiscal listar:', err);
    res.status(500).json({ error: 'Erro ao listar notas fiscais' });
  }
});

// ──────────────────────────────────────────────
//  GET /dashboard  —  Resumo fiscal
// ──────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const mesInicio = new Date().toISOString().substring(0, 7) + '-01';
    const baseWhere = { empresa_id: req.empresa_id, data_emissao: { [Op.gte]: mesInicio } };

    const [porStatus, porTipo, pendentes] = await Promise.all([
      NotaFiscal.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'total'], [fn('SUM', col('valor_total')), 'valor']],
        where: baseWhere,
        group: ['status'],
        raw: true
      }),
      NotaFiscal.findAll({
        attributes: ['tipo', [fn('COUNT', col('id')), 'total'], [fn('SUM', col('valor_total')), 'valor']],
        where: baseWhere,
        group: ['tipo'],
        raw: true
      }),
      NotaFiscal.count({
        where: { empresa_id: req.empresa_id, status: 'pendente' }
      })
    ]);

    // Provider ativo
    let providerAtivo = null;
    try {
      const configs = await FiscalProviderConfig.findAll({
        where: { empresa_id: req.empresa_id, ativo: true },
        attributes: ['provider_nome', 'ambiente', 'prioridade'],
        order: [['prioridade', 'ASC']]
      });
      providerAtivo = configs.length > 0 ? configs[0].provider_nome : null;
    } catch (e) { /* ignora */ }

    res.json({ porStatus, porTipo, pendentes, providerAtivo });
  } catch (err) {
    console.error('Erro fiscal dashboard:', err);
    res.status(500).json({ error: 'Erro ao gerar dashboard fiscal' });
  }
});

/* ═══════════════════════════════════════════════════════════════
   PROVIDERS — CRUD de configuração de providers
   ═══════════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────
//  GET /providers  —  Listar providers configurados
// ──────────────────────────────────────────────
router.get('/providers', perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const providers = await FiscalProviderConfig.findAll({
      where: { empresa_id: req.empresa_id },
      attributes: { exclude: ['token_encrypted', 'token_iv', 'token_tag', 'certificado_senha_encrypted', 'certificado_senha_iv', 'certificado_senha_tag'] },
      order: [['prioridade', 'ASC']]
    });
    res.json(providers);
  } catch (err) {
    console.error('Erro listar providers:', err);
    res.status(500).json({ error: 'Erro ao listar providers' });
  }
});

// ──────────────────────────────────────────────
//  POST /providers  —  Criar provider config
// ──────────────────────────────────────────────
router.post('/providers', perfil('administrador'), async (req, res) => {
  try {
    const { provider_nome, token, ambiente = 'homologacao', prioridade = 1, base_url, config_extra } = req.body;

    if (!provider_nome) return res.status(400).json({ error: 'provider_nome é obrigatório (ex: DEVNOTA)' });
    if (!token) return res.status(400).json({ error: 'Token de acesso é obrigatório' });

    const nome = provider_nome.toUpperCase();

    // Verificar se já existe
    const existente = await FiscalProviderConfig.findOne({
      where: { empresa_id: req.empresa_id, provider_nome: nome }
    });
    if (existente) {
      return res.status(400).json({ error: `Provider ${nome} já configurado. Use PUT para editar.` });
    }

    // Criptografar token
    const encrypted = encrypt(token);

    // Base URL padrão por provider
    const defaultUrls = {
      'DEVNOTA': 'https://devnota.com.br',
      'TECNOSPEED': 'https://managersdk-api.tecnospeed.com.br',
      'FOCUS': 'https://homologacao.focusnfe.com.br'
    };

    const config = await FiscalProviderConfig.create({
      empresa_id: req.empresa_id,
      provider_nome: nome,
      token_encrypted: encrypted.encrypted,
      token_iv: encrypted.iv,
      token_tag: encrypted.tag,
      base_url: base_url || defaultUrls[nome] || '',
      ambiente: ambiente,
      ativo: true,
      prioridade: parseInt(prioridade) || 1,
      config_extra: config_extra || {}
    });

    if (req.audit) await req.audit('criar', 'fiscal_providers_config', config.id, null, { provider_nome: nome, ambiente }, `Provider ${nome} configurado`);

    // Retornar sem token
    const safe = config.toJSON();
    delete safe.token_encrypted;
    delete safe.token_iv;
    delete safe.token_tag;
    res.status(201).json(safe);
  } catch (err) {
    console.error('Erro criar provider:', err);
    res.status(500).json({ error: 'Erro ao configurar provider: ' + err.message });
  }
});

// ──────────────────────────────────────────────
//  PUT /providers/:id  —  Editar provider
// ──────────────────────────────────────────────
router.put('/providers/:id', perfil('administrador'), async (req, res) => {
  try {
    const config = await FiscalProviderConfig.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!config) return res.status(404).json({ error: 'Provider não encontrado' });

    const { token, ambiente, prioridade, ativo, base_url, config_extra } = req.body;

    // Se token novo, criptografar
    if (token) {
      const encrypted = encrypt(token);
      config.token_encrypted = encrypted.encrypted;
      config.token_iv = encrypted.iv;
      config.token_tag = encrypted.tag;
    }

    if (ambiente !== undefined) config.ambiente = ambiente;
    if (prioridade !== undefined) config.prioridade = parseInt(prioridade);
    if (ativo !== undefined) config.ativo = ativo;
    if (base_url !== undefined) config.base_url = base_url;
    if (config_extra !== undefined) config.config_extra = config_extra;

    await config.save();

    if (req.audit) await req.audit('editar', 'fiscal_providers_config', config.id, null, { ambiente: config.ambiente, ativo: config.ativo }, `Provider ${config.provider_nome} atualizado`);

    const safe = config.toJSON();
    delete safe.token_encrypted;
    delete safe.token_iv;
    delete safe.token_tag;
    res.json(safe);
  } catch (err) {
    console.error('Erro editar provider:', err);
    res.status(500).json({ error: 'Erro ao editar provider: ' + err.message });
  }
});

// ──────────────────────────────────────────────
//  DELETE /providers/:id  —  Remover provider
// ──────────────────────────────────────────────
router.delete('/providers/:id', perfil('administrador'), async (req, res) => {
  try {
    const config = await FiscalProviderConfig.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!config) return res.status(404).json({ error: 'Provider não encontrado' });

    const nome = config.provider_nome;
    await config.destroy();

    if (req.audit) await req.audit('excluir', 'fiscal_providers_config', req.params.id, { provider_nome: nome }, null, `Provider ${nome} removido`);

    res.json({ ok: true, message: `Provider ${nome} removido` });
  } catch (err) {
    console.error('Erro remover provider:', err);
    res.status(500).json({ error: 'Erro ao remover provider' });
  }
});

// ──────────────────────────────────────────────
//  POST /providers/:id/testar  —  Testar conexão com provider
// ──────────────────────────────────────────────
router.post('/providers/:id/testar', perfil('administrador'), async (req, res) => {
  try {
    const config = await FiscalProviderConfig.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!config) return res.status(404).json({ error: 'Provider não encontrado' });

    const provider = FiscalProviderFactory._instanciar(config);

    // Para DevNota: cadastrar/atualizar empresa
    if (provider.cadastrarEmpresa) {
      const empresa = await Empresa.findByPk(req.empresa_id);
      const resultado = await provider.cadastrarEmpresa(empresa);
      return res.json({ 
        ok: true, 
        provider: config.provider_nome, 
        message: resultado.updated ? 'Empresa atualizada no provider' : 'Empresa cadastrada no provider',
        data: resultado.data
      });
    }

    res.json({ ok: true, provider: config.provider_nome, message: 'Conexão OK' });
  } catch (err) {
    console.error('Erro testar provider:', err);
    res.status(400).json({ error: 'Falha na conexão: ' + err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   EMISSÃO / CONSULTA / CANCELAMENTO — via Core Engine
   ═══════════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────────
//  POST /emitir  —  Emitir NFC-e completa
// ──────────────────────────────────────────────
router.post('/emitir', perfil('administrador', 'gerente', 'financeiro', 'caixa'), async (req, res) => {
  try {
    const { venda_id, dest_nome, dest_cpf_cnpj, info_complementar, forcar, serie } = req.body;

    if (!venda_id) return res.status(400).json({ error: 'venda_id é obrigatório' });

    const resultado = await FiscalCoreEngine.emitirNfce(venda_id, req.empresa_id, {
      dest_nome,
      dest_cpf_cnpj,
      info_complementar,
      forcar: forcar === true,
      serie
    });

    if (req.audit) {
      await req.audit('emitir', 'notas_fiscais', resultado.nf.id, null, {
        numero: resultado.nf.numero,
        status: resultado.nf.status,
        provider: resultado.nf.provider_usado
      }, `NFC-e #${resultado.nf.numero} — ${resultado.nf.status}`);
    }

    const statusCode = resultado.nf.status === 'autorizada' ? 201 : 200;
    res.status(statusCode).json({
      nf: resultado.nf,
      status: resultado.response.status,
      message: resultado.nf.status === 'autorizada'
        ? `NFC-e #${resultado.nf.numero} autorizada com sucesso!`
        : resultado.nf.status === 'pendente'
          ? `NFC-e #${resultado.nf.numero} em contingência (será reenviada automaticamente)`
          : `NFC-e #${resultado.nf.numero} rejeitada: ${resultado.response.motivo || 'verifique os dados'}`,
      warnings: resultado.response._raw?._warnings || []
    });
  } catch (err) {
    console.error('Erro emitir NFC-e:', err);
    res.status(400).json({ error: err.message || 'Erro ao emitir NFC-e' });
  }
});

// ──────────────────────────────────────────────
//  POST /reenviar-pendentes  —  Contingência
// ──────────────────────────────────────────────
router.post('/reenviar-pendentes', perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const resultado = await FiscalCoreEngine.reenviarPendentes(req.empresa_id);
    
    if (req.audit && resultado.processadas > 0) {
      await req.audit('reenviar', 'notas_fiscais', null, null, resultado, `Reenvio contingência: ${resultado.processadas} processadas`);
    }

    res.json(resultado);
  } catch (err) {
    console.error('Erro reenviar pendentes:', err);
    res.status(500).json({ error: err.message || 'Erro ao reenviar pendentes' });
  }
});

// ──────────────────────────────────────────────
//  GET /:id  —  Detalhe da nota fiscal
// ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const nf = await NotaFiscal.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id },
      include: [{ 
        model: Venda, 
        include: [{ model: VendaItem, include: [{ model: Produto, attributes: ['id', 'nome', 'ncm', 'cfop', 'cst_icms'] }] }]
      }]
    });

    if (!nf) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    res.json(nf);
  } catch (err) {
    console.error('Erro fiscal detalhe:', err);
    res.status(500).json({ error: 'Erro ao buscar nota fiscal' });
  }
});

// ──────────────────────────────────────────────
//  POST /:id/consultar  —  Consultar status no provider
// ──────────────────────────────────────────────
router.post('/:id/consultar', async (req, res) => {
  try {
    const resultado = await FiscalCoreEngine.consultar(req.params.id, req.empresa_id);
    res.json({
      nf: resultado.nf,
      status: resultado.response.status,
      message: resultado.response.status === 'AUTORIZADA'
        ? 'Nota autorizada!'
        : resultado.response.motivo || resultado.response.status
    });
  } catch (err) {
    console.error('Erro consultar NF:', err);
    res.status(400).json({ error: err.message || 'Erro ao consultar nota fiscal' });
  }
});

// ──────────────────────────────────────────────
//  POST /:id/cancelar  —  Cancelar nota fiscal
// ──────────────────────────────────────────────
router.post('/:id/cancelar', perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { motivo } = req.body;
    if (!motivo || motivo.length < 15) {
      return res.status(400).json({ error: 'Motivo do cancelamento deve ter no mínimo 15 caracteres' });
    }

    const resultado = await FiscalCoreEngine.cancelar(req.params.id, req.empresa_id, motivo);

    if (req.audit) {
      await req.audit('cancelar', 'notas_fiscais', resultado.nf.id, null, {
        numero: resultado.nf.numero,
        motivo
      }, `NF #${resultado.nf.numero} cancelada: ${motivo}`);
    }

    res.json({
      nf: resultado.nf,
      status: resultado.response.status,
      message: resultado.response.status === 'AUTORIZADA'
        ? `NF #${resultado.nf.numero} cancelada com sucesso`
        : resultado.response.motivo || 'Cancelamento em processamento'
    });
  } catch (err) {
    console.error('Erro cancelar NF:', err);
    res.status(400).json({ error: err.message || 'Erro ao cancelar nota fiscal' });
  }
});

// ──────────────────────────────────────────────
//  POST /:id/carta-correcao  —  Carta de correção
// ──────────────────────────────────────────────
router.post('/:id/carta-correcao', perfil('administrador', 'gerente'), async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || texto.length < 15) {
      return res.status(400).json({ error: 'Texto da carta de correção deve ter pelo menos 15 caracteres' });
    }

    const nf = await NotaFiscal.findOne({
      where: { id: req.params.id, empresa_id: req.empresa_id }
    });
    if (!nf) return res.status(404).json({ error: 'Nota fiscal não encontrada' });
    if (nf.status !== 'autorizada') return res.status(400).json({ error: 'Carta de correção só para notas autorizadas' });
    if ((nf.carta_correcao_seq || 0) >= 20) return res.status(400).json({ error: 'Limite de 20 cartas de correção atingido' });

    // Se tem provider, enviar CCe
    if (nf.chave_acesso && nf.provider_usado) {
      try {
        const provider = await FiscalProviderFactory.getProvider(req.empresa_id);
        if (provider.cartaCorrecao) {
          const seq = (nf.carta_correcao_seq || 0) + 1;
          const resultado = await provider.cartaCorrecao(nf.chave_acesso, texto, seq);
          
          nf.carta_correcao = texto;
          nf.carta_correcao_seq = seq;
          await nf.save();

          if (req.audit) await req.audit('carta_correcao', 'notas_fiscais', nf.id, null, { texto, seq }, `CCe #${seq} enviada via ${nf.provider_usado}`);
          return res.json({ nf, response: resultado, message: `Carta de correção #${seq} enviada` });
        }
      } catch (provErr) {
        // Se falhar no provider, salvar localmente
        logger.warn('CCe falhou no provider, salvando local', { erro: provErr.message });
      }
    }

    // Salvar localmente
    nf.carta_correcao = texto;
    nf.carta_correcao_seq = (nf.carta_correcao_seq || 0) + 1;
    await nf.save();

    if (req.audit) await req.audit('carta_correcao', 'notas_fiscais', nf.id, null, { texto, seq: nf.carta_correcao_seq }, `Carta de correção #${nf.carta_correcao_seq}`);
    res.json({ nf, message: `Carta de correção #${nf.carta_correcao_seq} salva` });
  } catch (err) {
    console.error('Erro fiscal carta correção:', err);
    res.status(500).json({ error: 'Erro ao gerar carta de correção: ' + err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   ROTA LEGADO — POST /gerar (compatibilidade)
   Gera NF local sem enviar ao provider
   ═══════════════════════════════════════════════════════════════ */
router.post('/gerar', perfil('administrador', 'gerente', 'financeiro'), async (req, res) => {
  try {
    const { venda_id, tipo = 'nfce', dest_nome, dest_cpf_cnpj, info_complementar } = req.body;

    if (!venda_id) return res.status(400).json({ error: 'venda_id é obrigatório' });

    // Verificar duplicata
    const existente = await NotaFiscal.findOne({
      where: { empresa_id: req.empresa_id, venda_id, status: { [Op.ne]: 'cancelada' } }
    });
    if (existente) {
      return res.status(400).json({ error: 'Já existe nota fiscal para esta venda', nota: existente });
    }

    // Tentar via Core Engine se provider configurado
    try {
      const providers = await FiscalProviderConfig.findAll({ where: { empresa_id: req.empresa_id, ativo: true } });
      if (providers.length > 0) {
        // Redirecionar para emissão real
        const resultado = await FiscalCoreEngine.emitirNfce(venda_id, req.empresa_id, {
          dest_nome, dest_cpf_cnpj, info_complementar
        });
        return res.status(201).json(resultado.nf);
      }
    } catch (e) { /* provider não configurado, continuar com gerar local */ }

    // Sem provider — gerar local (comportamento legado)
    const venda = await Venda.findOne({
      where: { id: venda_id, empresa_id: req.empresa_id },
      include: [{ model: VendaItem, include: [{ model: Produto }] }]
    });
    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });
    if (venda.status !== 'finalizada') return res.status(400).json({ error: 'Venda deve estar finalizada' });

    const empresa = await Empresa.findByPk(req.empresa_id);
    const campo = tipo === 'nfce' ? 'ultimo_numero_nfce' : 'ultimo_numero_nfe';
    const numero = (empresa[campo] || 0) + 1;

    const nf = await NotaFiscal.create({
      empresa_id: req.empresa_id,
      venda_id,
      tipo,
      numero,
      serie: empresa.serie_nfce || 1,
      status: 'pendente',
      valor_total: venda.total,
      dest_nome: dest_nome || venda.cliente_nome,
      dest_cpf_cnpj: dest_cpf_cnpj || venda.cliente_cpf,
      info_complementar,
      provider_usado: 'LOCAL',
      ambiente: empresa.ambiente_fiscal || 'homologacao',
      data_emissao: new Date()
    });

    empresa[campo] = numero;
    await empresa.save();
    venda.nota_fiscal_id = nf.id;
    await venda.save();

    if (req.audit) await req.audit('criar', 'notas_fiscais', nf.id, null, nf.toJSON(), `NF ${tipo.toUpperCase()} #${numero} gerada (local)`);
    res.status(201).json(nf);
  } catch (err) {
    console.error('Erro fiscal gerar:', err);
    res.status(500).json({ error: 'Erro ao gerar nota fiscal: ' + err.message });
  }
});

module.exports = router;
