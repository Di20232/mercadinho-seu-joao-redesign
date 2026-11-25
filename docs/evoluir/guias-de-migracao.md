# Guias de migração

Passo a passo para atualizar versão, banco, runtime ou fornecedor sem quebrar. Antes de qualquer um: [backup](../sustentar/backup-e-continuidade.md) e `npm test` verde no banco de teste.

## Roteiro geral de atualização

1. Leia o [changelog](changelog.md) desde a versão em uso. Procure **⚠ Quebra**.
2. Faça backup do banco.
3. Atualize o código (`git pull` ou o deploy do provedor).
4. Ajuste as variáveis de ambiente que a versão nova pede.
5. Aplique as migrations (`npx prisma migrate deploy`; no Docker local e no build da nuvem isso já é automático).
6. Confira: login, uma venda de teste cancelada em seguida, Painel e Relatórios.
7. Deu errado: [rollback](../sustentar/runbooks.md#rollback-de-uma-versão).

## Banco: migrations existentes

As migrations ficam em `prisma/migrations/` e são aplicadas em ordem. Todas são para a frente; não há migration de volta.

| Migration | Efeito em dados existentes | Cuidado |
|---|---|---|
| `20260827005750_init` | cria tudo | só em banco vazio |
| `20261002000000_add_session_version_and_password_reset` | `sessionVersion = 0` para todos | nenhum |
| `20261014000000_add_user_username` | gera `username` para cada conta, com a mesma regra do código | os nomes de usuário são aleatórios; avise a equipe do login curto novo |
| `20261030000000_add_sale_idempotency_key` | vendas antigas ficam com chave nula | nenhum |
| `20261106000000_add_user_permissions_and_pending_price` | todas as contas da equipe ficam **sem permissões extras** (só vendem); preços passam a aceitar nulo | depois de aplicar, o dono precisa marcar as permissões de quem cuida de estoque e de dinheiro |

Conferir o que falta aplicar:

```bash
npx prisma migrate status
```

## Do pré-1.0 para a 1.0.0 (branch `claude/pendencias-semana-12`)

1. Defina `APP_BASE_URL` com o endereço público **antes** de subir em produção; sem ela o servidor não inicia.
2. Os scripts soltos da raiz foram removidos. Use: `npm run seed` (no lugar de `create-admin.js`), `npm run reset-password -- email` (no lugar de `reset-password.js`), `npm run simulate:sales` (no lugar de `simulate-data.js`).
3. Se vier de antes de 06/11/2026, aplique as duas migrations novas e marque as permissões da equipe em Usuários.
4. Produtos vendidos por peso precisam ter a unidade certa (KG, G, L, LT, ML, M, MT): com UN, a venda agora recusa fração. Confira em Produtos antes de liberar o caixa.
5. Relatório por e-mail e app instalável não pedem configuração além do SMTP e do HTTPS.

## Do Docker local para a nuvem

Para levar os dados que já estão no computador da loja para o banco gerenciado:

1. Gere um backup no formato custom do banco local ([como](../sustentar/backup-e-continuidade.md#fazer-backup)).
2. Crie o banco na nuvem (PostgreSQL 16) e anote a string de conexão direta.
3. Restaure lá:
   ```bash
   pg_restore --no-owner --no-acl -d "<DATABASE_URL da nuvem>" backup_mercadinho_joao_AAAA-MM-DD.dump
   ```
   O backup já contém a tabela `_prisma_migrations`, então o `prisma migrate deploy` do build não reaplica nada.
4. Publique o serviço ([deploy](../sustentar/deploy-e-infraestrutura.md#publicar-na-nuvem-primeira-vez)) **sem** rodar o `npm run seed` (o dono já existe no backup).
5. Confira contagens (usuários, produtos, vendas) e a data da última venda, como no [ensaio de restauração](../sustentar/backup-e-continuidade.md#2-conferir).
6. Pare de usar o sistema local, para não haver vendas nos dois lugares.

Ainda não executado: o sistema não foi publicado.

## Node 20 para Node 22

O Node 20 saiu de suporte em 30/04/2026 e a imagem Docker ainda usa `node:20-bookworm-slim` (DT-07).

1. No `Dockerfile`: `FROM node:22-bookworm-slim`.
2. No `package.json`: `"engines": { "node": ">=22" }`.
3. Na nuvem: fixe Node 22 no provedor.
4. `docker compose up -d --build app`, depois `npm test` e a conferência manual.

Os 72 testes já passam com Node 22.23.2 (máquina de desenvolvimento, 25/11/2026). O que falta conferir é a imagem Docker com 22.

## Atualizar dependências com versão maior

Uma por vez, cada uma no seu pull request ([regras](dependencias.md#regras-para-mexer-em-dependência)). O que muda em cada uma, segundo as notas de versão dos projetos, e onde mexer aqui:

| Dependência | O que muda | Onde mexer neste projeto | Como conferir |
|---|---|---|---|
| `zod` 3 → 4 | mensagens e formato dos erros, `.strict()`/`.passthrough()`, `z.string().email()`, `required_error` | todos os schemas em `src/routes/*.js`; `src/validate.js` (usa `error.issues` e `flatten()`) | testes de validação e de login (as mensagens exatas são conferidas) |
| `nodemailer` 9 → 10 | API de transporte e opções de TLS | `src/jobs/dailyAlerts.js` (`buildTransport`) | e-mail real de "esqueci minha senha" e do alerta diário |
| `express` 4 → 5 | erros de handler `async` tratados nativamente; sintaxe de rotas com curingas; `req.query` só leitura | `src/app.js`, remover `express-async-errors`; conferir que nenhuma rota reescreve `req.query` (o `validate` só troca `req.body` por padrão) | suíte completa |
| `helmet` 7 → 8 | padrões de cabeçalhos | `src/app.js` (CSP) | abrir as telas e ver o console sem erro de CSP |
| `express-rate-limit` 7 → 8 | nomes de opções | `src/app.js`, `src/routes/auth.js` | teste manual de 11 logins errados |
| `@prisma/client` e `prisma` 5 → 7 | gerador e configuração do cliente, versão mínima do Node | `prisma/schema.prisma`, `src/db.js`, Dockerfile | `prisma migrate status`, suíte completa |
| `bcryptjs` 2 → 3 | prefixo do hash (`$2b$`) e módulos | `src/auth.js`, scripts de `prisma/` | entrar com uma senha criada antes da atualização |
| `dotenv` 16 → 18 | mensagens no console e padrões | `src/config.js` e scripts | subir o servidor e ler o log |

Antes de mexer, confirme os detalhes nas notas de versão oficiais de cada pacote: esta tabela é guia de onde olhar, não substitui a leitura.

## Trocar de fornecedor

| Troca | O que muda | Passos |
|---|---|---|
| Banco (Neon ↔ Supabase ↔ outro PostgreSQL) | só `DATABASE_URL` | backup no antigo → restore no novo → trocar a variável → reiniciar |
| Hospedagem (Render ↔ Railway ↔ VPS) | variáveis, `TRUST_PROXY`, domínio | recriar as variáveis da [tabela](../sustentar/deploy-e-infraestrutura.md#variáveis-de-ambiente); `APP_BASE_URL` e `CLIENT_ORIGIN` com o domínio novo |
| E-mail (Gmail ↔ outro SMTP) | `SMTP_*` | trocar as variáveis, reiniciar, conferir no log `[alertas] Conexão SMTP verificada com sucesso.` |
