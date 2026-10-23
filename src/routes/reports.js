const express = require('express');
const prisma = require('../db');
const { authenticate, authorize } = require('../auth');
const { getStockForecast, getSlowMovingProducts } = require('../forecast');
const { parseDateParam, clampIntParam } = require('../queryHelpers');
const { generateCsv, generateXlsx } = require('../exportService');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

async function sendExport(res, format, filenamePrefix, sheetName, headers, rows) {
  const fmt = (format || 'csv').toLowerCase();
  if (fmt === 'xlsx') {
    const buffer = await generateXlsx(sheetName, headers, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenamePrefix}.xlsx"`);
    return res.send(buffer);
  } else {
    const csv = generateCsv(headers, rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenamePrefix}.csv"`);
    return res.send(csv);
  }
}

router.get('/forecast', async (req, res) => {
  res.json(await getStockForecast());
});

router.get('/forecast/export', async (req, res) => {
  const forecast = await getStockForecast();
  const headers = ['Produto', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Venda Média Diária (un/dia)', 'Dias até Esgotar', 'Abaixo do Mínimo'];
  const rows = forecast.map((p) => [
    p.name,
    p.unit,
    p.currentStock,
    p.minStock,
    p.avgDailySales,
    p.daysUntilStockout !== null ? p.daysUntilStockout : 'Sem consumo',
    p.lowStock ? 'SIM' : 'NÃO',
  ]);
  const dateStr = new Date().toISOString().slice(0, 10);
  await sendExport(res, req.query.format, `previsao-estoque_${dateStr}`, 'Previsão de Estoque', headers, rows);
});

router.get('/sales-summary', async (req, res) => {
  const from = parseDateParam(req.query.from, 'from');
  let to = parseDateParam(req.query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const where = { canceled: false };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;

  const sales = await prisma.sale.findMany({ where, select: { totalAmount: true, createdAt: true } });

  const byDay = {};
  let total = 0;
  for (const s of sales) {
    const day = s.createdAt.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + Number(s.totalAmount);
    total += Number(s.totalAmount);
  }

  res.json({ total, count: sales.length, byDay });
});

router.get('/sales-summary/export', async (req, res) => {
  const from = parseDateParam(req.query.from, 'from');
  let to = parseDateParam(req.query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const where = { canceled: false };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;

  const sales = await prisma.sale.findMany({ where, select: { totalAmount: true, createdAt: true }, orderBy: { createdAt: 'asc' } });

  const byDayMap = {};
  for (const s of sales) {
    const day = s.createdAt.toISOString().slice(0, 10);
    if (!byDayMap[day]) {
      byDayMap[day] = { total: 0, count: 0 };
    }
    byDayMap[day].total += Number(s.totalAmount);
    byDayMap[day].count += 1;
  }

  const headers = ['Data', 'Total Vendido (R$)', 'Qtd Vendas'];
  const rows = Object.entries(byDayMap).map(([day, data]) => [
    day.split('-').reverse().join('/'),
    Number(data.total.toFixed(2)),
    data.count,
  ]);

  const suffix = req.query.from || req.query.to ? `${req.query.from || 'inicio'}_a_${req.query.to || 'fim'}` : 'geral';
  await sendExport(res, req.query.format, `resumo-vendas_${suffix}`, 'Resumo por Dia', headers, rows);
});

router.get('/top-products', async (req, res) => {
  const from = parseDateParam(req.query.from, 'from');
  let to = parseDateParam(req.query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const limit = clampIntParam(req.query.limit, { min: 1, max: 50, fallback: 10 });

  const saleWhere = { canceled: false };
  if (from || to) saleWhere.createdAt = {};
  if (from) saleWhere.createdAt.gte = from;
  if (to) saleWhere.createdAt.lte = to;

  const items = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: { sale: saleWhere },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  res.json(
    items.map((i) => ({
      productId: i.productId,
      name: nameById.get(i.productId) || 'Produto removido',
      quantitySold: Number(i._sum.quantity),
      revenue: Number(i._sum.subtotal),
    })),
  );
});

router.get('/top-products/export', async (req, res) => {
  const from = parseDateParam(req.query.from, 'from');
  let to = parseDateParam(req.query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const limit = clampIntParam(req.query.limit, { min: 1, max: 50, fallback: 10 });

  const saleWhere = { canceled: false };
  if (from || to) saleWhere.createdAt = {};
  if (from) saleWhere.createdAt.gte = from;
  if (to) saleWhere.createdAt.lte = to;

  const items = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: { sale: saleWhere },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  const headers = ['Produto', 'Qtd Vendida', 'Faturamento (R$)'];
  const rows = items.map((i) => [
    nameById.get(i.productId) || 'Produto removido',
    Number(i._sum.quantity),
    Number(Number(i._sum.subtotal).toFixed(2)),
  ]);

  const suffix = req.query.from || req.query.to ? `${req.query.from || 'inicio'}_a_${req.query.to || 'fim'}` : 'geral';
  await sendExport(res, req.query.format, `mais-vendidos_${suffix}`, 'Mais Vendidos', headers, rows);
});

router.get('/slow-moving', async (req, res) => {
  const days = clampIntParam(req.query.days, { min: 1, max: 365, fallback: 60 });
  res.json(await getSlowMovingProducts(days));
});

router.get('/slow-moving/export', async (req, res) => {
  const days = clampIntParam(req.query.days, { min: 1, max: 365, fallback: 60 });
  const products = await getSlowMovingProducts(days);

  const headers = ['Produto', 'Estoque Atual', 'Capital Parado (R$)'];
  const rows = products.map((p) => [
    p.name,
    p.currentStock,
    p.capitalParado,
  ]);

  await sendExport(res, req.query.format, `produtos-parados_${days}dias`, 'Produtos Parados', headers, rows);
});

module.exports = router;
