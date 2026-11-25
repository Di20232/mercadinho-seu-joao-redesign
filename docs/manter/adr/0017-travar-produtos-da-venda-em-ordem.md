# ADR-0017: Travar os produtos da venda de uma vez, em ordem fixa, antes de ler o saldo

- **Status:** Aceito. Complementa o [ADR-0005](0005-baixa-de-estoque-atomica-no-banco.md), que rejeitava `SELECT ... FOR UPDATE`.
- **Data:** 24/11/2026 (commit `50d7eef`, PR #8)

## Contexto

O ADR-0005 resolveu o estoque negativo com o UPDATE condicional, mas o teste de carga de 24/11/2026 achou dois problemas que ele não cobre:

- **Impasse (deadlock).** Cada venda travava os produtos na ordem do carrinho. Uma venda travava o arroz e esperava o feijão; outra, ao mesmo tempo, travava o feijão e esperava o arroz. O PostgreSQL derrubava uma das duas e o caixa recebia erro 500. Aconteceu 5 vezes no teste de carga, e pode acontecer na loja com só dois caixas.
- **Histórico errado.** O saldo era lido antes da trava; vendas simultâneas do mesmo produto gravavam todas "5→4" no histórico, embora o saldo final estivesse certo.

## Decisão

- `lockProducts(tx, ids)` (`src/stockOps.js`) roda `SELECT id FROM "Product" WHERE id IN (...) ORDER BY id FOR UPDATE` no começo da transação da venda e do cancelamento. A ordem vem do banco, igual para todos.
- Só depois disso a venda lê os produtos; como as linhas estão travadas até o commit, o saldo lido é o de verdade e vai para `previousStock`/`newStock` do histórico.
- O UPDATE condicional `currentStock >= quantidade` continua como segunda barreira.
- Toda rota futura que mexer em mais de um produto na mesma transação chama `lockProducts` primeiro.

## Consequências

- Ganha: nenhum impasse entre vendas e cancelamentos com os mesmos produtos; histórico com saldos em sequência (dois testes cobrem).
- Perde: vendas com produto em comum passam a esperar umas pelas outras (milissegundos no volume de um mercadinho).
- Perde: a trava usa `$queryRaw`; quem trocar de banco precisa de um equivalente a `FOR UPDATE`.

## Alternativas consideradas

- Repetir a transação ao detectar deadlock: tira o 500, mas mantém o histórico errado e gasta trabalho à toa.
- Nível de isolamento `SERIALIZABLE`: mesmo problema das repetições, com mais falsos conflitos.
