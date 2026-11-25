const ExcelJS = require('exceljs');
const { formatStoreDateTime, storeWallClock } = require('./storeTime');

// Data e hora de um acontecimento (venda, movimentação) numa planilha, sempre
// no horário da loja e não no do servidor. No CSV sai como texto
// "25/11/2026 22:00"; no Excel, como data de verdade, que ordena e filtra.
class StoreDateTime {
  constructor(date) {
    this.date = date;
  }
}
const storeDateTime = (date) => new StoreDateTime(date);
const XLSX_DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm';

function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Neutralize CSV injection formulas starting with =, +, -, @
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function formatCsvValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof StoreDateTime) return formatStoreDateTime(value.date);
  if (typeof value === 'number') {
    return String(value).replace('.', ',');
  }
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return sanitizeCsvCell(value);
}

// Campo com ";", aspas ou quebra de linha vai entre aspas (RFC 4180); sem isso
// um "NF 1234; fornecedor X" desloca as colunas da linha inteira.
function quoteCsv(str) {
  return /[;"\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function generateCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map((h) => quoteCsv(sanitizeCsvCell(h))).join(';'));
  for (const row of rows) {
    lines.push(row.map((v) => quoteCsv(formatCsvValue(v))).join(';'));
  }
  // UTF-8 with BOM
  return '﻿' + lines.join('\r\n');
}

async function generateXlsx(sheetName, headers, rows) {
  return generateWorkbook([{ name: sheetName, headers, rows }]);
}

// Um arquivo com várias abas: [{ name, headers, rows }], cada aba no mesmo estilo.
async function generateWorkbook(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const { name, headers, rows } of sheets) addSheet(workbook, name, headers, rows);
  return workbook.xlsx.writeBuffer();
}

function addSheet(workbook, sheetName, headers, rows) {
  const sheet = workbook.addWorksheet(sheetName || 'Relatório');

  // Add header
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '2563EB' }, // Modern blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Add data rows
  for (const row of rows) {
    const added = sheet.addRow(row.map((v) => (v instanceof StoreDateTime ? storeWallClock(v.date) : v)));
    row.forEach((v, i) => {
      if (v instanceof StoreDateTime) added.getCell(i + 1).numFmt = XLSX_DATE_TIME_FORMAT;
    });
  }

  // Freeze top row and enable auto filter
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (headers.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  // Auto-adjust column widths
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: true }, (cell) => {
      // Data vira "25/11/2026 22:00" na célula; String(Date) daria 60 letras.
      const columnLength = cell.value instanceof Date ? 16 : cell.value ? String(cell.value).length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 3, 12), 50);
  });
}

module.exports = { generateCsv, generateXlsx, generateWorkbook, storeDateTime, XLSX_DATE_TIME_FORMAT };
