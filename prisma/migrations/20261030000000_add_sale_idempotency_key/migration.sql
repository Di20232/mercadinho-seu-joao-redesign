-- Chave enviada pelo caixa (cabeçalho Idempotency-Key) para que repetir a
-- mesma confirmação de venda devolva a venda já criada em vez de duplicá-la.
-- Opcional: vendas antigas e clientes que não enviam a chave ficam com NULL.
ALTER TABLE "Sale" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "Sale"("idempotencyKey");
