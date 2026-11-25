# ADR-0011: Prever esgotamento pela média simples de vendas, sem modelo estatístico

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `5a358a3`)

## Contexto

O dono deixava faltar o que mais vendia. Ele precisa de um aviso antecipado que entenda e em que confie. O histórico de vendas de um mercadinho novo no sistema é curto.

## Decisão

Média diária = soma das saídas por venda (`StockMovement` tipo `SALE`) nos últimos `FORECAST_WINDOW_DAYS` dias (padrão 30) ÷ número de dias. Dias até esgotar = estoque ÷ média. "Vai acabar em 7 dias" = previsão ≤ 7 e ainda não abaixo do mínimo. Código em `src/forecast.js`.

## Consequências

- Ganha: cálculo transparente, explicável em uma frase ([glossário](../../usar/glossario.md#previsão-de-esgotamento)).
- Ganha: duas consultas para o catálogo inteiro.
- Perde: ignora sazonalidade, tendência e dia da semana.
- Perde: produto novo, com poucos dias de venda, aparece com média baixa, porque a divisão é sempre pelos 30 dias da janela.
- Perde: vendas canceladas continuam na média, porque o cancelamento entra como `ADJUSTMENT` e o `SALE` original permanece (dívida DT-04).

## Alternativas consideradas

- Média móvel ponderada ou modelo de série temporal: mais preciso, menos explicável, e o volume de dados não justifica.
