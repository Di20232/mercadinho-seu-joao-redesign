# ADR-0019: Repetir só as leituras quando a conexão do banco morreu

- **Status:** Aceito
- **Data:** 06/11/2026 (commit `d491b32`, PR #2)

## Contexto

Depois de o banco ficar parado, reiniciar ou o computador dormir, o pool do Prisma ainda guarda conexões mortas. Cada uma falha uma vez com o erro P1017 ("Server has closed the connection") antes de ser trocada. O primeiro acesso do dia virava erro 500 ou demorava.

## Decisão

Uma extensão do Prisma em `src/db.js` passa toda operação por `retryStaleRead` (`src/retryStaleRead.js`): se a operação for uma **leitura** (`findUnique`, `findFirst`, `findMany`, `count`, `aggregate`, `groupBy` e variantes) e o erro for P1017, repete até 5 vezes. Escrita nunca é repetida.

## Consequências

- Ganha: o primeiro acesso depois de parado funciona sem erro.
- Ganha: nenhuma escrita duplicada, porque repetir uma escrita às cegas poderia gravar duas vezes.
- Perde: uma escrita que pegue conexão morta ainda falha; o usuário tenta de novo (a venda é idempotente, [ADR-0015](0015-venda-idempotente.md)).
- Perde: o limite de 5 tentativas supõe o pool padrão; se o pool for aumentado muito, subir `MAX_ATTEMPTS`.
- Perde: `$queryRaw` (busca sem acento, travas) não passa pela extensão de modelo e não é repetido.

## Alternativas consideradas

- Checar a conexão antes de cada consulta: custo em toda requisição.
- Aumentar o tempo de vida das conexões: não resolve reinício do banco.
