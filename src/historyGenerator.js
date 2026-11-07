// Gera um histórico realista de vendas, entradas e perdas, sem tocar no banco.
//
// O histórico é montado DE TRÁS PARA FRENTE a partir do estoque "âncora" de
// cada produto (o saldo que ele tem hoje): uma venda vista de trás para frente
// só AUMENTA o saldo anterior, então nunca há estoque negativo; quando o saldo
// anterior fica alto demais, entra uma compra de fornecedor antes dela. Assim
// o histórico termina exatamente no saldo atual e cada movimentação fecha
// (anterior + quantidade = novo). Quantidades em milésimos e dinheiro em
// centavos (inteiros), para não acumular erro de ponto flutuante.
const crypto = require('crypto');

const DAY = 24 * 60 * 60 * 1000;
const HOUR_WEIGHTS = [[7, 2], [8, 5], [9, 7], [10, 8], [11, 10], [12, 11], [13, 9], [14, 6], [15, 6], [16, 7], [17, 10], [18, 11], [19, 8], [20, 4]];
const WEEKDAY = [0.6, 0.85, 0.9, 0.95, 1, 1.15, 1.35]; // domingo..sábado
const MONTH = [0.9, 0.92, 1, 1, 1, 1, 1.05, 1, 1, 1, 1.05, 1.35]; // jan..dez
const PERISHABLE = /latic|frio|padar|horti|carne|congel|ovo|leite|pão/i;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(rng, cumulative, total) {
  const x = rng() * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * products: [{ id, unit, category, salePriceCents, minStockMilli, anchorMilli, endAt: Date, weight? }]
 * Retorna { sales, movements } prontos para gravar.
 */
function buildHistory({ products, start, end, sellers, stockUserId, cancelUserId, salesPerDay = 60, seed = 1 }) {
  const rng = mulberry32(seed);
  const between = (a, b) => a + rng() * (b - a);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const hourTotal = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const hourCum = HOUR_WEIGHTS.reduce((acc, [, w]) => [...acc, (acc.at(-1) || 0) + w], []);
  const sellerCum = sellers.reduce((acc, s) => [...acc, (acc.at(-1) || 0) + s.weight], []);
  const sellerTotal = sellerCum.at(-1);

  // Popularidade em ordem aleatória; alguns produtos "morrem" (param de vender) para
  // aparecerem no relatório de produtos parados.
  const order = [...products].sort(() => rng() - 0.5);
  const state = new Map(order.map((p, rank) => [p.id, {
    p,
    // `p.weight` vem das vendas que o produto já tem, para um período novo seguir o mesmo ritmo.
    weight: p.weight > 0 ? p.weight : 1 / Math.pow(rank + 3, 0.85),
    deadFrom: rng() < 0.06 ? end.getTime() - between(65, 200) * DAY : Infinity,
    perishable: PERISHABLE.test(p.category || ''),
    events: [],
  }]));

  const sales = [];
  const totalDays = Math.round((end - start) / DAY);

  for (let d = 0; d < totalDays; d += 1) {
    const dayStart = start.getTime() + d * DAY;
    const date = new Date(dayStart);
    const yearsBack = (end - dayStart) / (365 * DAY);
    const alive = [...state.values()].filter((s) => s.p.endAt.getTime() > dayStart + DAY && s.deadFrom > dayStart + DAY);
    if (alive.length === 0) continue;
    const cum = [];
    alive.reduce((acc, s) => { cum.push(acc + s.weight); return acc + s.weight; }, 0);
    const cumTotal = cum.at(-1);

    // Movimento do dia: dia da semana, mês do ano e crescimento ao longo dos 2 anos.
    const mean = salesPerDay * WEEKDAY[date.getDay()] * MONTH[date.getMonth()] * (0.85 + 0.25 * (d / totalDays));
    const count = Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss()));

    for (let i = 0; i < count; i += 1) {
      const hour = HOUR_WEIGHTS[weightedPick(rng, hourCum, hourTotal)][0];
      const at = new Date(dayStart + hour * 3600000 + Math.floor(rng() * 3600000));
      const size = Math.min(12, 1 + Math.floor(-Math.log(1 - rng()) * 2.2));
      const picked = new Set();
      for (let k = 0; k < size; k += 1) picked.add(alive[weightedPick(rng, cum, cumTotal)]);

      const sale = { id: crypto.randomUUID(), createdAt: at, sellerId: sellers[weightedPick(rng, sellerCum, sellerTotal)].id, canceled: false, items: [] };
      // Preço muda por trimestre, ~5,5% ao ano de inflação.
      const priceFactor = Math.pow(1.055, -Math.floor(yearsBack * 4) / 4);
      for (const s of picked) {
        const r = rng();
        const qty = s.p.unit === 'KG'
          ? Math.round(between(0.25, 2.5) * 20) * 50
          : (r < 0.72 ? 1 : r < 0.92 ? 2 : 3 + Math.floor(rng() * 4)) * 1000;
        const unitCents = Math.max(1, Math.round(s.p.salePriceCents * priceFactor));
        sale.items.push({ productId: s.p.id, qtyMilli: qty, unitCents, subtotalCents: Math.round((unitCents * qty) / 1000) });
      }
      if (sale.items.length === 1 && rng() < 0.03) sale.canceled = true; // só carrinhos de 1 item são cancelados
      for (const item of sale.items) {
        state.get(item.productId).events.push({ t: at.getTime(), kind: sale.canceled ? 'CANCEL' : 'SALE', q: item.qtyMilli, sale });
      }
      sales.push(sale);
    }

    // Perdas: perecíveis perdem com frequência, os demais quase nunca.
    for (const s of alive) {
      if (rng() >= (s.perishable ? 0.02 : 0.0015)) continue;
      const q = s.p.unit === 'KG' ? Math.round(between(0.3, 2) * 20) * 50 : (1 + Math.floor(rng() * 4)) * 1000;
      const reasons = s.perishable ? ['Produto vencido', 'Estragado na exposição', 'Avariado no transporte'] : ['Embalagem danificada', 'Quebra no estoque'];
      s.events.push({ t: dayStart + (8 + rng() * 2) * 3600000, kind: 'LOSS', q, reason: reasons[Math.floor(rng() * reasons.length)] });
    }
  }

  const movements = [];
  for (const s of state.values()) {
    const ev = s.events.sort((a, b) => b.t - a.t); // do mais novo para o mais antigo
    const aliveDays = Math.max(1, (Math.min(s.p.endAt.getTime(), s.deadFrom) - start.getTime()) / DAY);
    const daily = ev.reduce((sum, e) => sum + e.q, 0) / aliveDays;
    const min = s.p.minStockMilli > 0 ? s.p.minStockMilli : Math.max(1000, daily * 3);
    const target = Math.max(min * 3, min + daily * between(14, 30));

    // Passada de trás para frente: decide o saldo antes de cada evento e onde entram as compras.
    let stock = s.p.anchorMilli;
    const forward = [];
    for (let i = 0; i < ev.length; i += 1) {
      const e = ev[i];
      if (e.kind === 'CANCEL' && stock < e.q) {
        e.kind = 'SALE'; // sem saldo para a venda acontecer e ser desfeita: fica como venda normal
        e.sale.canceled = false;
      }
      if (e.kind !== 'CANCEL') stock += e.q;
      forward.push(e);
      if (stock >= target) {
        const older = i + 1 < ev.length ? ev[i + 1].t : start.getTime();
        const step = s.p.unit === 'KG' ? 50 : 1000; // produto por unidade nunca fica com fração
        const reorder = Math.round((min * between(0.2, 1)) / step) * step;
        forward.push({ t: Math.round(e.t - (e.t - older) * between(0.1, 0.9)), kind: 'ENTRY', q: stock - reorder, reason: 'Compra de fornecedor' });
        stock = reorder;
      }
    }
    if (stock > 0) forward.push({ t: start.getTime() - 3600000, kind: 'ENTRY', q: stock, reason: 'Estoque inicial' });

    // Passada para frente: grava saldo anterior e novo de cada movimentação.
    let bal = 0;
    for (const e of forward.reverse()) {
      const base = { productId: s.p.id, createdAt: new Date(e.t) };
      if (e.kind === 'ENTRY') {
        movements.push({ ...base, type: 'ENTRY', qty: e.q, prev: bal, next: bal + e.q, reason: e.reason, userId: stockUserId });
        bal += e.q;
      } else if (e.kind === 'LOSS') {
        movements.push({ ...base, type: 'LOSS', qty: -e.q, prev: bal, next: bal - e.q, reason: e.reason, userId: stockUserId });
        bal -= e.q;
      } else {
        movements.push({ ...base, type: 'SALE', qty: -e.q, prev: bal, next: bal - e.q, reason: 'Venda', userId: e.sale.sellerId, saleId: e.sale.id });
        if (e.kind === 'CANCEL') {
          movements.push({ ...base, createdAt: new Date(e.t + 1000), type: 'ADJUSTMENT', qty: e.q, prev: bal - e.q, next: bal, reason: `Cancelamento da venda ${e.sale.id}`, userId: cancelUserId, saleId: e.sale.id });
        } else {
          bal -= e.q;
        }
      }
      if (bal < 0) throw new Error(`estoque negativo gerado para ${s.p.id}`);
    }
    if (bal !== s.p.anchorMilli) throw new Error(`histórico de ${s.p.id} não fecha: ${bal} != ${s.p.anchorMilli}`);
  }

  return { sales, movements };
}

module.exports = { buildHistory };
