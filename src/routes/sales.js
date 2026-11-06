const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../validate');
const httpError = require('../httpError');
const { authenticate } = require('../auth');
const { can, OWN_SALE_CANCEL_MINUTES } = require('../permissions');

// Quem tem "cancelar qualquer venda" cancela tudo; os demais só a própria,
// e só nos primeiros minutos depois de fechar.
function canCancelSale(user, sale, now = Date.now()) {
  if (can(user, 'sales.cancel')) return true;
  const ageMinutes = (now - new Date(sale.createdAt).getTime()) / 60_000;
  return sale.sellerId === user.sub && ageMinutes <= OWN_SALE_CANCEL_MINUTES;
}
const { parseDateParam, clampIntParam } = require('../queryHelpers');
const { applyStockDelta } = require('../stockOps');

const router = express.Router();
router.use(authenticate);

// Limite bem abaixo da capacidade da coluna Decimal(12,2) do banco
// (até 9.999.999.999,99). Mantém uma margem enorme de segurança: mesmo o
// pior caso (100 itens, cada um neste teto) nunca se aproxima do limite do
// tipo de dado, então uma venda jamais pode disparar um erro de overflow
// numérico no PostgreSQL — o limite de negócio é sempre atingido primeiro.
const MAX_SALE_TOTAL = 5_000_000;

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().finite().positive().max(10_000),
      }),
    )
    .min(1, 'A venda precisa de ao menos um item.')
    .max(100),
});

// O caixa gera uma chave por carrinho (cabeçalho Idempotency-Key) e a repete
// se a confirmação falhar no meio — rede caiu depois do banco gravar, clique
// duplo, nova tentativa. Sem isso cada repetição vira outra venda e baixa o
// estoque de novo. A chave é opcional para não quebrar outros clientes da API.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

const saleResponseInclude = { items: { include: { product: { select: { name: true, unit: true } } } } };

function toSaleResponse(sale) {
  return {
    id: sale.id,
    totalAmount: Number(sale.totalAmount),
    createdAt: sale.createdAt,
    itemCount: sale.items.length,
    items: sale.items.map((i) => ({
      product: i.product.name,
      unit: i.product.unit,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  };
}

function sameItems(sale, items) {
  const key = (productId, quantity) => `${productId}:${Number(quantity).toFixed(3)}`;
  const saved = sale.items.map((i) => key(i.productId, i.quantity)).sort();
  const requested = items.map((i) => key(i.productId, i.quantity)).sort();
  return saved.length === requested.length && saved.every((k, idx) => k === requested[idx]);
}

// Responde com a venda já gravada sob esta chave; false se ainda não existe.
// Mesma chave com outro carrinho (ou de outro usuário) é erro do cliente, não
// repetição: devolver a venda antiga esconderia que a nova nunca foi registrada.
async function replayExistingSale(idempotencyKey, req, res) {
  const existing = await prisma.sale.findUnique({ where: { idempotencyKey }, include: saleResponseInclude });
  if (!existing) return false;
  if (existing.sellerId !== req.user.sub || !sameItems(existing, req.body.items)) {
    throw httpError(422, 'Esta chave de idempotência já foi usada em outra venda.');
  }
  res.status(200).json(toSaleResponse(existing));
  return true;
}

router.post('/', validate(saleSchema), async (req, res) => {
  const { items } = req.body;

  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    throw httpError(400, 'Cabeçalho Idempotency-Key inválido: use de 8 a 100 letras, números, "-" ou "_".');
  }

  const productIds = items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw httpError(400, 'Itens duplicados na venda; agrupe as quantidades em um único item.');
  }

  if (idempotencyKey && await replayExistingSale(idempotencyKey, req, res)) return;

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({ data: { sellerId: req.user.sub, totalAmount: '0', idempotencyKey } });

    // Uma única consulta para todos os itens, em vez de um SELECT por item
    // dentro do laço (N+1). Numa venda de 20 itens isso troca 20 idas ao
    // banco por 1 só, encurtando a duração da transação — o que também
    // reduz o tempo que a linha de cada produto fica travada pelo UPDATE
    // atômico logo abaixo.
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    let total = 0;

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product || !product.active) throw httpError(404, 'Um dos produtos da venda não foi encontrado.');
      if (product.salePrice === null || product.costPrice === null) {
        throw httpError(409, `"${product.name}" ainda está aguardando preço e não pode ser vendido.`);
      }

      // UPDATE condicional atômico: só decrementa se houver saldo suficiente.
      // A checagem "currentStock >= quantity" é avaliada e aplicada pelo banco
      // dentro do mesmo statement/transação, o que evita venda com estoque
      // negativo mesmo sob concorrência (duas vendas simultâneas do mesmo item).
      const updateResult = await tx.product.updateMany({
        where: { id: item.productId, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (updateResult.count === 0) {
        throw httpError(409, `Estoque insuficiente para "${product.name}" (disponível: ${Number(product.currentStock)}).`);
      }

      const unitPrice = Number(product.salePrice);
      const subtotal = unitPrice * item.quantity;
      total += subtotal;
      // Barreira de segurança: nunca deixa o total computado em memória chegar
      // perto da capacidade da coluna numeric(12,2) do banco. Sem isso, uma
      // combinação extrema de preço × quantidade × itens estouraria a coluna
      // e o PostgreSQL rejeitaria o INSERT com um erro interno não tratado.
      if (subtotal > MAX_SALE_TOTAL || total > MAX_SALE_TOTAL) {
        throw httpError(400, 'O valor da venda excede o limite permitido pelo sistema.');
      }

      await tx.saleItem.create({
        data: {
          saleId: created.id,
          productId: item.productId,
          quantity: item.quantity.toFixed(3),
          unitPrice: unitPrice.toFixed(2),
          subtotal: subtotal.toFixed(2),
        },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: (-item.quantity).toFixed(3),
          previousStock: product.currentStock,
          newStock: (Number(product.currentStock) - item.quantity).toFixed(3),
          reason: 'Venda',
          userId: req.user.sub,
          saleId: created.id,
        },
      });
    }

    return tx.sale.update({
      where: { id: created.id },
      data: { totalAmount: total.toFixed(2) },
      include: saleResponseInclude,
    });
  }, { timeout: 15_000, maxWait: 5_000 }).catch((err) => {
    // Duas requisições com a mesma chave ao mesmo tempo passam pela consulta
    // acima, mas o índice único só deixa uma gravar; a outra é desfeita
    // inteira (estoque incluído) e responde com a venda que ficou.
    if (idempotencyKey && err.code === 'P2002') return null;
    throw err;
  });
  // Timeout maior que o padrão do Prisma (5s): uma venda com até 100 itens faz
  // várias consultas sequenciais por item dentro da mesma transação, e sob
  // carga isso poderia estourar o limite padrão e falhar sem necessidade.

  if (!sale) {
    if (await replayExistingSale(idempotencyKey, req, res)) return;
    throw httpError(409, 'Conflito ao registrar a venda; tente de novo.');
  }

  res.status(201).json(toSaleResponse(sale));
});

router.get('/', async (req, res) => {
  const page = clampIntParam(req.query.page, { min: 1, max: 1_000_000, fallback: 1 });
  const pageSize = clampIntParam(req.query.pageSize, { min: 1, max: 100, fallback: 20 });
  const from = parseDateParam(req.query.from, 'from');
  const to = parseDateParam(req.query.to, 'to');

  const where = { canceled: false };
  // Sem a permissão "ver as vendas de todos", a pessoa só enxerga as próprias.
  if (!can(req.user, 'sales.viewAll')) where.sellerId = req.user.sub;
  if (from || to) where.createdAt = {};
  if (from) where.createdAt.gte = from;
  if (to) where.createdAt.lte = to;

  const [sales, totalCount] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: { seller: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.sale.count({ where }),
  ]);

  res.json({
    totalCount,
    page,
    pageSize,
    sales: sales.map((s) => ({
      id: s.id,
      seller: s.seller.name,
      totalAmount: Number(s.totalAmount),
      itemCount: s._count.items,
      createdAt: s.createdAt,
      canCancel: canCancelSale(req.user, s),
    })),
  });
});

router.get('/:id', async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: { seller: { select: { name: true } }, items: { include: { product: { select: { name: true } } } } },
  });
  if (!sale) throw httpError(404, 'Venda não encontrada.');
  if (!can(req.user, 'sales.viewAll') && sale.sellerId !== req.user.sub) {
    throw httpError(403, 'Sem permissão para ver esta venda.');
  }

  res.json({
    id: sale.id,
    seller: sale.seller.name,
    totalAmount: Number(sale.totalAmount),
    canceled: sale.canceled,
    createdAt: sale.createdAt,
    items: sale.items.map((i) => ({
      product: i.product.name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  });
});

router.post('/:id/cancel', async (req, res) => {
  const sale = await prisma.$transaction(async (tx) => {
    const existing = await tx.sale.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!existing) throw httpError(404, 'Venda não encontrada.');
    if (!canCancelSale(req.user, existing)) {
      throw httpError(403, `Você só pode cancelar a sua própria venda até ${OWN_SALE_CANCEL_MINUTES} minutos depois de fechá-la.`);
    }
    if (existing.canceled) throw httpError(409, 'Venda já cancelada.');

    for (const item of existing.items) {
      // requireActive:false — a venda pode ter sido de um produto já
      // descontinuado; o estoque físico ainda precisa voltar mesmo assim.
      const { previousStock, newStock } = await applyStockDelta(tx, item.productId, Number(item.quantity), { requireActive: false });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'ADJUSTMENT',
          quantity: item.quantity,
          previousStock,
          newStock,
          reason: `Cancelamento da venda ${existing.id}`,
          userId: req.user.sub,
          saleId: existing.id,
        },
      });
    }

    return tx.sale.update({ where: { id: existing.id }, data: { canceled: true } });
  }, { timeout: 15_000, maxWait: 5_000 });

  res.json({ id: sale.id, canceled: sale.canceled });
});

module.exports = router;
