const { test } = require('node:test');
const assert = require('node:assert/strict');
const { storeToday, formatStoreDateTime, storeWallClock } = require('../src/storeTime');

// 01:30 UTC do dia 26 ainda é 22:30 do dia 25 em Brasília. Num servidor em UTC,
// o relógio dele já está no dia 26; a loja, não.
const NOITE_EM_BRASILIA = new Date('2026-11-26T01:30:07.250Z');

test('horário da loja: "hoje" é o dia de Brasília, não o do servidor', () => {
  assert.equal(storeToday(NOITE_EM_BRASILIA), '2026-11-25');
  assert.equal(storeToday(new Date('2026-11-26T03:00:00Z')), '2026-11-26');
  assert.equal(storeToday(new Date('2026-12-31T23:59:59Z')), '2026-12-31');
});

test('horário da loja: data e hora em texto, no formato brasileiro', () => {
  assert.equal(formatStoreDateTime(NOITE_EM_BRASILIA), '25/11/2026 22:30');
  assert.equal(formatStoreDateTime(new Date('2026-01-01T03:05:00Z')), '01/01/2026 00:05');
});

test('horário da loja: relógio de Brasília guardado nos campos UTC (para o Excel)', () => {
  assert.equal(storeWallClock(NOITE_EM_BRASILIA).toISOString(), '2026-11-25T22:30:07.250Z');
  // Meia-noite em ponto sai 00h, e não 24h.
  assert.equal(storeWallClock(new Date('2026-11-26T03:00:00Z')).toISOString(), '2026-11-26T00:00:00.000Z');
});
