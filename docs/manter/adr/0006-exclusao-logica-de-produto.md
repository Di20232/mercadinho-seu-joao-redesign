# ADR-0006: Nunca apagar produto, só desativar

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `5a358a3`). A reativação pela tela e pela API veio depois, na auditoria de qualidade.

## Contexto

Vendas e movimentações apontam para o produto por chave estrangeira. Apagar o produto apagaria ou quebraria o histórico, e o histórico é a auditoria do estoque.

## Decisão

`DELETE /api/products/:id` grava `active = false`. Produto inativo não entra em venda nova, some da listagem e do detalhe para o caixa, e continua visível para o admin, que pode reativar (`PUT` com `active: true`). As chaves estrangeiras de `SaleItem` e `StockMovement` são `RESTRICT`: o banco impede apagar um produto com histórico.

## Consequências

- Ganha: relatórios e histórico continuam completos; reativar é um clique.
- Ganha: cancelar uma venda de produto já desativado ainda devolve o estoque físico.
- Perde: o código de barras de um produto inativo continua ocupado; para reaproveitá-lo é preciso editar o inativo.
- Perde: o catálogo cresce para sempre. Não há rotina de arquivamento.

## Alternativas consideradas

- Apagar de verdade com `ON DELETE CASCADE`: perde o histórico.
- Copiar nome e preço para cada item de venda e permitir apagar: duplica dados e não resolve as movimentações.
