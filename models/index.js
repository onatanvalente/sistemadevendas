const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/* ══════════════════════════════════════════════════════════════
   SGC — Models v2.0  (ERP Varejista Modular)
   Segmentos: Mercado | Farmácia/Drogaria
   Feature-flags por tipo_negocio
   Preparação: NFC-e/NF-e, SNGPC, Multi-tenant por subdomínio
   ══════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════
//  EMPRESA (TENANT)
// ══════════════════════════════════════════════════
const Empresa = sequelize.define('Empresa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  nome_fantasia: DataTypes.STRING(200),
  cnpj: { type: DataTypes.STRING(18), allowNull: false, unique: true },
  inscricao_estadual: DataTypes.STRING(20),
  inscricao_municipal: DataTypes.STRING(20),
  tipo_negocio: { 
    type: DataTypes.ENUM('mercado', 'drogaria'), 
    allowNull: false, defaultValue: 'mercado' 
  },
  regime_tributario: { 
    type: DataTypes.ENUM('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'),
    defaultValue: 'simples_nacional'
  },
  // Subdomínio p/ multi-tenant (ex: "mercadinhoalpha")
  subdominio: { type: DataTypes.STRING(50), unique: true },
  endereco: DataTypes.STRING(300),
  numero: DataTypes.STRING(20),
  complemento: DataTypes.STRING(100),
  bairro: DataTypes.STRING(100),
  cidade: DataTypes.STRING(100),
  estado: DataTypes.STRING(2),
  cep: DataTypes.STRING(10),
  codigo_ibge: DataTypes.STRING(10),
  telefone: DataTypes.STRING(20),
  email: DataTypes.STRING(150),
  // Farmácia — responsável técnico
  responsavel_tecnico: DataTypes.STRING(200),
  crf_responsavel: DataTypes.STRING(30),
  // Fiscal
  certificado_digital: DataTypes.TEXT,
  ambiente_fiscal: { type: DataTypes.ENUM('homologacao', 'producao'), defaultValue: 'homologacao' },
  serie_nfce: { type: DataTypes.INTEGER, defaultValue: 1 },
  ultimo_numero_nfce: { type: DataTypes.INTEGER, defaultValue: 0 },
  serie_nfe: { type: DataTypes.INTEGER, defaultValue: 1 },
  ultimo_numero_nfe: { type: DataTypes.INTEGER, defaultValue: 0 },
  csc_id: DataTypes.STRING(10),
  csc_token: DataTypes.STRING(100),
  // Plano & controle
  plano: { 
    type: DataTypes.ENUM('basico', 'profissional', 'premium', 'empresarial'), 
    defaultValue: 'basico' 
  },
  max_usuarios: { type: DataTypes.INTEGER, defaultValue: 5 },
  max_caixas: { type: DataTypes.INTEGER, defaultValue: 2 },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  configuracoes: { type: DataTypes.JSONB, defaultValue: {} },
  // ── Personalização visual por tenant ──
  cor_primaria: { type: DataTypes.STRING(7), defaultValue: '#2563eb' },
  cor_secundaria: { type: DataTypes.STRING(7), defaultValue: '#10b981' },
  logo_url: DataTypes.STRING(500),
  // ── Status SaaS ──
  status: { type: DataTypes.ENUM('ativo', 'suspenso', 'trial', 'cancelado'), defaultValue: 'ativo' },
  trial_ate: DataTypes.DATEONLY,
  origem_cadastro: { type: DataTypes.ENUM('landing_page', 'comercial', 'indicacao', 'manual'), defaultValue: 'landing_page' }
}, { tableName: 'empresas', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  USUÁRIO MASTER (admin do SaaS — NÃO usa tenant_id)
// ══════════════════════════════════════════════════
const UsuarioMaster = sequelize.define('UsuarioMaster', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.ENUM('super_admin', 'suporte', 'comercial'), defaultValue: 'suporte' },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimo_login: DataTypes.DATE
}, { tableName: 'usuarios_master', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  USUÁRIO
// ══════════════════════════════════════════════════
const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  perfil: { 
    type: DataTypes.ENUM('administrador', 'gerente', 'vendedor', 'caixa', 'estoquista', 'financeiro', 'farmaceutico'),
    allowNull: false, defaultValue: 'vendedor'
  },
  // Permissões granulares (sobrepõem perfil)
  permissoes: { type: DataTypes.JSONB, defaultValue: {} },
  // ── Proteção contra fraude: limite de desconto manual por perfil ──
  limite_desconto_percentual: { 
    type: DataTypes.DECIMAL(5, 2), 
    defaultValue: 5.00,
    comment: 'Desconto manual máximo (%) que o usuário pode conceder sem senha de gerente'
  },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimo_login: DataTypes.DATE,
  avatar_url: DataTypes.STRING(500)
}, { 
  tableName: 'usuarios', timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['email', 'empresa_id'] }]
});

// ══════════════════════════════════════════════════
//  CLIENTE (histórico, fidelização, PDV inteligente)
// ══════════════════════════════════════════════════
const Cliente = sequelize.define('Cliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  cpf: { type: DataTypes.STRING(14), unique: false },
  telefone: DataTypes.STRING(20),
  email: DataTypes.STRING(150),
  data_nascimento: DataTypes.DATEONLY,
  endereco: DataTypes.STRING(300),
  cidade: DataTypes.STRING(100),
  estado: DataTypes.STRING(2),
  cep: DataTypes.STRING(10),
  // Métricas automáticas
  total_compras: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  quantidade_compras: { type: DataTypes.INTEGER, defaultValue: 0 },
  ticket_medio: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  ultima_compra: DataTypes.DATE,
  observacoes: DataTypes.TEXT,
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  // LGPD — preparado para consentimento futuro
  aceita_marketing: { type: DataTypes.BOOLEAN, defaultValue: false },
  data_aceite_marketing: { type: DataTypes.DATE, allowNull: true },
  aceite_origem: { type: DataTypes.ENUM('pdv', 'maquininha', 'site'), allowNull: true },
  cadastro_incompleto: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { 
  tableName: 'clientes', timestamps: true, underscored: true,
  indexes: [{ fields: ['empresa_id', 'cpf'] }]
});

// ══════════════════════════════════════════════════
//  CATEGORIA
// ══════════════════════════════════════════════════
const Categoria = sequelize.define('Categoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  descricao: DataTypes.STRING(300),
  cor: DataTypes.STRING(7), // hex color
  icone: DataTypes.STRING(50), // lucide icon name
  ordem: { type: DataTypes.INTEGER, defaultValue: 0 },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'categorias', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  FORNECEDOR (estratégico — ranking, métricas)
// ══════════════════════════════════════════════════
const Fornecedor = sequelize.define('Fornecedor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  cnpj_cpf: DataTypes.STRING(18),
  telefone: DataTypes.STRING(20),
  email: DataTypes.STRING(150),
  endereco: DataTypes.STRING(300),
  cidade: DataTypes.STRING(100),
  estado: DataTypes.STRING(2),
  contato: DataTypes.STRING(100),
  // Métricas estratégicas
  ranking: { type: DataTypes.INTEGER, defaultValue: 3 }, // 1-5 estrelas
  prazo_medio_entrega: { type: DataTypes.INTEGER, defaultValue: 0 }, // dias
  valor_medio_compra: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_compras: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  quantidade_compras: { type: DataTypes.INTEGER, defaultValue: 0 },
  ultima_compra: DataTypes.DATEONLY,
  observacoes: DataTypes.TEXT,
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'fornecedores', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  PRODUTO (mercado + farmácia + fiscal)
// ══════════════════════════════════════════════════
const Produto = sequelize.define('Produto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  categoria_id: DataTypes.INTEGER,
  fornecedor_id: DataTypes.INTEGER,
  nome: { type: DataTypes.STRING(200), allowNull: false },
  codigo_barras: DataTypes.STRING(50),
  codigo_interno: DataTypes.STRING(30),
  marca: DataTypes.STRING(100),
  subcategoria: DataTypes.STRING(100),
  descricao: DataTypes.TEXT,
  // Preços & margem
  preco_custo: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  preco_venda: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  margem: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  preco_promocional: DataTypes.DECIMAL(12, 2),
  promocao_inicio: DataTypes.DATEONLY,
  promocao_fim: DataTypes.DATEONLY,
  despesas_adicionais: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  permite_desconto_manual: { type: DataTypes.BOOLEAN, defaultValue: true },
  desconto_maximo: { type: DataTypes.DECIMAL(5, 2), defaultValue: 100 },
  // Estoque
  estoque_atual: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  estoque_minimo: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  estoque_maximo: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  ponto_reposicao: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  permite_estoque_negativo: { type: DataTypes.BOOLEAN, defaultValue: false },
  unidade: { type: DataTypes.STRING(10), defaultValue: 'UN' },
  unidade_compra: DataTypes.STRING(10),
  fator_conversao: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
  permite_fracionamento: { type: DataTypes.BOOLEAN, defaultValue: false },
  produto_pesado: { type: DataTypes.BOOLEAN, defaultValue: false },
  peso_liquido: DataTypes.DECIMAL(10, 3),
  peso_bruto: DataTypes.DECIMAL(10, 3),
  // Curva ABC (calculado automaticamente)
  curva_abc: { type: DataTypes.ENUM('A', 'B', 'C'), defaultValue: 'C' },
  giro_estoque: { type: DataTypes.ENUM('rapido', 'medio', 'lento'), defaultValue: 'medio' },
  total_vendido_mes: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  faturamento_mes: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // ── Campos FARMÁCIA ──
  e_medicamento: { type: DataTypes.BOOLEAN, defaultValue: false },
  principio_ativo: DataTypes.STRING(200),
  tipo_medicamento: DataTypes.STRING(30), // generico, referencia, similar, otc, fitoterapico, cosmetico, outros
  laboratorio: DataTypes.STRING(150),
  registro_anvisa: DataTypes.STRING(50),
  registro_ms: DataTypes.STRING(30),
  controlado: { type: DataTypes.BOOLEAN, defaultValue: false },
  classe_controlado: DataTypes.STRING(10), // A1, A2, A3, B1, B2, C1, C2, C3, C4, C5, D1, D2
  portaria_344: { type: DataTypes.BOOLEAN, defaultValue: false },
  exige_retencao_receita: { type: DataTypes.BOOLEAN, defaultValue: false },
  necessita_receita: { type: DataTypes.BOOLEAN, defaultValue: false },
  tipo_receita: DataTypes.STRING(30), // sem_receita, simples, branca, azul, amarela, especial
  controla_lote: { type: DataTypes.BOOLEAN, defaultValue: false },
  numero_lote: DataTypes.STRING(50),
  validade: DataTypes.DATEONLY,
  codigo_farmaceutico: DataTypes.STRING(50),
  // ── Campos FISCAL (NF-e / NFC-e) ──
  ncm: DataTypes.STRING(10),
  cest: DataTypes.STRING(10),
  cfop: DataTypes.STRING(6),
  origem: { type: DataTypes.STRING(1), defaultValue: '0' }, // 0=Nacional
  cst_icms: DataTypes.STRING(5),
  aliquota_icms: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cst_pis: DataTypes.STRING(3),
  aliquota_pis: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cst_cofins: DataTypes.STRING(3),
  aliquota_cofins: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  cst_ipi: DataTypes.STRING(3),
  aliquota_ipi: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  // ── Identificação & tipo ──
  tipo_produto: { type: DataTypes.STRING(20), defaultValue: 'mercadoria' }, // mercadoria, servico, uso_interno
  permite_venda_sem_estoque: { type: DataTypes.BOOLEAN, defaultValue: false },
  // ── Comercial extra ──
  preco_custo_medio: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  participa_fidelidade: { type: DataTypes.BOOLEAN, defaultValue: false },
  // ── Estoque avançado ──
  estoque_reservado: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  localizacao: DataTypes.STRING(50),
  controla_validade: { type: DataTypes.BOOLEAN, defaultValue: false },
  sugere_compra_automatica: { type: DataTypes.BOOLEAN, defaultValue: false },
  estoque_seguranca: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  lead_time_padrao: { type: DataTypes.INTEGER, defaultValue: 0 }, // dias
  // ── Compras ──
  cfop_compra: DataTypes.STRING(6),
  ultimo_custo_pago: DataTypes.DECIMAL(12, 2),
  prazo_entrega: { type: DataTypes.INTEGER, defaultValue: 0 }, // dias
  quantidade_minima_compra: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
  // ── Farmácia extras ──
  classe_terapeutica: DataTypes.STRING(150),
  generico: { type: DataTypes.BOOLEAN, defaultValue: false },
  // ── Balança (pesados) ──
  codigo_balanca: DataTypes.STRING(20),
  prefixo_balanca: DataTypes.STRING(10),
  tipo_leitura_balanca: DataTypes.STRING(30), // peso_embutido, leitura_serial
  // ── Reforma tributária (preparação futura) ──
  cbs: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  ibs: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  imposto_seletivo: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  // ── Inteligência ──
  ultima_venda: DataTypes.DATEONLY,
  ultima_compra: DataTypes.DATEONLY,
  // Imagem
  imagem_url: DataTypes.STRING(500),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { 
  tableName: 'produtos', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id', 'codigo_barras'] },
    { fields: ['empresa_id', 'nome'] },
    { fields: ['empresa_id', 'curva_abc'] }
  ]
});

// ══════════════════════════════════════════════════
//  HISTÓRICO DE PREÇO
// ══════════════════════════════════════════════════
const HistoricoPreco = sequelize.define('HistoricoPreco', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  preco_custo_anterior: DataTypes.DECIMAL(12, 2),
  preco_custo_novo: DataTypes.DECIMAL(12, 2),
  preco_venda_anterior: DataTypes.DECIMAL(12, 2),
  preco_venda_novo: DataTypes.DECIMAL(12, 2),
  margem_anterior: DataTypes.DECIMAL(5, 2),
  margem_nova: DataTypes.DECIMAL(5, 2),
  usuario_id: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'historico_precos', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  LOTE (controle por lote — farmácia / perecíveis)
// ══════════════════════════════════════════════════
const Lote = sequelize.define('Lote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  compra_item_id: DataTypes.INTEGER,
  numero_lote: { type: DataTypes.STRING(50), allowNull: false },
  validade: DataTypes.DATEONLY,
  quantidade_inicial: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  quantidade_atual: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  nota_fiscal_compra: DataTypes.STRING(50),
  fornecedor_id: DataTypes.INTEGER,
  data_entrada: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  custo_unitario: DataTypes.DECIMAL(12, 4),
  status: { type: DataTypes.STRING(10), defaultValue: 'ATIVO' }, // ATIVO, ESGOTADO, VENCIDO
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'lotes', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id', 'produto_id'] },
    { fields: ['empresa_id', 'validade'] },
    { fields: ['empresa_id', 'status'] },
    { fields: ['produto_id'] },
    { fields: ['fornecedor_id'] },
    { fields: ['compra_item_id'] },
    { unique: true, fields: ['empresa_id', 'produto_id', 'numero_lote'], name: 'lotes_empresa_produto_lote_unique' }
  ]
});

// ══════════════════════════════════════════════════
//  SUGESTÃO DE PRODUTO (PDV inteligente farmácia)
// ══════════════════════════════════════════════════
const ProdutoSugestao = sequelize.define('ProdutoSugestao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_sugerido_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { 
    type: DataTypes.ENUM('complementar', 'alternativa', 'upsell', 'combo'),
    defaultValue: 'complementar'
  },
  mensagem: DataTypes.STRING(200), // ex: "Protetor gástrico recomendado"
  prioridade: { type: DataTypes.INTEGER, defaultValue: 1 },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'produto_sugestoes', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  COMBO / KIT PROMOCIONAL
// ══════════════════════════════════════════════════
const Combo = sequelize.define('Combo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  descricao: DataTypes.TEXT,
  preco: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  preco_original: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // soma dos itens
  economia: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  validade_inicio: DataTypes.DATEONLY,
  validade_fim: DataTypes.DATEONLY,
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'combos', timestamps: true, underscored: true });

const ComboItem = sequelize.define('ComboItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  combo_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 }
}, { tableName: 'combo_itens', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  CAIXA (suporta múltiplos caixas simultâneos)
// ══════════════════════════════════════════════════
const Caixa = sequelize.define('Caixa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  numero_caixa: { type: DataTypes.INTEGER, defaultValue: 1 }, // Caixa 1, 2, 3...
  data_abertura: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  data_fechamento: DataTypes.DATE,
  valor_abertura: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_fechamento: DataTypes.DECIMAL(12, 2),
  total_vendas: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_dinheiro: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_pix: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_debito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_credito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_sangria: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_suprimento: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  diferenca: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  quantidade_vendas: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { 
    type: DataTypes.ENUM('aberto', 'fechado'), 
    defaultValue: 'aberto' 
  },
  observacoes: DataTypes.TEXT
}, { tableName: 'caixa', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  MOVIMENTAÇÃO DE CAIXA (Sangria / Suprimento)
// ══════════════════════════════════════════════════
const CaixaMovimentacao = sequelize.define('CaixaMovimentacao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  caixa_id: { type: DataTypes.INTEGER, allowNull: false },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM('sangria', 'suprimento'), allowNull: false },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  motivo: DataTypes.STRING(300),
  usuario_id: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'caixa_movimentacoes', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  VENDA
// ══════════════════════════════════════════════════
const Venda = sequelize.define('Venda', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  caixa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: DataTypes.INTEGER, // FK para tabela clientes
  numero: { type: DataTypes.INTEGER, allowNull: false },
  cliente_nome: DataTypes.STRING(200),
  cliente_cpf: DataTypes.STRING(14),
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  desconto: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  acrescimo: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  custo_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 }, // soma preco_custo dos itens
  lucro_estimado: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  forma_pagamento: { type: DataTypes.STRING(50), allowNull: false },
  // Para pagamento múltiplo
  valor_dinheiro: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_pix: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_debito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_credito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  troco: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { 
    type: DataTypes.ENUM('finalizada', 'cancelada', 'devolvida'), 
    defaultValue: 'finalizada' 
  },
  // ── Snapshot de integridade (congelado ao finalizar, NUNCA recalcular) ──
  subtotal_bruto: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, comment: 'Subtotal antes de qualquer desconto' },
  desconto_automatico_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, comment: 'Soma descontos do motor (programas comerciais)' },
  desconto_manual_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, comment: 'Desconto manual do operador' },
  // ── Cancelamento rastreável ──
  motivo_cancelamento: { type: DataTypes.STRING(500), allowNull: true },
  cancelado_por: { type: DataTypes.INTEGER, allowNull: true, comment: 'usuario_id que cancelou' },
  cancelado_em: { type: DataTypes.DATE, allowNull: true },
  venda_referenciada_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Se cancelamento gera nova linha, referencia a venda original' },
  // ── Rastreabilidade ──
  versao_sistema: { type: DataTypes.STRING(10), defaultValue: '5.0', comment: 'Versão do PDV no momento da venda' },
  ip_terminal: { type: DataTypes.STRING(50), allowNull: true },
  operador_nome: { type: DataTypes.STRING(200), allowNull: true, comment: 'Nome do operador congelado no momento da venda' },
  // ── Documento emitido ──
  tipo_documento_emitido: {
    type: DataTypes.ENUM('cupom_nao_fiscal', 'nfce'),
    defaultValue: 'cupom_nao_fiscal'
  },
  // ── Snapshot do cupom para reimpressão fiel ──
  snapshot_cupom: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'JSON congelado com todos os dados do cupom impresso — NUNCA recalcular'
  },
  // Fiscal
  nota_fiscal_id: DataTypes.INTEGER,
  observacoes: DataTypes.TEXT
}, { tableName: 'vendas', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  ITEM DA VENDA
// ══════════════════════════════════════════════════
const VendaItem = sequelize.define('VendaItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  venda_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_nome: { type: DataTypes.STRING(200), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  preco_unitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  preco_custo: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  desconto_item: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  // ── Motor de Descontos — auditoria completa ──
  programa_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Programa principal que originou o desconto (origem_programa_id)' },
  preco_original: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: 'Preço de tabela sem desconto automático' },
  preco_aplicado: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: 'Preço final após desconto automático (antes do manual)' },
  desconto_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Valor absoluto do desconto total aplicado pelo motor' },
  desconto_programa: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Alias legado — mesmo que desconto_total' },
  tipo_desconto: { type: DataTypes.STRING(30), allowNull: true, comment: 'percentual | valor_fixo | preco_especial | acumulado' },
  valor_desconto: { type: DataTypes.DECIMAL(10, 2), allowNull: true, comment: 'Valor numérico da regra (ex: 10 para 10%)' },
  programa_nome: { type: DataTypes.STRING(100), allowNull: true, comment: 'Nome do programa para histórico' },
  origem_desconto: { type: DataTypes.TEXT, allowNull: true, comment: 'JSON com trilha de auditoria completa do motor' },
  // Fiscal
  ncm: DataTypes.STRING(10),
  cfop: DataTypes.STRING(6),
  aliquota_icms: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }
}, { tableName: 'venda_itens', timestamps: true, underscored: true,
  indexes: [
    { fields: ['programa_id'], name: 'idx_itens_origem_programa' },
    { fields: ['venda_id'] }
  ]
});

// ══════════════════════════════════════════════════
//  MOVIMENTAÇÃO DE ESTOQUE
// ══════════════════════════════════════════════════
const EstoqueMovimentacao = sequelize.define('EstoqueMovimentacao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  lote_id: DataTypes.INTEGER,
  tipo: { 
    type: DataTypes.ENUM('entrada', 'saida', 'ajuste', 'perda', 'vencimento', 'devolucao'),
    allowNull: false 
  },
  origem: { type: DataTypes.STRING(30), defaultValue: 'MANUAL' }, // COMPRA, VENDA, AJUSTE, INVENTARIO, CANCELAMENTO, SNGPC_*
  quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  estoque_anterior: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  estoque_posterior: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  custo_unitario: DataTypes.DECIMAL(12, 4),
  motivo: DataTypes.STRING(300),
  justificativa: DataTypes.TEXT,
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  referencia: DataTypes.STRING(100),
  lote: DataTypes.STRING(50),
  validade: DataTypes.DATEONLY
}, { tableName: 'estoque_movimentacoes', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id', 'produto_id'] },
    { fields: ['empresa_id', 'lote_id'] },
    { fields: ['empresa_id', 'created_at'] },
    { fields: ['referencia'] },
    { fields: ['origem'] },
    { fields: ['produto_id'] },
    { fields: ['lote_id'] },
    { fields: ['usuario_id'] }
  ]
});

// ══════════════════════════════════════════════════
//  CONTAS A PAGAR
// ══════════════════════════════════════════════════
const ContaPagar = sequelize.define('ContaPagar', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  fornecedor_id: DataTypes.INTEGER,
  centro_custo_id: DataTypes.INTEGER,
  conta_bancaria_id: DataTypes.INTEGER,
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  data_pagamento: DataTypes.DATEONLY,
  forma_pagamento: DataTypes.STRING(50),
  status: { 
    type: DataTypes.ENUM('pendente', 'pago', 'vencido', 'cancelado'),
    defaultValue: 'pendente'
  },
  categoria: { type: DataTypes.STRING(50), defaultValue: 'fornecedor' },
  recorrente: { type: DataTypes.BOOLEAN, defaultValue: false },
  periodo_recorrencia: DataTypes.STRING(20), // mensal, semanal, etc
  observacoes: DataTypes.TEXT,
  usuario_id: DataTypes.INTEGER
}, { tableName: 'contas_pagar', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  CONTAS A RECEBER
// ══════════════════════════════════════════════════
const ContaReceber = sequelize.define('ContaReceber', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  cliente_id: DataTypes.INTEGER,
  cliente_nome: DataTypes.STRING(200),
  cliente_cpf: DataTypes.STRING(14),
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  data_recebimento: DataTypes.DATEONLY,
  forma_recebimento: DataTypes.STRING(50),
  conta_bancaria_id: DataTypes.INTEGER,
  status: { 
    type: DataTypes.ENUM('pendente', 'recebido', 'vencido', 'cancelado'),
    defaultValue: 'pendente'
  },
  venda_id: DataTypes.INTEGER,
  parcela: DataTypes.STRING(10),
  observacoes: DataTypes.TEXT,
  usuario_id: DataTypes.INTEGER
}, { tableName: 'contas_receber', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  CENTRO DE CUSTO
// ══════════════════════════════════════════════════
const CentroCusto = sequelize.define('CentroCusto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  descricao: DataTypes.STRING(300),
  tipo: { type: DataTypes.ENUM('receita', 'despesa', 'ambos'), defaultValue: 'ambos' },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'centros_custo', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  CONTA BANCÁRIA
// ══════════════════════════════════════════════════
const ContaBancaria = sequelize.define('ContaBancaria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  banco: DataTypes.STRING(100),
  agencia: DataTypes.STRING(20),
  conta: DataTypes.STRING(20),
  tipo: { type: DataTypes.ENUM('corrente', 'poupanca', 'pagamento', 'caixa_interno'), defaultValue: 'corrente' },
  saldo_inicial: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  saldo_atual: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  principal: { type: DataTypes.BOOLEAN, defaultValue: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'contas_bancarias', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  MEDICAMENTO CONTROLADO (SNGPC)
// ══════════════════════════════════════════════════
const MedicamentoControlado = sequelize.define('MedicamentoControlado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: true },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  // Cliente
  cliente_cpf: { type: DataTypes.STRING(14), allowNull: false },
  cliente_nome: { type: DataTypes.STRING(200), allowNull: false },
  cliente_endereco: DataTypes.STRING(300),
  cliente_telefone: DataTypes.STRING(20),
  // Médico
  medico_nome: DataTypes.STRING(200),
  medico_crm: DataTypes.STRING(20),
  medico_uf: DataTypes.STRING(2),
  especialidade: DataTypes.STRING(100),
  // Receita
  numero_receita: DataTypes.STRING(50),
  data_receita: DataTypes.DATEONLY,
  tipo_receita: { 
    type: DataTypes.ENUM('branca', 'azul', 'amarela', 'especial'),
    defaultValue: 'branca'
  },
  receita_retida: { type: DataTypes.BOOLEAN, defaultValue: false },
  receita_digital: DataTypes.TEXT, // base64 da imagem
  // Farmacêutico
  farmaceutico_id: { type: DataTypes.INTEGER, allowNull: false },
  // SNGPC
  quantidade_dispensada: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
  lote: DataTypes.STRING(50),
  data_venda: { type: DataTypes.DATEONLY, allowNull: false },
  exportado_sngpc: { type: DataTypes.BOOLEAN, defaultValue: false },
  data_exportacao: DataTypes.DATE
}, {
  tableName: 'medicamentos_controlados', timestamps: true, underscored: true,
  paranoid: false, // Regulatório: NUNCA soft delete
  indexes: [
    { fields: ['empresa_id', 'produto_id'] },
    { fields: ['empresa_id', 'data_venda'] },
    { fields: ['empresa_id', 'cliente_cpf'] },
    { fields: ['venda_id'] },
    { fields: ['farmaceutico_id'] },
    { fields: ['produto_id'] }
  ]
});

// ══════════════════════════════════════════════════
//  NOTA FISCAL (NFC-e / NF-e — estrutura preparada)
// ══════════════════════════════════════════════════
const NotaFiscal = sequelize.define('NotaFiscal', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: DataTypes.INTEGER,
  tipo: { type: DataTypes.ENUM('nfce', 'nfe'), defaultValue: 'nfce' },
  numero: { type: DataTypes.INTEGER, allowNull: false },
  serie: { type: DataTypes.INTEGER, defaultValue: 1 },
  chave_acesso: DataTypes.STRING(44),
  protocolo_autorizacao: DataTypes.STRING(20),
  status: { 
    type: DataTypes.ENUM('pendente', 'autorizada', 'cancelada', 'rejeitada', 'inutilizada'),
    defaultValue: 'pendente'
  },
  // Dados
  data_emissao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  data_cancelamento: DataTypes.DATE,
  motivo_cancelamento: DataTypes.STRING(300),
  valor_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // XMLs
  xml_envio: DataTypes.TEXT,
  xml_retorno: DataTypes.TEXT,
  xml_cancelamento: DataTypes.TEXT,
  // Carta de correção
  carta_correcao: DataTypes.TEXT,
  carta_correcao_seq: { type: DataTypes.INTEGER, defaultValue: 0 },
  // DANFE / PDF
  pdf_url: DataTypes.STRING(500),
  // Destinatário
  dest_nome: DataTypes.STRING(200),
  dest_cpf_cnpj: DataTypes.STRING(18),
  // Observações
  info_complementar: DataTypes.TEXT,
  // ── Arquitetura desacoplada ──
  provider_usado: { type: DataTypes.STRING(50), allowNull: true, comment: 'DEVNOTA, TECNOSPEED, FOCUS, SEFAZ_DIRETO, etc.' },
  ambiente: { type: DataTypes.ENUM('homologacao', 'producao'), defaultValue: 'homologacao' },
  motivo_rejeicao: DataTypes.TEXT,
  tentativas_envio: { type: DataTypes.INTEGER, defaultValue: 0 },
  ultima_tentativa: DataTypes.DATE,
  provider_id_externo: { type: DataTypes.STRING(100), comment: 'ID retornado pelo provider externo' },
  pdf_base64: DataTypes.TEXT
}, { tableName: 'notas_fiscais', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  FISCAL PROVIDER CONFIG (multi-provider, multi-empresa)
// ══════════════════════════════════════════════════
const FiscalProviderConfig = sequelize.define('FiscalProviderConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  provider_nome: { type: DataTypes.STRING(50), allowNull: false, comment: 'DEVNOTA, TECNOSPEED, FOCUS, SEFAZ_DIRETO' },
  // Token criptografado (AES-256-GCM)
  token_encrypted: DataTypes.TEXT,
  token_iv: DataTypes.STRING(32),
  token_tag: DataTypes.STRING(32),
  // Certificado digital
  certificado_path: DataTypes.STRING(500),
  certificado_senha_encrypted: DataTypes.TEXT,
  certificado_senha_iv: DataTypes.STRING(32),
  certificado_senha_tag: DataTypes.STRING(32),
  // Config
  ambiente: { type: DataTypes.ENUM('homologacao', 'producao'), defaultValue: 'homologacao' },
  base_url: DataTypes.STRING(300),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  prioridade: { type: DataTypes.INTEGER, defaultValue: 1, comment: 'Menor = maior prioridade; usado para fallback' },
  // Metadata
  config_extra: { type: DataTypes.JSONB, defaultValue: {}, comment: 'Configs específicas do provider' }
}, { tableName: 'fiscal_providers_config', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id', 'provider_nome'], unique: true },
    { fields: ['empresa_id', 'ativo'] }
  ]
});

// ══════════════════════════════════════════════════
//  META (controle de metas de vendas)
// ══════════════════════════════════════════════════
const Meta = sequelize.define('Meta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER, // null = meta geral da empresa
  tipo: { 
    type: DataTypes.ENUM('faturamento', 'vendas', 'ticket_medio', 'margem'),
    defaultValue: 'faturamento'
  },
  periodo: { 
    type: DataTypes.ENUM('diario', 'semanal', 'mensal', 'anual'),
    defaultValue: 'mensal'
  },
  valor_meta: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  valor_atual: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
  data_fim: { type: DataTypes.DATEONLY, allowNull: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'metas', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  AUDIT LOG (rastreabilidade completa)
// ══════════════════════════════════════════════════
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: DataTypes.INTEGER,
  usuario_nome: DataTypes.STRING(200),
  acao: { type: DataTypes.STRING(50), allowNull: false }, // criar, editar, excluir, login, logout, etc
  tabela: DataTypes.STRING(100),
  registro_id: DataTypes.INTEGER,
  dados_anteriores: DataTypes.JSONB,
  dados_novos: DataTypes.JSONB,
  descricao: DataTypes.STRING(500),
  ip: DataTypes.STRING(50),
  user_agent: DataTypes.STRING(500)
}, { tableName: 'audit_logs', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════════════════
//  SECURITY LOG (eventos de segurança persistidos)
// ══════════════════════════════════════════════════════════════
const SecurityLog = sequelize.define('SecurityLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: DataTypes.INTEGER, // null para eventos sem tenant
  usuario_id: DataTypes.INTEGER,
  route: DataTypes.STRING(500),
  method: DataTypes.STRING(10),
  ip: DataTypes.STRING(50),
  user_agent: DataTypes.STRING(500),
  action: { type: DataTypes.STRING(100), allowNull: false },
  // cross_tenant_access, login_failed, rate_limit_hit, auth_error, tenant_suspended
  reason: DataTypes.STRING(500),
  metadata: DataTypes.JSONB // dados adicionais (slug, empresa_id_token, etc.)
}, { tableName: 'security_logs', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════════════════
//  COMPRA (Nota de Compra / NF-e de entrada)
// ══════════════════════════════════════════════════════════════
const Compra = sequelize.define('Compra', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  fornecedor_id: DataTypes.INTEGER,
  tipo_documento: { type: DataTypes.STRING(10), defaultValue: 'MANUAL' }, // NFE, MANUAL
  numero_nf: DataTypes.STRING(20),
  serie: { type: DataTypes.STRING(5), defaultValue: '1' },
  chave_acesso: DataTypes.STRING(44),
  data_emissao: DataTypes.DATEONLY,
  data_entrada: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  valor_produtos: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_frete: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_desconto: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_impostos: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { type: DataTypes.STRING(20), defaultValue: 'ABERTA' }, // ABERTA, FINALIZADA, CANCELADA
  observacoes: DataTypes.TEXT,
  xml_original: DataTypes.TEXT,
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  finalizada_em: DataTypes.DATE,
  finalizada_por: DataTypes.INTEGER,
  cancelada_em: DataTypes.DATE,
  cancelada_por: DataTypes.INTEGER,
  motivo_cancelamento: DataTypes.STRING(500)
}, {
  tableName: 'compras', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id', 'numero_nf'] },
    { fields: ['empresa_id', 'fornecedor_id'] },
    { fields: ['empresa_id', 'status'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  ITEM DA COMPRA
// ══════════════════════════════════════════════════════════════
const CompraItem = sequelize.define('CompraItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  compra_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: DataTypes.INTEGER,
  produto_nome: { type: DataTypes.STRING(200), allowNull: false },
  codigo_barras: DataTypes.STRING(50),
  ncm: DataTypes.STRING(10),
  cfop: DataTypes.STRING(6),
  quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 1 },
  valor_unitario: { type: DataTypes.DECIMAL(12, 4), defaultValue: 0 },
  valor_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // Rateio de custos adicionais
  desconto_rateado: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  frete_rateado: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  imposto_rateado: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  custo_final_unitario: { type: DataTypes.DECIMAL(12, 4), defaultValue: 0 },
  // Dados do lote
  numero_lote: DataTypes.STRING(50),
  validade: DataTypes.DATEONLY,
  lote_id: DataTypes.INTEGER
}, { tableName: 'compra_itens', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════════════════
//  PARCELA DA COMPRA (duplicatas)
// ══════════════════════════════════════════════════════════════
const CompraParcela = sequelize.define('CompraParcela', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  compra_id: { type: DataTypes.INTEGER, allowNull: false },
  numero_parcela: { type: DataTypes.INTEGER, allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'pendente' } // pendente, paga
}, { tableName: 'compra_parcelas', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════════════════
//  PROGRAMA COMERCIAL (Clube, Convênio, Campanha, Tabela)
//  Estrutura escalável, multiempresa, auditável
// ══════════════════════════════════════════════════════════════
const ProgramaComercial = sequelize.define('ProgramaComercial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  tipo: { 
    type: DataTypes.ENUM('clube', 'convenio', 'campanha', 'tabela'),
    allowNull: false, defaultValue: 'clube'
  },
  descricao: DataTypes.TEXT,
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  acumulativo_global: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Se TRUE, regras deste programa podem acumular com outros programas' },
  prioridade_global: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Prioridade entre programas (maior = mais prioritário)' },
  programa_padrao: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Se TRUE, todo novo cliente é inscrito automaticamente neste programa' },
  data_inicio: DataTypes.DATE,
  data_fim: DataTypes.DATE
}, { 
  tableName: 'programas_comerciais', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['ativo'] },
    { fields: ['data_inicio', 'data_fim'] },
    { fields: ['empresa_id', 'ativo'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  CLIENTE ↔ PROGRAMA (Inscrição/Adesão) — N:N
//  empresa_id obrigatório para multiempresa
// ══════════════════════════════════════════════════════════════
const ClientePrograma = sequelize.define('ClientePrograma', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, comment: 'Multiempresa — nunca ignorar' },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  programa_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'ativo' }, // ativo, suspenso, cancelado
  data_adesao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { 
  tableName: 'clientes_programas', timestamps: true, underscored: true,
  indexes: [
    { fields: ['cliente_id'] },
    { fields: ['programa_id'] },
    { fields: ['cliente_id', 'programa_id'], unique: true },
    { fields: ['empresa_id'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  REGRA DE DESCONTO — coração do módulo
//  empresa_id obrigatório, CHECK constraints via validate
// ══════════════════════════════════════════════════════════════
const RegraDesconto = sequelize.define('RegraDesconto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, comment: 'Multiempresa — nunca ignorar' },
  programa_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo_regra: {
    type: DataTypes.ENUM('percentual', 'valor_fixo', 'preco_especial'),
    allowNull: false, defaultValue: 'percentual'
  },
  escopo: {
    type: DataTypes.ENUM('produto', 'categoria', 'geral'),
    allowNull: false, defaultValue: 'produto'
  },
  produto_id: DataTypes.INTEGER,     // preenchido quando escopo = 'produto'
  categoria_id: DataTypes.INTEGER,   // preenchido quando escopo = 'categoria'
  valor: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 0 },
  prioridade: { type: DataTypes.INTEGER, defaultValue: 0 },
  acumulativo: { type: DataTypes.BOOLEAN, defaultValue: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  // ── Vigência temporal: protege contra alteração retroativa ──
  data_inicio: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Início da vigência (null = sem limite)' },
  data_fim: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Fim da vigência (null = sem limite)' }
}, { 
  tableName: 'regras_desconto', timestamps: true, underscored: true,
  indexes: [
    { fields: ['programa_id'] },
    { fields: ['produto_id'] },
    { fields: ['categoria_id'] },
    { fields: ['prioridade'], order: 'DESC' },
    { fields: ['programa_id', 'ativo'] },
    { fields: ['empresa_id'] }
  ],
  validate: {
    escopoConsistente() {
      if (this.escopo === 'produto' && !this.produto_id) {
        throw new Error('Escopo "produto" exige produto_id preenchido');
      }
      if (this.escopo === 'categoria' && !this.categoria_id) {
        throw new Error('Escopo "categoria" exige categoria_id preenchido');
      }
      if (this.escopo === 'geral' && (this.produto_id || this.categoria_id)) {
        throw new Error('Escopo "geral" não deve ter produto_id ou categoria_id');
      }
    },
    valorPositivo() {
      if (parseFloat(this.valor) < 0) {
        throw new Error('Valor da regra deve ser positivo');
      }
    },
    percentualLimite() {
      if (this.tipo_regra === 'percentual' && parseFloat(this.valor) > 100) {
        throw new Error('Percentual não pode exceder 100%');
      }
    }
  }
});

// ══════════════════════════════════════════════════════════════
//  LOG DE DESCONTOS — rastreabilidade completa de todo desconto
//  Registra: quem, quando, por quê, base legal (regra/programa)
// ══════════════════════════════════════════════════════════════
const LogDesconto = sequelize.define('LogDesconto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Null se desconto foi aplicado antes de finalizar (preview)' },
  item_venda_id: { type: DataTypes.INTEGER, allowNull: true },
  tipo_desconto: {
    type: DataTypes.ENUM('automatico', 'manual', 'manual_gerente'),
    allowNull: false
  },
  regra_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'FK regras_desconto (null se manual)' },
  programa_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Programa comercial que originou' },
  produto_id: { type: DataTypes.INTEGER, allowNull: true },
  valor_original: { type: DataTypes.DECIMAL(12, 2), allowNull: false, comment: 'Preço antes do desconto' },
  valor_desconto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, comment: 'Valor absoluto do desconto aplicado' },
  percentual_desconto: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
  valor_final: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false, comment: 'Operador logado' },
  gerente_autorizador_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Gerente que autorizou (se manual acima do limite)' },
  motivo: { type: DataTypes.STRING(500), allowNull: true, comment: 'Justificativa do desconto manual' },
  ip: { type: DataTypes.STRING(50), allowNull: true },
  data_hora: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'log_descontos', timestamps: false, underscored: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['venda_id'] },
    { fields: ['usuario_id'] },
    { fields: ['tipo_desconto'] },
    { fields: ['data_hora'] },
    { fields: ['empresa_id', 'data_hora'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  LOG DE AÇÕES DO PDV — rastreabilidade de cada operação
//  Registra: todas as transições de estado e ações críticas
// ══════════════════════════════════════════════════════════════
const LogPdv = sequelize.define('LogPdv', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'Null se ação ocorreu sem venda ativa' },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  acao: { type: DataTypes.STRING(50), allowNull: false, comment: 'INICIAR_VENDA, IDENTIFICAR_CLIENTE, INICIAR_PAGAMENTO, etc.' },
  estado_anterior: { type: DataTypes.STRING(30), allowNull: true },
  estado_novo: { type: DataTypes.STRING(30), allowNull: true },
  detalhes: { type: DataTypes.JSONB, allowNull: true, comment: 'Dados contextuais da ação (cliente_id, produto_id, etc.)' },
  ip: { type: DataTypes.STRING(50), allowNull: true },
  data_hora: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'log_pdv', timestamps: false, underscored: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['venda_id'] },
    { fields: ['usuario_id'] },
    { fields: ['acao'] },
    { fields: ['data_hora'] },
    { fields: ['empresa_id', 'data_hora'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  HISTÓRICO DE APLICAÇÃO DE PROGRAMA (auditoria + escala futura)
//  Preparado para: cashback, pontos, relatórios de ROI
// ══════════════════════════════════════════════════════════════
const HistoricoAplicacaoPrograma = sequelize.define('HistoricoAplicacaoPrograma', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: false },
  item_venda_id: { type: DataTypes.INTEGER, allowNull: false },
  programa_id: { type: DataTypes.INTEGER, allowNull: false },
  regra_id: { type: DataTypes.INTEGER, allowNull: false },
  valor_aplicado: { type: DataTypes.DECIMAL(10, 2), allowNull: false, comment: 'Valor do desconto efetivamente aplicado em R$' },
  tipo_regra: { type: DataTypes.STRING(30), allowNull: true, comment: 'percentual | valor_fixo | preco_especial' },
  escopo: { type: DataTypes.STRING(20), allowNull: true },
  preco_original: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  preco_final: { type: DataTypes.DECIMAL(10, 2), allowNull: true }
}, {
  tableName: 'historico_aplicacao_programa', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['venda_id'] },
    { fields: ['item_venda_id'] },
    { fields: ['programa_id'] },
    { fields: ['regra_id'] },
    { fields: ['venda_id', 'item_venda_id'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  MODELOS DE ETIQUETA — templates para impressão de preço
// ══════════════════════════════════════════════════════════════
const ModeloEtiqueta = sequelize.define('ModeloEtiqueta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  largura_mm: { type: DataTypes.DECIMAL(6, 1), allowNull: false, defaultValue: 40 },
  altura_mm: { type: DataTypes.DECIMAL(6, 1), allowNull: false, defaultValue: 30 },
  tipo: { type: DataTypes.ENUM('padrao', 'promocional', 'clube'), allowNull: false, defaultValue: 'padrao' },
  layout_json: { type: DataTypes.JSONB, allowNull: true, comment: 'Config extra de layout (fontes, margens internas, etc.)' },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'modelos_etiqueta', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id'] },
    { fields: ['tipo'] },
    { fields: ['empresa_id', 'tipo'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  CONFIG IMPRESSÃO — parâmetros de impressora por tenant
// ══════════════════════════════════════════════════════════════
const ConfigImpressao = sequelize.define('ConfigImpressao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  tipo_impressora: { type: DataTypes.ENUM('termica', 'laser'), allowNull: false, defaultValue: 'laser' },
  largura_papel_mm: { type: DataTypes.DECIMAL(6, 1), allowNull: true, defaultValue: 80 },
  margem_superior: { type: DataTypes.DECIMAL(6, 1), allowNull: true, defaultValue: 5 },
  margem_lateral: { type: DataTypes.DECIMAL(6, 1), allowNull: true, defaultValue: 5 },
  dpi: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 203 },
  // ── Campos de cupom/recibo ──
  tamanho_fonte_cupom: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 12, comment: 'Tamanho da fonte do cupom em px' },
  cortar_automatico: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Se impressora corta papel automaticamente' },
  tipo_documento_padrao: {
    type: DataTypes.ENUM('cupom_nao_fiscal', 'nfce'),
    defaultValue: 'cupom_nao_fiscal'
  },
  mensagem_rodape: { type: DataTypes.STRING(500), allowNull: true, defaultValue: 'Obrigado pela preferência!', comment: 'Mensagem no rodapé do cupom' },
  imprimir_automatico: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Abrir diálogo de impressão automaticamente ao finalizar' }
}, {
  tableName: 'config_impressao', timestamps: true, underscored: true,
  indexes: [
    { fields: ['empresa_id'], unique: true }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Configuração da Drogaria (Fase 1)
// ══════════════════════════════════════════════════════════════
const SngpcConfiguracao = sequelize.define('SngpcConfiguracao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  cnpj: { type: DataTypes.STRING(18), allowNull: false },
  razao_social: { type: DataTypes.STRING(200), allowNull: false },
  numero_afe: DataTypes.STRING(50),
  responsavel_tecnico_nome: { type: DataTypes.STRING(200), allowNull: false },
  responsavel_tecnico_crf: { type: DataTypes.STRING(30), allowNull: false },
  responsavel_tecnico_uf: { type: DataTypes.STRING(2), allowNull: false },
  data_inicio_controle: { type: DataTypes.DATEONLY, allowNull: false },
  ambiente: { type: DataTypes.STRING(20), defaultValue: 'producao' },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'sngpc_configuracao', timestamps: true, underscored: true,
  paranoid: false // Regulatório: configuração SNGPC é rastreável
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Movimentações Imutáveis (NUNCA UPDATE/DELETE)
//  Fase 2: Motor regulatório completo com período obrigatório
// ══════════════════════════════════════════════════════════════
const SngpcMovimentacao = sequelize.define('SngpcMovimentacao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  lote_id: { type: DataTypes.INTEGER, allowNull: false },
  periodo_id: DataTypes.INTEGER, // FK → sngpc_periodos (Fase 2: vínculo com período)
  tipo: {
    type: DataTypes.ENUM('entrada', 'saida', 'ajuste', 'inventario',
      'ENTRADA', 'DISPENSACAO', 'PERDA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'),
    allowNull: false
  },
  quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  data_movimentacao: { type: DataTypes.DATEONLY, allowNull: false },
  numero_documento: DataTypes.STRING(100),
  documento_referencia: DataTypes.STRING(200), // Fase 2: NF, receita, etc.
  profissional_responsavel: DataTypes.STRING(200), // Fase 2: nome do farmacêutico
  // Dados do paciente/comprador (receita)
  cpf_paciente: DataTypes.STRING(14),
  nome_paciente: DataTypes.STRING(200),
  nome_medico: DataTypes.STRING(200),
  crm_medico: DataTypes.STRING(20),
  uf_crm: DataTypes.STRING(2),
  numero_receita: DataTypes.STRING(50),
  data_receita: DataTypes.DATEONLY,
  // Ajuste
  motivo_ajuste: DataTypes.STRING(50), // perda, vencimento, quebra, correcao_inventario
  observacao: DataTypes.TEXT,
  // Rastreabilidade
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: DataTypes.INTEGER,
  compra_id: DataTypes.INTEGER,
  // Controle de transmissão
  transmitido: { type: DataTypes.BOOLEAN, defaultValue: false },
  transmissao_id: DataTypes.INTEGER,
  // Integridade SHA-256
  hash_integridade: { type: DataTypes.STRING(64), allowNull: false }
}, {
  tableName: 'sngpc_movimentacoes', timestamps: true, underscored: true,
  paranoid: false, // Regulatório: movimentação SNGPC é IMUTÁVEL — nunca soft delete
  indexes: [
    { fields: ['empresa_id', 'produto_id'] },
    { fields: ['empresa_id', 'lote_id'] },
    { fields: ['empresa_id', 'tipo'] },
    { fields: ['empresa_id', 'data_movimentacao'] },
    { fields: ['empresa_id', 'transmitido'] },
    { fields: ['empresa_id', 'periodo_id'] },
    { fields: ['produto_id', 'lote_id'] },
    { fields: ['transmissao_id'] },
    { fields: ['venda_id'] },
    { fields: ['compra_id'] },
    { fields: ['produto_id'] },
    { fields: ['lote_id'] },
    { fields: ['usuario_id'] },
    { fields: ['periodo_id'] },
    { unique: true, fields: ['hash_integridade'], name: 'sngpc_mov_hash_unique' }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Períodos de Controle
// ══════════════════════════════════════════════════════════════
const SngpcPeriodo = sequelize.define('SngpcPeriodo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  data_inicio: { type: DataTypes.DATEONLY, allowNull: false },
  data_fim: { type: DataTypes.DATEONLY, allowNull: false },
  status: {
    type: DataTypes.ENUM('aberto', 'fechado', 'transmitido', 'cancelado'),
    defaultValue: 'aberto'
  },
  data_fechamento: DataTypes.DATE, // Fase 2: data efetiva do fechamento
  hash_integridade: DataTypes.STRING(64), // Fase 2: SHA-256 das movimentações
  usuario_fechamento: DataTypes.INTEGER, // Fase 2: quem fechou
  fechado_por: DataTypes.INTEGER,
  fechado_em: DataTypes.DATE,
  observacoes: DataTypes.TEXT
}, {
  tableName: 'sngpc_periodos', timestamps: true, underscored: true,
  paranoid: false, // Regulatório: período é rastreável — nunca soft delete
  indexes: [
    { fields: ['empresa_id', 'status'] },
    { fields: ['empresa_id', 'data_inicio', 'data_fim'], unique: true, name: 'sngpc_periodo_empresa_datas_unique' },
    { fields: ['fechado_por'] },
    { fields: ['usuario_fechamento'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Transmissões (XML gerado + envio manual)
// ══════════════════════════════════════════════════════════════
const SngpcTransmissao = sequelize.define('SngpcTransmissao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  periodo_id: { type: DataTypes.INTEGER, allowNull: false },
  arquivo_xml_path: DataTypes.STRING(500),
  xml_conteudo: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('gerado', 'enviado', 'aceito', 'rejeitado'),
    defaultValue: 'gerado'
  },
  protocolo_anvisa: DataTypes.STRING(50),
  data_envio: DataTypes.DATE,
  data_retorno: DataTypes.DATE,
  mensagem_retorno: DataTypes.TEXT,
  gerado_por: { type: DataTypes.INTEGER, allowNull: false },
  enviado_por: DataTypes.INTEGER
}, {
  tableName: 'sngpc_transmissoes', timestamps: true, underscored: true,
  paranoid: false, // Regulatório: transmissão é rastreável — nunca soft delete
  indexes: [
    { fields: ['empresa_id', 'status'] },
    { fields: ['periodo_id'] },
    { fields: ['gerado_por'] },
    { fields: ['enviado_por'] },
    { unique: true, fields: ['empresa_id', 'protocolo_anvisa'], name: 'sngpc_trans_protocolo_unique', where: { protocolo_anvisa: { [require('sequelize').Op.ne]: null } } }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Estoque Regulatório (Fase 2)
//  Saldo separado do estoque comercial — enterprise pattern
// ══════════════════════════════════════════════════════════════
const SngpcEstoque = sequelize.define('SngpcEstoque', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  lote_id: { type: DataTypes.INTEGER, allowNull: false },
  saldo_atual: { type: DataTypes.DECIMAL(10, 3), allowNull: false, defaultValue: 0 }
}, {
  tableName: 'sngpc_estoque', timestamps: true, underscored: true,
  paranoid: false,
  indexes: [
    { unique: true, fields: ['empresa_id', 'produto_id', 'lote_id'], name: 'sngpc_estoque_empresa_produto_lote_unique' },
    { fields: ['produto_id'] },
    { fields: ['lote_id'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Arquivos Gerados (Fase 3)
//  1 período → 1 arquivo ativo (UNIQUE periodo_id)
// ══════════════════════════════════════════════════════════════
const SngpcArquivo = sequelize.define('SngpcArquivo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  periodo_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  nome_arquivo: { type: DataTypes.STRING(255), allowNull: false },
  hash_arquivo: { type: DataTypes.STRING(64), allowNull: false },
  conteudo: { type: DataTypes.TEXT, allowNull: false },
  criado_em: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  criado_por: { type: DataTypes.INTEGER, allowNull: false }
}, {
  tableName: 'sngpc_arquivos', timestamps: true, underscored: true,
  paranoid: false, // Regulatório: arquivo SNGPC é rastreável
  indexes: [
    { unique: true, fields: ['periodo_id'], name: 'sngpc_arquivos_periodo_unique' },
    { fields: ['empresa_id'] },
    { fields: ['hash_arquivo'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  SNGPC — Auditoria Regulatória (Fase 3)
//  Log completo de todas ações regulatórias — NUNCA DELETE
// ══════════════════════════════════════════════════════════════
const SngpcAuditoria = sequelize.define('SngpcAuditoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  periodo_id: DataTypes.INTEGER,
  acao: {
    type: DataTypes.ENUM(
      'ABRIR_PERIODO', 'FECHAR_PERIODO', 'GERAR_ARQUIVO',
      'TRANSMITIR', 'REJEITAR', 'CANCELAR',
      'MOVIMENTACAO', 'VALIDAR_INTEGRIDADE'
    ),
    allowNull: false
  },
  dados_anteriores: { type: DataTypes.JSONB, allowNull: true },
  dados_novos: { type: DataTypes.JSONB, allowNull: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_nome: DataTypes.STRING(200),
  ip_address: DataTypes.STRING(50),
  detalhes: DataTypes.TEXT,
  timestamp: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'sngpc_auditoria', timestamps: false, underscored: true,
  paranoid: false,
  indexes: [
    { fields: ['periodo_id'] },
    { fields: ['empresa_id', 'timestamp'] },
    { fields: ['empresa_id', 'acao'] },
    { fields: ['usuario_id'] }
  ]
});

// ══════════════════════════════════════════════════════════════
//  ASSOCIAÇÕES (RELACIONAMENTOS)
// ══════════════════════════════════════════════════════════════

// Empresa → Usuários
Empresa.hasMany(Usuario, { foreignKey: 'empresa_id' });
Usuario.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Empresa → Clientes
Empresa.hasMany(Cliente, { foreignKey: 'empresa_id' });
Cliente.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Empresa → Categorias
Empresa.hasMany(Categoria, { foreignKey: 'empresa_id' });
Categoria.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Empresa → Fornecedores
Empresa.hasMany(Fornecedor, { foreignKey: 'empresa_id' });
Fornecedor.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Empresa → Produtos
Empresa.hasMany(Produto, { foreignKey: 'empresa_id' });
Produto.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Produto.belongsTo(Categoria, { foreignKey: 'categoria_id' });
Produto.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id' });

// Produto → Histórico de Preço (RESTRICT: histórico não deve ser apagado silenciosamente)
Produto.hasMany(HistoricoPreco, { foreignKey: 'produto_id', onDelete: 'RESTRICT' });
HistoricoPreco.belongsTo(Produto, { foreignKey: 'produto_id' });
HistoricoPreco.belongsTo(Empresa, { foreignKey: 'empresa_id' });
HistoricoPreco.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Produto → Lotes (RESTRICT: lote com estoque/movimentação não pode sumir)
Produto.hasMany(Lote, { foreignKey: 'produto_id', onDelete: 'RESTRICT' });
Lote.belongsTo(Produto, { foreignKey: 'produto_id' });
Lote.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Lote.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id' });

// Produto → Sugestões (CASCADE ok — sugestão é auxiliar, pode ser removida com produto)
Produto.hasMany(ProdutoSugestao, { foreignKey: 'produto_id', as: 'Sugestoes', onDelete: 'CASCADE' });
ProdutoSugestao.belongsTo(Produto, { foreignKey: 'produto_id', as: 'ProdutoOrigem' });
ProdutoSugestao.belongsTo(Produto, { foreignKey: 'produto_sugerido_id', as: 'ProdutoSugerido' });

// Combos
Empresa.hasMany(Combo, { foreignKey: 'empresa_id' });
Combo.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Combo.hasMany(ComboItem, { foreignKey: 'combo_id' });
ComboItem.belongsTo(Combo, { foreignKey: 'combo_id' });
ComboItem.belongsTo(Produto, { foreignKey: 'produto_id' });

// Caixa
Empresa.hasMany(Caixa, { foreignKey: 'empresa_id' });
Caixa.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Caixa.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Caixa.hasMany(CaixaMovimentacao, { foreignKey: 'caixa_id' });
CaixaMovimentacao.belongsTo(Caixa, { foreignKey: 'caixa_id' });

// Vendas
Empresa.hasMany(Venda, { foreignKey: 'empresa_id' });
Venda.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Venda.belongsTo(Caixa, { foreignKey: 'caixa_id' });
Venda.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Venda.belongsTo(Cliente, { foreignKey: 'cliente_id' });
Venda.hasMany(VendaItem, { foreignKey: 'venda_id' });
VendaItem.belongsTo(Venda, { foreignKey: 'venda_id' });
VendaItem.belongsTo(Produto, { foreignKey: 'produto_id' });

// Estoque
Empresa.hasMany(EstoqueMovimentacao, { foreignKey: 'empresa_id' });
EstoqueMovimentacao.belongsTo(Empresa, { foreignKey: 'empresa_id' });
EstoqueMovimentacao.belongsTo(Produto, { foreignKey: 'produto_id' });
EstoqueMovimentacao.belongsTo(Usuario, { foreignKey: 'usuario_id' });
EstoqueMovimentacao.belongsTo(Lote, { foreignKey: 'lote_id' });
Lote.hasMany(EstoqueMovimentacao, { foreignKey: 'lote_id' });

// Financeiro
Empresa.hasMany(ContaPagar, { foreignKey: 'empresa_id' });
ContaPagar.belongsTo(Empresa, { foreignKey: 'empresa_id' });
ContaPagar.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id' });
ContaPagar.belongsTo(CentroCusto, { foreignKey: 'centro_custo_id' });
ContaPagar.belongsTo(ContaBancaria, { foreignKey: 'conta_bancaria_id' });

Empresa.hasMany(ContaReceber, { foreignKey: 'empresa_id' });
ContaReceber.belongsTo(Empresa, { foreignKey: 'empresa_id' });
ContaReceber.belongsTo(Cliente, { foreignKey: 'cliente_id' });
ContaReceber.belongsTo(ContaBancaria, { foreignKey: 'conta_bancaria_id' });

// Centros de Custo e Contas Bancárias
Empresa.hasMany(CentroCusto, { foreignKey: 'empresa_id' });
CentroCusto.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Empresa.hasMany(ContaBancaria, { foreignKey: 'empresa_id' });
ContaBancaria.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// SNGPC / Medicamentos
MedicamentoControlado.belongsTo(Empresa, { foreignKey: 'empresa_id' });
MedicamentoControlado.belongsTo(Venda, { foreignKey: 'venda_id' });
MedicamentoControlado.belongsTo(Produto, { foreignKey: 'produto_id' });
MedicamentoControlado.belongsTo(Usuario, { foreignKey: 'farmaceutico_id', as: 'Farmaceutico' });

// Nota Fiscal
Empresa.hasMany(NotaFiscal, { foreignKey: 'empresa_id' });
NotaFiscal.belongsTo(Empresa, { foreignKey: 'empresa_id' });
NotaFiscal.belongsTo(Venda, { foreignKey: 'venda_id' });
Venda.hasOne(NotaFiscal, { foreignKey: 'venda_id' });

// Fiscal Provider Config
Empresa.hasMany(FiscalProviderConfig, { foreignKey: 'empresa_id' });
FiscalProviderConfig.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Metas
Empresa.hasMany(Meta, { foreignKey: 'empresa_id' });
Meta.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Meta.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Audit
Empresa.hasMany(AuditLog, { foreignKey: 'empresa_id' });
AuditLog.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Security Logs
SecurityLog.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SecurityLog.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Log de Descontos (auditoria anti-fraude)
Empresa.hasMany(LogDesconto, { foreignKey: 'empresa_id' });
LogDesconto.belongsTo(Empresa, { foreignKey: 'empresa_id' });
LogDesconto.belongsTo(Venda, { foreignKey: 'venda_id' });
LogDesconto.belongsTo(VendaItem, { foreignKey: 'item_venda_id' });
LogDesconto.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'Operador' });
LogDesconto.belongsTo(Usuario, { foreignKey: 'gerente_autorizador_id', as: 'GerenteAutorizador' });
LogDesconto.belongsTo(RegraDesconto, { foreignKey: 'regra_id' });
LogDesconto.belongsTo(Produto, { foreignKey: 'produto_id' });

// Log de Ações do PDV (rastreabilidade)
Empresa.hasMany(LogPdv, { foreignKey: 'empresa_id' });
LogPdv.belongsTo(Empresa, { foreignKey: 'empresa_id' });
LogPdv.belongsTo(Venda, { foreignKey: 'venda_id' });
LogPdv.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Venda → Venda referenciada (cancelamento)
Venda.belongsTo(Venda, { foreignKey: 'venda_referenciada_id', as: 'VendaOriginal' });
Venda.belongsTo(Usuario, { foreignKey: 'cancelado_por', as: 'CanceladoPor' });

// Compras
Empresa.hasMany(Compra, { foreignKey: 'empresa_id' });
Compra.belongsTo(Empresa, { foreignKey: 'empresa_id' });
Compra.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id' });
Compra.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Compra.hasMany(CompraItem, { foreignKey: 'compra_id' });
CompraItem.belongsTo(Compra, { foreignKey: 'compra_id' });
CompraItem.belongsTo(Produto, { foreignKey: 'produto_id' });
CompraItem.belongsTo(Lote, { foreignKey: 'lote_id' });
CompraItem.hasOne(Lote, { foreignKey: 'compra_item_id' });
Lote.belongsTo(CompraItem, { foreignKey: 'compra_item_id' });
Compra.hasMany(CompraParcela, { foreignKey: 'compra_id' });
CompraParcela.belongsTo(Compra, { foreignKey: 'compra_id' });

// Programas Comerciais
Empresa.hasMany(ProgramaComercial, { foreignKey: 'empresa_id' });
ProgramaComercial.belongsTo(Empresa, { foreignKey: 'empresa_id' });
ProgramaComercial.hasMany(RegraDesconto, { foreignKey: 'programa_id', onDelete: 'CASCADE' });
RegraDesconto.belongsTo(ProgramaComercial, { foreignKey: 'programa_id' });
RegraDesconto.belongsTo(Produto, { foreignKey: 'produto_id' });
RegraDesconto.belongsTo(Categoria, { foreignKey: 'categoria_id' });
RegraDesconto.belongsTo(Empresa, { foreignKey: 'empresa_id' });
ProgramaComercial.hasMany(ClientePrograma, { foreignKey: 'programa_id', onDelete: 'CASCADE' });
ClientePrograma.belongsTo(ProgramaComercial, { foreignKey: 'programa_id' });
Cliente.hasMany(ClientePrograma, { foreignKey: 'cliente_id' });
ClientePrograma.belongsTo(Cliente, { foreignKey: 'cliente_id' });
ClientePrograma.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Histórico de Aplicação de Programa (auditoria)
Empresa.hasMany(HistoricoAplicacaoPrograma, { foreignKey: 'empresa_id' });
HistoricoAplicacaoPrograma.belongsTo(Empresa, { foreignKey: 'empresa_id' });
HistoricoAplicacaoPrograma.belongsTo(Venda, { foreignKey: 'venda_id' });
HistoricoAplicacaoPrograma.belongsTo(VendaItem, { foreignKey: 'item_venda_id' });
HistoricoAplicacaoPrograma.belongsTo(ProgramaComercial, { foreignKey: 'programa_id' });
HistoricoAplicacaoPrograma.belongsTo(RegraDesconto, { foreignKey: 'regra_id' });

// Modelos de Etiqueta
Empresa.hasMany(ModeloEtiqueta, { foreignKey: 'empresa_id' });
ModeloEtiqueta.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// Config Impressão
Empresa.hasOne(ConfigImpressao, { foreignKey: 'empresa_id' });
ConfigImpressao.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// SNGPC Configuração — RESTRICT para preservar rastreabilidade Anvisa
Empresa.hasOne(SngpcConfiguracao, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcConfiguracao.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// SNGPC Movimentações — RESTRICT: movimentação SNGPC é IMUTÁVEL e RASTREÁVEL (Anvisa)
Empresa.hasMany(SngpcMovimentacao, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcMovimentacao.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcMovimentacao.belongsTo(Produto, { foreignKey: 'produto_id', onDelete: 'RESTRICT' });
SngpcMovimentacao.belongsTo(Lote, { foreignKey: 'lote_id', onDelete: 'RESTRICT' });
SngpcMovimentacao.belongsTo(Usuario, { foreignKey: 'usuario_id', onDelete: 'RESTRICT' });
SngpcMovimentacao.belongsTo(Venda, { foreignKey: 'venda_id', onDelete: 'SET NULL' });
SngpcMovimentacao.belongsTo(Compra, { foreignKey: 'compra_id', onDelete: 'SET NULL' });
SngpcMovimentacao.belongsTo(SngpcTransmissao, { foreignKey: 'transmissao_id', onDelete: 'SET NULL' });
Lote.hasMany(SngpcMovimentacao, { foreignKey: 'lote_id', as: 'MovimentacoesSngpc', onDelete: 'RESTRICT' });
Produto.hasMany(SngpcMovimentacao, { foreignKey: 'produto_id', as: 'MovimentacoesSngpc', onDelete: 'RESTRICT' });
SngpcMovimentacao.belongsTo(SngpcPeriodo, { foreignKey: 'periodo_id', onDelete: 'RESTRICT' });
SngpcPeriodo.hasMany(SngpcMovimentacao, { foreignKey: 'periodo_id', as: 'Movimentacoes', onDelete: 'RESTRICT' });

// SNGPC Períodos — RESTRICT para rastreabilidade
Empresa.hasMany(SngpcPeriodo, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcPeriodo.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcPeriodo.belongsTo(Usuario, { foreignKey: 'fechado_por', as: 'FechadoPor', onDelete: 'SET NULL' });
SngpcPeriodo.belongsTo(Usuario, { foreignKey: 'usuario_fechamento', as: 'UsuarioFechamento', onDelete: 'SET NULL' });

// SNGPC Estoque Regulatório (Fase 2) — RESTRICT
Empresa.hasMany(SngpcEstoque, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcEstoque.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcEstoque.belongsTo(Produto, { foreignKey: 'produto_id', onDelete: 'RESTRICT' });
SngpcEstoque.belongsTo(Lote, { foreignKey: 'lote_id', onDelete: 'RESTRICT' });
Produto.hasMany(SngpcEstoque, { foreignKey: 'produto_id', as: 'EstoqueRegulatorio', onDelete: 'RESTRICT' });
Lote.hasMany(SngpcEstoque, { foreignKey: 'lote_id', as: 'SaldoRegulatorio', onDelete: 'RESTRICT' });

// SNGPC Transmissões
// SNGPC Transmissões — RESTRICT para rastreabilidade
Empresa.hasMany(SngpcTransmissao, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcTransmissao.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcTransmissao.belongsTo(SngpcPeriodo, { foreignKey: 'periodo_id', onDelete: 'RESTRICT' });
SngpcPeriodo.hasMany(SngpcTransmissao, { foreignKey: 'periodo_id', onDelete: 'RESTRICT' });
SngpcTransmissao.belongsTo(Usuario, { foreignKey: 'gerado_por', as: 'SngpcGeradoPor', onDelete: 'SET NULL' });
SngpcTransmissao.belongsTo(Usuario, { foreignKey: 'enviado_por', as: 'SngpcEnviadoPor', onDelete: 'SET NULL' });
SngpcTransmissao.hasMany(SngpcMovimentacao, { foreignKey: 'transmissao_id', onDelete: 'SET NULL' });

// SNGPC Arquivos (Fase 3) — RESTRICT
Empresa.hasMany(SngpcArquivo, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcArquivo.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcArquivo.belongsTo(SngpcPeriodo, { foreignKey: 'periodo_id', onDelete: 'RESTRICT' });
SngpcPeriodo.hasOne(SngpcArquivo, { foreignKey: 'periodo_id', as: 'Arquivo', onDelete: 'RESTRICT' });
SngpcArquivo.belongsTo(Usuario, { foreignKey: 'criado_por', as: 'CriadoPor', onDelete: 'SET NULL' });

// SNGPC Auditoria (Fase 3) — NUNCA DELETAR
Empresa.hasMany(SngpcAuditoria, { foreignKey: 'empresa_id', onDelete: 'RESTRICT' });
SngpcAuditoria.belongsTo(Empresa, { foreignKey: 'empresa_id' });
SngpcAuditoria.belongsTo(SngpcPeriodo, { foreignKey: 'periodo_id', onDelete: 'SET NULL' });
SngpcAuditoria.belongsTo(Usuario, { foreignKey: 'usuario_id', onDelete: 'RESTRICT' });

module.exports = {
  sequelize,
  Empresa,
  UsuarioMaster,
  Usuario,
  Cliente,
  Categoria,
  Fornecedor,
  Produto,
  HistoricoPreco,
  Lote,
  ProdutoSugestao,
  Combo,
  ComboItem,
  Caixa,
  CaixaMovimentacao,
  Venda,
  VendaItem,
  EstoqueMovimentacao,
  ContaPagar,
  ContaReceber,
  CentroCusto,
  ContaBancaria,
  MedicamentoControlado,
  NotaFiscal,
  Meta,
  AuditLog,
  SecurityLog,
  Compra,
  CompraItem,
  CompraParcela,
  ProgramaComercial,
  ClientePrograma,
  RegraDesconto,
  HistoricoAplicacaoPrograma,
  LogDesconto,
  LogPdv,
  ModeloEtiqueta,
  ConfigImpressao,
  SngpcConfiguracao,
  SngpcMovimentacao,
  SngpcPeriodo,
  SngpcTransmissao,
  SngpcEstoque,
  SngpcArquivo,
  SngpcAuditoria,
  FiscalProviderConfig
};
