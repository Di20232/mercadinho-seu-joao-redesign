const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../validate');
const { authenticate, authorize } = require('../auth');
const { parseDateParam, parseEnumParam, clampIntParam } = require('../queryHelpers');
const { applyStockDelta } = require('../stockOps');
const { generateCsv, generateXlsx } = require('../exportService');

const router = express.Router();
// Movimentações de estoque (entradas de compra e ajustes/perdas) são
// exclusivas do dono/administrador, para manter um único responsável pelos números.
router.use(authenticate, authorize('ADMIN'));

const entrySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().finite().positive().max(1_000_000),
  reason: z.string().trim().max(255).optional().nullable(),
});

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z
    .number()
    .finite()
    .refine((v) => v !== 0, 'A quantidade não pode ser zero.')
    .refine((v) => Math.abs(v) <= 1_000_000),
  reason: z.string().trim().min(1).max(255),
  type: z.enum(['ADJUSTMENT', 'LOSS']).default('ADJUSTMENT'),
});

router.post('/entries', validate(entrySchema), async (req, res) => {
  const { productId, quantity, reason } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const { updated, previousStock, newStock } = await applyStockDelta(tx, productId, quantity);
    await tx.stockMovement.create({
      data: {
        productId,
        type: 'ENTRY',
        quantity: quantity.toFixed(3),
        previousStock,
        newStock,
        reason: reason || 'Entrada de estoque (compra)',
        userId: req.user.sub,
      },
    });
    return updated;
  });

  res.status(201).json({ productId: result.id, currentStock: Number(result.currentStock) });
});

router.post('/adjustments', validate(adjustmentSchema), async (req, res) => {
  const { productId, quantity, reason, type } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const { updated, previousStock, newStock } = await applyStockDelta(tx, productId, quantity);
    await tx.stockMovement.create({
      data: {
        productId,
        type,
        quantity: quantity.toFixed(3),
        previousStock,
        newStock,
        reason,
        userId: req.user.sub,
      },
    });
    return updated;
  });

  res.status(201).json({ productId: result.id, currentStock: Number(result.currentStock) });
});

const MOVEMENT_TYPES = ['ENTRY', 'SALE', 'ADJUSTMENT', 'LOSS'];

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

router.get('/movements', async (req, res) => {
  const { productId } = req.query;
  const type = parseEnumParam(req.query.type, MOVEMENT_TYPES, 'type');
  const from = parseDateParam(req.query.from, 'from');
  const to = parseDateParam(req.query.to, 'to');

  const where = {};
  if (productId) where.productId = String(productId);
  if (type) where.type = type;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;

  const include = { product: { select: { name: true } }, user: { select: { name: true } } };
  const serialize = (m) => ({
    id: m.id,
    product: m.product.name,
    type: m.type,
    quantity: Number(m.quantity),
    previousStock: Number(m.previousStock),
    newStock: Number(m.newStock),
    reason: m.reason,
    user: m.user.name,
    createdAt: m.createdAt,
  });

  const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;
  if (!paginated) {
    const movements = await prisma.stockMovement.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return res.json(movements.map(serialize));
  }

  const page = clampIntParam(req.query.page, { min: 1, max: 1_000_000, fallback: 1 });
  const pageSize = clampIntParam(req.query.pageSize, { min: 1, max: 100, fallback: 20 });
  const [movements, totalCount] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);
  res.json({ totalCount, page, pageSize, movements: movements.map(serialize) });
});

router.get('/movements/export', async (req, res) => {
  const { productId } = req.query;
  const type = parseEnumParam(req.query.type, MOVEMENT_TYPES, 'type');
  const from = parseDateParam(req.query.from, 'from');
  let to = parseDateParam(req.query.to, 'to');
  if (to) to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);

  const where = {};
  if (productId) where.productId = String(productId);
  if (type) where.type = type;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;

  const include = { product: { select: { name: true } }, user: { select: { name: true } } };
  const movements = await prisma.stockMovement.findMany({
    where,
    include,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const headers = ['Data/Hora', 'Produto', 'Tipo', 'Quantidade', 'Estoque Anterior', 'Novo Estoque', 'Motivo', 'Usuário'];
  const rows = movements.map((m) => [
    m.createdAt,
    m.product.name,
    m.type,
    Number(m.quantity),
    Number(m.previousStock),
    Number(m.newStock),
    m.reason || '',
    m.user.name,
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);
  await sendExport(res, req.query.format, `movimentacoes-estoque_${dateStr}`, 'Movimentações de Estoque', headers, rows);
});

module.exports = router;
