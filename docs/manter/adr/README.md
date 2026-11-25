# Registros de decisão de arquitetura (ADRs)

Cada ADR registra **uma** decisão: o contexto, o que foi decidido, o que se ganha e o que se perde. ADR não se edita depois de aceito: se a decisão mudar, escreva um novo e marque o antigo como "Substituído por ADR-XXXX".

As decisões abaixo foram reconstruídas em 24/11/2026 a partir do código, dos comentários no código e do histórico do git. A data é a do commit que introduziu a decisão.

| ADR | Decisão | Status | Data |
|---|---|---|---|
| [0001](0001-monolito-node-express-com-frontend-estatico.md) | Monólito Node/Express que serve a API e um frontend estático sem framework | Aceito | 27/08/2026 |
| [0002](0002-postgresql-prisma-e-decimal.md) | PostgreSQL com Prisma, valores em `Decimal` | Aceito | 27/08/2026 |
| [0003](0003-sessao-jwt-em-cookie-revalidada-no-banco.md) | Sessão JWT em cookie `httpOnly`, revalidada no banco a cada requisição | Aceito | 02/10/2026 |
| [0004](0004-csrf-por-cabecalho-customizado.md) | Defesa CSRF por cabeçalho `X-Requested-With` + `SameSite=Lax` | Aceito | 27/08/2026 |
| [0005](0005-baixa-de-estoque-atomica-no-banco.md) | Baixa e soma de estoque com UPDATE condicional atômico | Aceito, complementado por 0017 | 27/08/2026 |
| [0006](0006-exclusao-logica-de-produto.md) | Produto nunca é apagado, só desativado | Aceito | 27/08/2026 |
| [0007](0007-administrador-unico.md) | Um único administrador; toda outra conta é caixa | Substituído em parte por 0014 | 02/10/2026 |
| [0008](0008-importacao-em-duas-fases.md) | Importação em duas fases, uma transação por linha | Aceito | 08/09/2026 |
| [0009](0009-frontend-sem-cdn-e-csp-self.md) | Frontend sem CDN, com CSP só `'self'` | Aceito | 26/10/2026 |
| [0010](0010-docker-compose-local-com-nomes-fixos.md) | Docker Compose local com nome de projeto e volume fixos, banco na 5433 | Aceito | 16/10/2026 |
| [0011](0011-previsao-por-media-simples.md) | Previsão de esgotamento por média simples | Aceito | 27/08/2026 |
| [0012](0012-testes-de-integracao-contra-postgres-real.md) | Testes de integração contra PostgreSQL real, com trava de banco | Aceito | 27/08/2026 |
| [0013](0013-deploy-na-nuvem-em-modo-node.md) | Deploy na nuvem em modo Node, não pelo Dockerfile | Aceito | 24/11/2026 |
| [0014](0014-permissoes-por-pessoa.md) | Permissões por pessoa em vez de dois perfis fixos | Aceito | 06/11/2026 |
| [0015](0015-venda-idempotente.md) | Confirmação de venda idempotente com `Idempotency-Key` | Aceito | 30/10/2026 |
| [0016](0016-produto-aguardando-preco.md) | Produto sem preço ("aguardando preço") que não pode ser vendido | Aceito | 06/11/2026 |
| [0017](0017-travar-produtos-da-venda-em-ordem.md) | Travar os produtos da venda de uma vez, em ordem fixa | Aceito | 24/11/2026 |
| [0018](0018-app-instalavel-sem-cache-de-dados.md) | App instalável (PWA) sem guardar dados no aparelho | Aceito | 24/11/2026 |
| [0019](0019-repetir-leitura-com-conexao-morta.md) | Repetir só as leituras quando a conexão do banco morreu | Aceito | 06/11/2026 |
| [0020](0020-cadastro-publico-nasce-desativado.md) | Conta do cadastro público nasce desativada | Aceito | 25/11/2026 |

## Modelo para um ADR novo

Copie para `NNNN-titulo-curto.md`, com o próximo número livre.

```markdown
# ADR-NNNN: Título no imperativo

- **Status:** Proposto | Aceito | Substituído por ADR-XXXX
- **Data:** DD/MM/AAAA

## Contexto
O problema e as forças em jogo. Fatos, não opinião.

## Decisão
O que foi decidido, em uma ou duas frases.

## Consequências
- Ganha: ...
- Perde: ...

## Alternativas consideradas
- Alternativa: por que não.
```
