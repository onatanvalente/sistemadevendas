/**
 * Script de seed - Cria dados iniciais para teste
 * Executar: npm run db:seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Empresa, Usuario, Categoria, Produto } = require('../models');

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');

    await sequelize.sync({ force: true });
    console.log('✅ Tabelas recriadas');

    // Empresa demo
    const empresa = await Empresa.create({
      nome: 'Mercado Exemplo',
      cnpj: '12.345.678/0001-99',
      tipo_negocio: 'mercado',
      regime_tributario: 'simples_nacional',
      telefone: '(11) 99999-9999',
      email: 'contato@mercadoexemplo.com',
      cidade: 'São Paulo',
      estado: 'SP'
    });
    console.log('✅ Empresa criada');

    // Admin
    const senhaHash = await bcrypt.hash('123456', 12);
    await Usuario.create({
      empresa_id: empresa.id,
      nome: 'Administrador',
      email: 'admin@sgc.com',
      senha: senhaHash,
      perfil: 'administrador'
    });

    // Vendedor
    await Usuario.create({
      empresa_id: empresa.id,
      nome: 'Maria Vendedora',
      email: 'vendedor@sgc.com',
      senha: senhaHash,
      perfil: 'vendedor'
    });
    console.log('✅ Usuários criados (admin@sgc.com / 123456)');

    // Categorias
    const categorias = await Promise.all([
      Categoria.create({ empresa_id: empresa.id, nome: 'Bebidas' }),
      Categoria.create({ empresa_id: empresa.id, nome: 'Alimentos' }),
      Categoria.create({ empresa_id: empresa.id, nome: 'Limpeza' }),
      Categoria.create({ empresa_id: empresa.id, nome: 'Higiene' }),
      Categoria.create({ empresa_id: empresa.id, nome: 'Padaria' }),
    ]);
    console.log('✅ Categorias criadas');

    // Produtos
    const produtos = [
      { nome: 'Coca-Cola 2L', codigo_barras: '7894900010015', preco_custo: 5.50, preco_venda: 8.99, estoque_atual: 50, estoque_minimo: 10, categoria_id: categorias[0].id },
      { nome: 'Água Mineral 500ml', codigo_barras: '7896064200116', preco_custo: 0.80, preco_venda: 2.50, estoque_atual: 100, estoque_minimo: 20, categoria_id: categorias[0].id },
      { nome: 'Cerveja Brahma Lata', codigo_barras: '7891149101009', preco_custo: 2.20, preco_venda: 3.99, estoque_atual: 80, estoque_minimo: 15, categoria_id: categorias[0].id },
      { nome: 'Suco Del Valle 1L', codigo_barras: '7894900530018', preco_custo: 3.50, preco_venda: 6.49, estoque_atual: 30, estoque_minimo: 8, categoria_id: categorias[0].id },
      { nome: 'Arroz 5kg Tio João', codigo_barras: '7893500018452', preco_custo: 18.00, preco_venda: 27.90, estoque_atual: 25, estoque_minimo: 5, categoria_id: categorias[1].id },
      { nome: 'Feijão 1kg Camil', codigo_barras: '7896006712954', preco_custo: 5.00, preco_venda: 8.49, estoque_atual: 40, estoque_minimo: 10, categoria_id: categorias[1].id },
      { nome: 'Macarrão Espaguete 500g', codigo_barras: '7891079008102', preco_custo: 2.80, preco_venda: 4.99, estoque_atual: 60, estoque_minimo: 15, categoria_id: categorias[1].id },
      { nome: 'Óleo de Soja 900ml', codigo_barras: '7891107100204', preco_custo: 4.50, preco_venda: 7.89, estoque_atual: 35, estoque_minimo: 8, categoria_id: categorias[1].id },
      { nome: 'Açúcar 1kg', codigo_barras: '7896110198286', preco_custo: 3.50, preco_venda: 5.99, estoque_atual: 45, estoque_minimo: 10, categoria_id: categorias[1].id },
      { nome: 'Leite Integral 1L', codigo_barras: '7891515901011', preco_custo: 4.00, preco_venda: 6.49, estoque_atual: 40, estoque_minimo: 10, categoria_id: categorias[1].id },
      { nome: 'Detergente Ypê 500ml', codigo_barras: '7896098900017', preco_custo: 1.50, preco_venda: 2.99, estoque_atual: 70, estoque_minimo: 15, categoria_id: categorias[2].id },
      { nome: 'Desinfetante Pinho Sol 500ml', codigo_barras: '7891024131107', preco_custo: 3.00, preco_venda: 5.49, estoque_atual: 40, estoque_minimo: 10, categoria_id: categorias[2].id },
      { nome: 'Sabão em Pó Omo 1kg', codigo_barras: '7891150026698', preco_custo: 10.00, preco_venda: 16.99, estoque_atual: 25, estoque_minimo: 5, categoria_id: categorias[2].id },
      { nome: 'Papel Higiênico (12 rolos)', codigo_barras: '7891172422102', preco_custo: 12.00, preco_venda: 19.90, estoque_atual: 30, estoque_minimo: 5, categoria_id: categorias[3].id },
      { nome: 'Sabonete Dove', codigo_barras: '7891150029446', preco_custo: 2.50, preco_venda: 4.99, estoque_atual: 50, estoque_minimo: 10, categoria_id: categorias[3].id },
      { nome: 'Creme Dental Colgate 90g', codigo_barras: '7891024132005', preco_custo: 3.00, preco_venda: 5.49, estoque_atual: 40, estoque_minimo: 10, categoria_id: categorias[3].id },
      { nome: 'Pão Francês (kg)', codigo_barras: '', preco_custo: 8.00, preco_venda: 14.99, estoque_atual: 20, estoque_minimo: 5, categoria_id: categorias[4].id, unidade: 'KG' },
      { nome: 'Bolo de Chocolate (fatia)', codigo_barras: '', preco_custo: 4.00, preco_venda: 7.99, estoque_atual: 15, estoque_minimo: 3, categoria_id: categorias[4].id },
    ];

    for (const p of produtos) {
      const custo = parseFloat(p.preco_custo);
      const venda = parseFloat(p.preco_venda);
      p.empresa_id = empresa.id;
      p.margem = custo > 0 ? (((venda - custo) / custo) * 100).toFixed(2) : 0;
      await Produto.create(p);
    }
    console.log(`✅ ${produtos.length} produtos criados`);

    console.log('\n🎉 Seed concluído!');
    console.log('──────────────────────────');
    console.log('Login: admin@sgc.com');
    console.log('Senha: 123456');
    console.log('──────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();
