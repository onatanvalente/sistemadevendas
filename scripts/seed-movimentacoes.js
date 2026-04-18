/**
 * ══════════════════════════════════════════════════════════════
 *  SEED DE MOVIMENTAÇÕES — Drogaria Romã
 *  Simula operações realistas de 01/Jan/2026 a 18/Fev/2026
 *
 *  Executar APÓS seed.js:
 *    node scripts/seed.js
 *    node scripts/seed-movimentacoes.js
 * ══════════════════════════════════════════════════════════════
 */
require('dotenv').config();
const {
  sequelize, Empresa, Usuario, Produto, Cliente, Categoria,
  Fornecedor, Caixa, CaixaMovimentacao, Venda, VendaItem,
  EstoqueMovimentacao, ContaPagar, ContaReceber, Lote,
  Compra, CompraItem, CompraParcela, MedicamentoControlado,
  AuditLog
} = require('../models');

// Desabilitar logging do Sequelize para performance
sequelize.options.logging = false;

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDec(min, max, dec = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(dec)); }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function dateStr(d) { return d.toISOString().split('T')[0]; }
function addHours(d, h, m) {
  const r = new Date(d);
  r.setHours(h, m, rand(0, 59), 0);
  return r;
}

// Nomes de pacientes e dados fictícios
const NOMES_PACIENTES = [
  'Ana Paula Rodrigues', 'Carlos Eduardo Mendes', 'Fernanda Costa Lima',
  'João Marcos Pereira', 'Luciana Aparecida Santos', 'Roberto Alves Neto',
  'Mariana Ferreira Souza', 'Paulo Henrique Oliveira', 'Beatriz Gomes Martins',
  'Thiago Ribeiro da Silva', 'Camila Duarte Araujo', 'Diego Nascimento Ramos',
  'Patrícia Almeida Lopes', 'Rafael Sousa Costa', 'Juliana Prado Vieira',
  'Marcos Antônio da Cruz', 'Isabela Monteiro Dias', 'André Luiz Barbosa',
  'Sandra Regina Moraes', 'Felipe Carvalho Andrade', 'Renata Teixeira Nunes',
  'Gustavo Henrique Melo', 'Aline Batista Machado', 'Eduardo Fonseca Pinto'
];

const NOMES_MEDICOS = [
  { nome: 'Dr. Ricardo Almeida', crm: '12345', uf: 'SP' },
  { nome: 'Dra. Claudia Ferreira', crm: '23456', uf: 'SP' },
  { nome: 'Dr. Marcos Oliveira', crm: '34567', uf: 'SP' },
  { nome: 'Dra. Ana Beatriz Costa', crm: '45678', uf: 'SP' },
  { nome: 'Dr. Henrique Santos', crm: '56789', uf: 'SP' },
  { nome: 'Dra. Maria Luiza Souza', crm: '67890', uf: 'SP' },
  { nome: 'Dr. Fernando Lima', crm: '78901', uf: 'RJ' },
  { nome: 'Dra. Juliana Ramos', crm: '89012', uf: 'SP' },
];

const CPFS_FICTICIOS = [
  '123.456.789-00', '234.567.890-11', '345.678.901-22', '456.789.012-33',
  '567.890.123-44', '678.901.234-55', '789.012.345-66', '890.123.456-77',
  '901.234.567-88', '012.345.678-99', '111.222.333-01', '222.333.444-02',
  '333.444.555-03', '444.555.666-04', '555.666.777-05', '666.777.888-06',
  '777.888.999-07', '888.999.000-08', '999.000.111-09', '000.111.222-10',
  '112.233.445-11', '223.344.556-12', '334.455.667-13', '445.566.778-14'
];

const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'debito', 'credito'];
const PESOS_PAGAMENTO  = [15, 35, 25, 25];

function sortearFormaPagamento() {
  const r = rand(1, 100);
  let acc = 0;
  for (let i = 0; i < FORMAS_PAGAMENTO.length; i++) {
    acc += PESOS_PAGAMENTO[i];
    if (r <= acc) return FORMAS_PAGAMENTO[i];
  }
  return 'pix';
}

// ═══════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════
async function main() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao banco.\n');

    // ── Buscar empresa Drogaria ──
    const empresa = await Empresa.findOne({ where: { tipo_negocio: 'drogaria' } });
    if (!empresa) { console.error('Drogaria nao encontrada. Execute npm run db:seed primeiro.'); process.exit(1); }
    const EID = empresa.id;
    console.log(`Empresa: ${empresa.nome_fantasia} (id=${EID})`);

    // ── Buscar usuarios ──
    const usuarios = await Usuario.findAll({ where: { empresa_id: EID } });
    const admin = usuarios.find(u => u.perfil === 'administrador');
    const vendedor = usuarios.find(u => u.perfil === 'vendedor') || admin;
    const farmaceutico = usuarios.find(u => u.perfil === 'farmaceutico') || admin;
    const operadores = [admin, vendedor, farmaceutico].filter(Boolean);
    console.log(`Usuarios: ${operadores.map(u => u.nome).join(', ')}`);

    // ── Buscar produtos ──
    const todosProdutos = await Produto.findAll({ where: { empresa_id: EID, ativo: true } });
    const produtosNormais = todosProdutos.filter(p => !p.controlado);
    const produtosControlados = todosProdutos.filter(p => p.controlado);
    console.log(`Produtos: ${todosProdutos.length} total (${produtosControlados.length} controlados)`);

    // ── Buscar clientes ──
    const clientes = await Cliente.findAll({ where: { empresa_id: EID } });
    console.log(`Clientes: ${clientes.length}`);

    // ── Buscar fornecedores ──
    const fornecedores = await Fornecedor.findAll({ where: { empresa_id: EID } });

    // Nota: Com underscored:true, Sequelize usa createdAt/updatedAt (camelCase)
    // como nomes de atributo JS, mapeando para created_at/updated_at no DB.
    // Passamos createdAt/updatedAt nos .create() para que Sequelize reconheça
    // os valores como "changed" e NÃO sobrescreva com NOW().

    // ══════════════════════════════════════════
    //  ESTOQUE EM MEMÓRIA (tracking central)
    // ══════════════════════════════════════════
    const estoqueAtual = {};
    for (const p of todosProdutos) {
      estoqueAtual[p.id] = parseFloat(p.estoque_atual);
    }

    // ════════════════════════════════════════════
    //  GERAR LOTES INICIAIS PARA TODOS OS PRODUTOS
    // ════════════════════════════════════════════
    console.log('\nCriando lotes iniciais...');
    const lotesMap = {};
    for (const prod of todosProdutos) {
      const numLote = prod.numero_lote || `LT${String(prod.id).padStart(4, '0')}A`;
      const validade = prod.validade || '2027-06-30';
      const [lote] = await Lote.findOrCreate({
        where: { empresa_id: EID, produto_id: prod.id, numero_lote: numLote },
        defaults: {
          empresa_id: EID,
          produto_id: prod.id,
          numero_lote: numLote,
          validade,
          quantidade_inicial: parseFloat(prod.estoque_atual) + 500,
          quantidade_atual: parseFloat(prod.estoque_atual),
          data_entrada: '2025-12-15',
          custo_unitario: parseFloat(prod.preco_custo),
          status: 'ATIVO',
          fornecedor_id: prod.fornecedor_id,
          ativo: true
        }
      });
      lotesMap[prod.id] = lote;
    }
    console.log(`${Object.keys(lotesMap).length} lotes criados/verificados.`);

    // ════════════════════════════════════════════
    //  GERAR CLIENTES EXTRAS
    // ════════════════════════════════════════════
    console.log('\nCriando clientes extras...');
    const clientesExtras = [];
    const nomesClientes = [
      'Rosana Martins', 'Sérgio Oliveira', 'Cláudia Ribeiro', 'Antônio Ferreira',
      'Marta Almeida', 'Pedro Henrique Costa', 'Luciana Teixeira', 'Rogério Lima',
      'Simone da Silva', 'Márcio Eduardo Barros', 'Teresa Cristina Souza', 'Fábio Augusto Pinto',
      'Denise Moraes', 'Valdir José Neto', 'Eliane Carvalho', 'Rodrigo Fonseca',
      'Adriana Batista', 'Jorge Luiz Campos', 'Cristiane Duarte', 'Leandro Vieira'
    ];
    for (let i = 0; i < nomesClientes.length; i++) {
      const [cli] = await Cliente.findOrCreate({
        where: { empresa_id: EID, cpf: CPFS_FICTICIOS[i] },
        defaults: {
          empresa_id: EID,
          nome: nomesClientes[i],
          cpf: CPFS_FICTICIOS[i],
          telefone: `(11) 9${rand(1000, 9999)}-${rand(1000, 9999)}`,
          data_nascimento: `${rand(1955, 1998)}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
          ativo: true
        }
      });
      clientesExtras.push(cli);
    }
    const todosClientes = [...clientes, ...clientesExtras];
    console.log(`${todosClientes.length} clientes disponiveis.`);

    // ════════════════════════════════════════════
    //  GERAR COMPRAS (reposição recorrente de estoque)
    // ════════════════════════════════════════════
    console.log('\nCriando compras de reposicao...');
    const datasCompras = [
      '2025-12-20', '2025-12-28',
      '2026-01-03', '2026-01-10', '2026-01-17', '2026-01-24', '2026-01-31',
      '2026-02-05', '2026-02-12'
    ];
    let compraCount = 0;

    for (const dataCompra of datasCompras) {
      const fornecedor = pick(fornecedores);
      const nItens = rand(8, Math.min(12, todosProdutos.length));
      const prodsSorteados = shuffle(todosProdutos).slice(0, nItens);

      let valorProdutos = 0;
      const itensData = [];

      for (const p of prodsSorteados) {
        const qty = rand(40, 120);
        const valorUnit = parseFloat(p.preco_custo) * randDec(0.85, 1.05);
        const valorTotal = parseFloat((qty * valorUnit).toFixed(2));
        valorProdutos += valorTotal;
        itensData.push({ produto: p, qty, valorUnit: parseFloat(valorUnit.toFixed(4)), valorTotal });
      }

      const valorFrete = randDec(80, 300);
      const valorDesc = randDec(0, valorProdutos * 0.03);
      const valorTotal = parseFloat((valorProdutos + valorFrete - valorDesc).toFixed(2));

      const tsCompra = new Date(dataCompra + 'T10:00:00');
      const compra = await Compra.create({
        empresa_id: EID,
        fornecedor_id: fornecedor.id,
        tipo_documento: 'MANUAL',
        numero_nf: String(rand(100000, 999999)),
        data_emissao: dataCompra,
        data_entrada: dataCompra,
        valor_produtos: valorProdutos.toFixed(2),
        valor_frete: valorFrete,
        valor_desconto: valorDesc,
        valor_total: valorTotal,
        status: 'FINALIZADA',
        usuario_id: admin.id,
        finalizada_em: tsCompra,
        finalizada_por: admin.id,
        createdAt: tsCompra,
        updatedAt: tsCompra
      });

      for (const item of itensData) {
        const freteRateado = parseFloat(((item.valorTotal / valorProdutos) * valorFrete).toFixed(2));
        const descontoRateado = parseFloat(((item.valorTotal / valorProdutos) * valorDesc).toFixed(2));
        const custoFinal = parseFloat(((item.valorTotal + freteRateado - descontoRateado) / item.qty).toFixed(4));

        const sufixo = String.fromCharCode(65 + rand(0, 5)) + rand(1, 9);
        const novoLoteNum = `LT${String(item.produto.id).padStart(4, '0')}${sufixo}`;

        const [novoLote] = await Lote.findOrCreate({
          where: { empresa_id: EID, produto_id: item.produto.id, numero_lote: novoLoteNum },
          defaults: {
            empresa_id: EID,
            produto_id: item.produto.id,
            numero_lote: novoLoteNum,
            validade: `2027-${String(rand(1, 12)).padStart(2, '0')}-28`,
            quantidade_inicial: item.qty,
            quantidade_atual: item.qty,
            data_entrada: dataCompra,
            custo_unitario: custoFinal,
            status: 'ATIVO',
            fornecedor_id: fornecedor.id,
            ativo: true
          }
        });

        await CompraItem.create({
          compra_id: compra.id,
          produto_id: item.produto.id,
          produto_nome: item.produto.nome,
          codigo_barras: item.produto.codigo_barras,
          quantidade: item.qty,
          valor_unitario: item.valorUnit,
          valor_total: item.valorTotal,
          frete_rateado: freteRateado,
          desconto_rateado: descontoRateado,
          custo_final_unitario: custoFinal,
          numero_lote: novoLoteNum,
          lote_id: novoLote.id,
          createdAt: tsCompra,
          updatedAt: tsCompra
        });

        // Movimentação de estoque — entrada
        const estAnterior = estoqueAtual[item.produto.id];
        const estPosterior = estAnterior + item.qty;
        // ★ ATUALIZAR TRACKING EM MEMÓRIA ★
        estoqueAtual[item.produto.id] = estPosterior;

        await EstoqueMovimentacao.create({
          empresa_id: EID,
          produto_id: item.produto.id,
          lote_id: novoLote.id,
          tipo: 'entrada',
          origem: 'COMPRA',
          quantidade: item.qty,
          estoque_anterior: estAnterior,
          estoque_posterior: estPosterior,
          custo_unitario: custoFinal,
          motivo: `Compra NF ${compra.numero_nf}`,
          usuario_id: admin.id,
          referencia: `COMPRA-${compra.id}`,
          lote: novoLoteNum,
          createdAt: tsCompra,
          updatedAt: tsCompra
        });

        // Atualizar estoque do produto no DB
        await item.produto.update({ estoque_atual: estPosterior });
      }

      // Contas a pagar (2 parcelas)
      const parcValor = parseFloat((valorTotal / 2).toFixed(2));
      for (let p = 1; p <= 2; p++) {
        const vencDate = new Date(dataCompra);
        vencDate.setDate(vencDate.getDate() + p * 30);
        const pago = vencDate < new Date('2026-02-18');

        await CompraParcela.create({
          compra_id: compra.id,
          numero_parcela: p,
          data_vencimento: dateStr(vencDate),
          valor: parcValor,
          status: pago ? 'paga' : 'pendente',
          createdAt: tsCompra,
          updatedAt: tsCompra
        });

        await ContaPagar.create({
          empresa_id: EID,
          descricao: `NF ${compra.numero_nf} — Parc. ${p}/2 — ${fornecedor.nome}`,
          fornecedor_id: fornecedor.id,
          valor: parcValor,
          data_vencimento: dateStr(vencDate),
          data_pagamento: pago ? dateStr(vencDate) : null,
          forma_pagamento: pago ? 'transferencia' : null,
          status: pago ? 'pago' : 'pendente',
          categoria: 'fornecedor',
          usuario_id: admin.id,
          createdAt: tsCompra,
          updatedAt: tsCompra
        });
      }

      // Atualizar fornecedor
      await fornecedor.update({
        total_compras: parseFloat(fornecedor.total_compras) + valorTotal,
        quantidade_compras: fornecedor.quantidade_compras + 1,
        ultima_compra: dataCompra
      });

      compraCount++;
    }
    console.log(`${compraCount} compras criadas com itens, lotes, estoque e contas a pagar.`);

    // Snapshot do estoque pós-compras
    const estoqueInicial = {};
    for (const p of todosProdutos) {
      estoqueInicial[p.id] = estoqueAtual[p.id];
    }
    console.log('Estoque total apos compras:', Object.values(estoqueAtual).reduce((a, b) => a + b, 0).toFixed(0), 'unidades');

    // ════════════════════════════════════════════
    //  DESPESAS FIXAS MENSAIS
    // ════════════════════════════════════════════
    console.log('\nCriando despesas fixas...');
    const despesasFixas = [
      { desc: 'Aluguel Ponto Comercial', valor: 4500, dia: 5 },
      { desc: 'Conta de Energia', valor: 1200, dia: 10 },
      { desc: 'Conta de Agua', valor: 280, dia: 10 },
      { desc: 'Internet/Telefone', valor: 350, dia: 15 },
      { desc: 'Folha de Pagamento', valor: 12000, dia: 5 },
      { desc: 'Contabilidade', valor: 800, dia: 10 },
      { desc: 'Sistema VarlenSYS (SaaS)', valor: 299, dia: 1 },
      { desc: 'Seguro do Ponto', valor: 450, dia: 20 },
    ];

    for (const mes of ['2026-01', '2026-02']) {
      for (const dp of despesasFixas) {
        const venc = `${mes}-${String(dp.dia).padStart(2, '0')}`;
        const vencDate = new Date(venc + 'T12:00:00');
        const pago = vencDate <= new Date('2026-02-18');

        await ContaPagar.create({
          empresa_id: EID,
          descricao: `${dp.desc} — ${mes.replace('-', '/')}`,
          valor: dp.valor + randDec(-dp.valor * 0.05, dp.valor * 0.05),
          data_vencimento: venc,
          data_pagamento: pago ? venc : null,
          forma_pagamento: pago ? 'transferencia' : null,
          status: pago ? 'pago' : 'pendente',
          categoria: 'despesa_fixa',
          usuario_id: admin.id,
          createdAt: vencDate,
          updatedAt: vencDate
        });
      }
    }
    console.log('Despesas fixas criadas (Jan + Fev).');

    // ════════════════════════════════════════════
    //  VENDAS DIÁRIAS — 01/Jan até 18/Fev 2026
    // ════════════════════════════════════════════
    console.log('\nGerando vendas diarias...');

    const DATA_INICIO = new Date('2026-01-01');
    const DATA_FIM    = new Date('2026-02-18');
    let numeroVenda = 1;
    let totalVendasCriadas = 0;
    let totalFaturamento = 0;
    let totalControlados = 0;

    for (let d = new Date(DATA_INICIO); d <= DATA_FIM; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();
      const diaStr = dateStr(d);

      // Domingo = fechado
      if (diaSemana === 0) continue;

      const ehSabado = diaSemana === 6;
      const numVendasDia = ehSabado ? rand(12, 20) : rand(20, 35);

      // ── Abrir caixa do dia ──
      const operadorDia = pick(operadores);
      const horaAbertura = addHours(d, ehSabado ? 8 : 7, rand(0, 30));
      const horaFechamento = addHours(d, ehSabado ? 14 : 20, rand(0, 59));
      const fundoTroco = 300;

      const caixa = await Caixa.create({
        empresa_id: EID,
        usuario_id: operadorDia.id,
        numero_caixa: 1,
        data_abertura: horaAbertura,
        data_fechamento: horaFechamento,
        valor_abertura: fundoTroco,
        valor_fechamento: 0,
        total_vendas: 0,
        total_dinheiro: 0,
        total_pix: 0,
        total_debito: 0,
        total_credito: 0,
        total_sangria: 0,
        total_suprimento: 0,
        diferenca: 0,
        quantidade_vendas: 0,
        status: 'fechado',
        createdAt: horaAbertura,
        updatedAt: horaAbertura
      });

      let caixaTotalVendas = 0;
      let caixaDinheiro = 0, caixaPix = 0, caixaDebito = 0, caixaCredito = 0;
      let caixaQtdVendas = 0;

      // ── Gerar vendas do dia ──
      for (let v = 0; v < numVendasDia; v++) {
        const horaVenda = addHours(d,
          ehSabado ? rand(8, 13) : rand(7, 20),
          rand(0, 59)
        );

        // Filtrar produtos com estoque
        const produtosDisponiveis = todosProdutos.filter(p => estoqueAtual[p.id] >= 1);
        if (produtosDisponiveis.length === 0) break;

        const normaisDisp = produtosDisponiveis.filter(p => !p.controlado);
        const ctrlDisp = produtosDisponiveis.filter(p => p.controlado);

        // Sortear itens (1 a 4 produtos por venda)
        const numItens = rand(1, 4);
        let prodsVenda = shuffle(normaisDisp).slice(0, numItens);
        let temControlado = false;

        // 12% de chance de incluir controlado
        if (ctrlDisp.length > 0 && Math.random() < 0.12) {
          prodsVenda = prodsVenda.slice(0, Math.max(0, numItens - 1));
          prodsVenda.push(pick(ctrlDisp));
          temControlado = true;
        }

        if (prodsVenda.length === 0) continue;

        // Sortear cliente (55% identificado)
        const cliente = Math.random() < 0.55 ? pick(todosClientes) : null;

        // Calcular itens e totais
        const itens = [];
        let subtotal = 0;
        let custoTotal = 0;

        for (const prod of prodsVenda) {
          const maxQty = Math.min(prod.controlado ? 1 : 3, Math.floor(estoqueAtual[prod.id]));
          if (maxQty < 1) continue;
          const qty = prod.controlado ? 1 : rand(1, maxQty);
          const precoUnit = parseFloat(prod.preco_venda);
          const precoCusto = parseFloat(prod.preco_custo);
          const sub = parseFloat((qty * precoUnit).toFixed(2));
          subtotal += sub;
          custoTotal += qty * precoCusto;
          itens.push({ produto: prod, quantidade: qty, preco_unitario: precoUnit, preco_custo: precoCusto, subtotal: sub });
        }

        if (itens.length === 0) continue;

        // Desconto
        let desconto = 0;
        if (Math.random() < 0.12) {
          desconto = parseFloat((subtotal * randDec(3, 8) / 100).toFixed(2));
        }

        const total = parseFloat((subtotal - desconto).toFixed(2));
        if (total <= 0) continue;
        const lucro = parseFloat((total - custoTotal).toFixed(2));

        // Pagamento
        const forma = sortearFormaPagamento();
        let vDinheiro = 0, vPix = 0, vDebito = 0, vCredito = 0, troco = 0;
        let formaPgto = forma;

        if (forma === 'dinheiro') {
          vDinheiro = total;
          troco = parseFloat((Math.ceil(total / 5) * 5 - total).toFixed(2));
        } else if (forma === 'pix') { vPix = total; }
        else if (forma === 'debito') { vDebito = total; }
        else { vCredito = total; }

        // Split (5% vendas > R$60)
        if (total > 60 && Math.random() < 0.05) {
          formaPgto = 'multiplo';
          const metade = parseFloat((total / 2).toFixed(2));
          vDinheiro = metade; vPix = parseFloat((total - metade).toFixed(2));
          vDebito = 0; vCredito = 0; troco = 0;
        }

        const operadorVenda = pick(operadores);

        // ── Criar venda ──
        const venda = await Venda.create({
          empresa_id: EID,
          caixa_id: caixa.id,
          usuario_id: operadorVenda.id,
          cliente_id: cliente ? cliente.id : null,
          numero: numeroVenda++,
          cliente_nome: cliente ? cliente.nome : null,
          cliente_cpf: cliente ? cliente.cpf : null,
          subtotal, desconto, total,
          custo_total: parseFloat(custoTotal.toFixed(2)),
          lucro_estimado: lucro,
          forma_pagamento: formaPgto,
          valor_dinheiro: vDinheiro, valor_pix: vPix, valor_debito: vDebito, valor_credito: vCredito,
          troco, status: 'finalizada',
          subtotal_bruto: subtotal, desconto_automatico_total: 0, desconto_manual_total: desconto,
          operador_nome: operadorVenda.nome,
          versao_sistema: '5.0',
          tipo_documento_emitido: 'cupom_nao_fiscal',
          createdAt: horaVenda,
          updatedAt: horaVenda
        });

        // ── Itens + estoque ──
        for (const item of itens) {
          await VendaItem.create({
            venda_id: venda.id,
            produto_id: item.produto.id,
            produto_nome: item.produto.nome,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            preco_custo: item.preco_custo,
            desconto_item: 0,
            subtotal: item.subtotal,
            createdAt: horaVenda,
            updatedAt: horaVenda
          });

          const estAnterior = estoqueAtual[item.produto.id];
          const estPosterior = parseFloat(Math.max(0, estAnterior - item.quantidade).toFixed(3));
          estoqueAtual[item.produto.id] = estPosterior;

          const lote = lotesMap[item.produto.id];
          await EstoqueMovimentacao.create({
            empresa_id: EID,
            produto_id: item.produto.id,
            lote_id: lote ? lote.id : null,
            tipo: 'saida', origem: 'VENDA',
            quantidade: item.quantidade,
            estoque_anterior: estAnterior,
            estoque_posterior: estPosterior,
            custo_unitario: item.preco_custo,
            motivo: `Venda #${venda.numero}`,
            usuario_id: operadorVenda.id,
            referencia: `VENDA-${venda.id}`,
            createdAt: horaVenda, updatedAt: horaVenda
          });

          if (lote) {
            const loteQty = parseFloat(lote.quantidade_atual) - item.quantidade;
            await lote.update({ quantidade_atual: Math.max(0, loteQty) });
          }
        }

        // ── Controlado ──
        if (temControlado) {
          const prodCtrl = itens.find(it => it.produto.controlado);
          if (prodCtrl) {
            const medico = pick(NOMES_MEDICOS);
            await MedicamentoControlado.create({
              empresa_id: EID, venda_id: venda.id, produto_id: prodCtrl.produto.id,
              cliente_cpf: pick(CPFS_FICTICIOS), cliente_nome: pick(NOMES_PACIENTES),
              medico_nome: medico.nome, medico_crm: medico.crm, medico_uf: medico.uf,
              numero_receita: `REC${rand(100000, 999999)}`,
              data_receita: diaStr,
              tipo_receita: prodCtrl.produto.tipo_receita === 'receita_controle_especial' ? 'azul' : 'branca',
              receita_retida: true,
              farmaceutico_id: farmaceutico.id,
              quantidade_dispensada: prodCtrl.quantidade,
              lote: lotesMap[prodCtrl.produto.id] ? lotesMap[prodCtrl.produto.id].numero_lote : 'N/D',
              data_venda: diaStr,
              createdAt: horaVenda, updatedAt: horaVenda
            });
            totalControlados++;
          }
        }

        // ── Conta a receber (crédito parcelado) ──
        if (formaPgto === 'credito' && total > 100 && Math.random() < 0.25) {
          const numParc = pick([2, 3]);
          const valorParc = parseFloat((total / numParc).toFixed(2));
          for (let p = 1; p <= numParc; p++) {
            const venc = new Date(horaVenda);
            venc.setDate(venc.getDate() + p * 30);
            const recebido = venc < new Date('2026-02-18');
            await ContaReceber.create({
              empresa_id: EID,
              descricao: `Venda #${venda.numero} — Parc. ${p}/${numParc}`,
              cliente_id: cliente ? cliente.id : null,
              cliente_nome: cliente ? cliente.nome : 'Nao identificado',
              createdAt: horaVenda,
              updatedAt: horaVenda,
              cliente_cpf: cliente ? cliente.cpf : null,
              valor: valorParc,
              data_vencimento: dateStr(venc),
              status: recebido ? 'recebido' : 'pendente',
              data_recebimento: recebido ? dateStr(venc) : null,
              forma_recebimento: recebido ? 'credito' : null,
              venda_id: venda.id,
              parcela: `${p}/${numParc}`,
              usuario_id: operadorVenda.id
            });
          }
        }

        // Acumular totais
        caixaTotalVendas += total;
        caixaDinheiro += vDinheiro; caixaPix += vPix;
        caixaDebito += vDebito; caixaCredito += vCredito;
        caixaQtdVendas++;

        // Atualizar cliente
        if (cliente) {
          const novoTotal = parseFloat(cliente.total_compras) + total;
          const novaQtd = cliente.quantidade_compras + 1;
          await cliente.update({
            total_compras: novoTotal, quantidade_compras: novaQtd,
            ticket_medio: parseFloat((novoTotal / novaQtd).toFixed(2)),
            ultima_compra: horaVenda
          });
        }
      }

      // ── Sangria ──
      let totalSangria = 0;
      if (caixaDinheiro > 600) {
        const valorSangria = parseFloat((caixaDinheiro * 0.6).toFixed(2));
        await CaixaMovimentacao.create({
          caixa_id: caixa.id, empresa_id: EID, tipo: 'sangria',
          valor: valorSangria,
          motivo: 'Retirada de seguranca — excesso de dinheiro no caixa',
          usuario_id: admin.id,
          createdAt: horaFechamento,
          updatedAt: horaFechamento
        });
        totalSangria = valorSangria;
      }

      // ── Suprimento (seg-feira, 40% chance) ──
      let totalSuprimento = 0;
      if (diaSemana === 1 && Math.random() < 0.4) {
        const valorSupr = randDec(100, 250);
        await CaixaMovimentacao.create({
          caixa_id: caixa.id, empresa_id: EID, tipo: 'suprimento',
          valor: valorSupr,
          motivo: 'Reforco de troco para a semana',
          usuario_id: admin.id,
          createdAt: horaAbertura,
          updatedAt: horaAbertura
        });
        totalSuprimento = valorSupr;
      }

      // ── Fechar caixa ──
      const diferenca = randDec(-3, 3);
      await caixa.update({
        data_fechamento: horaFechamento,
        valor_fechamento: parseFloat((fundoTroco + caixaDinheiro - totalSangria + totalSuprimento + diferenca).toFixed(2)),
        total_vendas: parseFloat(caixaTotalVendas.toFixed(2)),
        total_dinheiro: parseFloat(caixaDinheiro.toFixed(2)),
        total_pix: parseFloat(caixaPix.toFixed(2)),
        total_debito: parseFloat(caixaDebito.toFixed(2)),
        total_credito: parseFloat(caixaCredito.toFixed(2)),
        total_sangria: totalSangria, total_suprimento: totalSuprimento,
        diferenca: parseFloat(diferenca.toFixed(2)),
        quantidade_vendas: caixaQtdVendas,
        status: 'fechado'
      });

      totalVendasCriadas += caixaQtdVendas;
      totalFaturamento += caixaTotalVendas;

      const pct = Math.round(((d - DATA_INICIO) / (DATA_FIM - DATA_INICIO)) * 100);
      process.stdout.write(`\r  ${diaStr} | ${String(caixaQtdVendas).padStart(2)} vendas R$ ${caixaTotalVendas.toFixed(2).padStart(10)} | Acum: ${totalVendasCriadas} vendas R$ ${totalFaturamento.toFixed(2)} [${pct}%]`);
    }

    // ── Atualizar estoque final ──
    console.log('\n\nAtualizando estoque final dos produtos...');
    for (const prod of todosProdutos) {
      const vendido = Math.max(0, estoqueInicial[prod.id] - estoqueAtual[prod.id]);
      await prod.update({
        estoque_atual: Math.max(0, estoqueAtual[prod.id]),
        total_vendido_mes: vendido
      });
    }

    // ════════════════════════════════════════════
    //  CANCELAMENTOS (~3%)
    // ════════════════════════════════════════════
    console.log('Criando cancelamentos...');
    const numCanc = Math.max(5, Math.round(totalVendasCriadas * 0.03));
    const vendasCanc = await Venda.findAll({
      where: { empresa_id: EID, status: 'finalizada' },
      order: sequelize.random(),
      limit: numCanc
    });

    for (const v of vendasCanc) {
      const dt = v.createdAt || v.created_at || new Date();
      await v.update({
        status: 'cancelada',
        motivo_cancelamento: pick([
          'Cliente desistiu da compra',
          'Produto com defeito/avariado',
          'Erro de registro — produto duplicado',
          'Troca por outro produto',
          'Divergencia de preco'
        ]),
        cancelado_por: admin.id,
        cancelado_em: new Date(dt.getTime() + rand(60, 3600) * 1000)
      });
    }
    console.log(`${vendasCanc.length} vendas canceladas.`);

    // ════════════════════════════════════════════
    //  RESUMO FINAL
    // ════════════════════════════════════════════
    const finalizadas = totalVendasCriadas - vendasCanc.length;
    console.log('\n══════════════════════════════════════════');
    console.log('  SEED DE MOVIMENTACOES CONCLUIDO');
    console.log('══════════════════════════════════════════');
    console.log(`  Periodo:          01/Jan/2026 a 18/Fev/2026`);
    console.log(`  Empresa:          ${empresa.nome_fantasia}`);
    console.log(`  Total vendas:     ${totalVendasCriadas} (${finalizadas} finalizadas, ${vendasCanc.length} canceladas)`);
    console.log(`  Faturamento:      R$ ${totalFaturamento.toFixed(2)}`);
    console.log(`  Ticket medio:     R$ ${(totalFaturamento / totalVendasCriadas).toFixed(2)}`);
    console.log(`  Controlados:      ${totalControlados} dispensacoes`);
    console.log(`  Compras:          ${compraCount}`);
    console.log(`  Clientes:         ${todosClientes.length}`);
    console.log(`  Media vendas/dia: ${(totalVendasCriadas / 42).toFixed(1)}`);
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\nErro no seed:', error);
    process.exit(1);
  }
}

main();
