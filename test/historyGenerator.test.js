const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildHistory } = require('../src/historyGenerator');

const DAY = 24 * 60 * 60 * 1000;
const end = new Date(2026, 10, 6);
const start = new Date(end.getTime() - 120 * DAY);

const products = [
  { id: 'arroz', unit: 'PCT', category: 'Mercearia', salePriceCents: 2490, minStockMilli: 10000, anchorMilli: 40000, endAt: end },
  { id: 'banana', unit: 'KG', category: 'Hortifruti', salePriceCents: 699, minStockMilli: 5000, anchorMilli: 12500, endAt: end },
  { id: 'esgotado', unit: 'UN', category: 'Limpeza', salePriceCents: 399, minStockMilli: 6000, anchorMilli: 0, endAt: end },
  // termina antes do fim, como um produto que já tinha movimentação real depois
  { id: 'antigo', unit: 'UN', category: 'Laticínios', salePriceCents: 549, minStockMilli: 24000, anchorMilli: 60000, endAt: new Date(end.getTime() - 10 * DAY) },
];

const history = buildHistory({
  products, start, end, salesPerDay: 25, seed: 7,
  sellers: [{ id: 'caixa', weight: 3 }, { id: 'dono', weight: 1 }], stockUserId: 'estoque', cancelUserId: 'financeiro',
});

test('histórico: cada produto fecha no estoque de hoje, sem saldo negativo e com a conta certa', () => {
  for (const p of products) {
    const moves = history.movements.filter((m) => m.productId === p.id);
    let balance = 0;
    for (const m of moves) {
      assert.equal(m.prev, balance, `${p.id}: saldo anterior não bate`);
      assert.equal(m.prev + m.qty, m.next, `${p.id}: anterior + quantidade != novo`);
      assert.ok(m.next >= 0, `${p.id}: estoque negativo`);
      balance = m.next;
    }
    assert.equal(balance, p.anchorMilli, `${p.id}: não termina no estoque atual`);
  }
});

test('histórico: produto vendido por unidade nunca tem quantidade ou saldo fracionado', () => {
  const unitIds = new Set(products.filter((p) => p.unit !== 'KG').map((p) => p.id));
  const fractional = history.movements.filter((m) => unitIds.has(m.productId) && [m.qty, m.prev, m.next].some((v) => v % 1000 !== 0));
  assert.equal(fractional.length, 0, JSON.stringify(fractional[0]));
});

test('histórico: tem vendas, compras e perdas, e nada depois do fim de cada produto', () => {
  const types = new Set(history.movements.map((m) => m.type));
  for (const t of ['SALE', 'ENTRY', 'LOSS']) assert.ok(types.has(t), `faltou movimentação ${t}`);
  assert.ok(history.sales.length > 1000);
  const antigoEnd = products[3].endAt.getTime();
  assert.ok(history.movements.filter((m) => m.productId === 'antigo').every((m) => m.createdAt.getTime() < antigoEnd));
});

test('histórico: venda cancelada tem a baixa e a devolução, e não mexe no saldo', () => {
  const canceled = history.sales.filter((s) => s.canceled);
  assert.ok(canceled.length > 0, 'nenhuma venda cancelada gerada');
  for (const sale of canceled) {
    const moves = history.movements.filter((m) => m.saleId === sale.id);
    assert.deepEqual(moves.map((m) => m.type), ['SALE', 'ADJUSTMENT']);
    assert.equal(moves[0].qty + moves[1].qty, 0);
  }
  for (const sale of history.sales.filter((s) => !s.canceled)) {
    assert.equal(history.movements.filter((m) => m.saleId === sale.id).length, sale.items.length);
  }
});
