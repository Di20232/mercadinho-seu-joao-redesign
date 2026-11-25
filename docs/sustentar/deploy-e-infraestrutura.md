# Deploy e infraestrutura

Onde o sistema roda, como publicar uma versão nova, onde ficam os segredos e todas as variáveis de ambiente.

## Situação em 24/11/2026

| Item | Situação |
|---|---|
| Ambiente local (Docker) | Em uso na máquina do desenvolvedor: `http://localhost:3100` |
| Produção na nuvem | **Ainda não publicado.** Passo a passo pronto abaixo |
| Pipeline CI/CD | **Não existe.** Build, teste e deploy são manuais |
| Infraestrutura como código | Só o `docker-compose.yml` (ambiente local) e o `Dockerfile` |
| Domínio e HTTPS | A definir; o provedor de nuvem fornece HTTPS no domínio dele |

## Ambientes

| | Local Docker | Local Node | Produção (planejada) |
|---|---|---|---|
| Sobe com | `docker compose up -d --build` | `npm run dev` | provedor builda do repositório |
| App | contêiner `app`, imagem `node:20-bookworm-slim`, porta 3100 no host | Node da máquina, porta 3000 | serviço web Node (Render ou Railway) |
| Banco | contêiner `db`, `postgres:16-alpine`, porta 5433 no host | o do Docker (5433) | PostgreSQL gerenciado (Neon ou Supabase) |
| `NODE_ENV` | `development` | `development` | `production` |
| Migrations | no `CMD` do contêiner, a cada subida | `npx prisma migrate deploy` à mão | no comando de build |
| Segredos | `docker-compose.yml` (padrões locais) e `.env` | `.env` | variáveis do painel do provedor |

## Arquivos de infraestrutura

| Arquivo | Faz |
|---|---|
| `Dockerfile` | Imagem Debian slim com OpenSSL (o Prisma precisa), `npm ci`, copia o código. `CMD`: espera o host `db` na 5432 (`wait-for-db.sh`, até 60 s), roda `prisma migrate deploy` e `node src/server.js` |
| `docker-compose.yml` | Serviços `db` e `app`, nome do projeto e do volume fixos ([ADR-0010](../manter/adr/0010-docker-compose-local-com-nomes-fixos.md)), `restart: unless-stopped`, healthcheck do banco |
| `wait-for-db.sh` | Tenta abrir conexão TCP com o banco uma vez por segundo, até 60 vezes |
| `.dockerignore` | Fora da imagem: `node_modules`, `.git`, `.env`, `.claude`, `test`, `backups`, logs |
| `.gitattributes` | Força LF nos `.sh`, senão o contêiner não acha o script |

O `Dockerfile` serve **só** para o compose: na nuvem não existe host `db` ([ADR-0013](../manter/adr/0013-deploy-na-nuvem-em-modo-node.md)).

## Publicar na nuvem (primeira vez)

O caminho preparado é o **Render** com o arquivo `render.yaml` da raiz (Blueprint) e o banco no **Neon**. Não precisa de shell, o que o plano gratuito do Render não tem.

1. **Banco (Neon).** Crie um projeto PostgreSQL na região **AWS us-east-1** (a mesma do Render em Virginia). Copie a string de conexão **direta** (desligue "Connection pooling") e confira o `?sslmode=require` no fim.
2. **Serviço (Render).** New → **Blueprint** → repositório `Di20232/mercadinho-seu-joao-redesign`. O Render lê o `render.yaml` e pede, no próprio painel:
   - `DATABASE_URL`: a string do Neon;
   - `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: o dono do mercadinho (senha forte, mínimo de 8 caracteres).
   O resto já vem do arquivo: `NODE_ENV=production`, Node 22, `TZ=America/Sao_Paulo`, `TRUST_PROXY=1` e `JWT_SECRET` gerado pelo Render.
3. **Primeiro deploy.** O build roda `npm ci --include=dev`, as migrations e o seed do dono. O seed só cria o dono se ainda não houver nenhum: nos deploys seguintes não faz nada. Depois do primeiro deploy, **apague `ADMIN_PASSWORD`** do painel e troque a senha em Usuários.
4. **Endereço.** Sem `APP_BASE_URL`, o sistema usa o endereço que o Render cria (`RENDER_EXTERNAL_URL`, ex.: `https://mercadinho-do-joao.onrender.com`). Defina `APP_BASE_URL` só ao trocar para domínio próprio.
5. **Conferência.** Abra o endereço público, faça uma venda de teste e cancele em Vendas recentes. Confira o estoque de volta no histórico. Peça "Esqueci minha senha" e confira o e-mail (só com SMTP configurado).
6. **App no celular.** Abra o endereço no Chrome do Android e use o aviso "Instalar app" ([ADR-0018](../manter/adr/0018-app-instalavel-sem-cache-de-dados.md)). Com o endereço fixo, o app instalado não quebra mais.
7. **Monitoramento mínimo** e **backup**: [monitoramento](monitoramento.md) e [backup](backup-e-continuidade.md).

**Plano gratuito do Render:** o serviço dorme depois de ~15 minutos sem acesso, e o primeiro acesso seguinte leva de 30 s a 1 min. Para uso diário na loja, o plano `starter` não dorme (troque `plan` no `render.yaml` ou no painel).

Sem o Blueprint (outro provedor, ou o Render configurado à mão): build `npm ci --include=dev && npx prisma migrate deploy`, start `node src/server.js`, Node 22, as variáveis da tabela "Produção" abaixo, e o dono criado uma vez com `ADMIN_NAME=... ADMIN_EMAIL=... ADMIN_PASSWORD='...' npm run seed`.

Nunca rode `seed:products`, `simulate:sales`, `simulate:history` nem `seed:perfis` em produção (o `simulate:history` também se recusa): os dois últimos criam contas com senha que está no código (o `seed:perfis` se recusa com `NODE_ENV=production`; o `simulate:sales`, não).

Depois do primeiro acesso, o dono cria as contas da equipe em Usuários, escolhendo o tipo de cada pessoa (Financeiro, Estoque, Caixa).

## Publicar uma versão nova

Sem CI, o roteiro é manual:

1. Na máquina do desenvolvedor, com a branch atualizada: `npm test` no banco de teste (72/72 em 25/11/2026).
2. Se houver migration nova, leia o SQL e faça um backup do banco de produção antes ([backup](backup-e-continuidade.md)).
3. Merge do PR em `master`.
4. No provedor, o deploy dispara pelo push em `master` (ou manualmente no painel). O build aplica as migrations.
5. Confira: a página abre, o login funciona, uma venda de teste passa e é cancelada.
6. Deu errado? [Rollback](runbooks.md#rollback-de-uma-versão).

Local com Docker, o equivalente é:

```bash
git pull
docker compose up -d --build app
docker compose logs -f app
```

## Onde ficam os segredos

| Segredo | Local | Produção | Nunca em |
|---|---|---|---|
| `JWT_SECRET` | `.env` (ou o padrão local do compose) | variável do provedor | git, log, chat |
| `DATABASE_URL` (com a senha do banco) | `.env` / compose | variável do provedor | git |
| `POSTGRES_PASSWORD` | padrão `changeme_local_only` no compose | não se aplica (banco gerenciado) | qualquer ambiente fora da máquina local |
| `SMTP_PASS` (senha de app do Gmail) | `.env` | variável do provedor | git |
| `ADMIN_PASSWORD` | `.env`, só para o seed | só no comando do seed, uma vez | variável permanente do provedor |
| `AUTO_LOGIN_PASSWORD` | `.env`, só demonstração | não usar | |

O `.env` está no `.gitignore` e no `.dockerignore`. Trocar o `JWT_SECRET` derruba todas as sessões (todos entram de novo).

## Variáveis de ambiente

Lidas em `src/config.js` (e nos scripts de `prisma/`). "Obrigatória em produção" significa que o servidor **recusa subir** sem ela.

| Variável | Padrão | Produção | Para quê |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Liga as travas de produção |
| `PORT` | `3000` | o provedor define | Porta HTTP |
| `DATABASE_URL` | nenhum | **obrigatória** (o Prisma falha sem ela) | Conexão com o PostgreSQL |
| `JWT_SECRET` | segredo de desenvolvimento | **obrigatória**, forte (`openssl rand -base64 48`) | Assina a sessão |
| `JWT_EXPIRES_IN` | `8h` | `8h` | Validade do token (o cookie dura 8 h fixas) |
| `APP_BASE_URL` | `http://localhost:<PORT>` | **obrigatória**, endereço público, não localhost (no Render, se faltar, vale `RENDER_EXTERNAL_URL`) | Monta o link do e-mail de nova senha |
| `CLIENT_ORIGIN` | `http://localhost:<PORT>` | o endereço público | Origens extras aceitas pelo CORS, separadas por vírgula |
| `COOKIE_SECURE` | `false` | ignorado: sempre `true` | Cookie só em HTTPS |
| `TRUST_PROXY` | `0` | `1` no Render/Railway | Quantos proxies confiáveis na frente (IP real para o rate limit) |
| `API_RATE_LIMIT_MAX` | `300` | `300` | Requisições por minuto por IP |
| `PASSWORD_RESET_EXPIRES_MIN` | `30` | `30` | Validade do link de nova senha |
| `FORECAST_WINDOW_DAYS` | `30` | `30` | Janela da previsão |
| `EXPIRY_ALERT_DAYS` | `7` | `7` | Dias para "vencendo em breve" |
| `LOW_STOCK_ALERT_HOUR` | `8` | ajuste ao fuso (ver abaixo) | Hora do e-mail diário (0 a 23, relógio do servidor) |
| `SMTP_HOST` | vazio (e-mail desligado) | `smtp.gmail.com` ou outro | Servidor de e-mail (nova senha, alerta diário) |
| `SMTP_PORT` | `587` | `587` (STARTTLS) ou `465` (TLS) | |
| `SMTP_USER`, `SMTP_PASS` | vazios | conta e senha de app | Autenticação SMTP |
| `SMTP_FROM` | `Mercadinho do João <no-reply@mercadinhodojoao.local>` | remetente real | |
| `ALERT_EMAIL_TO` | vazio (alerta desligado) | e-mail do dono | Destinatários do alerta diário, separados por vírgula |
| `AUTO_LOGIN_ENABLED`, `AUTO_LOGIN_EMAIL`, `AUTO_LOGIN_PASSWORD` | desligado | sempre desligado | Entrada automática de demonstração (só caixa) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `Administrador`, nenhum, nenhum | só no seed | Cria o dono |
| `SIMULATE_DAYS` | `14` | não usar | Dias do `simulate:sales` |
| `SIMULATE_YEARS`, `SIMULATE_FROM` | `2`, nenhum | não usar | Período do `simulate:history` |
| `RESET_EMAIL`, `RESET_PASSWORD` | nenhum | só no comando | `npm run reset-password` sem terminal interativo |
| `ALLOW_DB_RESET` | nenhum | nunca | Libera a suíte de testes num banco sem `test` no nome |
| `POSTGRES_PASSWORD` | `changeme_local_only` | não se aplica | Senha do banco do compose |

O servidor em Docker e na nuvem roda em **UTC**. `LOW_STOCK_ALERT_HOUR=8` dispara às 5h de Brasília; para 8h de Brasília, use `11`.

### Variáveis que o compose passa ao contêiner

O contêiner `app` **não lê o `.env` inteiro**: recebe só o que está em `environment:` no `docker-compose.yml`, com os valores do `.env` substituídos onde houver `${...}`. `APP_BASE_URL`, `API_RATE_LIMIT_MAX`, `PASSWORD_RESET_EXPIRES_MIN` e `AUTO_LOGIN_*` não estão na lista. Consequência: no Docker local, o link do e-mail de nova senha sai como `http://localhost:3000/...`, mas o sistema está na 3100 ([dívida DT-14](../evoluir/roadmap-e-divida-tecnica.md)).

## Requisitos de recursos

Não medidos. Referência: um processo Node e um PostgreSQL pequenos; os planos gratuitos dos provedores citados comportam o volume de um mercadinho. A suíte completa de 72 testes roda em cerca de 14 s numa máquina de desenvolvimento.
