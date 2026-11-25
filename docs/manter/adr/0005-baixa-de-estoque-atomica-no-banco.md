# ADR-0005: Mudar o estoque com UPDATE condicional atômico, nunca com "ler, calcular e gravar"

- **Status:** Aceito. Complementado pelo [ADR-0017](0017-travar-produtos-da-venda-em-ordem.md): desde 24/11/2026 a venda também trava os produtos em ordem fixa antes de ler o saldo.
- **Data:** 27/08/2026 (commits `5a358a3` e `0dd5eaf`)

## Contexto

Duas vendas ou duas entradas simultâneas no mesmo produto podem ler o mesmo saldo, cada uma calcular o seu "depois" e a segunda gravar por cima da primeira. O comentário em `src/stockOps.js` registra o teste feito ao vivo: 30 entradas simultâneas de +1 resultaram em estoque 16, não 30, com as 30 movimentações gravadas. O extrato dizia uma coisa e o saldo, outra.

## Decisão

- Venda: `UPDATE ... SET currentStock = currentStock - q WHERE id = ? AND currentStock >= q`. Zero linhas atualizadas significa estoque insuficiente, e a transação inteira volta (`src/routes/sales.js`).
- Entradas, perdas, ajustes, devolução por cancelamento e importação: `applyStockDelta` (`src/stockOps.js`), com `increment` feito pelo banco e um `WHERE` que mantém o resultado entre 0 e 50.000.000.
- O saldo anterior e o novo da movimentação são lidos dentro da mesma transação, depois do UPDATE.

## Consequências

- Ganha: estoque nunca fica negativo e nunca perde atualização, provado pelos testes de corrida.
- Ganha: o histórico de movimentações bate com o saldo.
- Perde: a mensagem "Estoque insuficiente ... (disponível: N)" usa o saldo lido antes do UPDATE; sob concorrência, o número mostrado pode estar um pouco velho.
- Perde: toda rota nova que mexer em estoque precisa usar `applyStockDelta`. Gravar `currentStock` direto reintroduz o bug.

## Alternativas consideradas

- `SELECT ... FOR UPDATE`: resolve, mas trava a linha por mais tempo e o Prisma não oferece isso sem SQL cru.
- Nível de isolamento `SERIALIZABLE`: exigiria repetir transações que falham por conflito.
