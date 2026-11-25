# ADR-0002: Usar PostgreSQL com Prisma e guardar dinheiro e quantidade em `Decimal`

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `5a358a3`)

## Contexto

Venda e estoque precisam de transação: ou a venda inteira entra, com a baixa de cada item, ou nada entra. Valores em dinheiro não podem sofrer erro de ponto flutuante. A hospedagem precisa ter opção gratuita ou barata.

## Decisão

PostgreSQL como banco e Prisma como ORM e ferramenta de migrations. Preços e totais em `Decimal(12,2)`; quantidades e estoque em `Decimal(12,3)`, para permitir venda a peso.

## Consequências

- Ganha: transações ACID; PostgreSQL gerenciado gratuito em vários provedores (Neon, Supabase, Render).
- Ganha: Prisma parametriza toda consulta, o que elimina injeção de SQL por construção; migrations versionadas em `prisma/migrations/`.
- Ganha: `Decimal` evita centavos perdidos.
- Perde: o Prisma não compara coluna com coluna no `where` (ex.: `currentStock <= minStock`), então o filtro de estoque baixo é feito em memória (`src/routes/products.js`). Aceitável para centenas de produtos.
- Perde: a API converte `Decimal` em `number` na resposta; cálculos no Node (ex.: total da venda) usam ponto flutuante antes do `toFixed(2)`. Os limites de valor (RN-04) mantêm o erro irrelevante.
- Perde: o Prisma 5 já está duas versões maiores atrás (ver [dependências](../../evoluir/dependencias.md)).

## Alternativas consideradas

- SQLite: mais simples, mas fraco em escrita concorrente e raro como serviço gerenciado.
- SQL escrito à mão: mais controle, mais risco de injeção e mais código.
