/**
 * Sincroniza os modelos com o banco de dados
 * Executar: npm run db:sync
 */
require('dotenv').config();
const { sequelize } = require('../models');

async function sync() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco');

    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

sync();
