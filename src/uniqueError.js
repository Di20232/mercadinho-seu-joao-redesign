// Regra única para "já cadastrado".
//
// Cada cadastro faz duas checagens: antes de gravar, procura o registro e
// responde 409 se ele já existe (mensagem amigável na hora); e, ao gravar,
// traduz o erro P2002 do Prisma (violação de chave única) para o mesmo 409 —
// que só acontece quando duas requisições cadastram o mesmo valor ao mesmo
// tempo e as duas passam pela primeira checagem.
const httpError = require('./httpError');

const DUPLICATE = {
  userEmail: 'Já existe um usuário com este e-mail.',
  productBarcode: 'Já existe um produto com este código de barras.',
  importBarcode: 'Código de barras já cadastrado em outro produto.',
};

function isUniqueViolation(err) {
  return Boolean(err) && err.code === 'P2002';
}

// Primeira checagem: `found` é o resultado da busca pelo valor único.
function ensureAvailable(found, message) {
  if (found) throw httpError(409, message);
}

// Segunda checagem: roda a gravação e converte P2002 em 409.
async function guardUnique(write, message) {
  try {
    return await write();
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, message);
    throw err;
  }
}

module.exports = { DUPLICATE, isUniqueViolation, ensureAvailable, guardUnique };
