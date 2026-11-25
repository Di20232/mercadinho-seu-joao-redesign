# ADR-0016: Permitir produto sem preço ("aguardando preço") e proibir a venda dele

- **Status:** Aceito
- **Data:** 06/11/2026 (commit `3d54ef3`; migration `20261106000000_add_user_permissions_and_pending_price`)

## Contexto

Com as permissões por pessoa ([ADR-0014](0014-permissoes-por-pessoa.md)), quem recebe a mercadoria (estoque) precisa cadastrar o produto novo na hora, mas não deve definir preço nem ver custo. Até então, `costPrice` e `salePrice` eram obrigatórios no banco e na API.

## Decisão

- `Product.costPrice` e `Product.salePrice` passam a aceitar nulo.
- Quem não tem `prices.manage` cria e edita produto **sem** preço. Mandar qualquer campo de preço, mesmo nulo, dá 403.
- Produto com qualquer um dos dois preços nulo está **aguardando preço** (`pricePending: true` na API).
- Produto aguardando preço não é vendido (409 com o nome do produto) e a tela de vendas o tira da busca.
- Quem tem `prices.manage` recebe a lista no painel e o filtro em Produtos, e define o preço pela edição normal.

## Consequências

- Ganha: o estoque não trava esperando o dono para cadastrar.
- Ganha: nenhum produto entra no caixa com preço zero ou inventado.
- Perde: todo código que lê preço precisa tratar nulo (`serializeProduct`, `forecast.js` no capital parado, exportações). Um `Number(null)` silencioso vira 0.
- Perde: quem tem `prices.manage` pode, pela API, voltar um preço a nulo; a tela não oferece isso.

## Alternativas consideradas

- Preço provisório zero: o produto poderia ser vendido de graça por engano.
- Fila de "produtos propostos" separada do catálogo: mais uma entidade e mais uma tela para o mesmo resultado.
