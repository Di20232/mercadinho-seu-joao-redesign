# ADR-0012: Testar por integração contra um PostgreSQL real, com trava contra apagar o banco errado

- **Status:** Aceito
- **Data:** 27/08/2026 (commit `0dd5eaf`)

## Contexto

Os bugs mais graves encontrados na auditoria (corrida de estoque, sessão não revogada, autorização) só aparecem com banco de verdade e requisições HTTP de verdade. Mock de banco não reproduz `UPDATE` condicional nem concorrência.

## Decisão

- Test runner nativo do Node (`node:test`), sem dependência nova.
- `test/integration.test.js` sobe o `app` do Express numa porta aleatória e faz requisições HTTP reais contra um PostgreSQL real.
- Antes de rodar, `resetDb()` apaga todas as tabelas, mas **recusa** se o nome do banco em `DATABASE_URL` não contiver `test` (ou sem `ALLOW_DB_RESET=true`).
- `test/security.test.js` cobre JWT, CORS, cálculo de preço e a configuração de produção, sem banco.
- Com `NODE_ENV=test`, os limites de tentativa de login, cadastro e senha ficam desligados para a suíte não tomar 429.

## Consequências

- Ganha: os testes provam o comportamento real, inclusive concorrência.
- Ganha: rodar `npm test` com o `.env` de desenvolvimento por engano não destrói os dados.
- Perde: precisa de um PostgreSQL rodando e de um banco de teste com as migrations aplicadas.
- Perde: os testes compartilham um banco e rodam em sequência; duas pessoas rodando a suíte no mesmo banco ao mesmo tempo atrapalham uma à outra.

## Alternativas consideradas

- Mocks do Prisma: rápidos, mas não pegam os bugs que importam aqui.
- Testcontainers: isola cada execução, mas adiciona dependência e exige Docker no teste.
