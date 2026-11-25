const { Prisma } = require('@prisma/client');
const httpError = require('./httpError');

// Bem abaixo da capacidade da coluna Decimal(12,3) (~999.999.999,999) —
// impede que somas repetidas eventualmente estourem a coluna.
const MAX_STOCK = 50_000_000;

// Aplica um delta ao estoque de forma atômica: um UPDATE condicional cujo
// WHERE já garante que o resultado fica dentro de [0, MAX_STOCK], usando
// `increment` (a soma é feita pelo próprio banco, nunca "ler em JS e
// escrever de volta um valor absoluto"). Sem isso, duas requisições
// concorrentes para o mesmo produto podem ler o mesmo valor "antes", cada
// uma calcular seu próprio "depois" e a segunda escrita sobrescrever
// silenciosamente a primeira — um "lost update" clássico. Reproduzido ao
// vivo: 30 entradas simultâneas de +1 no mesmo produto resultavam num
// estoque final de 16 em vez de 30, com as 30 movimentações de auditoria
// registradas mesmo assim — o extrato dizia uma coisa, o saldo real dizia outra.
//
// Usado por toda rota que soma/subtrai de Product.currentStock fora da
// venda em si (que já usa o mesmo tipo de UPDATE condicional): entradas de
// estoque, ajustes/perdas, e devolução de estoque ao cancelar uma venda.
//
// `requireActive` é true por padrão (entradas/ajustes são ações deliberadas
// sobre um produto presumivelmente ativo), mas o cancelamento de venda passa
// `false`: se o produto foi descontinuado depois da venda, cancelar a venda
// ainda precisa devolver o estoque físico — a mercadoria existe fisicamente
// independente do produto estar ou não à venda no momento do cancelamento.
async function applyStockDelta(tx, productId, quantity, { notFoundMessage = 'Produto não encontrado.', requireActive = true } = {}) {
  const bound = quantity >= 0 ? { lte: (MAX_STOCK - quantity).toFixed(3) } : { gte: (-quantity).toFixed(3) };
  const updateResult = await tx.product.updateMany({
    where: { id: productId, ...(requireActive ? { active: true } : {}), currentStock: bound },
    data: { currentStock: { increment: quantity } },
  });
  if (updateResult.count === 0) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || (requireActive && !product.active)) throw httpError(404, notFoundMessage);
    throw httpError(400, quantity < 0 ? 'Essa operação deixaria o estoque negativo.' : 'Essa operação deixaria o estoque acima do limite permitido pelo sistema.');
  }
  // Novo valor lido dentro da MESMA transação: reflete com exatidão o que a
  // própria transação acabou de gravar, mesmo que outras transações
  // concorrentes ainda não enxerguem essa mudança.
  const updated = await tx.product.findUnique({ where: { id: productId } });
  const newStock = Number(updated.currentStock);
  const previousStock = (newStock - quantity).toFixed(3);
  return { updated, previousStock, newStock: newStock.toFixed(3) };
}

// Trava as linhas de vários produtos de uma vez, SEMPRE na mesma ordem (a do
// próprio banco, por id), antes de a transação mexer em qualquer uma delas.
//
// Sem isso, a venda travava os produtos na ordem do carrinho: uma venda
// travava o arroz e esperava o feijão enquanto outra, ao mesmo tempo, travava
// o feijão e esperava o arroz. O PostgreSQL acusava deadlock, derrubava uma
// das duas e o caixa recebia erro 500 (5 vezes no teste de carga de
// 24/11/2026, e possível na loja com só dois caixas). Com todo mundo pedindo
// as travas na mesma ordem, um espera o outro terminar e o impasse não existe.
//
// Toda rota que mexe em mais de um produto na mesma transação (venda e
// cancelamento de venda) chama isto primeiro, pela MESMA consulta: a ordem é
// definida pelo banco, então não depende de como o JavaScript ordena textos.
// Como as linhas ficam travadas até o fim da transação, uma leitura feita
// depois disto enxerga o saldo de verdade, que ninguém mais consegue mudar.
async function lockProducts(tx, productIds) {
  if (productIds.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`;
}

module.exports = { MAX_STOCK, applyStockDelta, lockProducts };
