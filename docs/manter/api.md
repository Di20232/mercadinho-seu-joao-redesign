# Contratos da API

API REST em JSON, servida pelo mesmo processo que serve as telas. Especificação completa e navegável em [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0, 38 operações). Este documento resume as convenções e lista as rotas.

O sistema não publica eventos nem mensagens assíncronas. A única saída fora do HTTP é o e-mail (link de nova senha e alerta diário).

## Convenções

| Tema | Regra |
|---|---|
| Base | `/api` na mesma origem das telas (ex.: `http://localhost:3100/api`) |
| Formato | `application/json` nos dois sentidos. Exceções: upload de planilha (`multipart/form-data`) e exportações (CSV ou XLSX) |
| Autenticação | Cookie `mj_token` (JWT), definido por `POST /api/auth/login` e `/auto-login` (o `/register` não abre sessão). Sem cookie válido: **401** |
| CSRF | Todo `POST`, `PUT`, `PATCH` e `DELETE` precisa do cabeçalho `X-Requested-With: fetch`. Sem ele: **403** "Requisição bloqueada." |
| Autorização | Por permissão ([lista](requisitos-e-regras.md#permissões)). O dono (`ADMIN`) tem todas. Sem a permissão: **403** "Sem permissão para executar esta ação." |
| CORS | Aceita a própria origem e as de `CLIENT_ORIGIN`, com credenciais. Cabeçalhos aceitos: `Content-Type`, `Authorization`, `X-Requested-With`, `Idempotency-Key` |
| Tamanho do corpo | 100 kB; rotas `/api/imports/*` aceitam 4 MB de JSON e arquivo de até 5 MB |
| Números | `Decimal` do banco sai como `number`; preço de produto aguardando preço sai `null` |
| Datas | ISO 8601 em UTC na resposta. Filtros `from` e `to` aceitam `AAAA-MM-DD` (meia-noite UTC). Nos relatórios e nas exportações o `to` inclui o dia inteiro; em `GET /api/sales` e `GET /api/stock/movements`, não: `to=2026-11-20` para na meia-noite do dia 20 (dívida DT-15) |
| Paginação | `page` (≥ 1) e `pageSize` (1 a 100, padrão 20). A resposta paginada traz `totalCount`, `page`, `pageSize` e a lista |
| IDs | UUID |

### Erros

Todo erro responde `{ "error": "mensagem em português" }`. Erros de validação do corpo trazem também `details` (saída do Zod).

| Status | Quando |
|---|---|
| 400 | Validação, parâmetro inválido, `Idempotency-Key` malformada, regra de negócio (ex.: estoque ficaria negativo num ajuste) |
| 401 | Sem sessão, sessão expirada, conta desativada, senha trocada; login errado |
| 403 | Login de conta desativada com a senha certa; falta `X-Requested-With`; falta permissão; venda de outra pessoa; cancelamento fora do prazo de 10 minutos; preço enviado por quem não define preços; auto-login com conta que não é caixa puro |
| 404 | Recurso não existe ou está inativo para quem não cadastra produtos; rota desconhecida ("Não encontrado.") |
| 409 | Estoque insuficiente; produto aguardando preço na venda; venda já cancelada; e-mail ou código de barras já cadastrado; conflito raro entre duas confirmações |
| 422 | `Idempotency-Key` já usada em outra venda (outro carrinho ou outro usuário) |
| 429 | Limite de requisições estourado |
| 500 | Falha inesperada: sempre "Erro interno do servidor.", detalhe só no log |
| 503 | Auto-login ligado sem credenciais configuradas |

### Limites de requisição

Contados por IP, em memória (reiniciar o processo zera).

| Rotas | Limite |
|---|---|
| Toda a `/api` | 300 por minuto (`API_RATE_LIMIT_MAX`) |
| `POST /api/auth/login` | 10 a cada 15 min |
| `POST /api/auth/register` | 5 por hora |
| `POST /api/auth/forgot-password` | 5 a cada 15 min |
| `POST /api/auth/reset-password` | 10 a cada 15 min |
| `POST /api/auth/auto-login` | 10 a cada 15 min |

Com `NODE_ENV=test`, só o limite geral continua valendo.

## Rotas

Coluna "Acesso": **público** (sem sessão), **logado** (qualquer pessoa), o nome da permissão, ou **dono** (só `ADMIN`). "A ou B" = basta uma das duas.

### Autenticação: `/api/auth`

| Método e rota | Acesso | Corpo | Resposta |
|---|---|---|---|
| `POST /login` | público | `{ login, password }` (`login` = e-mail ou usuário; `email` é aceito como apelido de `login`) | 200 `{ id, name, email, username, role }` + cookie. 401 "Login incorreto." (não existe, ou conta desativada com senha errada) ou "Senha incorreta.". 403 com mensagem própria para conta desativada com a senha certa |
| `POST /register` | público | `{ name, email, password }` (nenhum outro campo) | 201 `{ id, name, email, username, role, active: false, message }`: conta `CASHIER` sem permissões e **desativada**, **sem cookie**. Entra depois que o dono liga a conta. 409 se o e-mail existe |
| `POST /forgot-password` | público | `{ email }` | 200 sempre com a mesma `message`, exista o e-mail ou não |
| `POST /reset-password` | público | `{ token, password }` | 200 `{ message }`. 400 link inválido, expirado ou usado |
| `POST /auto-login` | público | nenhum | 200 + cookie, só com `AUTO_LOGIN_ENABLED=true` fora de produção e conta `CASHIER` sem permissões. 404 se desligado |
| `POST /logout` | público | nenhum | 200 `{ ok: true }`, apaga o cookie |
| `GET /me` | logado | | 200 `{ id, name, email, username, role, permissions, active }`. `permissions` já é a lista **efetiva** (o dono recebe todas) |

### Produtos: `/api/products`

| Método e rota | Acesso | Observação |
|---|---|---|
| `GET /` | logado | Filtros `query` (parte do nome, ignorando acento e maiúsculas), `category`, `lowStock=true`, `pricePending=true`, `includeInactive=true` (só `products.manage` ou `prices.manage`). Sem `page`/`pageSize` devolve a **lista inteira**; com eles, `{ totalCount, page, pageSize, products }`. Cada produto traz `pricePending`; `costPrice` e `margin` só para `prices.manage` |
| `GET /{id}` | logado | 404 para quem não cadastra produtos se o produto estiver inativo |
| `POST /` | `products.manage` ou `prices.manage` | `{ name, barcode?, category?, unit?, minStock?, initialStock?, expiryDate?, salePrice?, costPrice? }`. Preços só com `prices.manage` (senão 403); sem preço, nasce aguardando preço. `expiryDate` em `AAAA-MM-DD`. 201 |
| `PUT /{id}` | `products.manage` ou `prices.manage` | Mesmos campos, todos opcionais, mais `active`; sem `initialStock`. Preços (inclusive `null`) só com `prices.manage` |
| `DELETE /{id}` | `products.manage` ou `prices.manage` | Desativa (`active = false`). 200 `{ ok: true }` |

### Vendas: `/api/sales`

| Método e rota | Acesso | Observação |
|---|---|---|
| `POST /` | logado | `{ items: [{ productId, quantity }] }`, 1 a 100 itens, sem produto repetido, quantidade com até 3 casas decimais e inteira para unidades fora de KG, G, L, LT, ML, M, MT (400); item com subtotal de R$ 0,00 dá 400. Cabeçalho opcional `Idempotency-Key` (8 a 100 de `A-Z a-z 0-9 - _`). 201 venda nova com `id`, `totalAmount`, `createdAt`, `itemCount` e `items` (`product`, `unit`, `quantity`, `unitPrice`, `subtotal`); **200** com a venda já gravada quando a chave se repete com o mesmo carrinho; 409 sem estoque ou produto aguardando preço; 422 chave usada em outra venda |
| `GET /` | logado | Paginado (sempre). Filtros `from`, `to`. Sem `sales.viewAll`, só as próprias. Não lista canceladas. Cada venda traz `canCancel` |
| `GET /{id}` | logado | Inclui `canceled` e os itens. Sem `sales.viewAll`, 403 na venda de outra pessoa |
| `POST /{id}/cancel` | logado | Com `sales.cancel`: qualquer venda. Sem: só a própria, até 10 minutos depois (senão 403). Devolve o estoque. 409 se já cancelada |

### Estoque: `/api/stock` (`stock.manage`)

| Método e rota | Observação |
|---|---|
| `POST /entries` | `{ productId, quantity > 0, reason? }`. 201 `{ productId, currentStock }` |
| `POST /adjustments` | `{ productId, quantity ≠ 0, reason, type: ADJUSTMENT \| LOSS }`. Quantidade com sinal: negativa remove |
| `GET /movements` | Filtros `productId`, `type` (`ENTRY`, `SALE`, `ADJUSTMENT`, `LOSS`), `from`, `to`. Sem paginação devolve as 200 mais recentes; com `page`/`pageSize`, `{ totalCount, page, pageSize, movements }` |
| `GET /movements/export` | Mesmos filtros (o `to` inclui o dia inteiro), `format=csv` (padrão) ou `xlsx`. Até 20.000 linhas mais recentes; se houver mais, uma linha final de aviso. Tipo em português. Data/Hora no horário de Brasília: texto `dd/mm/aaaa hh:mm` no CSV, data de verdade (formato `dd/mm/yyyy hh:mm`) no XLSX |

### Painel: `/api/dashboard`

| Método e rota | Acesso | Observação |
|---|---|---|
| `GET /` | logado | `{ lowStock, soonOut, expiring }` para todos. Com `prices.manage`, também `pricePending` (`{ id, name, createdAt }`). Com `reports.view`, também `today`, `month` (`{ total, count }`) e `slowMoving` |

### Relatórios: `/api/reports` (`reports.view`)

| Método e rota | Observação |
|---|---|
| `GET /forecast` | Previsão de todos os produtos ativos, do que acaba antes para o que não tem previsão |
| `GET /sales-summary` | `from`, `to`. `{ total, count, byDay: { "AAAA-MM-DD": total } }`. Dias em UTC |
| `GET /top-products` | `from`, `to`, `limit` (1 a 50, padrão 10). Ordenado por faturamento |
| `GET /slow-moving` | `days` (1 a 365, padrão 60) |
| `GET /forecast/export`, `/sales-summary/export`, `/top-products/export`, `/slow-moving/export` | Mesmos parâmetros, mais `format=csv` (padrão) ou `xlsx` |
| `GET /export` | `from`, `to`. Um XLSX com as abas Resumo, Vendas por dia, Mais vendidos (50), Produtos parados (60 dias) e Previsão de estoque |

### Usuários: `/api/users` (dono)

| Método e rota | Observação |
|---|---|
| `GET /permissions` | `{ permissions: { chave: rótulo }, templates: { financeiro, estoque, caixa } }`, para montar o formulário |
| `GET /` | Todas as contas, por nome, com `permissions` |
| `POST /` | `{ name, email, password, permissions? }`. Sempre cria `CASHIER`. Permissão fora da lista: 400. 409 se o e-mail existe |
| `PUT /{id}` | `{ name?, active?, password?, permissions? }`. Trocar a senha encerra as sessões da conta; permissões valem na próxima requisição. 400 ao tentar desativar a si mesmo |

### Importação: `/api/imports` (`prices.manage`)

| Método e rota | Observação |
|---|---|
| `GET /products/template` | Baixa `modelo-produtos.xlsx` |
| `POST /products/parse` | `multipart/form-data` com o campo `file`, **ou** JSON `{ text }` com os dados colados. Devolve `{ headers, rows, mapping, fields }`. Não grava |
| `POST /products/preview` | `{ headers, rows, mapping, options }`. Devolve `{ summary, items }`. Não grava. Em produto existente, `items[].warnings` diz o que a linha muda além de preço e estoque (nome, categoria, unidade, mínimo, validade); validade anterior ao dia de hoje em Brasília também avisa |
| `POST /products/commit` | Mesmo corpo. Grava e devolve `{ created, updated, skipped, failed, failures }` |

`options`: `mode` (`upsert` padrão, `createOnly`, `updateOnly`), `matchBy` (`barcode` padrão, `name`), `stockMode` (`ignore` padrão, `set`, `add`). `mapping`: para cada campo (`name`, `barcode`, `category`, `unit`, `costPrice`, `salePrice`, `stock`, `minStock`, `expiryDate`), o índice da coluna, a partir de 0.

## Exemplo com curl

O cookie precisa ser guardado entre as chamadas, e o cabeçalho anti-CSRF precisa ir em toda escrita.

```bash
curl -c cookies.txt -H "Content-Type: application/json" -H "X-Requested-With: fetch" \
  -d '{"login":"admin@example.com","password":"SUA_SENHA"}' http://localhost:3100/api/auth/login
```
```bash
curl -b cookies.txt "http://localhost:3100/api/products?query=arroz"
```
```bash
curl -b cookies.txt -H "Content-Type: application/json" -H "X-Requested-With: fetch" \
  -H "Idempotency-Key: carrinho-0001-teste" \
  -d '{"items":[{"productId":"<uuid>","quantity":2}]}' http://localhost:3100/api/sales
```

Repetir a última chamada com a mesma chave devolve 200 com a mesma venda.

## Mudando a API

Toda mudança de rota atualiza este arquivo e o `openapi.yaml` no mesmo pull request. Mudança que quebra cliente (campo removido ou renomeado, status diferente, permissão nova exigida) entra no [changelog](../evoluir/changelog.md) como **quebra de compatibilidade**. O único cliente hoje é o próprio frontend em `public/js/`.

Para conferir se a especificação cobre todas as rotas do código, compare os `router.<método>('<caminho>')` de `src/routes/*.js` com os `paths` do `openapi.yaml` (em 25/11/2026: 38 e 38).
