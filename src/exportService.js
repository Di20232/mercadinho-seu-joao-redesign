const ExcelJS = require('exceljs');

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

function generateCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map(sanitizeCsvCell).join(';'));
  for (const row of rows) {
    lines.push(row.map(formatCsvValue).join(';'));
  }
  // UTF-8 with BOM
  return '﻿' + lines.join('\r\n');
}

async function generateXlsx(sheetName, headers, rows) {
  const workbook = new ExcelJS.Workbook();
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
    sheet.addRow(row);
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
      const columnLength = cell.value ? String(cell.value).length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(Math.max(maxLength + 3, 12), 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = { generateCsv, generateXlsx };
