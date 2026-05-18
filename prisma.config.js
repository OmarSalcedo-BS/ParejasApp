// prisma.config.js
const { defineConfig } = require('prisma/config');

// Cargamos las variables de entorno desde .env
require('dotenv/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});