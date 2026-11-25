# Testes de regressão

A suíte que prova que uma atualização não quebrou nada: 81 testes automatizados mais um roteiro manual curto para o que os testes não alcançam (as telas).

## Como rodar

Ver [guia de desenvolvimento](../manter/guia-de-desenvolvimento.md#testes). Resumo:

```powershell
$env:DATABASE_URL = "postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao_test?schema=public"; npm test
```

A suíte apaga o banco de teste antes de rodar e recusa bancos sem `test` no nome ([ADR-0012](../manter/adr/0012-testes-de-integracao-contra-postgres-real.md)).

## Execuções registradas

| Data | Commit | Node | Resultado | Duração |
|---|---|---|---|---|
| 24/11/2026 | `2e99c72` (antes do rebase) | 22.23.2 | 48/48 | 10,7 s |
| 24/11/2026 | `84e5186` | 22.23.2 | 54/54 | 9,7 s |
| 25/11/2026 | `master` (`0df94d5`) + docs | 22.23.2 | **72/72** | 14,1 s |
| 25/11/2026 | PR #11 + docs (`f33e8fc`) | 24.19.0 | **81/81**, também com `TZ=UTC` | 11,8 s |

Registre aqui cada execução antes de um deploy.

## O que cada teste protege

`I` = `test/integration.test.js` (59 testes, HTTP real contra PostgreSQL real). `S` = `test/security.test.js` (8 testes, sem banco). `U` = testes de unidade sem banco: `retryStaleRead.test.js` (3), `historyGenerator.test.js` (4), `exportService.test.js` (4), `storeTime.test.js` (3). A coluna "Regra" aponta para [requisitos e regras](../manter/requisitos-e-regras.md).

| # | Teste | Arquivo | Regra |
|---|---|---|---|
| 1 | login: retorna mensagens específicas para campo, e-mail e senha | I | RN-18 |
| 2 | login: aceita o nome de usuário gerado no cadastro | I | RN-18 |
| 3 | CORS: a própria página do app passa em qualquer endereço; outro site continua bloqueado | I | RN-27 |
| 4 | CSRF: rota que altera estado rejeita requisição sem X-Requested-With | I | RN-27 |
| 5 | SQL injection: payload é armazenado como texto literal, nunca executado | I | RN-31 |
| 6 | validação de calendário rejeita datas impossíveis (30 de fevereiro) | I | RN-12 |
| 7 | barreira de overflow numérico rejeita uma venda absurdamente alta | I | RN-04 |
| 8 | venda decrementa o estoque corretamente e rejeita venda além do disponível | I | RN-01 |
| 9 | condição de corrida: entradas de estoque simultâneas nunca perdem atualizações | I | RN-08 |
| 10 | condição de corrida: vendas simultâneas nunca vendem além do estoque disponível | I | RN-01, RN-09 |
| 11 | idempotência: repetir a venda com a mesma Idempotency-Key devolve a mesma venda e baixa o estoque uma vez só | I | RN-35 |
| 12 | idempotência: requisições simultâneas com a mesma chave criam uma única venda | I | RN-35 |
| 13 | idempotência: chave reaproveitada em outro carrinho é recusada e chave malformada dá 400 | I | RN-35 |
| 14 | revogação de sessão: usuário desativado perde acesso imediatamente, mesmo com token ainda válido | I | RN-17 |
| 15 | autorização: funcionário (caixa) é bloqueado de rotas administrativas e nunca vê preço de custo | I | RN-13, RN-14 |
| 16 | produto desativado pode ser reativado pelo administrador | I | RN-10 |
| 17 | produto desativado fica invisível para o caixa na rota de detalhe (não só na listagem) | I | RN-10 |
| 18 | auto-login: fica desabilitado por padrão | I | RN-28 |
| 19 | auto-login: recusa conta ADMIN mesmo com senha correta | I | RN-28 |
| 20 | auto-login: permite apenas usuário CASHIER configurado no servidor | I | RN-28 |
| 21 | recuperação de senha: e-mail inexistente recebe resposta genérica sem erro 500 | I | RN-19 |
| 22 | recuperação de senha: resposta nunca contém token ou link, para e-mail existente ou inexistente | I | RN-19 |
| 23 | relatórios: filtro até uma data inclui vendas do dia inteiro | I | RN-24 |
| 24 | relatórios: slow-moving identifica produto parado com capital calculado | I | RN-22 |
| 25 | recuperação de senha: token é de uso único | I | RN-19 |
| 26 | estoque: cancelamento de venda devolve o estoque e grava movimentação ADJUSTMENT | I | RN-05 |
| 27 | estoque: cancelamento duplo retorna 409 | I | RN-05 |
| 28 | estoque: ajuste/perda grava previousStock e newStock corretos | I | RN-07 |
| 29 | estoque: histórico filtra por productId e por type | I | RN-07 |
| 30 | estoque: CASHIER é bloqueado nas rotas administrativas de estoque | I | RN-09a |
| 31 | estoque: produtos abaixo de minStock aparecem na previsão de estoque (alerta) | I | RN-20, RN-21 |
| 32 | importação: caixa é bloqueado em todas as rotas de importação | I | RN-14, RN-26 |
| 33 | importação: números em formato brasileiro e datas dd/mm/aaaa são gravados corretamente | I | RN-26 |
| 34 | importação: acerto de saldo registra movimentação com o estoque anterior e o novo | I | RN-26, RN-07 |
| 35 | importação: código de barras repetido no arquivo não cadastra o produto duas vezes | I | RN-26 |
| 36 | importação: código de barras que pertence a outro produto é recusado, nunca sobrescrito | I | RN-26 |
| 37 | importação: aceita corpo grande, mas as demais rotas continuam limitadas a 100kb | I | RN-26 |
| 38 | importação: planilha .xlsx é lida e as colunas são reconhecidas pelo cabeçalho | I | RN-26 |
| 39 | exportação: administrador consegue exportar relatórios e movimentações em CSV e XLSX | I | RN-25 |
| 40 | exportação: caixa é bloqueado (403) em todas as rotas de exportação | I | RN-25, RN-14 |
| 41 | perfis: estoque cadastra produto sem preço, financeiro recebe o aviso e libera para venda | I | RN-34, RN-13 |
| 42 | perfis: cada permissão abre só a sua parte da API e vale na hora em que o dono muda | I | RN-14, RN-15, RN-36, RN-09a |
| 43 | perfis: caixa cancela a própria venda só nos primeiros 10 minutos; financeiro cancela qualquer uma | I | RN-05, RN-06 |
| 44 | já cadastrado: código de barras repetido retorna 409 ao cadastrar e ao editar produto | I | RN-11 |
| 45 | já cadastrado: e-mail repetido retorna 409 no cadastro público e na tela de usuários | I | RN-15 |
| 46 | já cadastrado: corrida entre duas gravações (P2002) vira 409 e outros erros passam intactos | I | RN-11 |
| 47 | busca: "cafe", "CAFE" e "café" acham "Café"; % e _ digitados são literais | I | RN-40 |
| 48 | vendas simultâneas: o histórico grava os saldos em sequência (5→4, 4→3, 3→2, 2→1, 1→0) | I | RN-01 |
| 49 | impasse: vendas simultâneas com os mesmos produtos em ordem inversa nunca falham | I | RN-01 |
| 50 | venda: quantidade com mais de 3 casas decimais é recusada (não vira venda de R$ 0,00) | I | RN-37 |
| 51 | venda: produto vendido por unidade não aceita fração; por quilo aceita | I | RN-37 |
| 52 | venda: item que sairia por R$ 0,00 é recusado | I | RN-37 |
| 53 | relatório por e-mail: sem SMTP avisa, e-mail inválido dá 400 e quem não vê relatórios recebe 403 | I | RN-38 |
| 54 | relatório por e-mail: manda resumo no corpo e um Excel com uma aba por relatório | I | RN-38 |
| 55 | exportação: histórico do estoque sai com o tipo em português | I | RN-25 |
| 56 | JWT: signToken inclui issuer e audience | S | RN-30 |
| 57 | JWT: verificação falha com issuer inválido | S | RN-30 |
| 58 | JWT: verificação falha com audience inválida | S | RN-30 |
| 59 | JWT: algoritmo inválido é rejeitado | S | RN-30 |
| 60 | CORS: app.js importa cors corretamente | S | RN-27 |
| 61 | CORS: configuração permite origens do allowlist | S | RN-27 |
| 62 | Sales: app.js calcula preço do servidor, não do cliente | S | RN-02 |
| 63 | produção: config recusa APP_BASE_URL ausente ou localhost e aceita endereço público | S | RN-29 |
| 64 | conexão morta: leitura é repetida e acaba funcionando | U | RN-39 |
| 65 | conexão morta: escrita nunca é repetida (evita gravar duas vezes) | U | RN-39 |
| 66 | outros erros não são repetidos, e a leitura desiste depois de 5 tentativas | U | RN-39 |
| 67 | histórico: cada produto fecha no estoque de hoje, sem saldo negativo e com a conta certa | U | RN-41 |
| 68 | histórico: produto vendido por unidade nunca tem quantidade ou saldo fracionado | U | RN-41 |
| 69 | histórico: tem vendas, compras e perdas, e nada depois do fim de cada produto | U | RN-41 |
| 70 | histórico: venda cancelada tem a baixa e a devolução, e não mexe no saldo | U | RN-41 |
| 71 | CSV: ";", aspas e quebra de linha no texto não deslocam as colunas | U | RN-25 |
| 72 | CSV: fórmulas continuam neutralizadas e números ficam com vírgula | U | RN-25 |
| 73 | validade: alerta diário inclui o produto que vence hoje, com a data certa | I | RN-33 |
| 74 | importação: conferência avisa troca de nome, mínimo, categoria e validade vencida | I | RN-26 |
| 75 | exportação: movimentações saem com data e hora de Brasília e o tipo em português (CSV em texto, XLSX como data) | I | RN-25 |
| 76 | cadastro público: conta nasce desativada, sem sessão, e só entra depois que o dono libera | I | RN-15, RN-18 |
| 77 | CSV: data e hora saem em texto, no horário da loja | U | RN-25 |
| 78 | Excel: data e hora continuam sendo data (ordena e filtra), no horário da loja | U | RN-25 |
| 79 | horário da loja: "hoje" é o dia de Brasília, não o do servidor | U | RN-26 |
| 80 | horário da loja: data e hora em texto, no formato brasileiro | U | RN-25 |
| 81 | horário da loja: relógio de Brasília guardado nos campos UTC (para o Excel) | U | RN-25 |

Os testes 60 a 62 (`security.test.js`) leem o código-fonte ou repetem a lógica, em vez de exercitar o servidor; quebram com uma simples renomeação. O comportamento equivalente está coberto pelos testes 3 e 8.

## Lacunas

Regras sem teste automatizado (dívida DT-21). Cada uma é candidata ao próximo teste:

| Regra | O que testar |
|---|---|
| RN-03 | Venda com o mesmo `productId` em duas linhas dá 400 |
| RN-06 | Caixa sem `sales.viewAll` não vê a venda de outro na lista e recebe 403 no detalhe |
| RN-09 | Perda maior que o saldo dá 400; entrada que passaria de 50.000.000 dá 400 |
| RN-13a | Cadastro com estoque inicial gera `ENTRY`; `PUT` com `initialStock` não muda o estoque |
| RN-15 | `POST /api/users` com `role: 'ADMIN'` cria `CASHIER`; `POST /api/auth/register` com `role` dá 400 |
| RN-16 | Dono tentando se desativar dá 400 |
| RN-23 | Painel lista produto vencido; e-mail diário não |
| RN-25a | Caixa não recebe `today`, `month` nem `slowMoving` no painel |
| RN-32 | Erro inesperado responde "Erro interno do servidor." sem pilha |
| RN-33 | Texto do alerta diário (com `buildAlertText`) e recusa de `ALERT_EMAIL_TO` inválido |
| DT-01 | Venda às 23h de Brasília cai no dia certo (depois de corrigido) |

Também não há teste automatizado de **telas** (frontend). Por isso o roteiro manual abaixo.

## Roteiro manual de regressão (30 minutos)

Num ambiente local com dados de exemplo (`seed`, `seed:products`, `simulate:sales`, `seed:perfis`), depois de qualquer mudança de frontend ou de dependência:

| # | Como quem | Passo | Esperado |
|---|---|---|---|
| 1 | caixa | Entrar com o nome de usuário | Painel com 3 indicadores de alerta, sem dinheiro |
| 2 | caixa | Vender 2 itens pelo teclado (↓ Enter), imprimir | Comprovante com total certo; janela de impressão abre |
| 3 | caixa | Cancelar a venda logo em seguida | "Venda cancelada e estoque devolvido." |
| 4 | caixa | Procurar um produto aguardando preço | Não aparece |
| 5 | estoque | Abrir Estoque, dar entrada, registrar perda | Prévia "X → Y"; histórico com as duas linhas |
| 6 | estoque | Cadastrar produto | Sem campos de preço; selo "Aguardando preço" |
| 7 | financeiro | Painel → Aguardando preço → Definir preço | Produto sai do aviso e aparece na venda |
| 8 | financeiro | Relatórios: 30 dias, Hoje, baixar planilha | Gráfico, ranking e `.xlsx` abrem |
| 9 | financeiro | Importar `planilhas-teste/produtos-com-erros.xlsx` até a prévia | Erros por linha, nada gravado |
| 10 | dono | Usuários: mudar o tipo de alguém para Personalizado, desligar e religar | Selo muda; a pessoa perde e recupera o acesso |
| 11 | dono | Tema escuro, recolher menu, tela em 375 px | Nada cortado ou sobreposto |
| 12 | caixa | Buscar "cafe"; pôr um produto por UN e digitar 1,5 | Acha "Café"; o subtotal é de 2 unidades |
| 13 | financeiro | Relatórios → Enviar por e-mail (com SMTP de teste) | "Relatório enviado para ..."; Excel com 5 abas |
| 14 | qualquer | No celular (Chrome Android, HTTPS), tocar "Instalar app"; desligar a internet | App com ícone próprio; página "sem conexão" |
| 15 | qualquer | Console do navegador | Sem erro, sem violação de CSP |

Registre o resultado na tabela de execuções, com o que falhou.
