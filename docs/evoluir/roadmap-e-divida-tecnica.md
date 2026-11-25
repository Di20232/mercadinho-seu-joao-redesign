# Roadmap e dívida técnica

O que precisa evoluir, por quê e em que ordem. Cada item de dívida tem um código (`DT-xx`) usado no resto da documentação. Levantado em 24/11/2026 lendo o código, rodando os testes e o `npm audit`.

## Roadmap

### Agora: o sistema já está publicado (25/11/2026)

| Item | Por quê | Esforço |
|---|---|---|
| Configurar o e-mail (SMTP) | Sem ele não há "esqueci minha senha" nem alerta diário. No Render grátis só pela porta 2525 | pequeno |
| `npm audit fix` sem quebra (DT-08) | Fecha a vulnerabilidade crítica e as altas que não exigem versão maior | pequeno |
| Node 22 na imagem e em `engines` (DT-07) | Node 20 está fora de suporte desde 30/04/2026 | pequeno |
| Corrigir os dias em UTC (DT-01) | "Vendas hoje" e os relatórios por dia erram depois das 21h | médio |
| Checagem de saúde e de disponibilidade (DT-05) | Hoje quem descobre que caiu é o cliente | pequeno |
| Backup automático (DT-17) | Último backup é de 16/10/2026 | pequeno |
| `nodemailer` 10 (DT-08) | Vulnerabilidades altas; passa a importar quando o SMTP for ligado | pequeno a médio |

### Próximo: primeiras semanas em produção

| Item | Por quê |
|---|---|
| Busca da venda por código de barras (DT-02) | Leitor de código de barras no balcão. A busca sem acento já está no `master` (`1ad7a0e`) |
| Tela de histórico de vendas com cancelamento (DT-03) | Hoje só as 15 últimas podem ser canceladas pela tela |
| CI no GitHub Actions rodando `npm test` com PostgreSQL (DT-06) | Teste só local depende de alguém lembrar |
| Cobrir as regras sem teste (DT-21) | Dez regras só garantidas pelo código |
| Filtro `to` inclusivo em vendas e movimentações (DT-15) | Igualar aos relatórios |
| Link do e-mail correto no Docker local (DT-14) | Teste local do "esqueci minha senha" |

### Depois: manutenção evolutiva

| Item | Por quê |
|---|---|
| Zod 4 (DT-08) | Vulnerabilidade alta só corrigida na 4; muda a API de validação |
| Express 5, helmet 8, express-rate-limit 8 | Linha 4 em manutenção; remove `express-async-errors` |
| Prisma 7 | Duas versões maiores atrás |
| bcryptjs 3, dotenv 18 | Atualização de rotina |
| Previsão sem venda cancelada e com janela real para produto novo (DT-04) | Números mais fiéis |
| Ajuste positivo e inventário pela tela (DT-16) | Corrigir estoque sem gambiarra |
| Anonimização de usuário (DT-18) | Pedido de eliminação pela LGPD |
| Dividir `public/js/app.js` por tela (DT-12) | Arquivo de 1.500 linhas |
| Limpar a documentação antiga da raiz (DT-11) | Números vencidos confundem |

Guias para as migrações maiores: [guias de migração](guias-de-migracao.md).

## Dívida técnica

Impacto: **alto** afeta dinheiro, segurança ou disponibilidade; **médio** afeta o trabalho diário; **baixo** afeta quem mantém.

| Código | Dívida | Evidência | Impacto | Como resolver |
|---|---|---|---|---|
| DT-01 | Dias contados em UTC. "Vendas hoje" e "no mês" usam a meia-noite do relógio do servidor (UTC no Docker e na nuvem); o resumo por dia agrupa por `toISOString()` (sempre UTC). Venda às 22h de Brasília cai no dia seguinte. **Em parte resolvido (PR #11):** a planilha do histórico do estoque e o aviso de validade da importação já usam o horário da loja, por `src/storeTime.js`, que serve também para o resto | `src/routes/dashboard.js`, `src/routes/reports.js`; contêiner com `TZ` vazio, relógio em UTC (conferido) | alto | Definir `TZ=America/Sao_Paulo` no ambiente **e** calcular as chaves de dia no fuso da loja (não com `toISOString`). Teste com venda às 23h |
| DT-02 | Busca da venda só pelo nome; sem leitura de código de barras | `src/productSearch.js` | médio | Buscar também `barcode` exato; Enter com código exato adiciona direto |
| DT-03 | Sem tela de histórico de vendas; cancelamento só nas 15 recentes | `public/js/app.js` (`/sales?pageSize=15`) | médio | Aba de histórico com filtro de data e paginação (a API já pagina) |
| DT-04 | Previsão conta vendas canceladas (o `SALE` fica, o cancelamento entra como `ADJUSTMENT`) e divide pelo tamanho da janela mesmo para produto novo | `src/forecast.js` | baixo | Descontar movimentações com `saleId` de venda cancelada; dividir pelos dias desde a primeira entrada quando menor que a janela |
| DT-05 | Sem endpoint de saúde, métricas ou alerta | não há rota `/health` | alto | `GET /api/health` com `SELECT 1`; checagem externa; alertas de log ([monitoramento](../sustentar/monitoramento.md)) |
| DT-06 | Sem CI: nenhum workflow em `.github/` | | médio | GitHub Actions com serviço `postgres:16`, `prisma migrate deploy` e `npm test` em todo PR |
| DT-07 | Imagem `node:20` fora de suporte; `engines` diz `>=18`, mas `node-cron` 4 exige 20+ | `Dockerfile`, `package.json` | alto | `node:22-bookworm-slim`, `"engines": { "node": ">=22" }` ([guia](guias-de-migracao.md#node-20-para-node-22)) |
| DT-08 | 9 vulnerabilidades em produção (1 crítica, 5 altas) e dependências com versões maiores atrasadas | `npm audit` de 24/11/2026 ([inventário](dependencias.md)) | alto | `npm audit fix`; depois `nodemailer` 10 e `zod` 4 |
| DT-09 | Rate limit em memória e agendador dentro do processo: com duas instâncias, cada uma conta separado e o e-mail diário sai duas vezes | `src/app.js`, `src/routes/auth.js`, `src/server.js` | baixo (hoje há uma instância) | Store compartilhado (ex.: no PostgreSQL) e agendador numa instância só, se um dia escalar |
| DT-10 | Sem versionamento: `package.json` parado em 1.0.0, nenhuma tag | `git tag` vazio | baixo | Adotar o processo do [changelog](changelog.md) |
| DT-11 | Documentos antigos com informação vencida: o README clona `mercadinho-seu-joao-2` (nenhum dos remotos do projeto), cita uma pasta `src/middleware/` que não existe, "forma de pagamento" no fluxo de vendas (não existe), "8 produtos de exemplo" (são 24) e um arquivo `LICENSE` que não existe; o `.env.example` traz a porta 5432, mas o compose publica o banco na 5433; `DOCUMENTATION.md` aponta para seções do README que não existem mais; `PROJETO_COMPLETO.md` diz "7/7 testes" | arquivos da raiz | baixo | Reduzir o README a uma porta de entrada para `docs/`; mover os relatórios para `docs/historico/` |
| DT-12 | `public/js/app.js` com cerca de 1.700 linhas e todas as telas; nenhum teste de frontend | | baixo | Um arquivo por tela; testes de ponta a ponta com Playwright nas telas críticas (venda, cancelamento) |
| DT-13 | Código repetido: `sendExport` em `stock.js` e `reports.js`; o filtro de datas repetido em várias rotas | | baixo | Extrair para `exportService.js` e `queryHelpers.js` |
| DT-14 | O compose não passa `APP_BASE_URL` ao contêiner: no Docker local o link do e-mail sai com `localhost:3000`, mas o sistema está na 3100 | `docker-compose.yml` | baixo | `APP_BASE_URL: ${APP_BASE_URL:-http://localhost:3100}` no `environment` do `app` |
| DT-15 | Em `GET /api/sales` e `GET /api/stock/movements` o filtro `to` para na meia-noite do dia; nos relatórios e exportações inclui o dia todo | `src/routes/sales.js`, `src/routes/stock.js` | baixo | Mesma regra dos relatórios, num helper só (junto com DT-13) |
| DT-16 | A tela Estoque só remove; ajuste positivo e contagem de inventário só por entrada com observação ou por importação | `public/app.html` | baixo | Opção "ajuste" com sinal e motivo; tela de inventário |
| DT-17 | Backup só manual; o último é de 16/10/2026 e fica só na máquina do desenvolvedor | `backups/` | alto | Backup diário do provedor na nuvem; tarefa agendada no local; cópia fora da máquina |
| DT-18 | LGPD: sem anonimização de usuário pela tela; tokens de senha usados nunca são apagados; sem prazo de retenção definido | `src/routes/users.js`, tabela `PasswordResetToken` | médio | Ação "anonimizar" no admin; limpeza periódica de tokens vencidos |
| DT-19 | Sem licença definida para o código (`private`, sem `LICENSE`) | `package.json` | baixo | Decisão do dono do código; registrar no repositório |
| DT-20 | Sem linter nem formatador; há comentários `eslint-disable` sem ESLint configurado | | baixo | ESLint e Prettier com as regras que o código já segue |
| DT-21 | Regras sem teste automatizado: RN-03, RN-06 (o caixa não ver a venda dos outros), RN-09 (perda maior que o saldo e teto), RN-13a, RN-15 (`role` ignorado), RN-16, RN-23, RN-25a, RN-32, RN-33 | [requisitos](../manter/requisitos-e-regras.md) | médio | Um teste por regra ([lacunas](testes-de-regressao.md#lacunas)) |
| DT-22 | Senha padrão do banco no `docker-compose.yml` com a porta 5433 aberta no computador; `simulate:sales` cria caixa com senha fixa no código e, ao contrário do `seed:perfis`, não recusa produção | `docker-compose.yml`, `prisma/simulateSales.js` | médio se o computador estiver na rede da loja | Exigir `POSTGRES_PASSWORD` no `.env`; publicar a porta só em `127.0.0.1`; o simulador recusar `NODE_ENV=production` e gerar senha aleatória |
| DT-23 | A barra lateral e os botões só refletem uma mudança de permissão depois de recarregar a página (a API já barra na hora) | `public/js/app.js` (`currentUser` lido uma vez) | baixo | Recarregar `/auth/me` ao trocar de aba ou ao receber 403 |
| DT-25 | A lista de unidades que aceitam fração está duplicada em `src/units.js` e `public/js/app.js` | os dois arquivos | baixo | Servir a lista pela API (ex.: em `/auth/me`) ou num arquivo compartilhado |
| DT-27 | Produto por UN com fração digitada: a conta usa o inteiro, mas o campo continua mostrando a fração | `public/js/app.js` (carrinho) | baixo | Reescrever o valor do campo ao arredondar |
| DT-24 | Os documentos antigos da raiz (`MATRIZ_PERFIS_ADMIN_CAIXA.md`, `DOCUMENTATION.md`) ainda descrevem só dois perfis | arquivos da raiz | baixo | Junto com DT-11 |

## Como manter esta lista

- Dívida nova encontrada: acrescente com o próximo código livre, a evidência (arquivo ou comando) e como resolver.
- Dívida paga: apague a linha no mesmo PR da correção e registre no [changelog](changelog.md).
- Revise a ordem do roadmap a cada mês, com o dono do sistema.
