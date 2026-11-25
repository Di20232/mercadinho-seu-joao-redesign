# Guia de desenvolvimento e testes

Como subir o ambiente local, os padrões do código e como rodar os testes. Os comandos abaixo foram executados em 24/11/2026 numa máquina Windows 11 com Node 22.23.2, npm 10.9.8 e Docker 29.3.1.

Os blocos marcados `powershell` são para o PowerShell do Windows; os marcados `bash`, para Git Bash, Linux ou macOS.

## Pré-requisitos

| Ferramenta | Versão | Observação |
|---|---|---|
| Node.js | 20 ou mais novo (recomendado 22 LTS) | `node-cron` 4 exige Node 20+ ([compatibilidade](../evoluir/matriz-de-compatibilidade.md)) |
| npm | o que vem com o Node | |
| Docker Desktop | com Docker Compose v2 | precisa estar **aberto** antes do `docker compose` |
| Git | qualquer recente | `core.autocrlf` pode ficar ligado: o `.gitattributes` força LF no `wait-for-db.sh` |

## Obter o código

```bash
git clone https://github.com/Di20232/mercadinho-seu-joao-redesign.git
cd mercadinho-seu-joao-redesign
```

Esse é o repositório ativo desde 24/11/2026; o antigo `Di20232/mercadinho-seu-joao` não existe mais. Para quem nunca rodou o projeto, o [`TUTORIAL_INSTALACAO.md`](../../TUTORIAL_INSTALACAO.md) da raiz tem o mesmo caminho em linguagem mais simples.

## Configurar o `.env`

```bash
cp .env.example .env
```

Edite o `.env`. O mínimo para rodar localmente:

| Variável | Valor local | Por quê |
|---|---|---|
| `ADMIN_PASSWORD` | uma senha sua, 8+ caracteres | o `npm run seed` recusa vazio ou a senha de exemplo antiga |
| `ADMIN_EMAIL`, `ADMIN_NAME` | os seus | conta do dono |
| `DATABASE_URL` | `postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao?schema=public` | só para o modo B abaixo; o `.env.example` traz a porta 5432 como exemplo genérico |

A senha `changeme_local_only` é o padrão do `docker-compose.yml` para o banco local (variável `POSTGRES_PASSWORD`). Nunca use esse padrão fora da sua máquina. Lista completa de variáveis em [deploy e infraestrutura](../sustentar/deploy-e-infraestrutura.md#variáveis-de-ambiente).

O `.env` está no `.gitignore` e no `.dockerignore`. Não faça commit dele.

## Modo A: tudo no Docker (mais simples)

```bash
docker compose up -d --build
```
```bash
docker compose exec app npm run seed
```

Abra `http://localhost:3100` e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

Dados de exemplo (opcional, só em ambiente local):

```bash
docker compose exec app npm run seed:products
docker compose exec app npm run simulate:sales
docker compose exec app npm run seed:perfis
docker compose exec app npm run simulate:history
```

O `simulate:history` cria 2 anos de vendas, compras e perdas que terminam no estoque atual, para os relatórios terem volume. O `seed:perfis` cria uma conta de teste de cada tipo (Financeiro, Estoque, Caixa) para conferir as permissões no navegador; a senha está no topo de `prisma/seedPerfis.js`.

O contêiner `app` aplica as migrations pendentes a cada subida (`npx prisma migrate deploy` no `CMD`). O banco fica no volume `mercadinho-seu-joao_mercadinho_joao_db_data` e sobrevive a `docker compose stop`, `down` e reinício da máquina. **`docker compose down -v` apaga o banco.**

Mudou o código? A imagem não se atualiza sozinha:

```bash
docker compose up -d --build app
```

## Modo B: Node na máquina, banco no Docker (para desenvolver)

```bash
docker compose up -d db
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

Abra `http://localhost:3000`. O `nodemon` reinicia o servidor a cada mudança em `src/`. O frontend em `public/` não tem build: basta recarregar a página.

`npm install` roda `prisma generate` sozinho (`postinstall`). Se mudar o `schema.prisma`, rode `npx prisma generate` de novo.

## Testes

A suíte de integração **apaga todas as tabelas** do banco apontado por `DATABASE_URL` e só roda se o nome do banco contiver `test`. Use um banco só para testes.

Uma vez, crie o banco de teste e aplique as migrations nele:

```bash
docker compose exec db createdb -U postgres mercadinho_joao_test
```
```bash
DATABASE_URL="postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao_test?schema=public" npx prisma migrate deploy
```

Para rodar a suíte:

```bash
DATABASE_URL="postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao_test?schema=public" npm test
```

No PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao_test?schema=public"; npm test
```

A variável do terminal vale mais que a do `.env` (o `dotenv` não sobrescreve o que já existe). Resultado esperado, conferido em 25/11/2026 no `master` (`0df94d5`):

```
# tests 72
# pass 72
# fail 0
# duration_ms 14122
```

O `npm test` roda seis arquivos: `integration.test.js` (precisa do banco), `security.test.js`, e os testes de unidade `retryStaleRead.test.js`, `historyGenerator.test.js`, `exportService.test.js` e `storeTime.test.js`.

Depois de puxar commits com migration nova, aplique-as também no banco de teste (o `prisma migrate deploy` acima), senão os testes falham por coluna inexistente.

O que cada teste cobre e o que falta cobrir: [testes de regressão](../evoluir/testes-de-regressao.md).

Duas pessoas (ou dois agentes) rodando a suíte **no mesmo banco** ao mesmo tempo apagam os dados uma da outra no meio. Cada um usa o seu banco (`mercadinho_joao_test_<nome>`).

## Estrutura de pastas

```
.
├── src/                    backend
│   ├── server.js           entrada do processo
│   ├── app.js              Express: middlewares, rotas, estáticos, erros
│   ├── config.js           variáveis de ambiente
│   ├── auth.js             senha, JWT, cookie, authenticate, authorize, CSRF
│   ├── permissions.js      permissões, tipos de pessoa, requirePermission
│   ├── db.js               Prisma Client único (com retryStaleRead.js)
│   ├── productSearch.js    busca por nome sem acento
│   ├── units.js            unidades que aceitam fração
│   ├── historyGenerator.js histórico de demonstração
│   ├── routes/             uma rota por recurso
│   ├── jobs/dailyAlerts.js e-mail diário
│   ├── stockOps.js         soma/subtração atômica de estoque
│   ├── forecast.js         previsão e produtos parados
│   ├── spreadsheet.js      leitura de planilha
│   ├── productImport.js    colunas e valores da importação
│   ├── exportService.js    CSV e XLSX
│   ├── storeTime.js        horário da loja (Brasília), independente do servidor
│   ├── uniqueError.js      409 "já cadastrado"
│   ├── username.js         nome de usuário
│   ├── validate.js         middleware Zod
│   ├── queryHelpers.js     validação de query string
│   └── httpError.js        erro com status
├── public/                 frontend estático (sem build), PWA (sw.js, manifest, offline.html, icons/)
├── prisma/                 schema, migrations, seed e scripts de manutenção
├── test/                   integration.test.js, security.test.js, helpers/
├── planilhas-teste/        uma planilha boa e uma com erros, para testar a importação
├── docs/                   esta documentação
├── Dockerfile, docker-compose.yml, wait-for-db.sh
├── TUTORIAL_INSTALACAO.md  passo a passo para rodar em outra máquina
└── .env.example
```

## Scripts

| Comando | Faz |
|---|---|
| `npm start` | `node src/server.js` |
| `npm run dev` | servidor com `nodemon` |
| `npm test` | as duas suítes (`node --test`) |
| `npm run prisma:generate` | gera o Prisma Client |
| `npm run prisma:migrate` | `prisma migrate dev`: cria migration nova (só em desenvolvimento) |
| `npm run prisma:deploy` | `prisma migrate deploy`: aplica as pendentes |
| `npm run seed` | cria o admin (uma vez) |
| `npm run seed:products` | 24 produtos de exemplo |
| `npm run simulate:sales` | vendas dos últimos 14 dias (`SIMULATE_DAYS`) |
| `npm run simulate:history` | 2 anos de histórico que termina no estoque atual (`SIMULATE_YEARS`, `SIMULATE_FROM`); recusa produção |
| `npm run seed:perfis` | contas de teste Financeiro, Estoque e Caixa (recusa rodar em produção) |
| `npm run reset-password -- email@exemplo.com` | troca a senha de uma conta pelo terminal |

`seed:products`, `simulate:sales`, `simulate:history` e `seed:perfis` são só para ambiente local ou de demonstração.

## Padrões do código

### Backend

- CommonJS (`require`), `async/await`. O `express-async-errors` leva qualquer erro lançado num handler para o tratador central: lance `httpError(status, 'mensagem')`, não responda erro à mão.
- **Toda entrada é validada.** Corpo: schema Zod com `validate(schema)`. Query string: `parseDateParam`, `parseEnumParam`, `clampIntParam` de `queryHelpers.js`.
- **Toda rota protegida checa a permissão no servidor** com `requirePermission('chave')` (`src/permissions.js`), mesmo que a tela esconda o botão. Só `/api/users` usa `authorize('ADMIN')`. Regra que depende do dado (ex.: cancelar só a própria venda) usa `can(req.user, 'chave')` dentro da rota. Permissão nova: chave em `PERMISSIONS`, rótulo para a tela, modelos em `TEMPLATES` se for o caso, teste e atualização da tabela em [requisitos](requisitos-e-regras.md#permissões).
- Campo que nem toda permissão pode ver (ex.: custo) é filtrado na serialização, não no frontend.
- **Nunca grave `currentStock` direto.** Use `applyStockDelta` (ou o UPDATE condicional da venda) e grave a `StockMovement` na mesma transação ([ADR-0005](adr/0005-baixa-de-estoque-atomica-no-banco.md)). Transação que mexe em **mais de um produto** chama `lockProducts` primeiro ([ADR-0017](adr/0017-travar-produtos-da-venda-em-ordem.md)).
- SQL cru só com `prisma.$queryRaw` em template (parametrizado), nunca `$queryRawUnsafe` com texto do usuário. Em `LIKE`, escape `%`, `_` e a barra invertida como em `src/productSearch.js`.
- A lista de unidades com fração existe em dois lugares: `src/units.js` (quem decide) e `public/js/app.js` (para o campo da tela). Mude os dois juntos.
- Valor único (e-mail, código de barras): `ensureAvailable` antes e `guardUnique` na gravação (`uniqueError.js`).
- Preço, vendedor e perfil vêm do banco e da sessão, nunca do corpo da requisição.
- Mensagens para o usuário em português, curtas e com o que fazer. Erro 500 nunca leva detalhe para a resposta.
- Comentário explica o **porquê**, não o que a linha faz. Vários comentários registram bugs reais que a linha evita: não apague sem entender.
- Não há linter nem formatador configurado. Siga o estilo dos arquivos vizinhos (2 espaços, aspas simples, ponto e vírgula).

### Frontend

- Sem framework e sem build. Cada tela é um `<template>` em `public/app.html` e uma função `render<Tela>()` em `public/js/app.js`.
- Monte HTML com `el()` (`public/js/api.js`) e `textContent`. **Dado do servidor nunca entra por `innerHTML`.**
- Nada inline: nem `<script>`, nem `style=""`, nem `onclick=""`. A CSP só aceita arquivos da própria origem ([ADR-0009](adr/0009-frontend-sem-cdn-e-csp-self.md)). Para variar estilo por JS, use `element.style.setProperty('--var', ...)` ou classes.
- Chamadas à API só por `api.get/post/put/del`, que já mandam o cookie e o `X-Requested-With`.
- Elemento que depende de permissão leva `data-perm="stock|reports|prices|catalog|manage"` (ou `data-admin-only`, só para o dono); `app.js` liga as classes `can-*` no `<body>` a partir de `currentUser.permissions`. Isso é conforto visual; a proteção é no servidor.
- Ícone novo: copie o SVG do Lucide para `public/js/icons.js`.
- Animações respeitam `prefers-reduced-motion`.
- `public/sw.js` não guarda dados de propósito. Se mudar a lista de arquivos de reserva dele, troque o nome do cache (`mercadinho-v1`).
- Confira as telas em 375 px, notebook e desktop, nos temas claro e escuro.

## Mudar o banco

1. Edite `prisma/schema.prisma`.
2. Com o `DATABASE_URL` do banco de **desenvolvimento**, crie a migration:
   ```bash
   npx prisma migrate dev --name descricao_curta
   ```
3. Confira o SQL gerado em `prisma/migrations/<data>_descricao_curta/migration.sql`. Coluna obrigatória nova em tabela com dados precisa de valor padrão ou de preenchimento (veja `20261014000000_add_user_username`).
4. Aplique no banco de teste e rode a suíte.
5. Faça commit da pasta da migration junto com o schema.
6. Atualize o [modelo de dados](modelo-de-dados.md).

Nunca edite uma migration já aplicada em outro ambiente: crie outra.

## Checklist de uma mudança

- [ ] Regra nova ou alterada registrada em [requisitos e regras](requisitos-e-regras.md), com teste.
- [ ] `npm test` passando no banco de teste.
- [ ] Tela conferida no navegador, se mudou o frontend.
- [ ] Documentos atualizados conforme a tabela em [docs/README.md](../README.md#quando-o-código-muda-qual-documento-muda-junto).
- [ ] Entrada no [changelog](../evoluir/changelog.md).
- [ ] Nenhum `.env`, senha, token ou cookie no commit.

## Convenções de git

- Uma branch por tema: `claude/<tema>` (ou `<autor>/<tema>`), saindo de `master`.
- Commit em português, verbo na terceira pessoa, sem acento: `Corrige recuperacao de senha para nao expor token`.
- Um commit por tarefa. Pull request para `master`.

## Problemas comuns no ambiente

| Sintoma | Causa | Solução |
|---|---|---|
| `docker compose` não responde | Docker Desktop fechado | Abra o Docker Desktop e espere o ícone ficar verde |
| Banco não sobe: porta 5432 ocupada | Não deveria: o compose usa a 5433 | Confira se não mudou o `ports` |
| Porta 3000 ou 3100 ocupada | Outro processo (às vezes um Node esquecido) | Veja quem usa a porta antes de encerrar: `netstat -ano \| findstr :3000` |
| Contêiner `app` reinicia com `wait-for-db.sh: not found` | O script ficou com quebra de linha do Windows (CRLF) | `git add --renormalize .` e reconstrua a imagem |
| Sistema sobe sem usuários nem vendas | Volume novo e vazio | Confira o `name:` e o nome do volume no compose ([ADR-0010](adr/0010-docker-compose-local-com-nomes-fixos.md)) |
| Código novo não aparece no `localhost:3100` | Imagem antiga | `docker compose up -d --build app` |
| `npm test` recusa: "Recusando apagar o banco..." | `DATABASE_URL` aponta para um banco sem `test` no nome | Aponte para o banco de teste |
| Testes falham com 429 | `NODE_ENV` diferente de `test` | O próprio `test/integration.test.js` define `NODE_ENV=test`; não sobrescreva |

Mais casos em [runbooks](../sustentar/runbooks.md).
