const express = require('express');
const prisma = require('../db');
const { authenticate } = require('../auth');
const { requirePermission } = require('../permissions');
const { getStockForecast, getSlowMovingProducts } = require('../forecast');
const { parseDateParam, clampIntParam } = require('../queryHelpers');
const { generateCsv, generateXlsx, generateWorkbook } = require('../exportService');

const router = express.Router();
router.use(authenticate, requirePermission('reports.view'));

// Filtro de vendas válidas no período; "até" inclui o dia inteiro.
function saleWhere(query) {
  const from = parseDateParam(query.from, 'from');
  let to = parseDateParam(query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  const where = { canceled: false };
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;
  return where;
}

async function salesByDay(where) {
  const sales = await prisma.sale.findMany({ where, select: { totalAmount: true, createdAt: true }, orderBy: { createdAt: 'asc' } });
  const byDay = {};
  let total = 0;
  for (const s of sales) {
    const day = s.createdAt.toISOString().slice(0, 10);
    byDay[day] = byDay[day] || { total: 0, count: 0 };
    byDay[day].total += Number(s.totalAmount);
    byDay[day].count += 1;
    total += Number(s.totalAmount);
  }
  return { total, count: sales.length, byDay };
}

async function topProducts(where, limit) {
  const items = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: { sale: where },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  return items.map((i) => ({
    productId: i.productId,
    name: nameById.get(i.productId) || 'Produto removido',
    quantitySold: Number(i._sum.quantity),
    revenue: Number(i._sum.subtotal),
  }));
}

const BY_DAY_HEADERS = ['Data', 'Total Vendido (R$)', 'Qtd Vendas'];
const byDayRows = (byDay) => Object.entries(byDay).map(([day, d]) => [day.split('-').reverse().join('/'), Number(d.total.toFixed(2)), d.count]);
const TOP_HEADERS = ['Produto', 'Qtd Vendida', 'Faturamento (R$)'];
const topRows = (items) => items.map((i) => [i.name, i.quantitySold, Number(i.revenue.toFixed(2))]);

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

const FORECAST_HEADERS = ['Produto', 'Unidade', 'Estoque Atual', 'Estoque Mínimo', 'Venda Média Diária (un/dia)', 'Dias até Esgotar', 'Abaixo do Mínimo'];
const forecastRows = (forecast) => forecast.map((p) => [
  p.name,
  p.unit,
  p.currentStock,
  p.minStock,
  p.avgDailySales,
  p.daysUntilStockout !== null ? p.daysUntilStockout : 'Sem consumo',
  p.lowStock ? 'SIM' : 'NÃO',
]);
const SLOW_HEADERS = ['Produto', 'Estoque Atual', 'Capital Parado (R$)'];
const slowRows = (products) => products.map((p) => [p.name, p.currentStock, p.capitalParado]);

router.get('/forecast/export', async (req, res) => {
  const headers = FORECAST_HEADERS;
  const rows = forecastRows(await getStockForecast());
  const dateStr = new Date().toISOString().slice(0, 10);
  await sendExport(res, req.query.format, `previsao-estoque_${dateStr}`, 'Previsão de Estoque', headers, rows);
});

router.get('/sales-summary', async (req, res) => {
  const { total, count, byDay } = await salesByDay(saleWhere(req.query));
  res.json({ total, count, byDay: Object.fromEntries(Object.entries(byDay).map(([day, d]) => [day, d.total])) });
});

router.get('/sales-summary/export', async (req, res) => {
  const { byDay } = await salesByDay(saleWhere(req.query));
  const headers = BY_DAY_HEADERS;
  const rows = byDayRows(byDay);

  const suffix = req.query.from || req.query.to ? `${req.query.from || 'inicio'}_a_${req.query.to || 'fim'}` : 'geral';
  await sendExport(res, req.query.format, `resumo-vendas_${suffix}`, 'Resumo por Dia', headers, rows);
});

router.get('/top-products', async (req, res) => {
  const limit = clampIntParam(req.query.limit, { min: 1, max: 50, fallback: 10 });
  res.json(await topProducts(saleWhere(req.query), limit));
});

router.get('/top-products/export', async (req, res) => {
  const limit = clampIntParam(req.query.limit, { min: 1, max: 50, fallback: 10 });
  const headers = TOP_HEADERS;
  const rows = topRows(await topProducts(saleWhere(req.query), limit));

  const suffix = req.query.from || req.query.to ? `${req.query.from || 'inicio'}_a_${req.query.to || 'fim'}` : 'geral';
  await sendExport(res, req.query.format, `mais-vendidos_${suffix}`, 'Mais Vendidos', headers, rows);
});

router.get('/slow-moving', async (req, res) => {
  const days = clampIntParam(req.query.days, { min: 1, max: 365, fallback: 60 });
  res.json(await getSlowMovingProducts(days));
});

router.get('/slow-moving/export', async (req, res) => {
  const days = clampIntParam(req.query.days, { min: 1, max: 365, fallback: 60 });
  const headers = SLOW_HEADERS;
  const rows = slowRows(await getSlowMovingProducts(days));

  await sendExport(res, req.query.format, `produtos-parados_${days}dias`, 'Produtos Parados', headers, rows);
});

// Planilha completa do período: um Excel com uma aba por relatório.
router.get('/export', async (req, res) => {
  const where = saleWhere(req.query);
  const [{ total, count, byDay }, top, slow, forecast] = await Promise.all([
    salesByDay(where), topProducts(where, 50), getSlowMovingProducts(60), getStockForecast(),
  ]);
  const { from, to } = req.query;
  const brDate = (value) => parseDateParam(value, 'data').toISOString().slice(0, 10).split('-').reverse().join('/');
  const period = from || to ? `${from ? brDate(from) : 'o início'} a ${to ? brDate(to) : 'hoje'}` : 'todo o período';
  const capital = slow.reduce((sum, p) => sum + p.capitalParado, 0);

  const summary = [
    ['Período', period],
    ['Total vendido (R$)', Number(total.toFixed(2))],
    ['Vendas', count],
    ['Ticket médio (R$)', count ? Number((total / count).toFixed(2)) : 0],
    ['Produtos parados há 60 dias', slow.length],
    ['Capital parado (R$)', Number(capital.toFixed(2))],
    ['Produtos abaixo do estoque mínimo', forecast.filter((p) => p.lowStock).length],
  ];
  const buffer = await generateWorkbook([
    { name: 'Resumo', headers: ['Indicador', 'Valor'], rows: summary },
    { name: 'Vendas por dia', headers: BY_DAY_HEADERS, rows: byDayRows(byDay) },
    { name: 'Mais vendidos', headers: TOP_HEADERS, rows: topRows(top) },
    { name: 'Produtos parados', headers: SLOW_HEADERS, rows: slowRows(slow) },
    { name: 'Previsão de estoque', headers: FORECAST_HEADERS, rows: forecastRows(forecast) },
  ]);

  const suffix = from || to ? `${from || 'inicio'}_a_${to || 'fim'}` : 'geral';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio_${suffix}.xlsx"`);
  res.send(buffer);
});

module.exports = router;
