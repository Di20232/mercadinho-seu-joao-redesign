const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { generateCsv, generateXlsx, storeDateTime, XLSX_DATE_TIME_FORMAT } = require('../src/exportService');

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

// 01:30 UTC do dia 26 é 22:30 do dia 25 em Brasília: a venda é do dia 25.
const VENDA_DA_NOITE = new Date('2026-11-26T01:30:00Z');

test('CSV: data e hora saem em texto, no horário da loja', () => {
  const rows = parseCsv(generateCsv(['Data/Hora', 'Produto'], [[storeDateTime(VENDA_DA_NOITE), 'Arroz']]).replace(/^﻿/, ''));
  assert.deepEqual(rows[1], ['25/11/2026 22:30', 'Arroz']);
});

test('Excel: data e hora continuam sendo data (ordena e filtra), no horário da loja', async () => {
  const buffer = await generateXlsx('Movimentações', ['Data/Hora', 'Produto'], [[storeDateTime(VENDA_DA_NOITE), 'Arroz']]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const cell = workbook.worksheets[0].getCell('A2');
  assert.ok(cell.value instanceof Date, `a célula deveria ser data, veio ${typeof cell.value}: ${cell.value}`);
  assert.equal(cell.value.toISOString(), '2026-11-25T22:30:00.000Z');
  assert.equal(cell.numFmt, XLSX_DATE_TIME_FORMAT);
});
