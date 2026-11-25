// Cria 2 anos de histórico (vendas, compras de fornecedor e perdas) para
// popular os relatórios. O estoque atual de cada produto NÃO muda: o histórico
// é montado para terminar exatamente nele (ver src/historyGenerator.js).
//
// A carga inicial de cada produto (a entrada "Estoque inicial ..." que leva o
// saldo de 0 ao valor atual) é substituída por esse histórico. Se o produto já
// começa com movimentação real, o histórico termina no saldo de antes dela.
// Vendas e movimentações reais ficam sempre como estão.
//
// Uso: npm run simulate:history          (SIMULATE_YEARS=1 para outro período)
//      SIMULATE_FROM=2024-01-01 npm run simulate:history   (começa numa data fixa;
//      com histórico já gerado, completa só o trecho mais antigo que falta)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { buildHistory } = require('../src/historyGenerator');

const DAY = 24 * 60 * 60 * 1000;
const YEARS = Number(process.env.SIMULATE_YEARS || 2);
const CHUNK = 5000;
const milli = (v) => Math.round(Number(v) * 1000);
const qty = (m) => (m / 1000).toFixed(3);
const money = (c) => (c / 100).toFixed(2);

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Simulação de histórico não roda em produção.');
  const prisma = new PrismaClient();
  try {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = process.env.SIMULATE_FROM
      ? new Date(`${process.env.SIMULATE_FROM}T00:00:00`)
      : new Date(end.getTime() - Math.round(YEARS * 365) * DAY);
    if (Number.isNaN(start.getTime()) || start >= end) throw new Error('SIMULATE_FROM inválida (use AAAA-MM-DD, antes de hoje).');

    // Trava contra rodar duas vezes: se já há vendas perto do início pedido, esse
    // período já foi gerado. Rodar de novo com uma data MAIS ANTIGA completa o começo.
    const oldest = await prisma.sale.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    if (oldest && oldest.createdAt < new Date(start.getTime() + 30 * DAY) && oldest.createdAt < new Date(end.getTime() - 30 * DAY)) {
      throw new Error(`Já existe histórico desde ${oldest.createdAt.toLocaleDateString('pt-BR')}. Nada foi alterado.`);
    }
    // Popularidade de cada produto = quantas vezes ele já foi vendido (se já houver histórico).
    // Com poucas vendas (ex.: só as reais de teste) a contagem distorceria tudo: aí a popularidade é sorteada.
    const sold = await prisma.saleItem.groupBy({ by: ['productId'], _count: true });
    const soldCount = new Map(sold.reduce((n, g) => n + g._count, 0) >= 1000 ? sold.map((g) => [g.productId, g._count]) : []);

    const users = await prisma.user.findMany({ where: { active: true } });
    const byEmail = (email) => users.find((u) => u.email === email);
    const owner = users.find((u) => u.role === 'ADMIN');
    if (!owner) throw new Error('Nenhum dono (ADMIN) cadastrado — rode "npm run seed" primeiro.');
    const caixa = byEmail('caixa@teste.local') || owner;
    const financeiro = byEmail('financeiro@teste.local') || owner;
    const estoque = byEmail('estoque@teste.local') || owner;
    const sellers = [{ id: caixa.id, weight: 55 }, { id: owner.id, weight: 30 }, { id: financeiro.id, weight: 15 }];

    const products = await prisma.product.findMany({
      where: { active: true, salePrice: { not: null } },
      include: { movements: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    const anchored = [];
    const replaceIds = [];
    for (const p of products) {
      const first = p.movements[0];
      if (!first) {
        anchored.push({ p, anchor: milli(p.currentStock), endAt: end });
      } else if (first.type === 'ENTRY' && Number(first.previousStock) === 0) {
        // Carga inicial (0 -> saldo): é trocada pelo histórico, que termina no mesmo saldo.
        anchored.push({ p, anchor: milli(first.newStock), endAt: first.createdAt });
        replaceIds.push(first.id);
      } else {
        // Já tem movimentação real: o histórico termina no saldo de antes dela, que fica intacta.
        anchored.push({ p, anchor: milli(first.previousStock), endAt: first.createdAt });
      }
    }

    const { sales, movements } = buildHistory({
      products: anchored.map(({ p, anchor, endAt }) => ({
        id: p.id, unit: p.unit, category: p.category, salePriceCents: Math.round(Number(p.salePrice) * 100),
        minStockMilli: milli(p.minStock), anchorMilli: anchor, endAt: endAt < end ? endAt : end, weight: soldCount.get(p.id),
      })),
      start, end, sellers, stockUserId: estoque.id, cancelUserId: financeiro.id, seed: 20261106,
    });

    const saleRows = sales.map((s) => ({
      id: s.id, sellerId: s.sellerId, createdAt: s.createdAt, canceled: s.canceled,
      totalAmount: money(s.items.reduce((sum, i) => sum + i.subtotalCents, 0)),
    }));
    const itemRows = sales.flatMap((s) => s.items.map((i) => ({
      saleId: s.id, productId: i.productId, quantity: qty(i.qtyMilli), unitPrice: money(i.unitCents), subtotal: money(i.subtotalCents),
    })));
    const moveRows = movements.map((m) => ({
      productId: m.productId, type: m.type, quantity: qty(m.qty), previousStock: qty(m.prev), newStock: qty(m.next),
      reason: m.reason, userId: m.userId, saleId: m.saleId || null, createdAt: m.createdAt,
    }));

    console.log(`Gravando ${saleRows.length} vendas, ${itemRows.length} itens e ${moveRows.length} movimentações...`);
    // Tudo ou nada: se algo falhar no meio, o banco volta como estava.
    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({ where: { id: { in: replaceIds } } });
      for (let i = 0; i < saleRows.length; i += CHUNK) await tx.sale.createMany({ data: saleRows.slice(i, i + CHUNK) });
      for (let i = 0; i < itemRows.length; i += CHUNK) await tx.saleItem.createMany({ data: itemRows.slice(i, i + CHUNK) });
      for (let i = 0; i < moveRows.length; i += CHUNK) await tx.stockMovement.createMany({ data: moveRows.slice(i, i + CHUNK) });
    }, { timeout: 15 * 60 * 1000, maxWait: 10_000 });

    const count = (type) => moveRows.filter((m) => m.type === type).length;
    console.log(`Pronto: histórico de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}.`);
    console.log(`${anchored.length} produtos, ${saleRows.length} vendas (${saleRows.filter((s) => s.canceled).length} canceladas), ${count('ENTRY')} entradas, ${count('LOSS')} perdas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
