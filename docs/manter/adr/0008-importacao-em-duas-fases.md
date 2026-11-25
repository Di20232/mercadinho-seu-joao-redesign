# ADR-0008: Importar planilha em duas fases, com uma transação por linha

- **Status:** Aceito
- **Data:** 08/09/2026 (commit `e0824f8`)

## Contexto

Importar centenas de produtos de uma vez reescreve preços e saldos. Um erro de coluna (ex.: estoque lido no lugar do preço) estragaria o cadastro inteiro. Planilhas reais trazem valores "como gente escreve" (R$ 12,50; 31/12/2026), cabeçalhos variados e linhas com problema no meio.

## Decisão

- **Fase 1, sem gravar:** `parse` lê o arquivo e devolve a grade e o palpite das colunas; `preview` roda `analyze()` e devolve o plano linha a linha (criar, atualizar, ignorar, erro, com antes e depois).
- **Fase 2, gravar:** `commit` roda **o mesmo** `analyze()` sobre a mesma grade e grava cada linha na **própria transação**, com a movimentação de estoque junto.
- A grade fica no navegador entre as fases; o servidor não guarda estado da importação.
- A análise recusa: código de barras que já é de outro produto, duplicatas no arquivo, nome ambíguo, estoque resultante negativo.

## Consequências

- Ganha: o que o usuário aprova é exatamente o que é gravado.
- Ganha: uma linha ruim não desfaz as outras; o resultado lista as que falharam e por quê.
- Perde: a importação não é "tudo ou nada". Se cair no meio, parte fica gravada (o relatório final diz o quê).
- Perde: entre a prévia e a confirmação outra sessão pode mudar o cadastro; o `commit` reanalisa e trata a corrida de código de barras como falha da linha.
- Perde: a grade volta ao servidor a cada prévia, por isso o limite de corpo dessa rota é 4 MB (o resto da API fica em 100 kB).

## Alternativas consideradas

- Uma transação para o arquivo inteiro: um erro na linha 900 desfaria 899 linhas boas.
- Guardar o arquivo no servidor entre as fases: exigiria armazenamento e limpeza.
