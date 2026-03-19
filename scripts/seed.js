/**
 * Script de seed v3.0 - SaaS Multi-Tenant
 * Cria: UsuarioMaster + 2 clientes fictícios
 *   - Mercadinho B&B (mercado)
 *   - Drogaria Romã (drogaria)
 * Executar: npm run db:seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { 
  sequelize, Empresa, Usuario, UsuarioMaster, Categoria, Produto, Fornecedor, 
  Cliente, CentroCusto, ContaBancaria, ProdutoSugestao, Combo, ComboItem, Meta 
} = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');

    await sequelize.sync({ force: true });
    console.log('✅ Tabelas recriadas');

    const senhaHash = await bcrypt.hash('123456', 12);

    // ═══════════════════════════════════════════
    //  USUÁRIO MASTER (Admin do SaaS)
    // ═══════════════════════════════════════════
    await UsuarioMaster.create({
      nome: 'Super Admin',
      email: 'master@sgc.com',
      senha: senhaHash,
      role: 'super_admin',
      ativo: true
    });
    console.log('✅ Usuário Master criado (master@sgc.com / 123456)');

    // ═══════════════════════════════════════════
    //  EMPRESA 1: MERCADINHO B&B
    // ═══════════════════════════════════════════
    const mercado = await Empresa.create({
      nome: 'Mercadinho B&B Ltda',
      nome_fantasia: 'Mercadinho B&B',
      cnpj: '12.345.678/0001-99',
      tipo_negocio: 'mercado',
      regime_tributario: 'simples_nacional',
      endereco: 'Rua das Flores, 123',
      numero: '123',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01001-000',
      telefone: '(11) 99999-9999',
      email: 'contato@mercadinhobb.com',
      subdominio: 'mercadinho-bb',
      status: 'ativo',
      plano: 'profissional',
      cor_primaria: '#2563eb',
      cor_secundaria: '#10b981',
      origem_cadastro: 'manual'
    });

    // Usuários do mercado
    await Usuario.create({ empresa_id: mercado.id, nome: 'Admin B&B', email: 'admin@sgc.com', senha: senhaHash, perfil: 'administrador' });
    await Usuario.create({ empresa_id: mercado.id, nome: 'Maria Vendedora', email: 'vendedor@sgc.com', senha: senhaHash, perfil: 'vendedor' });
    await Usuario.create({ empresa_id: mercado.id, nome: 'João Gerente', email: 'gerente@sgc.com', senha: senhaHash, perfil: 'gerente' });
    await Usuario.create({ empresa_id: mercado.id, nome: 'Ana Financeiro', email: 'financeiro@sgc.com', senha: senhaHash, perfil: 'financeiro' });
    console.log('✅ Mercadinho B&B + 4 usuários criados');

    // Categorias mercado
    const catMerc = await Promise.all([
      Categoria.create({ empresa_id: mercado.id, nome: 'Bebidas', cor: '#3B82F6', icone: 'cup-soda', ordem: 1 }),
      Categoria.create({ empresa_id: mercado.id, nome: 'Alimentos', cor: '#10B981', icone: 'utensils', ordem: 2 }),
      Categoria.create({ empresa_id: mercado.id, nome: 'Limpeza', cor: '#8B5CF6', icone: 'spray-can', ordem: 3 }),
      Categoria.create({ empresa_id: mercado.id, nome: 'Higiene', cor: '#F59E0B', icone: 'heart', ordem: 4 }),
      Categoria.create({ empresa_id: mercado.id, nome: 'Padaria', cor: '#EF4444', icone: 'croissant', ordem: 5 }),
    ]);

    // Fornecedores mercado
    const fornMerc = await Promise.all([
      Fornecedor.create({ empresa_id: mercado.id, nome: 'Distribuidora ABC', cnpj_cpf: '11.222.333/0001-44', telefone: '(11) 3333-4444', contato: 'Carlos', ranking: 5, prazo_medio_entrega: 3 }),
      Fornecedor.create({ empresa_id: mercado.id, nome: 'Atacado Central', cnpj_cpf: '55.666.777/0001-88', telefone: '(11) 5555-6666', contato: 'Roberto', ranking: 4, prazo_medio_entrega: 5 }),
      Fornecedor.create({ empresa_id: mercado.id, nome: 'Padaria Master', cnpj_cpf: '99.000.111/0001-22', telefone: '(11) 7777-8888', contato: 'Dona Maria', ranking: 4, prazo_medio_entrega: 1 }),
    ]);

    // Clientes mercado
    await Promise.all([
      Cliente.create({ empresa_id: mercado.id, nome: 'José da Silva', cpf: '111.222.333-44', telefone: '(11) 91111-2222' }),
      Cliente.create({ empresa_id: mercado.id, nome: 'Ana Oliveira', cpf: '555.666.777-88', telefone: '(11) 93333-4444', email: 'ana@email.com' }),
      Cliente.create({ empresa_id: mercado.id, nome: 'Pedro Santos', cpf: '999.000.111-22', telefone: '(11) 95555-6666' }),
    ]);

    // Centros de custo
    await Promise.all([
      CentroCusto.create({ empresa_id: mercado.id, nome: 'Operacional', descricao: 'Custos operacionais', tipo: 'despesa' }),
      CentroCusto.create({ empresa_id: mercado.id, nome: 'Vendas', descricao: 'Receitas de vendas', tipo: 'receita' }),
      CentroCusto.create({ empresa_id: mercado.id, nome: 'Administrativo', descricao: 'Custos administrativos', tipo: 'despesa' }),
    ]);

    // Conta bancária
    await ContaBancaria.create({ empresa_id: mercado.id, nome: 'Conta Principal', banco: 'Nubank', tipo: 'corrente', principal: true });

    // Produtos mercado
    const produtosMerc = [
      { nome: 'Coca-Cola 2L', codigo_barras: '7894900010015', preco_custo: 5.50, preco_venda: 8.99, estoque_atual: 50, estoque_minimo: 10, estoque_maximo: 100, categoria_id: catMerc[0].id, fornecedor_id: fornMerc[0].id, curva_abc: 'A', ncm: '22021000' },
      { nome: 'Água Mineral 500ml', codigo_barras: '7896064200116', preco_custo: 0.80, preco_venda: 2.50, estoque_atual: 100, estoque_minimo: 20, estoque_maximo: 200, categoria_id: catMerc[0].id, fornecedor_id: fornMerc[0].id, curva_abc: 'A', ncm: '22011000' },
      { nome: 'Cerveja Brahma Lata', codigo_barras: '7891149101009', preco_custo: 2.20, preco_venda: 3.99, estoque_atual: 80, estoque_minimo: 15, estoque_maximo: 150, categoria_id: catMerc[0].id, fornecedor_id: fornMerc[0].id, curva_abc: 'A', ncm: '22030000' },
      { nome: 'Suco Del Valle 1L', codigo_barras: '7894900530018', preco_custo: 3.50, preco_venda: 6.49, estoque_atual: 30, estoque_minimo: 8, estoque_maximo: 60, categoria_id: catMerc[0].id, fornecedor_id: fornMerc[0].id, curva_abc: 'B' },
      { nome: 'Arroz 5kg Tio João', codigo_barras: '7893500018452', preco_custo: 18.00, preco_venda: 27.90, estoque_atual: 25, estoque_minimo: 5, estoque_maximo: 50, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[1].id, curva_abc: 'A', ncm: '10063021' },
      { nome: 'Feijão 1kg Camil', codigo_barras: '7896006712954', preco_custo: 5.00, preco_venda: 8.49, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 80, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[1].id, curva_abc: 'A', ncm: '07133319' },
      { nome: 'Macarrão Espaguete 500g', codigo_barras: '7891079008102', preco_custo: 2.80, preco_venda: 4.99, estoque_atual: 60, estoque_minimo: 15, estoque_maximo: 100, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Óleo de Soja 900ml', codigo_barras: '7891107100204', preco_custo: 4.50, preco_venda: 7.89, estoque_atual: 35, estoque_minimo: 8, estoque_maximo: 60, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Açúcar 1kg', codigo_barras: '7896110198286', preco_custo: 3.50, preco_venda: 5.99, estoque_atual: 45, estoque_minimo: 10, estoque_maximo: 80, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Leite Integral 1L', codigo_barras: '7891515901011', preco_custo: 4.00, preco_venda: 6.49, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 80, categoria_id: catMerc[1].id, fornecedor_id: fornMerc[0].id, curva_abc: 'A' },
      { nome: 'Detergente Ypê 500ml', codigo_barras: '7896098900017', preco_custo: 1.50, preco_venda: 2.99, estoque_atual: 70, estoque_minimo: 15, estoque_maximo: 120, categoria_id: catMerc[2].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Desinfetante Pinho Sol 500ml', codigo_barras: '7891024131107', preco_custo: 3.00, preco_venda: 5.49, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 60, categoria_id: catMerc[2].id, fornecedor_id: fornMerc[1].id, curva_abc: 'C' },
      { nome: 'Sabão em Pó Omo 1kg', codigo_barras: '7891150026698', preco_custo: 10.00, preco_venda: 16.99, estoque_atual: 25, estoque_minimo: 5, estoque_maximo: 40, categoria_id: catMerc[2].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Papel Higiênico (12 rolos)', codigo_barras: '7891172422102', preco_custo: 12.00, preco_venda: 19.90, estoque_atual: 30, estoque_minimo: 5, estoque_maximo: 50, categoria_id: catMerc[3].id, fornecedor_id: fornMerc[1].id, curva_abc: 'B' },
      { nome: 'Sabonete Dove', codigo_barras: '7891150029446', preco_custo: 2.50, preco_venda: 4.99, estoque_atual: 50, estoque_minimo: 10, estoque_maximo: 80, categoria_id: catMerc[3].id, fornecedor_id: fornMerc[1].id, curva_abc: 'C' },
      { nome: 'Creme Dental Colgate 90g', codigo_barras: '7891024132005', preco_custo: 3.00, preco_venda: 5.49, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 60, categoria_id: catMerc[3].id, fornecedor_id: fornMerc[1].id, curva_abc: 'C' },
      { nome: 'Pão Francês (kg)', codigo_barras: '', preco_custo: 8.00, preco_venda: 14.99, estoque_atual: 20, estoque_minimo: 5, estoque_maximo: 40, categoria_id: catMerc[4].id, fornecedor_id: fornMerc[2].id, unidade: 'KG', permite_fracionamento: true, curva_abc: 'A' },
      { nome: 'Bolo de Chocolate (fatia)', codigo_barras: '', preco_custo: 4.00, preco_venda: 7.99, estoque_atual: 15, estoque_minimo: 3, estoque_maximo: 25, categoria_id: catMerc[4].id, fornecedor_id: fornMerc[2].id, curva_abc: 'C' },
    ];

    for (const p of produtosMerc) {
      const custo = parseFloat(p.preco_custo);
      const venda = parseFloat(p.preco_venda);
      p.empresa_id = mercado.id;
      p.margem = custo > 0 ? (((venda - custo) / custo) * 100).toFixed(2) : 0;
      await Produto.create(p);
    }
    console.log(`✅ ${produtosMerc.length} produtos mercado criados`);

    // Meta mercado
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
    await Meta.create({
      empresa_id: mercado.id,
      tipo: 'faturamento',
      periodo: 'mensal',
      valor_meta: 50000,
      data_inicio: inicioMes.toISOString().split('T')[0],
      data_fim: fimMes.toISOString().split('T')[0]
    });

    // ═══════════════════════════════════════════
    //  EMPRESA 2: DROGARIA ROMÃ
    // ═══════════════════════════════════════════
    const drogaria = await Empresa.create({
      nome: 'Drogaria Romã Ltda',
      nome_fantasia: 'Drogaria Romã',
      cnpj: '98.765.432/0001-10',
      tipo_negocio: 'drogaria',
      regime_tributario: 'simples_nacional',
      endereco: 'Av. Brasil, 456',
      numero: '456',
      bairro: 'Saúde',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '04101-000',
      telefone: '(11) 88888-7777',
      email: 'contato@drogariaroma.com',
      responsavel_tecnico: 'Dr. Felipe Souza',
      crf_responsavel: 'CRF-SP 12345',
      subdominio: 'drogaria-roma',
      status: 'ativo',
      plano: 'empresarial',
      cor_primaria: '#059669',
      cor_secundaria: '#0ea5e9',
      origem_cadastro: 'manual'
    });

    // Usuários farmácia
    const farmaceutico = await Usuario.create({ empresa_id: drogaria.id, nome: 'Admin Romã', email: 'admin@farmacia.com', senha: senhaHash, perfil: 'administrador' });
    await Usuario.create({ empresa_id: drogaria.id, nome: 'Vendedor Farmácia', email: 'vendedor@farmacia.com', senha: senhaHash, perfil: 'vendedor' });
    const farmUser = await Usuario.create({ empresa_id: drogaria.id, nome: 'Dr. Felipe Souza', email: 'farmaceutico@farmacia.com', senha: senhaHash, perfil: 'farmaceutico' });
    console.log('✅ Drogaria Romã + 3 usuários criados');

    // Categorias farmácia
    const catFarm = await Promise.all([
      Categoria.create({ empresa_id: drogaria.id, nome: 'Medicamentos', cor: '#EF4444', icone: 'pill', ordem: 1 }),
      Categoria.create({ empresa_id: drogaria.id, nome: 'Genéricos', cor: '#3B82F6', icone: 'pill', ordem: 2 }),
      Categoria.create({ empresa_id: drogaria.id, nome: 'Dermocosméticos', cor: '#EC4899', icone: 'sparkles', ordem: 3 }),
      Categoria.create({ empresa_id: drogaria.id, nome: 'Higiene Pessoal', cor: '#F59E0B', icone: 'heart', ordem: 4 }),
      Categoria.create({ empresa_id: drogaria.id, nome: 'Vitaminas e Suplementos', cor: '#10B981', icone: 'leaf', ordem: 5 }),
      Categoria.create({ empresa_id: drogaria.id, nome: 'Controlados', cor: '#DC2626', icone: 'shield-alert', ordem: 6 }),
    ]);

    // Fornecedores farmácia
    const fornFarm = await Promise.all([
      Fornecedor.create({ empresa_id: drogaria.id, nome: 'Distribuidora Pharma SP', cnpj_cpf: '22.333.444/0001-55', telefone: '(11) 2222-3333', contato: 'Marcos', ranking: 5, prazo_medio_entrega: 2 }),
      Fornecedor.create({ empresa_id: drogaria.id, nome: 'Medley Farmacêutica', cnpj_cpf: '33.444.555/0001-66', telefone: '(11) 4444-5555', contato: 'Patrícia', ranking: 4, prazo_medio_entrega: 4 }),
      Fornecedor.create({ empresa_id: drogaria.id, nome: 'EMS Genéricos', cnpj_cpf: '44.555.666/0001-77', telefone: '(11) 6666-7777', contato: 'Ricardo', ranking: 5, prazo_medio_entrega: 3 }),
    ]);

    // Clientes farmácia
    await Promise.all([
      Cliente.create({ empresa_id: drogaria.id, nome: 'Maria Aparecida', cpf: '222.333.444-55', telefone: '(11) 92222-3333', data_nascimento: '1960-05-15' }),
      Cliente.create({ empresa_id: drogaria.id, nome: 'Carlos Alberto', cpf: '666.777.888-99', telefone: '(11) 94444-5555', data_nascimento: '1975-11-20' }),
    ]);

    // Centros de custo farmácia
    await Promise.all([
      CentroCusto.create({ empresa_id: drogaria.id, nome: 'Operacional', tipo: 'despesa' }),
      CentroCusto.create({ empresa_id: drogaria.id, nome: 'Vendas', tipo: 'receita' }),
    ]);

    await ContaBancaria.create({ empresa_id: drogaria.id, nome: 'Conta Farmácia', banco: 'Bradesco', tipo: 'corrente', principal: true });

    // Produtos farmácia (com campos específicos)
    const produtosFarm = [
      // Medicamentos referência
      { nome: 'Dorflex 36 comprimidos', codigo_barras: '7896004800011', preco_custo: 8.00, preco_venda: 15.99, estoque_atual: 50, estoque_minimo: 15, estoque_maximo: 80, categoria_id: catFarm[0].id, fornecedor_id: fornFarm[0].id, tipo_medicamento: 'referencia', principio_ativo: 'Dipirona + Citrato de Orfenadrina + Cafeína', laboratorio: 'Sanofi', registro_anvisa: '1.0573.0300', tipo_receita: 'sem_receita', lote: 'DRF24001', validade: '2025-12-31', curva_abc: 'A' },
      { nome: 'Aspirina 500mg 20cp', codigo_barras: '7891106001472', preco_custo: 5.00, preco_venda: 12.49, estoque_atual: 60, estoque_minimo: 20, estoque_maximo: 100, categoria_id: catFarm[0].id, fornecedor_id: fornFarm[0].id, tipo_medicamento: 'referencia', principio_ativo: 'Ácido Acetilsalicílico', laboratorio: 'Bayer', registro_anvisa: '1.0429.0003', tipo_receita: 'sem_receita', lote: 'ASP24002', validade: '2026-06-30', curva_abc: 'A' },
      { nome: 'Buscopan Composto 20cp', codigo_barras: '7891106005241', preco_custo: 10.00, preco_venda: 22.90, estoque_atual: 35, estoque_minimo: 10, estoque_maximo: 50, categoria_id: catFarm[0].id, fornecedor_id: fornFarm[0].id, tipo_medicamento: 'referencia', principio_ativo: 'Escopolamina + Dipirona', laboratorio: 'Boehringer', registro_anvisa: '1.0367.0027', tipo_receita: 'sem_receita', lote: 'BUS24003', validade: '2025-09-30', curva_abc: 'A' },
      { nome: 'Nexium 40mg 28cp', codigo_barras: '7896015536619', preco_custo: 45.00, preco_venda: 89.90, estoque_atual: 15, estoque_minimo: 5, estoque_maximo: 30, categoria_id: catFarm[0].id, fornecedor_id: fornFarm[1].id, tipo_medicamento: 'referencia', principio_ativo: 'Esomeprazol', laboratorio: 'AstraZeneca', registro_anvisa: '1.1618.0057', tipo_receita: 'receita_simples', lote: 'NEX24004', validade: '2026-03-31', curva_abc: 'B' },

      // Genéricos
      { nome: 'Dipirona Sódica 500mg 30cp (Gen)', codigo_barras: '7896714211015', preco_custo: 2.50, preco_venda: 6.99, estoque_atual: 100, estoque_minimo: 30, estoque_maximo: 200, categoria_id: catFarm[1].id, fornecedor_id: fornFarm[2].id, tipo_medicamento: 'generico', principio_ativo: 'Dipirona Sódica', laboratorio: 'EMS', registro_anvisa: '1.0235.0587', tipo_receita: 'sem_receita', lote: 'DIP24005', validade: '2026-01-31', curva_abc: 'A' },
      { nome: 'Amoxicilina 500mg 21cp (Gen)', codigo_barras: '7896714221014', preco_custo: 8.00, preco_venda: 18.90, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 60, categoria_id: catFarm[1].id, fornecedor_id: fornFarm[2].id, tipo_medicamento: 'generico', principio_ativo: 'Amoxicilina', laboratorio: 'EMS', registro_anvisa: '1.0235.0102', tipo_receita: 'receita_simples', lote: 'AMX24006', validade: '2025-08-31', curva_abc: 'B' },
      { nome: 'Losartana 50mg 30cp (Gen)', codigo_barras: '7896714231013', preco_custo: 5.00, preco_venda: 14.90, estoque_atual: 55, estoque_minimo: 15, estoque_maximo: 80, categoria_id: catFarm[1].id, fornecedor_id: fornFarm[2].id, tipo_medicamento: 'generico', principio_ativo: 'Losartana Potássica', laboratorio: 'EMS', registro_anvisa: '1.0235.0415', tipo_receita: 'receita_simples', lote: 'LOS24007', validade: '2026-05-31', curva_abc: 'A' },
      { nome: 'Omeprazol 20mg 28cp (Gen)', codigo_barras: '7896714241012', preco_custo: 4.00, preco_venda: 12.49, estoque_atual: 70, estoque_minimo: 20, estoque_maximo: 100, categoria_id: catFarm[1].id, fornecedor_id: fornFarm[2].id, tipo_medicamento: 'generico', principio_ativo: 'Omeprazol', laboratorio: 'Medley', registro_anvisa: '1.0181.0023', tipo_receita: 'receita_simples', lote: 'OMP24008', validade: '2026-04-30', curva_abc: 'A' },

      // Controlados
      { nome: 'Rivotril 2mg 30cp', codigo_barras: '7896226500011', preco_custo: 12.00, preco_venda: 25.90, estoque_atual: 20, estoque_minimo: 5, estoque_maximo: 30, categoria_id: catFarm[5].id, fornecedor_id: fornFarm[0].id, tipo_medicamento: 'referencia', principio_ativo: 'Clonazepam', laboratorio: 'Roche', registro_anvisa: '1.0100.0008', tipo_receita: 'receita_controle_especial', controlado: true, lote: 'RIV24009', validade: '2026-02-28', curva_abc: 'B' },
      { nome: 'Ritalina 10mg 30cp', codigo_barras: '7896226510010', preco_custo: 15.00, preco_venda: 34.90, estoque_atual: 15, estoque_minimo: 3, estoque_maximo: 20, categoria_id: catFarm[5].id, fornecedor_id: fornFarm[0].id, tipo_medicamento: 'referencia', principio_ativo: 'Metilfenidato', laboratorio: 'Novartis', registro_anvisa: '1.0068.0027', tipo_receita: 'receita_controle_especial', controlado: true, lote: 'RIT24010', validade: '2025-11-30', curva_abc: 'C' },

      // Dermocosméticos
      { nome: 'Protetor Solar FPS 50', codigo_barras: '7891010245017', preco_custo: 25.00, preco_venda: 49.90, estoque_atual: 25, estoque_minimo: 8, estoque_maximo: 40, categoria_id: catFarm[2].id, fornecedor_id: fornFarm[1].id, curva_abc: 'B' },
      { nome: 'Hidratante Corporal 400ml', codigo_barras: '7891010255016', preco_custo: 15.00, preco_venda: 32.90, estoque_atual: 20, estoque_minimo: 5, estoque_maximo: 30, categoria_id: catFarm[2].id, fornecedor_id: fornFarm[1].id, curva_abc: 'C' },

      // Vitaminas
      { nome: 'Vitamina C 1g 30cp Efervescentes', codigo_barras: '7896658502019', preco_custo: 8.00, preco_venda: 19.90, estoque_atual: 45, estoque_minimo: 10, estoque_maximo: 60, categoria_id: catFarm[4].id, fornecedor_id: fornFarm[1].id, principio_ativo: 'Ácido Ascórbico', tipo_receita: 'sem_receita', curva_abc: 'A' },
      { nome: 'Vitamina D 2000UI 60cp', codigo_barras: '7896658512018', preco_custo: 12.00, preco_venda: 29.90, estoque_atual: 30, estoque_minimo: 8, estoque_maximo: 50, categoria_id: catFarm[4].id, fornecedor_id: fornFarm[1].id, principio_ativo: 'Colecalciferol', tipo_receita: 'sem_receita', curva_abc: 'B' },

      // Higiene
      { nome: 'Álcool Gel 500ml', codigo_barras: '7891010265015', preco_custo: 5.00, preco_venda: 12.90, estoque_atual: 40, estoque_minimo: 10, estoque_maximo: 60, categoria_id: catFarm[3].id, fornecedor_id: fornFarm[1].id, curva_abc: 'B' },
    ];

    const produtosCriados = [];
    for (const p of produtosFarm) {
      const custo = parseFloat(p.preco_custo);
      const venda = parseFloat(p.preco_venda);
      p.empresa_id = drogaria.id;
      p.margem = custo > 0 ? (((venda - custo) / custo) * 100).toFixed(2) : 0;
      const criado = await Produto.create(p);
      produtosCriados.push(criado);
    }
    console.log(`✅ ${produtosFarm.length} produtos farmácia criados`);

    // Sugestões inteligentes (PDV farmácia)
    // Dorflex → sugere Omeprazol (protetor gástrico)
    await ProdutoSugestao.create({ empresa_id: drogaria.id, produto_id: produtosCriados[0].id, produto_sugerido_id: produtosCriados[7].id, tipo: 'complementar', mensagem: '💊 Protetor gástrico recomendado com anti-inflamatório', prioridade: 5 });
    // Aspirina → sugere Omeprazol
    await ProdutoSugestao.create({ empresa_id: drogaria.id, produto_id: produtosCriados[1].id, produto_sugerido_id: produtosCriados[7].id, tipo: 'complementar', mensagem: '💊 Protetor gástrico recomendado', prioridade: 5 });
    // Amoxicilina → sugere Vitamina C
    await ProdutoSugestao.create({ empresa_id: drogaria.id, produto_id: produtosCriados[5].id, produto_sugerido_id: produtosCriados[12].id, tipo: 'complementar', mensagem: '🍊 Vitamina C para reforçar imunidade', prioridade: 3 });
    // Nexium → sugere genérico Omeprazol como alternativa
    await ProdutoSugestao.create({ empresa_id: drogaria.id, produto_id: produtosCriados[3].id, produto_sugerido_id: produtosCriados[7].id, tipo: 'alternativa', mensagem: '💰 Versão genérica disponível com desconto', prioridade: 4 });
    console.log('✅ Sugestões inteligentes criadas');

    // Combo farmácia: Kit Imunidade
    const combo = await Combo.create({
      empresa_id: drogaria.id,
      nome: 'Kit Imunidade',
      descricao: 'Vitamina C + Vitamina D com desconto',
      preco: 39.90,
      preco_original: 49.80,
      economia: 9.90
    });
    await ComboItem.create({ combo_id: combo.id, produto_id: produtosCriados[12].id, quantidade: 1 }); // Vit C
    await ComboItem.create({ combo_id: combo.id, produto_id: produtosCriados[13].id, quantidade: 1 }); // Vit D
    console.log('✅ Combo "Kit Imunidade" criado');

    // Meta farmácia
    await Meta.create({
      empresa_id: drogaria.id,
      tipo: 'faturamento',
      periodo: 'mensal',
      valor_meta: 80000,
      data_inicio: inicioMes.toISOString().split('T')[0],
      data_fim: fimMes.toISOString().split('T')[0]
    });

    console.log('\n🎉 Seed v3.0 SaaS concluído!');
    console.log('══════════════════════════════════════');
    console.log('MASTER (Painel Admin):');
    console.log('  URL:   /master');
    console.log('  Login: master@sgc.com');
    console.log('  Senha: 123456');
    console.log('');
    console.log('MERCADINHO B&B:');
    console.log('  URL:   /app/mercadinho-bb');
    console.log('  Login: admin@sgc.com');
    console.log('  Senha: 123456');
    console.log('');
    console.log('DROGARIA ROMÃ:');
    console.log('  URL:   /app/drogaria-roma');
    console.log('  Login: admin@farmacia.com');
    console.log('  Senha: 123456');
    console.log('══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();
