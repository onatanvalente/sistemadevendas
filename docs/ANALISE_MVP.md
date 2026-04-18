# VarlenSYS - Analise Completa para MVP Comercializavel

> **Data:** 17/04/2026
> **Versao:** VarlenSYS v3.0 - SaaS Multi-tenant
> **Stack:** Node.js + Express + Sequelize + PostgreSQL
> **Segmentos:** Mercadinhos / Mercearias + Drogarias / Farmacias

---

## 1. PARECER GERAL

O VarlenSYS esta em **estagio avancado de desenvolvimento** com ~20.000+ linhas de codigo.
A arquitetura multi-tenant, seguranca (JWT, RLS, CORS, Helmet, IDOR protection),
e a maioria dos modulos operacionais estao **completos e funcionais**.

O sistema esta **proximo de ser comercializavel** mas precisa de ajustes em areas
criticas que um cliente pagante espera desde o primeiro dia.

---

## 2. STATUS DE CADA MODULO

### Modulos PRONTOS (funcionais e completos)

| Modulo | Status | Backend | Observacao |
|--------|--------|---------|------------|
| PDV (Ponto de Venda) | OK | vendas.js, caixa.js, produtos.js | Fullscreen, busca barcode, multi-pagamento, motor descontos |
| Vendas | OK | vendas.js (734 linhas) | CRUD, filtros, cancelamento com reversao completa |
| Caixa | OK | caixa.js (163 linhas) | Abertura, fechamento, sangria, suprimento |
| Produtos | OK | produtos.js (522 linhas) | CRUD, historico precos, lotes, sugestoes, combos |
| Estoque | OK | estoque.js (460 linhas) | Movimentacoes, inventario, sugestao compra, FIFO lotes |
| Categorias | OK | categorias.js (67 linhas) | CRUD basico |
| Fornecedores | OK | fornecedores.js (250 linhas) | CRUD, ranking, metricas |
| Clientes | OK | clientes.js (350 linhas) | CRUD, busca CPF, historico, auto-inscricao programa |
| Compras | OK | compras.js (692 linhas) | Fluxo ABERTA -> FINALIZAR, gera lotes/estoque/financeiro |
| Programas Comerciais | OK | programas.js (370 linhas) | Clube, convenio, campanha, motor de descontos v1.0 |
| Dashboard | OK | dashboard.js (271 linhas) | KPIs dia/mes, crescimento, curva ABC, metas |
| Etiquetas | OK | etiquetas.js (316 linhas) | Modelos, config impressora, simulacao preco clube |
| Fiscal (NFC-e) | OK | fiscal.js + 5 services (1752 linhas) | Emissao, cancelamento, carta correcao, provider DevNota |
| SNGPC | OK | sngpc.js (1762 linhas) + services | 3 fases: motor regulatorio, encerramento, XML ANVISA |
| Auditoria | OK | audit.js (388 linhas) | Log completo de acoes |
| Auth/Seguranca | OK | auth.js, tenantResolver.js, audit.js | JWT, RBAC, RLS, cross-tenant block |
| Painel Master | OK | master.js (238 linhas) | Gestao de tenants, usuarios master |
| Landing Page | OK | landing.js (154 linhas) | Registro publico de novas empresas |

### Modulos PARCIAIS (existem mas incompletos)

| Modulo | Status | Problema |
|--------|--------|----------|
| Empresas (config) | PARCIAL | So 2 endpoints, poucos campos editaveis, sem upload logo |
| Financeiro | PARCIAL | Contas a pagar/receber funcionam, mas fluxo de caixa muito basico |
| Usuarios | PARCIAL | CRUD ok, mas falta troca de senha propria |

### Modulos AUSENTES (nao existem)

| Modulo | Impacto para MVP | Descricao |
|--------|------------------|-----------|
| Relatorios exportaveis (PDF/Excel) | CRITICO | Nenhum relatorio pode ser exportado |
| Jobs agendados | CRITICO | Contas nao vencem automaticamente, lotes nao expiram |
| DRE (Demonstrativo de Resultado) | ALTO | Gestor nao tem visao de lucro real |
| Notificacoes (email/WhatsApp) | MEDIO | Sem alertas para estoque critico, contas vencendo |
| Import CSV de produtos | MEDIO | Onboarding de clientes novos e manual produto a produto |
| Import XML NF-e compra | MEDIO | Entrada de compra nao usa XML do fornecedor |
| Devolucao parcial de venda | MEDIO | So cancela venda inteira, nao troca/devolve item |
| PIX QR Code dinamico | BAIXO | PIX e manual no PDV |
| Modo offline PDV | BAIXO | Sistema para se internet cair |
| TEF (maquininha) | BAIXO | Integracao com Stone/Cielo/PagSeguro |

---

## 3. CREDENCIAIS DO SEED (banco local)

O script `scripts/seed.js` cria os seguintes usuarios com senha **123456**:

### Painel Master (Admin SaaS)
| Email | Senha | Role |
|-------|-------|------|
| master@varlensys.com | 123456 | super_admin |

### Mercadinho B&B (slug: `mercadinho-bb`)
| Email | Senha | Perfil |
|-------|-------|--------|
| admin@varlensys.com | 123456 | administrador |
| vendedor@varlensys.com | 123456 | vendedor |
| gerente@varlensys.com | 123456 | gerente |
| financeiro@varlensys.com | 123456 | financeiro |

### Drogaria Roma (slug: `drogaria-roma`)
| Email | Senha | Perfil |
|-------|-------|--------|
| admin@farmacia.com | 123456 | administrador |
| vendedor@farmacia.com | 123456 | vendedor |
| farmaceutico@farmacia.com | 123456 | farmaceutico |

> **IMPORTANTE:** Para o banco na nuvem (Railway), o seed precisa ser executado
> apontando para a DATABASE_URL de producao. Se ainda nao foi executado, esses
> usuarios nao existem la.

---

## 4. ARQUITETURA DE URLS (dois sistemas, mesmo banco)

O sistema ja funciona com dois sistemas separados acessando o mesmo banco:

| URL | Sistema | Quem acessa |
|-----|---------|-------------|
| `/` | Landing Page (site publico) | Visitantes |
| `/app/:slug` | Sistema do cliente (SPA) | Usuarios do tenant |
| `/master` | Painel Administrativo SaaS | Administradores do SaaS |
| `/api/master/*` | API do admin (JWT separado) | Backend do painel master |
| `/api/*` | API do tenant (JWT + X-Tenant-Slug) | Backend do sistema do cliente |

O link do painel master (`/master`) **foi removido da landing page** para que
clientes nao acessem. O acesso ao master se da apenas por URL direta.

---

## 5. O QUE FALTA PARA O MVP MINIMO COMERCIALIZAVEL

### PRIORIDADE 0 - Bloqueantes (sem isso nao vende)

- [ ] **5.1 - Modulo Empresas completo**
  - Editar todos os campos (CNPJ, IE, IM, endereco completo, dados fiscais)
  - Upload de logo
  - Gestao de plano e trial

- [ ] **5.2 - Troca de senha pelo proprio usuario**
  - Endpoint `PUT /api/usuarios/minha-senha`
  - Tela de "minha conta" no frontend

- [ ] **5.3 - Relatorios basicos exportaveis**
  - Vendas por periodo (PDF)
  - Produtos mais vendidos (PDF)
  - Fechamento de caixa (PDF) - essencial para conferencia
  - Contas a pagar/receber pendentes (PDF)

- [ ] **5.4 - Jobs de vencimento automatico**
  - Marcar contas como "vencido" quando data_vencimento < hoje
  - Marcar lotes como "VENCIDO" quando validade < hoje
  - Pode ser um endpoint `/api/jobs/vencimentos` chamado por scheduler

- [ ] **5.5 - Cupom nao-fiscal imprimivel**
  - Gerar PDF do cupom para impressao via navegador
  - O snapshot_cupom ja existe na venda - so precisa do template

### PRIORIDADE 1 - Importantes (cliente espera em 30 dias)

- [ ] **5.6 - DRE basico**
  - Receita bruta - devolucoes = Receita liquida
  - Receita liquida - CMV = Lucro bruto
  - Lucro bruto - despesas = Lucro operacional
  - Dados ja existem (custo_total, lucro_estimado nas vendas)

- [ ] **5.7 - Contas recorrentes automaticas**
  - Quando quitar conta com `recorrente=true`, gerar a proxima
  - Campos ja existem no modelo (recorrente, periodo_recorrencia)

- [ ] **5.8 - Previsao de fluxo de caixa**
  - Projetar saldo futuro baseado em contas pendentes (pagar + receber)
  - Grafico 30/60/90 dias

- [ ] **5.9 - Import CSV de produtos**
  - Endpoint `POST /api/produtos/importar`
  - Planilha padrao com colunas: nome, codigo_barras, preco_custo, preco_venda, etc.
  - Validacao e relatorio de erros

- [ ] **5.10 - Devolucao/troca parcial de venda**
  - Devolver 1 item de uma venda com 5 itens
  - Reverter estoque e gerar credito/estorno

### PRIORIDADE 2 - Diferenciais (cliente fica satisfeito)

- [ ] **5.11 - Import XML NF-e de compra**
  - Ler XML da SEFAZ e auto-preencher itens da compra
  - lib xml2js ja esta no projeto

- [ ] **5.12 - Notificacoes por email**
  - Estoque critico (abaixo do minimo)
  - Conta vencendo amanha
  - Lote vencendo em 30 dias
  - Pode usar Nodemailer + SMTP gratuito

- [ ] **5.13 - Programa de fidelidade com pontos**
  - Pontos por R$ gasto
  - Resgate de pontos como desconto
  - Historico de pontuacao
  - Vencimento de pontos

- [ ] **5.14 - Dashboard do gerente em tempo real**
  - WebSocket para vendas sendo realizadas
  - Atualizar KPIs sem refresh

- [ ] **5.15 - Impressao termica real**
  - Integracao com impressoras termicas (58mm/80mm)
  - Servico local ou extensao do navegador

### PRIORIDADE 3 - Futuro (roadmap pos-lancamento)

- [ ] **5.16 - TEF (integracao maquininha)**
- [ ] **5.17 - PIX QR Code dinamico**
- [ ] **5.18 - Modo offline PDV**
- [ ] **5.19 - Multi-filial**
- [ ] **5.20 - PBM (programas de beneficio medicamento)**
- [ ] **5.21 - Interacao medicamentosa**
- [ ] **5.22 - Conciliacao bancaria**
- [ ] **5.23 - API publica para integracao**
- [ ] **5.24 - App mobile (React Native)**
- [ ] **5.25 - Venda fiado (credito para cliente)**

---

## 6. PONTOS DE ATENCAO DE SEGURANCA

| Item | Status | Risco |
|------|--------|-------|
| JWT com fallback hardcoded | ATENCAO | Se .env nao tiver JWT_SECRET, usa valor padrao |
| SSL rejectUnauthorized: false | ACEITAVEL | Necessario para Railway, certificado auto-assinado |
| Senha minima 8 chars | OK | Em routes/landing.js e routes/auth.js |
| bcrypt 12 rounds | OK | Boa pratica |
| CORS restritivo | OK | Wildcard bloqueado em producao |
| Rate limiting | OK | 1000 req/15min global, 20 login/15min, 5 registro/hora |
| RLS PostgreSQL | OK | Row-Level Security por empresa_id |
| IDOR protection | OK | Validacao de FK cross-tenant em todas as rotas |
| CSP Report-Only | OK | Monitoramento de violacoes |
| Helmet | OK | Headers de seguranca completos |

---

## 7. RESUMO EXECUTIVO

### O que esta PRONTO:
- 17 modulos operacionais com ~20.000 linhas de codigo
- Multi-tenant completo com isolamento por JWT + RLS
- PDV com motor de descontos, multi-pagamento, FIFO de lotes
- SNGPC completo (3 fases) para farmacias
- NFC-e com provider DevNota integrado
- Seguranca robusta (Helmet, CORS, Rate Limit, bcrypt, RLS)

### O que FALTA para vender:
1. Relatorios exportaveis (PDF pelo menos)
2. Jobs automaticos de vencimento
3. Modulo de configuracao da empresa completo
4. Cupom imprimivel
5. Troca de senha pelo usuario

### Esforco estimado para MVP:
- **P0 (bloqueantes):** 5 itens - desenvolvimento de 2-3 semanas
- **P1 (importantes):** 5 itens - desenvolvimento de 3-4 semanas
- **Total para MVP comercializavel:** 5-7 semanas de trabalho focado

---

## 8. ALTERACOES JA REALIZADAS

### Landing Page (landing.html)
- [x] Removido botao "Painel Admin" da navbar (master so por URL direta)
- [x] Removido icone de foguete de todos os botoes
- [x] "Comecar Gratis" substituido por "Cadastrar-se"
- [x] Adicionado botao "Fazer Login" na navbar e no hero
- [x] Adicionado modal de login com campo de slug + email + senha
- [x] CTA section atualizada com dois botoes (cadastrar + login)
- [x] Links cruzados entre modais (login -> cadastro e vice-versa)
- [x] Modal de registro atualizado com link "Ja tem conta? Fazer Login"
