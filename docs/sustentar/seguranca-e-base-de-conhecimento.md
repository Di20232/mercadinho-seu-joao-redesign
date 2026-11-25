# Segurança e base de conhecimento

Quem acessa o quê, como os dados pessoais são tratados (LGPD), as proteções que existem e os incidentes que já aconteceram.

## Acessos

| Acesso | Quem deve ter | Como se concede | Como se revoga |
|---|---|---|---|
| Sistema, conta do dono | só o dono | `npm run seed` (uma vez) | trocar a senha (`npm run reset-password`) |
| Sistema, conta da equipe | caixa, estoque, financeiro | dono cria em Usuários e marca as permissões | dono desmarca permissões ou desliga a conta (efeito imediato) |
| Repositório GitHub `Di20232/mercadinho-seu-joao-redesign` | desenvolvedores | convite no GitHub | remover colaborador |
| Painel do provedor da aplicação | N2 | convite no provedor | remover membro |
| Painel e string de conexão do banco | N2 | convite no provedor | remover membro e **trocar a senha do banco** |
| Conta de e-mail que envia (SMTP) | N2 | senha de app do Gmail | revogar a senha de app na conta Google |
| Shell do servidor (`reset-password`, seed) | N2 | acesso ao painel do provedor | idem |

Quando alguém da equipe técnica sai: remova os acessos acima, troque a senha do banco, a senha de app do SMTP e o `JWT_SECRET` (isso derruba todas as sessões; todos entram de novo).

## Proteções implementadas

| Ameaça | Proteção | Onde |
|---|---|---|
| Senha vazada do banco | Senha só como hash bcrypt, custo 12 | `src/auth.js` |
| Força bruta de senha | 10 tentativas por 15 min por IP no login; limites próprios no cadastro, no "esqueci" e no reset | `src/routes/auth.js` |
| Abuso geral da API | 300 requisições por minuto por IP | `src/app.js` |
| Roubo de sessão por script | JWT em cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção | `src/auth.js` |
| Funcionário demitido com sessão aberta | Usuário revalidado no banco a cada requisição; desligar corta na hora | `src/auth.js` |
| Pessoa da equipe fazendo o que não deve | Permissões checadas no servidor em cada rota e lidas do banco a cada requisição; lista fechada de permissões | `src/permissions.js`, `src/routes/*.js` |
| Estoque mexendo em preço ou vendo custo | Preço só com `prices.manage`; custo e margem filtrados na API | `src/routes/products.js` |
| Venda duplicada por rede instável | Confirmação idempotente | `src/routes/sales.js` |
| Sistema usado para disparar e-mails em massa | Relatório por e-mail limitado a 10 envios por 15 min por IP, só com `reports.view` | `src/routes/reports.js` |
| Busca com SQL cru | `$queryRaw` parametrizado e `LIKE` com escape | `src/productSearch.js` |
| Cookie roubado antes de trocar a senha | `sessionVersion` invalida tokens antigos | `src/auth.js` |
| CSRF | Cabeçalho `X-Requested-With` obrigatório nas escritas + CORS restrito | `src/auth.js`, `src/app.js` |
| XSS | Tela monta HTML sem `innerHTML` com dado do servidor; CSP só `'self'`, sem inline | `public/js/api.js`, `src/app.js` |
| SQL injection | Prisma parametriza tudo | `src/db.js` |
| Alguém da equipe virando dono | Papel fixado no servidor; um dono só; só o dono mexe em usuários e permissões | `src/routes/auth.js`, `src/routes/users.js` |
| Caixa vendo custo e margem | Campos não saem da API sem `prices.manage` | `src/routes/products.js` |
| Descobrir quem tem conta pelo "esqueci" | Resposta sempre igual | `src/routes/auth.js` |
| Link de senha roubado | Token de 256 bits, só o hash no banco, 30 min, uso único | `src/routes/auth.js` |
| Host header injection no link do e-mail | Link montado de `APP_BASE_URL`, não do cabeçalho `Host` | `src/config.js` |
| Planilha exportada com fórmula maliciosa | Células com `= + - @` neutralizadas no CSV | `src/exportService.js` |
| Senha SMTP em texto puro | TLS obrigatório (465 ou STARTTLS exigido) | `src/jobs/dailyAlerts.js` |
| Configuração insegura em produção | Recusa subir sem `JWT_SECRET` forte e `APP_BASE_URL` público; auto-login sempre desligado | `src/config.js` |
| Detalhe interno vazando no erro | 500 responde só "Erro interno do servidor." | `src/app.js` |
| IP forjado para furar o rate limit | `TRUST_PROXY=0` por padrão | `src/config.js` |

### Pontos de atenção

- **Logs fora de produção contêm links válidos de nova senha** (`[forgot-password] link de reset para ...`). Não compartilhe esses logs.
- **`npm run simulate:sales` cria um caixa com senha que está no código**, se não houver caixa ativo. **`npm run seed:perfis` cria três contas (financeiro, estoque, caixa) com senha que está no código**; ele recusa produção, o simulador não. Os dois só em ambiente local.
- **O relatório por e-mail vai para qualquer endereço** digitado: quem tem "Ver faturamento e relatórios" pode mandar os números da loja para fora. É confiança dada junto com a permissão; não há lista de destinatários permitidos (dívida DT-26).
- **Permissões são poder real**: "Definir preços" importa planilha e reescreve preços e saldos em massa; "Cancelar qualquer venda" mexe no estoque. Revise de tempos em tempos quem tem o quê em Usuários.
- **Senha do banco local padrão** (`changeme_local_only`) está no `docker-compose.yml`. A porta 5433 fica aberta no computador: em rede da loja, quem alcança o computador alcança o banco. Troque `POSTGRES_PASSWORD` no `.env` se o computador ficar na rede da loja.
- **Rate limit em memória**: reiniciar zera; mais de uma instância conta separado.
- **Logout** apaga o cookie do navegador, mas não invalida o token no servidor; ele expira em até 8 h. Para cortar de vez, troque a senha.
- **Dependências** com versões maiores mais novas disponíveis ([inventário](../evoluir/dependencias.md)). Rode `npm audit` antes de cada deploy.

O histórico da auditoria de segurança feita em 2026 está nos arquivos `SPRINT_REPORT.md`, `SPRINT_3_REPORT.md` e `REFACTORING_FINAL_REPORT.md` da raiz, e os testes que a protegem estão em [testes de regressão](../evoluir/testes-de-regressao.md).

## LGPD

### Que dados pessoais existem

| Dado | Titular | Finalidade | Base legal provável | Onde |
|---|---|---|---|---|
| Nome, e-mail, nome de usuário, permissões | equipe e dono | acesso ao sistema, identificação de quem vendeu e de quem mexeu no estoque | execução de contrato (trabalho) e legítimo interesse (auditoria) | tabela `User` |
| Hash da senha | idem | autenticação | idem | `User.passwordHash` |
| Autoria de vendas e movimentações | idem | auditoria do caixa e do estoque | legítimo interesse | `Sale.sellerId`, `StockMovement.userId` |

O sistema **não guarda dados de clientes** do mercadinho: a venda não tem comprador, CPF nem forma de pagamento. A base legal é indicação técnica, não parecer jurídico.

### Onde os dados aparecem fora do banco

- Backups (`backups/` e os do provedor).
- Logs: e-mail de quem pediu nova senha (fora de produção) e pilhas de erro.
- Planilhas exportadas: nome de quem fez cada movimentação de estoque.
- E-mails de alerta: não contêm dado pessoal.

### Pedidos de titular

| Pedido | Como atender hoje |
|---|---|
| Acesso / confirmação | O dono vê nome, e-mail e usuário em Usuários. Exportação completa: consulta no banco (N2) |
| Correção do nome | Dono edita em Usuários |
| Correção do e-mail | **Sem tela.** N2 altera no banco |
| Eliminação | **Sem tela.** A conta não pode ser apagada porque vendas e movimentações apontam para ela (chave estrangeira `RESTRICT`). Faça **anonimização** pelo N2: trocar nome por "Ex-funcionário N", e-mail por um endereço fictício único, desligar a conta e trocar a senha por uma aleatória. O histórico de vendas continua íntegro |

Falta: tela de anonimização e prazo de retenção definido (dívida DT-18).

### Incidente com dados pessoais

Vazamento de backup, de log ou acesso indevido ao banco: troque a senha do banco, o `JWT_SECRET` e as senhas dos usuários afetados; registre o que vazou e quando; avalie com o dono a comunicação à ANPD e aos titulares, conforme a LGPD.

## Base de conhecimento

Incidentes que já aconteceram e a solução confirmada. As notas completas ficam no cofre de conhecimento do desenvolvedor (`Cerebro/Problemas-Resolvidos/`).

| Incidente | Causa | Solução | Runbook |
|---|---|---|---|
| `Cannot find module 'express'` ao subir | Dependências não instaladas | `npm install` | [guia de dev](../manter/guia-de-desenvolvimento.md) |
| PostgreSQL não sobe na 5432 | PostgreSQL nativo do Windows ocupa a porta | Compose publica na 5433 | [porta ocupada](runbooks.md#porta-ocupada) |
| Contêineres "órfãos" rodando a partir de `C:\Windows\System32` | Compose rodado fora da pasta do projeto | Rodar sempre na pasta do projeto; `name:` fixo no compose | [ADR-0010](../manter/adr/0010-docker-compose-local-com-nomes-fixos.md) |
| Porta 3000 presa | Processo Node órfão | Achar o PID, conferir a linha de comando, encerrar | [porta ocupada](runbooks.md#porta-ocupada) |
| Login dá erro 500 | Docker Desktop fechado, banco fora | Abrir o Docker Desktop | [sistema não abre](runbooks.md#o-sistema-não-abre-ou-o-login-dá-erro) |
| Importação renomeava o produto errado | Casar por nome um produto que tinha outro código de barras | A análise recusa código de barras de outro produto | teste "importação: código de barras que pertence a outro produto é recusado..." |
| Docker Desktop aberto pelo Claude Code não inicia | Herdava o redirecionamento de AppData do app | Abrir pelo Explorer | [sistema não abre](runbooks.md#o-sistema-não-abre-ou-o-login-dá-erro) |
| Sistema subiu sem dados depois de renomear a pasta | Volume novo criado pelo Compose | Nome do projeto e do volume fixos | [subiu sem usuários](runbooks.md#o-sistema-subiu-sem-usuários-nem-vendas) |
| Contêiner com imagem antiga, sem as correções novas | Faltou `--build` | `docker compose up -d --build app` | [código novo não aparece](runbooks.md#o-código-novo-não-aparece) |
| `wait-for-db.sh: not found` | CRLF no script | `.gitattributes` com `eol=lf` | [contêiner não sobe](runbooks.md#contêiner-app-não-sobe) |
| 150 vendas legítimas simultâneas tomavam 429 | Limite geral de 120/min baixo demais | Subiu para 300/min, configurável | [429](runbooks.md#muitas-tentativas-429) |
| Testes de login tomavam 429 | Rate limit valendo na suíte | `skip` com `NODE_ENV=test` | |
| Primeiro acesso do dia com erro 500 ou lento | Conexões mortas no pool do Prisma (P1017) | Leituras repetidas ([ADR-0019](../manter/adr/0019-repetir-leitura-com-conexao-morta.md)) | |
| Erro 500 com dois caixas vendendo os mesmos produtos (5 vezes no teste de carga de 24/11/2026) | Impasse (deadlock) por travas em ordens diferentes | Travas em ordem fixa ([ADR-0017](../manter/adr/0017-travar-produtos-da-venda-em-ordem.md)) | |
| Histórico com vários "5→4" seguidos | Saldo lido antes da trava | Leitura depois da trava (idem) | |
| Venda de R$ 0,00 com quantidade 0,0004; meia caixa vendida | Quantidade sem limite de casas e sem regra de unidade | Até 3 casas, inteiro para unidades contadas, nenhum item a R$ 0,00 | |
| Exportar todo o histórico do estoque (164 mil linhas) levou 34 s e 1,1 GB e travou o site | Sem limite na exportação | Limite de 20.000 linhas com aviso | |
| CSV com colunas deslocadas | Texto com `;` sem aspas | Campos entre aspas (RFC 4180) | |
| Android criou atalho em vez de app | Instalação fora do Chrome | Aviso "Instalar app" com o caminho certo | [app instalado](runbooks.md#app-instalado-no-celular) |

Incidente novo resolvido e confirmado: acrescente uma linha aqui e, se tiver passo a passo, um item nos [runbooks](runbooks.md).
