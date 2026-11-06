-- Permissões por pessoa (dono marca o que cada funcionário pode fazer).
-- Contas existentes começam sem nenhuma: continuam só vendendo, como antes.
ALTER TABLE "User" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Produto cadastrado pelo estoque nasce sem preço ("aguardando preço").
ALTER TABLE "Product" ALTER COLUMN "costPrice" DROP NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "salePrice" DROP NOT NULL;
