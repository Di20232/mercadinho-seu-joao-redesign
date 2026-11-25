# ADR-0013: Publicar na nuvem em modo Node, não pelo Dockerfile

- **Status:** Aceito (o sistema ainda não foi publicado)
- **Data:** 24/11/2026 (commit `2e99c72`, seção "Publicando na nuvem" do README)

## Contexto

O `Dockerfile` foi feito para o `docker-compose`: o `CMD` espera o banco num host chamado `db` (`wait-for-db.sh db 5432`) antes de rodar as migrations. Na nuvem o banco é gerenciado (Neon ou Supabase) e não existe host `db`. Os provedores-alvo (Render, Railway) rodam Node diretamente.

## Decisão

Publicar como serviço web Node:

- Build: `npm ci --include=dev && npx prisma migrate deploy`. O `--include=dev` é necessário porque, com `NODE_ENV=production`, o `npm ci` pularia o pacote `prisma` (devDependency), e o `postinstall` (`prisma generate`) e as migrations falhariam.
- Start: `node src/server.js`.
- Banco: PostgreSQL gerenciado, string de conexão **direta** (sem pooler), com `sslmode=require`.
- Variáveis obrigatórias em produção: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` forte, `APP_BASE_URL` e `CLIENT_ORIGIN` com o endereço público, `TRUST_PROXY=1`.

Complemento (25/11/2026): o caminho preparado é o Blueprint `render.yaml` do Render. O build também roda o seed do dono quando `ADMIN_EMAIL` está definido (idempotente: não cria um segundo dono), o que dispensa o shell. Sem `APP_BASE_URL`, vale o `RENDER_EXTERNAL_URL`, e `TZ=America/Sao_Paulo` vem no arquivo.

## Consequências

- Ganha: nada de registry de imagem; o provedor builda a partir do repositório.
- Ganha: o servidor recusa subir com configuração perigosa (RN-29).
- Perde: o ambiente de produção (Node do provedor) difere do local (imagem `node:20`). Fixar a versão do Node no provedor (ex.: `engines` ou variável do provedor) é necessário para não divergir.
- Perde: as migrations rodam no build; uma migration que falha derruba o deploy, o que é desejável, mas exige conferir antes.

## Alternativas consideradas

- Usar o `Dockerfile` na nuvem: exigiria tirar o `wait-for-db.sh db` ou tornar o host configurável.
- Rodar as migrations no start: cada reinício tentaria migrar.
