# ADR-0015: Tornar a confirmação de venda idempotente com o cabeçalho `Idempotency-Key`

- **Status:** Aceito
- **Data:** 30/10/2026 (commit `7678571`; migration `20261030000000_add_sale_idempotency_key`)

## Contexto

Se a rede cai depois de o banco gravar a venda, mas antes de a resposta chegar ao caixa, a tela mostra erro. O caixa clica de novo e o sistema registrava **outra** venda, baixando o estoque duas vezes. Clique duplo tinha o mesmo efeito.

## Decisão

- A tela de vendas gera uma chave aleatória por carrinho e a envia no cabeçalho `Idempotency-Key`. Se a confirmação falhar e o carrinho não mudar, a próxima tentativa reenvia **a mesma** chave. Carrinho diferente gera chave nova.
- O servidor grava a chave em `Sale.idempotencyKey`, com índice único.
- Chegou uma chave já gravada, do mesmo usuário e com os mesmos itens e quantidades: responde 200 com a venda existente, sem tocar no estoque.
- Mesma chave com outro carrinho ou outro usuário: 422, para não esconder que a venda nova não foi registrada.
- Duas requisições simultâneas com a mesma chave: o índice único deixa uma gravar; a outra tem a transação inteira desfeita (estoque incluído) e responde com a venda que ficou.
- A chave é **opcional**: clientes que não a mandam continuam funcionando como antes.

## Consequências

- Ganha: rede instável no balcão não duplica venda nem estoque (três testes cobrem).
- Ganha: nenhuma tabela nova; uma coluna e um índice.
- Perde: a proteção depende de a tela reenviar a mesma chave; outro cliente da API precisa implementar o mesmo.
- Perde: as chaves ficam para sempre na tabela `Sale`; não há expiração.

## Alternativas consideradas

- Desabilitar o botão durante o envio: já existia, mas não resolve a queda de rede depois da gravação.
- Detectar duplicata por "mesmo carrinho nos últimos N segundos": daria falso positivo em duas vendas iguais e legítimas seguidas.
