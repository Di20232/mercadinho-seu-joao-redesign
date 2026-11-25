# Requisitos e regras de negócio

Cada regra tem um código (`RN-xx`), o lugar no código que a garante e o teste que a protege. Quando a coluna de teste diz **sem teste**, a regra só está garantida pelo código e pode quebrar sem ninguém perceber: essas lacunas estão em [testes de regressão](../evoluir/testes-de-regressao.md#lacunas).

Testes: `I` = `test/integration.test.js`, `S` = `test/security.test.js`, `U` = testes de unidade (`test/retryStaleRead.test.js`, `test/historyGenerator.test.js`, `test/exportService.test.js`). O nome do teste é o texto que aparece na saída do `npm test`.

## Contexto do problema

O cliente é o dono de um mercadinho de secos e molhados com quatro dores: perdia o controle do estoque, comprava demais o que ficava parado, perdia produto vencido e deixava faltar o que mais vendia. Depois, com equipe, precisou dividir o trabalho (quem cuida do estoque não mexe em preço; quem cuida do dinheiro não mexe no estoque). Os requisitos funcionais saem daí.

| Requisito | Dor que resolve | Regras |
|---|---|---|
| RF-01 Registrar vendas no balcão com baixa automática de estoque | Perda de controle do estoque | RN-01 a RN-06, RN-35, RN-37, RN-40 |
| RF-02 Controlar entradas, perdas e o histórico de estoque | Perda de controle do estoque | RN-07 a RN-09a |
| RF-03 Manter o cadastro de produtos | Base de tudo | RN-10 a RN-13a, RN-34 |
| RF-04 Avisar o que vai faltar, o que está parado e o que vai vencer | Falta de produto, compra excessiva, vencidos | RN-20 a RN-23 |
| RF-05 Relatórios de vendas e planilhas | Decidir compra e preço | RN-22, RN-24, RN-25, RN-38 |
| RF-06 Importar produtos de planilha | Cadastro inicial e atualização de preços em massa | RN-26 |
| RF-07 Controlar quem acessa e o que cada pessoa faz | Segurança do caixa, dos preços e dos números | RN-14 a RN-19, RN-27, RN-28, RN-36 |

## Permissões

Base de várias regras abaixo (`src/permissions.js`). O dono (`role = ADMIN`) tem todas. As demais contas (`role = CASHIER`) têm a lista `permissions` que o dono marcou.

| Chave | Libera | Tipo de pessoa que já marca |
|---|---|---|
| `sales.viewAll` | Listar e abrir vendas de todos | Financeiro |
| `sales.cancel` | Cancelar qualquer venda, a qualquer momento | Financeiro |
| `reports.view` | `/api/reports/*`, exportações de relatórios, totais financeiros e produtos parados no painel | Financeiro |
| `prices.manage` | Informar preço, ver custo e margem, `/api/imports/*`, aviso de produtos aguardando preço, escrever produtos | Financeiro |
| `products.manage` | Criar, editar, desativar e reativar produtos, sem preço | Estoque |
| `stock.manage` | `/api/stock/*` (entradas, perdas, ajustes, histórico, exportação) | Estoque |
| (só `ADMIN`) | `/api/users/*` | Dono |
| (todos) | Vender, ver produtos ativos, alertas do painel, cancelar a própria venda em até 10 min | Todos, inclusive Caixa |

## Vendas

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-01 | A venda baixa o estoque de forma atômica e nunca deixa saldo negativo, mesmo com vendas simultâneas. Sem saldo, a venda inteira é recusada (409). Os produtos da venda (e do cancelamento) são travados de uma vez, sempre na mesma ordem, antes de ler o saldo: vendas simultâneas não entram em impasse e o histórico grava os saldos em sequência. | `src/stockOps.js` (`lockProducts`: `SELECT ... ORDER BY id FOR UPDATE`), `src/routes/sales.js` (UPDATE condicional como segunda barreira) ([ADR-0017](adr/0017-travar-produtos-da-venda-em-ordem.md)) | I: "venda decrementa o estoque corretamente..."; I: "condição de corrida: vendas simultâneas nunca vendem além do estoque disponível"; I: "vendas simultâneas: o histórico grava os saldos em sequência (5→4, ...)"; I: "impasse: vendas simultâneas com os mesmos produtos em ordem inversa nunca falham" |
| RN-02 | O preço e o vendedor vêm do servidor (banco e sessão), nunca do cliente. O cliente manda só `productId` e `quantity`. | `src/routes/sales.js` (`saleSchema`, `unitPrice = product.salePrice`, `sellerId: req.user.sub`) | S: "Sales: app.js calcula preço do servidor, não do cliente" |
| RN-03 | A mesma venda não pode ter o mesmo produto em duas linhas (400). | `src/routes/sales.js` (checagem com `Set`) | **sem teste** |
| RN-04 | Limites: 1 a 100 itens, até 10.000 por item, total até R$ 5.000.000,00 (400). | `src/routes/sales.js` (`saleSchema`, `MAX_SALE_TOTAL`) | I: "barreira de overflow numérico rejeita uma venda absurdamente alta" |
| RN-05 | Quem tem `sales.cancel` cancela qualquer venda; os demais só a própria, até 10 minutos depois (`OWN_SALE_CANCEL_MINUTES`); fora disso, 403. O cancelamento devolve o estoque (mesmo de produto inativo), grava `ADJUSTMENT` com o id da venda, só acontece uma vez (409) e tira a venda de todos os totais. A listagem informa `canCancel` por venda. | `src/routes/sales.js` (`canCancelSale`, `/:id/cancel`), `src/permissions.js`, `src/stockOps.js` | I: "estoque: cancelamento de venda devolve o estoque e grava movimentação ADJUSTMENT"; I: "estoque: cancelamento duplo retorna 409"; I: "perfis: caixa cancela a própria venda só nos primeiros 10 minutos; financeiro cancela qualquer uma" |
| RN-06 | Sem `sales.viewAll`, a pessoa lista e abre só as próprias vendas (403 na venda de outro). | `src/routes/sales.js` (`where.sellerId`, checagem no `/:id`) | parcial: I "perfis: caixa cancela a própria venda..." (financeiro vê a venda de outro); o caixa **não** ver a dos outros: **sem teste** |
| RN-37 | Quantidade da venda: no máximo 3 casas decimais (400); inteira para unidades contadas, isto é, qualquer unidade fora de KG, G, L, LT, ML, M, MT (400); nenhum item cujo subtotal arredonde para R$ 0,00 (400). A tela do caixa repete a lista de unidades para arredondar o campo. | `src/routes/sales.js`, `src/units.js` (`allowsFraction`), `public/js/app.js` (cópia da lista) | I: "venda: quantidade com mais de 3 casas decimais é recusada..."; I: "venda: produto vendido por unidade não aceita fração; por quilo aceita"; I: "venda: item que sairia por R$ 0,00 é recusado" |
| RN-40 | A busca de produto por nome ignora acento e maiúsculas, nos dois lados da comparação; `%`, `_` e `\` digitados são literais. Sem extensão do PostgreSQL. | `src/productSearch.js` (`translate(lower(...))` em `$queryRaw` parametrizado), `src/routes/products.js` | I: "busca: "cafe", "CAFE" e "café" acham "Café"; % e _ digitados são literais" |
| RN-35 | Venda idempotente: o cabeçalho opcional `Idempotency-Key` (8 a 100 caracteres `A-Z a-z 0-9 - _`) faz a repetição do mesmo carrinho pelo mesmo usuário devolver a venda já gravada (200), sem baixar o estoque de novo, mesmo com requisições simultâneas. Mesma chave com outro carrinho ou outro usuário: 422. Chave malformada: 400. | `src/routes/sales.js` (`replayExistingSale`, índice único `Sale.idempotencyKey`), `public/js/app.js` (`pendingSale`) | I: "idempotência: repetir a venda com a mesma Idempotency-Key..."; I: "idempotência: requisições simultâneas com a mesma chave criam uma única venda"; I: "idempotência: chave reaproveitada em outro carrinho é recusada e chave malformada dá 400" |

## Estoque

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-07 | Toda mudança de estoque gera uma movimentação com tipo, quantidade, saldo anterior, saldo novo, motivo e usuário. Não há rota para editar ou apagar movimentação. | `src/routes/stock.js`, `src/routes/sales.js`, `src/routes/products.js`, `src/routes/imports.js` | I: "estoque: ajuste/perda grava previousStock e newStock corretos"; I: "estoque: histórico filtra por productId e por type" |
| RN-08 | Entradas, ajustes e devoluções concorrentes no mesmo produto nunca perdem atualização: a soma é feita pelo banco (`increment`), não lida e regravada pelo Node. | `src/stockOps.js` (`applyStockDelta`) | I: "condição de corrida: entradas de estoque simultâneas nunca perdem atualizações" |
| RN-09 | O estoque fica sempre entre 0 e 50.000.000. Fora disso, 400 com a mensagem do motivo. | `src/stockOps.js` (`MAX_STOCK`) | na venda: I "condição de corrida: vendas simultâneas..."; perda maior que o saldo e teto: **sem teste** |
| RN-09a | Entrada, ajuste, perda, histórico e exportação de movimentações exigem `stock.manage`. Perda e ajuste exigem motivo. | `src/routes/stock.js` (`requirePermission('stock.manage')`, `adjustmentSchema`) | I: "estoque: CASHIER é bloqueado nas rotas administrativas de estoque"; I: "perfis: cada permissão abre só a sua parte da API..." |

## Produtos

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-10 | Produto nunca é apagado: `DELETE` só marca `active = false`. Quem tem `products.manage` ou `prices.manage` pode reativar e vê os inativos; para os demais, inativo some da listagem **e** do detalhe. Inativo não entra em venda. | `src/routes/products.js` (`canEditCatalog`) | I: "produto desativado pode ser reativado pelo administrador"; I: "produto desativado fica invisível para o caixa na rota de detalhe (não só na listagem)" |
| RN-11 | Código de barras é único entre todos os produtos (409 "Já existe um produto com este código de barras."), inclusive numa corrida entre duas gravações. | `src/uniqueError.js`, `src/routes/products.js` | I: "já cadastrado: código de barras repetido retorna 409 ao cadastrar e ao editar produto"; I: "já cadastrado: corrida entre duas gravações (P2002) vira 409..." |
| RN-12 | A validade precisa existir no calendário (30/02 é recusado). | `src/routes/products.js` (`dateOnly`) | I: "validação de calendário rejeita datas impossíveis (30 de fevereiro)" |
| RN-13 | Só quem tem `prices.manage` recebe `costPrice` e `margin` da API. | `src/routes/products.js` (`serializeProduct`) | I: "autorização: funcionário (caixa) é bloqueado de rotas administrativas e nunca vê preço de custo"; I: "perfis: estoque cadastra produto sem preço..." (estoque não vê custo) |
| RN-13a | Estoque inicial no cadastro vira movimentação `ENTRY` "Estoque inicial no cadastro". O estoque não muda pela edição do produto. | `src/routes/products.js` (`productUpdateSchema` omite `initialStock`) | **sem teste** |
| RN-34 | Produto **aguardando preço** = `salePrice` ou `costPrice` nulo. Quem não tem `prices.manage` cria e edita produto sem mandar preço (mandar preço, mesmo nulo: 403 "Só o dono ou o financeiro podem definir preços."). Produto aguardando preço não é vendido (409) e some da busca da venda. Quem tem `prices.manage` recebe a lista no painel (`pricePending`) e pode filtrar em `GET /api/products?pricePending=true`. | `src/routes/products.js` (`assertCanSetPrices`, `isPricePending`), `src/routes/sales.js`, `src/routes/dashboard.js` | I: "perfis: estoque cadastra produto sem preço, financeiro recebe o aviso e libera para venda" |

## Usuários e acesso

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-14 | Cada rota exige no servidor a permissão da tabela acima; esconder botão na tela é só conforto. Falta de permissão: 403 "Sem permissão para executar esta ação." | `requirePermission(...)` em `src/routes/*.js`; `authorize('ADMIN')` em `src/routes/users.js` | I: "perfis: cada permissão abre só a sua parte da API e vale na hora em que o dono muda"; I: "autorização: funcionário (caixa)..."; I: "importação: caixa é bloqueado..."; I: "exportação: caixa é bloqueado (403)..." |
| RN-15 | Há um único dono (`ADMIN`), criado pelo seed. Toda conta criada pela API nasce `CASHIER`; um `role` enviado é ignorado (no auto-cadastro, recusado). A conta do auto-cadastro nasce **desativada** e sem sessão, até o dono ligá-la ([ADR-0020](adr/0020-cadastro-publico-nasce-desativado.md)). Só o dono marca permissões; permissão fora da lista: 400. | `src/routes/auth.js` (`registerSchema.strict()`), `src/routes/users.js`, `prisma/seed.js` | permissão inválida: I "perfis: cada permissão..."; conta desativada: I "cadastro público: conta nasce desativada..."; `role` ignorado: **sem teste** |
| RN-16 | O dono não pode desativar a própria conta (400). | `src/routes/users.js` | **sem teste** |
| RN-17 | Desativar uma conta ou trocar a senha derruba as sessões na hora: o servidor revalida usuário, `active` e `sessionVersion` a cada requisição. | `src/auth.js` (`authenticate`), `src/routes/users.js`, `src/routes/auth.js` | I: "revogação de sessão: usuário desativado perde acesso imediatamente, mesmo com token ainda válido" |
| RN-36 | Mudar as permissões de alguém vale na hora: elas são lidas do banco a cada requisição, não ficam no token. | `src/auth.js` (`req.user.permissions`) | I: "perfis: cada permissão abre só a sua parte da API e vale na hora em que o dono muda" |
| RN-18 | Login por e-mail ou por nome de usuário (gerado como primeiro nome + 4 dígitos). Mensagens distintas para login e senha errados; 10 tentativas por 15 min por IP. Conta desativada: 403 com mensagem própria só com a senha certa; com a senha errada, o mesmo 401 "Login incorreto." de uma conta que não existe. | `src/routes/auth.js`, `src/username.js` | I: "login: retorna mensagens específicas para campo, e-mail e senha"; I: "login: aceita o nome de usuário gerado no cadastro" |
| RN-19 | Recuperação de senha: resposta sempre genérica (sem revelar se o e-mail existe), token de 256 bits guardado só como hash SHA-256, validade de 30 min, uso único, um token ativo por usuário; o token nunca sai na resposta HTTP. | `src/routes/auth.js` (`forgot-password`, `reset-password`) | I: "recuperação de senha: e-mail inexistente recebe resposta genérica sem erro 500"; I: "recuperação de senha: resposta nunca contém token ou link..."; I: "recuperação de senha: token é de uso único" |

## Alertas, previsão e relatórios

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-20 | Estoque baixo = `currentStock <= minStock`, só produtos ativos. | `src/forecast.js` (`getStockForecast`) | I: "estoque: produtos abaixo de minStock aparecem na previsão de estoque (alerta)" |
| RN-21 | Previsão: média diária = saídas por venda nos últimos `FORECAST_WINDOW_DAYS` (30) ÷ janela; dias até esgotar = estoque ÷ média; sem venda = sem previsão. "Vai acabar em 7 dias" = não está baixo e previsão ≤ 7. | `src/forecast.js` (`getStockForecast`, `splitForecastAlerts`) | parcial: I "estoque: produtos abaixo de minStock..." |
| RN-22 | Produto parado = ativo, estoque > 0, sem venda em N dias (painel 60; API 1–365). Capital parado = estoque × custo (custo nulo conta 0). | `src/forecast.js` (`getSlowMovingProducts`) | I: "relatórios: slow-moving identifica produto parado com capital calculado" |
| RN-23 | Vencendo = validade até hoje + `EXPIRY_ALERT_DAYS` (7). O painel inclui vencidos; o e-mail diário não. | `src/routes/dashboard.js`, `src/jobs/dailyAlerts.js` | **sem teste** |
| RN-24 | Relatórios contam só vendas não canceladas e exigem `reports.view`. O filtro "até" inclui o dia inteiro (até 23:59:59.999 UTC). | `src/routes/reports.js` | I: "relatórios: filtro até uma data inclui vendas do dia inteiro"; I: "perfis: cada permissão..." |
| RN-25 | Exportação em CSV (`;`, UTF-8 com BOM, decimal com vírgula, campo com `;`, aspas ou quebra de linha entre aspas) e XLSX. Relatórios: `reports.view`; movimentações: `stock.manage`, até 20.000 linhas mais recentes, com uma linha final de aviso quando corta, o tipo em português e a Data/Hora no horário de Brasília (texto no CSV, data no XLSX; `src/storeTime.js`). Células que começam com `=`, `+`, `-`, `@` são neutralizadas contra injeção de fórmula. | `src/exportService.js`, `src/routes/reports.js`, `src/routes/stock.js` (`EXPORT_LIMIT`) | I: "exportação: administrador consegue exportar..."; I: "exportação: caixa é bloqueado (403)..."; I: "exportação: histórico do estoque sai com o tipo em português"; U: "CSV: ";", aspas e quebra de linha..."; U: "CSV: fórmulas continuam neutralizadas..."; I: "exportação: movimentações saem com data e hora de Brasília..."; U: "CSV: data e hora saem em texto..."; U: "Excel: data e hora continuam sendo data..."; U: "horário da loja: ..." (3) |
| RN-38 | **Removida em 25/11/2026** (era o relatório por e-mail). Os relatórios saem só pela tela e pelas planilhas. | — | — |
| RN-25a | Totais financeiros do painel (vendas do dia e do mês, produtos parados) só para `reports.view`; os alertas de estoque e validade, para todos. | `src/routes/dashboard.js` | **sem teste** |

## Importação

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-26 | Importação exige `prices.manage` e roda em duas fases: `parse` e `preview` não gravam nada; `commit` refaz a mesma análise e grava uma transação por linha. Recusa código de barras de outro produto, duplicatas no arquivo e estoque resultante negativo. Toda mudança de estoque vira movimentação. Produto novo precisa de preço de venda. Em produto existente, a conferência avisa o que a linha muda além de preço e estoque (nome, categoria, unidade, mínimo, validade); validade anterior ao dia de hoje **em Brasília** também avisa. Aviso não impede gravar. Limites: 5 MB, 1.000 linhas, 40 colunas. | `src/routes/imports.js` (`analyze`), `src/productImport.js`, `src/spreadsheet.js` | I: "importação: números em formato brasileiro e datas dd/mm/aaaa..."; I: "importação: acerto de saldo registra movimentação..."; I: "importação: código de barras repetido no arquivo..."; I: "importação: código de barras que pertence a outro produto é recusado..."; I: "importação: planilha .xlsx é lida..."; I: "importação: aceita corpo grande, mas as demais rotas continuam limitadas a 100kb"; I: "importação: caixa é bloqueado..."; I: "importação: conferência avisa troca de nome, mínimo, categoria e validade vencida" |

## Segurança e operação

| Código | Regra | Onde no código | Teste |
|---|---|---|---|
| RN-27 | Toda requisição que altera estado precisa do cabeçalho `X-Requested-With: fetch` (defesa contra CSRF). CORS aceita a própria origem e as de `CLIENT_ORIGIN`. | `src/auth.js` (`requireFetchHeader`), `src/app.js` | I: "CSRF: rota que altera estado rejeita requisição sem X-Requested-With"; I: "CORS: a própria página do app passa..."; S: "CORS: ..." |
| RN-28 | Auto-login só para demonstração: desligado por padrão, nunca em produção, só para conta `CASHIER` **sem nenhuma permissão extra** configurada no servidor. | `src/config.js`, `src/routes/auth.js` | I: "auto-login: fica desabilitado por padrão"; I: "auto-login: recusa conta ADMIN..."; I: "auto-login: permite apenas usuário CASHIER..." |
| RN-29 | Em produção o servidor recusa subir sem `JWT_SECRET` forte e sem `APP_BASE_URL` público; o cookie de sessão é sempre `Secure`. Contas de teste (`seed:perfis`) não são criadas em produção. | `src/config.js`, `prisma/seedPerfis.js` | S: "produção: config recusa APP_BASE_URL ausente ou localhost e aceita endereço público" |
| RN-30 | JWT HS256 com issuer `mercadinho-joao-api` e audience `mercadinho-joao-web`, em cookie `httpOnly` `SameSite=Lax`, validade 8 h. | `src/auth.js` | S: "JWT: ..." (4 testes) |
| RN-31 | Entrada de texto é tratada como dado, nunca como SQL (Prisma parametriza tudo). | `src/db.js` e todas as rotas | I: "SQL injection: payload é armazenado como texto literal, nunca executado" |
| RN-32 | Erro 500 nunca expõe detalhe interno ao cliente; o detalhe vai para o log. | `src/app.js` (error handler) | **sem teste** |
| RN-33 | Alerta diário por e-mail no horário `LOW_STOCK_ALERT_HOUR`, só com SMTP configurado e TLS obrigatório. A lista de validade vai do início de hoje até `EXPIRY_ALERT_DAYS` dias, então inclui o produto que vence hoje, e a data sai em UTC (como é gravada). | `src/jobs/dailyAlerts.js` | texto do alerta: I "validade: alerta diário inclui o produto que vence hoje, com a data certa"; envio: **sem teste** |
| RN-39 | Leitura que falha porque a conexão do pool morreu (Prisma P1017, comum depois de o banco ou o computador ficar parado) é repetida até 5 vezes; escrita nunca é repetida. | `src/retryStaleRead.js`, `src/db.js` (extensão do Prisma) ([ADR-0019](adr/0019-repetir-leitura-com-conexao-morta.md)) | U: "conexão morta: leitura é repetida e acaba funcionando"; U: "conexão morta: escrita nunca é repetida..."; U: "outros erros não são repetidos..." |
| RN-41 | O histórico de demonstração (`simulate:history`) termina exatamente no estoque atual de cada produto, sem saldo negativo, com quantidade inteira para unidades contadas, e não roda em produção. | `src/historyGenerator.js`, `prisma/simulateHistory.js` | U: os 4 testes "histórico: ..." |

## Requisitos não funcionais

| Código | Requisito | Como é atendido |
|---|---|---|
| RNF-01 | Funcionar em qualquer navegador moderno, sem instalação | App web; HTML, CSS e JS puros ([compatibilidade](../evoluir/matriz-de-compatibilidade.md)) |
| RNF-02 | Usar no balcão pelo teclado | Busca com ↑ ↓ Enter Esc na tela de vendas |
| RNF-03 | Usar no celular | Telas responsivas a partir de 375 px |
| RNF-04 | Dinheiro sem erro de arredondamento | Colunas `Decimal(12,2)` e `Decimal(12,3)` no banco |
| RNF-05 | Aguentar vários caixas na mesma rede | Limite geral de 300 requisições por minuto por IP (`API_RATE_LIMIT_MAX`) |
| RNF-06 | Não perder dados ao reiniciar ou renomear a pasta | Volume Docker com nome fixo ([ADR-0010](adr/0010-docker-compose-local-com-nomes-fixos.md)) |
| RNF-07 | Hospedar barato | Monólito Node + PostgreSQL gerenciado; sem serviços extras |
| RNF-08 | Internet instável não duplica venda | Venda idempotente (RN-35) |
| RNF-09 | Vários caixas ao mesmo tempo sem erro | Travas na mesma ordem (RN-01); teste de carga de 24/11/2026 citado em `src/stockOps.js` |
| RNF-10 | Usar como app no celular | PWA: `manifest.webmanifest`, `sw.js`, aviso de instalação ([ADR-0018](adr/0018-app-instalavel-sem-cache-de-dados.md)) |
| RNF-11 | Primeiro acesso depois de parado sem erro | Leituras repetidas com conexão morta (RN-39) |
| RNF-12 | Exportar não derruba o sistema | Limite de 20.000 linhas no histórico do estoque (RN-25) |
