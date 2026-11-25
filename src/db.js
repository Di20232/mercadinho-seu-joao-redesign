const { PrismaClient } = require('@prisma/client');
const { retryStaleRead } = require('./retryStaleRead');

// Cliente único do Prisma. Todas as queries usam parâmetros tipados
// (nunca concatenação de string), o que elimina injeção de SQL por construção.
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      $allOperations: ({ operation, args, query }) => retryStaleRead(operation, () => query(args)),
    },
  },
});

module.exports = prisma;
