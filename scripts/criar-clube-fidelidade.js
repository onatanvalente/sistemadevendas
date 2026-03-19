/* ══════════════════════════════════════════════════════════════
   SGC — Script: Criar Programa Padrão "Clube Fidelidade"
   Execução única para configuração inicial do sistema.
   
   Uso: node scripts/criar-clube-fidelidade.js
   
   O que faz:
   1. Cria o programa "Clube Fidelidade" como programa_padrao = true
   2. Inscreve todos os clientes existentes automaticamente
   3. Evita duplicidade (idempotente — pode rodar várias vezes)
   ══════════════════════════════════════════════════════════════ */

require('dotenv').config();
const { sequelize, Empresa, ProgramaComercial, ClientePrograma, Cliente } = require('../models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco\n');

    // Buscar todas as empresas ativas
    const empresas = await Empresa.findAll({ where: { ativo: true } });
    if (empresas.length === 0) {
      console.log('⚠️  Nenhuma empresa ativa encontrada');
      process.exit(0);
    }

    for (const empresa of empresas) {
      console.log(`\n══ Empresa: ${empresa.nome} (ID: ${empresa.id}) ══`);

      // Verificar se já existe programa padrão
      let clube = await ProgramaComercial.findOne({
        where: { empresa_id: empresa.id, programa_padrao: true }
      });

      if (clube) {
        console.log(`  ✅ Programa padrão já existe: "${clube.nome}" (ID: ${clube.id})`);
      } else {
        // Desmarcar qualquer programa_padrao existente (segurança)
        await ProgramaComercial.update(
          { programa_padrao: false },
          { where: { empresa_id: empresa.id, programa_padrao: true } }
        );

        // Criar o Clube Fidelidade
        clube = await ProgramaComercial.create({
          empresa_id: empresa.id,
          nome: 'Clube Fidelidade',
          tipo: 'clube',
          descricao: 'Programa de fidelidade padrão — todo novo cliente é inscrito automaticamente.',
          ativo: true,
          programa_padrao: true,
          acumulativo_global: false,
          prioridade_global: 0
        });
        console.log(`  ✅ Clube Fidelidade criado (ID: ${clube.id})`);
      }

      // Inscrever todos os clientes existentes que ainda não estão inscritos
      const clientes = await Cliente.findAll({
        where: { empresa_id: empresa.id, ativo: true },
        attributes: ['id', 'nome']
      });

      let inscritos = 0;
      let jaEstavam = 0;

      for (const cliente of clientes) {
        const existe = await ClientePrograma.findOne({
          where: { cliente_id: cliente.id, programa_id: clube.id }
        });
        if (!existe) {
          await ClientePrograma.create({
            empresa_id: empresa.id,
            cliente_id: cliente.id,
            programa_id: clube.id,
            status: 'ativo'
          });
          inscritos++;
        } else {
          jaEstavam++;
        }
      }

      console.log(`  📊 Clientes: ${clientes.length} total | ${inscritos} inscritos agora | ${jaEstavam} já estavam`);
    }

    console.log('\n══════════════════════════════════════════');
    console.log('  ✅ Configuração concluída!');
    console.log('  Todo novo cliente será inscrito automaticamente.');
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
