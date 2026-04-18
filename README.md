# VarlenSYS - Sistema de Gestão Comercial

Sistema SaaS completo para **mercadinhos**, **drogarias** e **pequenos comércios varejistas**.

## 🚀 Funcionalidades (MVP - Fase 1)

- ✅ **Autenticação** - Login, registro de empresa, JWT, controle de acesso (RBAC)
- ✅ **PDV Completo** - Busca, código de barras, carrinho, múltiplas formas de pagamento
- ✅ **Gestão de Caixa** - Abertura, fechamento, sangria, suprimento
- ✅ **Estoque** - Cadastro, entrada, saída, ajuste, perda, alertas
- ✅ **Financeiro** - Contas a pagar, contas a receber, fluxo de caixa
- ✅ **Dashboard** - Faturamento, ticket médio, produtos mais vendidos, alertas
- ✅ **Multi-tenant** - Cada empresa com dados isolados
- ✅ **Modo escuro** - Toggle de tema claro/escuro

## 🛠️ Tech Stack

- **Backend:** Node.js + Express
- **Banco:** PostgreSQL + Sequelize ORM
- **Frontend:** HTML/CSS/JS (SPA vanilla)
- **Auth:** JWT + bcryptjs
- **Deploy:** Railway

## 📦 Instalação Local

### 1. Pré-requisitos
- Node.js 18+
- PostgreSQL instalado e rodando

### 2. Configurar banco
```sql
CREATE DATABASE varlensys_db;
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Editar .env com sua DATABASE_URL
```

### 4. Instalar dependências
```bash
npm install
```

### 5. Rodar seed (dados de teste)
```bash
npm run db:seed
```

### 6. Iniciar servidor
```bash
npm run dev
```

Acesse: http://localhost:3000

**Login de teste:**
- Email: `admin@varlensys.com`
- Senha: `123456`

## 🚂 Deploy no Railway

### 1. Criar repositório no GitHub
```bash
git init
git add .
git commit -m "VarlenSYS - MVP completo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/varlensys.git
git push -u origin main
```

### 2. No Railway (railway.app)
1. Criar novo projeto
2. **Add PostgreSQL** - Adicionar banco de dados
3. **Deploy from GitHub** - Conectar o repositório
4. As variáveis `DATABASE_URL` são configuradas automaticamente
5. Adicionar variável `JWT_SECRET` com um valor seguro
6. Adicionar variável `NODE_ENV=production`
7. Deploy automático a cada push!

### Variáveis de ambiente no Railway:
| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | *(automático pelo Railway)* |
| `JWT_SECRET` | `sua_chave_secreta_forte` |
| `NODE_ENV` | `production` |

## 📁 Estrutura do Projeto

```
├── server.js              # Servidor Express
├── package.json
├── railway.json           # Config Railway
├── config/
│   └── database.js        # Conexão PostgreSQL
├── middleware/
│   └── auth.js            # JWT + RBAC + Multi-tenant
├── models/
│   └── index.js           # Todos os modelos Sequelize
├── routes/
│   ├── auth.js            # Login / Registro
│   ├── empresas.js        # CRUD Empresa
│   ├── usuarios.js        # CRUD Usuários
│   ├── categorias.js      # CRUD Categorias
│   ├── fornecedores.js    # CRUD Fornecedores
│   ├── produtos.js        # CRUD Produtos
│   ├── vendas.js          # PDV / Vendas
│   ├── caixa.js           # Gestão de Caixa
│   ├── estoque.js         # Movimentações
│   ├── financeiro.js      # Contas Pagar/Receber
│   └── dashboard.js       # Indicadores
├── public/
│   ├── index.html         # SPA Entry
│   ├── css/style.css      # Design System
│   └── js/
│       ├── app.js         # Router SPA + API Client
│       ├── pages.js       # Todas as páginas
│       └── pdv.js         # Módulo PDV
└── scripts/
    ├── seed.js            # Dados de teste
    └── syncDb.js          # Sync do banco
```

## 🔑 Perfis de Acesso

| Perfil | Acesso |
|--------|--------|
| **Administrador** | Acesso total |
| **Vendedor** | PDV + Caixa |
| **Financeiro** | Contas Pagar/Receber + Relatórios |
| **Farmacêutico** | PDV + Validação controlados (drogaria) |

## ⌨️ Atalhos do PDV

| Tecla | Ação |
|-------|------|
| **F2** | Foco na busca |
| **F12** | Finalizar venda |
| **Esc** | Limpar busca |
| **Enter** | Buscar por código de barras |

## 📋 Roadmap

### Fase 2
- [ ] Emissão fiscal (NF-e / NFC-e)
- [ ] Relatórios avançados (DRE, fluxo de caixa visual)
- [ ] Controle avançado de permissões

### Fase 3
- [ ] Módulo ANVISA (drogarias)
- [ ] App mobile
- [ ] Integrações externas

---

**VarlenSYS** - Complexidade no código. Simplicidade na tela. 💼
