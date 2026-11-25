// Busca de produto pelo nome ignorando acentos e maiúsculas: "cafe", "CAFE"
// e "café" acham "Café Torrado".
//
// O `contains` + `mode: 'insensitive'` do Prisma ignora só maiúsculas. Aqui o
// banco compara os dois lados depois de `translate(lower(...))`, que tira os
// acentos do nome e do termo do mesmo jeito. Sem extensão (unaccent) e sem
// coluna nova: funciona igual no Docker local, no Neon e no Supabase. As
// maiúsculas acentuadas também entram no mapa porque, num banco com collation
// "C", o lower() não as converte.
const prisma = require('./db');

const ACCENTED = 'áàâãäåéèêëíìîïóòôõöúùûüýÿçñÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝÇÑ';
const PLAIN = [...ACCENTED]
  .map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
  .join('');

// %, _ e \ digitados pelo usuário são literais, não curingas do LIKE.
function escapeLike(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// IDs dos produtos cujo nome contém o termo, ignorando acentos e maiúsculas.
async function findProductIdsByName(term) {
  const pattern = `%${escapeLike(String(term))}%`;
  const rows = await prisma.$queryRaw`
    SELECT id FROM "Product"
    WHERE translate(lower(name), ${ACCENTED}, ${PLAIN})
          LIKE translate(lower(${pattern}), ${ACCENTED}, ${PLAIN}) ESCAPE '\\'
  `;
  return rows.map((r) => r.id);
}

module.exports = { findProductIdsByName, ACCENTED, PLAIN };
