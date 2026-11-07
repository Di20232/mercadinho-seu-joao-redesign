const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateCsv } = require('../src/exportService');

// Lê o CSV como o Excel faria: ";" separa colunas, aspas protegem o conteúdo.
function parseCsv(text) {
  const rows = [[]];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { rows.at(-1).push(field); field = ''; } else if (c === '\r' && text[i + 1] === '\n') { rows.at(-1).push(field); field = ''; rows.push([]); i += 1; } else field += c;
  }
  rows.at(-1).push(field);
  return rows;
}

test('CSV: ";", aspas e quebra de linha no texto não deslocam as colunas', () => {
  const csv = generateCsv(['Motivo', 'Usuário'], [
    ['NF 1234; fornecedor X', 'Diego'],
    ['caixa "amassada"', 'Ana'],
    ['linha 1\nlinha 2', 'Bia'],
  ]).replace(/^﻿/, '');
  const rows = parseCsv(csv);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.length === 2), JSON.stringify(rows));
  assert.deepEqual(rows[1], ['NF 1234; fornecedor X', 'Diego']);
  assert.deepEqual(rows[2], ['caixa "amassada"', 'Ana']);
  assert.deepEqual(rows[3], ['linha 1\nlinha 2', 'Bia']);
});

test('CSV: fórmulas continuam neutralizadas e números ficam com vírgula', () => {
  const csv = generateCsv(['Produto', 'Valor'], [['=HYPERLINK("http://x";"clique")', 1.5], ['@SUM(A1)', -4]]).replace(/^﻿/, '');
  const rows = parseCsv(csv);
  assert.equal(rows[1][0], `'=HYPERLINK("http://x";"clique")`);
  assert.equal(rows[1][1], '1,5');
  assert.equal(rows[2][0], "'@SUM(A1)");
  assert.equal(rows[2][1], '-4');
});
