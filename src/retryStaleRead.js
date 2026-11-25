// Depois que o banco fica parado, reinicia ou o computador dorme, o pool do
// Prisma ainda guarda conexões mortas; cada uma falha uma vez com P1017
// ("Server has closed the connection") antes de ser trocada. Sem isto o 1º
// acesso vira erro 500 ou demora. Só LEITURAS são repetidas: uma escrita
// repetida às cegas poderia gravar duas vezes.
// shortcut: no máximo 5 tentativas (pool padrão tem poucas conexões); se o
// pool for aumentado muito, subir MAX_ATTEMPTS.
const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const MAX_ATTEMPTS = 5;

async function retryStaleRead(operation, run) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      if (err.code !== 'P1017' || !READS.has(operation) || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}

module.exports = { retryStaleRead };
