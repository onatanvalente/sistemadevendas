const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// ══════════════════════════════════════════════════
//  EMPRESA (TENANT)
// ══════════════════════════════════════════════════
const Empresa = sequelize.define('Empresa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  cnpj: { type: DataTypes.STRING(18), allowNull: false, unique: true },
  tipo_negocio: { 
    type: DataTypes.ENUM('mercado', 'drogaria'), 
    allowNull: false, defaultValue: 'mercado' 
  },
  regime_tributario: { 
    type: DataTypes.ENUM('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'),
    defaultValue: 'simples_nacional'
  },
  endereco: DataTypes.STRING(300),
  cidade: DataTypes.STRING(100),
  estado: DataTypes.STRING(2),
  cep: DataTypes.STRING(10),
  telefone: DataTypes.STRING(20),
  email: DataTypes.STRING(150),
  responsavel_tecnico: DataTypes.STRING(200),
  crf_responsavel: DataTypes.STRING(30),
  plano: { 
    type: DataTypes.ENUM('basico', 'profissional', 'premium'), 
    defaultValue: 'basico' 
  },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'empresas', timestamps: true, underscored: true });

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
    type: DataTypes.ENUM('administrador', 'vendedor', 'financeiro', 'farmaceutico'),
    allowNull: false, defaultValue: 'vendedor'
  },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  ultimo_login: DataTypes.DATE
}, { 
  tableName: 'usuarios', timestamps: true, underscored: true,
  indexes: [{ unique: true, fields: ['email', 'empresa_id'] }]
});

// ══════════════════════════════════════════════════
//  CATEGORIA
// ══════════════════════════════════════════════════
const Categoria = sequelize.define('Categoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  descricao: DataTypes.STRING(300),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'categorias', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  FORNECEDOR
// ══════════════════════════════════════════════════
const Fornecedor = sequelize.define('Fornecedor', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  cnpj_cpf: DataTypes.STRING(18),
  telefone: DataTypes.STRING(20),
  email: DataTypes.STRING(150),
  endereco: DataTypes.STRING(300),
  contato: DataTypes.STRING(100),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'fornecedores', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  PRODUTO
// ══════════════════════════════════════════════════
const Produto = sequelize.define('Produto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  categoria_id: DataTypes.INTEGER,
  fornecedor_id: DataTypes.INTEGER,
  nome: { type: DataTypes.STRING(200), allowNull: false },
  codigo_barras: DataTypes.STRING(50),
  descricao: DataTypes.TEXT,
  preco_custo: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  preco_venda: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  margem: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  estoque_atual: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  estoque_minimo: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  unidade: { type: DataTypes.STRING(10), defaultValue: 'UN' },
  // Campos para drogaria
  lote: DataTypes.STRING(50),
  validade: DataTypes.DATEONLY,
  controlado: { type: DataTypes.BOOLEAN, defaultValue: false },
  registro_anvisa: DataTypes.STRING(50),
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { 
  tableName: 'produtos', timestamps: true, underscored: true,
  indexes: [{ fields: ['empresa_id', 'codigo_barras'] }]
});

// ══════════════════════════════════════════════════
//  CAIXA
// ══════════════════════════════════════════════════
const Caixa = sequelize.define('Caixa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
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
  numero: { type: DataTypes.INTEGER, allowNull: false },
  cliente_nome: DataTypes.STRING(200),
  cliente_cpf: DataTypes.STRING(14),
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  desconto: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  acrescimo: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  forma_pagamento: { 
    type: DataTypes.STRING(50), allowNull: false 
  },
  // Para pagamento múltiplo
  valor_dinheiro: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_pix: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_debito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_credito: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  troco: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  status: { 
    type: DataTypes.ENUM('finalizada', 'cancelada'), 
    defaultValue: 'finalizada' 
  },
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
  desconto_item: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, { tableName: 'venda_itens', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  MOVIMENTAÇÃO DE ESTOQUE
// ══════════════════════════════════════════════════
const EstoqueMovimentacao = sequelize.define('EstoqueMovimentacao', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { 
    type: DataTypes.ENUM('entrada', 'saida', 'ajuste', 'perda', 'vencimento'),
    allowNull: false 
  },
  quantidade: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
  estoque_anterior: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  estoque_posterior: { type: DataTypes.DECIMAL(10, 3), defaultValue: 0 },
  motivo: DataTypes.STRING(300),
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  referencia: DataTypes.STRING(100) // ex: "venda #123"
}, { tableName: 'estoque_movimentacoes', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  CONTAS A PAGAR
// ══════════════════════════════════════════════════
const ContaPagar = sequelize.define('ContaPagar', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  fornecedor_id: DataTypes.INTEGER,
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  data_pagamento: DataTypes.DATEONLY,
  status: { 
    type: DataTypes.ENUM('pendente', 'pago', 'vencido', 'cancelado'),
    defaultValue: 'pendente'
  },
  categoria: { 
    type: DataTypes.STRING(50), 
    defaultValue: 'fornecedor' // fornecedor, aluguel, salario, imposto, outros
  },
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
  cliente_nome: DataTypes.STRING(200),
  cliente_cpf: DataTypes.STRING(14),
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  data_vencimento: { type: DataTypes.DATEONLY, allowNull: false },
  data_recebimento: DataTypes.DATEONLY,
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
//  MEDICAMENTO CONTROLADO (ANVISA)
// ══════════════════════════════════════════════════
const MedicamentoControlado = sequelize.define('MedicamentoControlado', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  empresa_id: { type: DataTypes.INTEGER, allowNull: false },
  venda_id: { type: DataTypes.INTEGER, allowNull: false },
  produto_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_cpf: { type: DataTypes.STRING(14), allowNull: false },
  cliente_nome: { type: DataTypes.STRING(200), allowNull: false },
  medico_nome: DataTypes.STRING(200),
  medico_crm: DataTypes.STRING(20),
  numero_receita: DataTypes.STRING(50),
  receita_retida: { type: DataTypes.BOOLEAN, defaultValue: false },
  farmaceutico_id: { type: DataTypes.INTEGER, allowNull: false },
  data_venda: { type: DataTypes.DATEONLY, allowNull: false }
}, { tableName: 'medicamentos_controlados', timestamps: true, underscored: true });

// ══════════════════════════════════════════════════
//  ASSOCIAÇÕES (RELACIONAMENTOS)
// ══════════════════════════════════════════════════

// Empresa → Usuários
Empresa.hasMany(Usuario, { foreignKey: 'empresa_id' });
Usuario.belongsTo(Empresa, { foreignKey: 'empresa_id' });

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
Venda.hasMany(VendaItem, { foreignKey: 'venda_id' });
VendaItem.belongsTo(Venda, { foreignKey: 'venda_id' });
VendaItem.belongsTo(Produto, { foreignKey: 'produto_id' });

// Estoque
Empresa.hasMany(EstoqueMovimentacao, { foreignKey: 'empresa_id' });
EstoqueMovimentacao.belongsTo(Empresa, { foreignKey: 'empresa_id' });
EstoqueMovimentacao.belongsTo(Produto, { foreignKey: 'produto_id' });

// Financeiro
Empresa.hasMany(ContaPagar, { foreignKey: 'empresa_id' });
ContaPagar.belongsTo(Empresa, { foreignKey: 'empresa_id' });
ContaPagar.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id' });

Empresa.hasMany(ContaReceber, { foreignKey: 'empresa_id' });
ContaReceber.belongsTo(Empresa, { foreignKey: 'empresa_id' });

// ANVISA
MedicamentoControlado.belongsTo(Empresa, { foreignKey: 'empresa_id' });
MedicamentoControlado.belongsTo(Venda, { foreignKey: 'venda_id' });
MedicamentoControlado.belongsTo(Produto, { foreignKey: 'produto_id' });

module.exports = {
  sequelize,
  Empresa,
  Usuario,
  Categoria,
  Fornecedor,
  Produto,
  Caixa,
  CaixaMovimentacao,
  Venda,
  VendaItem,
  EstoqueMovimentacao,
  ContaPagar,
  ContaReceber,
  MedicamentoControlado
};
