# ADR-0014: Dar permissões por pessoa em vez de dois perfis fixos

- **Status:** Aceito. Substitui em parte o [ADR-0007](0007-administrador-unico.md).
- **Data:** 06/11/2026 (commit `3d54ef3`, PR #1 `perfis-por-pessoa`; migration `20261106000000_add_user_permissions_and_pending_price`)

## Contexto

Com dois perfis fixos (dono e caixa), tudo o que não era vender ficava com o dono. A loja passou a ter gente cuidando do estoque e gente cuidando do dinheiro. Dar o perfil de dono a essas pessoas abriria tudo, inclusive usuários e preços para quem só recebe mercadoria.

## Decisão

- O papel (`role`) continua com dois valores: `ADMIN` (o dono, único) e `CASHIER` (toda a equipe).
- Cada conta `CASHIER` ganha uma lista `permissions` (`text[]` no banco) com chaves fixas definidas em `src/permissions.js`: `sales.viewAll`, `sales.cancel`, `reports.view`, `prices.manage`, `products.manage`, `stock.manage`.
- O dono tem todas, sempre (`effectivePermissions`). Só ele mexe em usuários e permissões (`/api/users` segue com `authorize('ADMIN')`).
- As rotas usam `requirePermission(...)`, que libera se a pessoa tiver **qualquer** uma das permissões listadas.
- Três modelos prontos no formulário: Financeiro, Estoque, Caixa. Combinação fora dos modelos aparece como "Personalizado".
- As permissões são lidas do banco a cada requisição, junto com a revalidação da sessão ([ADR-0003](0003-sessao-jwt-em-cookie-revalidada-no-banco.md)), então mudam na hora.
- Contas que já existiam ficam com lista vazia: continuam só vendendo.
- Qualquer pessoa cancela a **própria** venda até 10 minutos depois (`OWN_SALE_CANCEL_MINUTES`), para desfazer engano no balcão sem chamar o dono.
- O frontend marca blocos com `data-perm="stock|reports|prices|catalog|manage"` e esconde o que a pessoa não pode usar. Isso é só conforto: a API decide.

## Consequências

- Ganha: divisão de trabalho sem dar acesso total; mudança de permissão sem novo login.
- Ganha: a lista de permissões é fechada (Zod `z.enum(ALL)`); permissão inventada é recusada (400).
- Perde: a matriz de acesso ficou mais difícil de ver de relance; a tabela em [requisitos](../requisitos-e-regras.md#permissões) e no [manual](../../usar/manual-do-usuario.md#quem-pode-fazer-o-quê) precisa acompanhar `src/permissions.js`.
- Perde: nova função que precise de controle exige uma chave nova em `PERMISSIONS`, o uso em `requirePermission` e, se for o caso, um ajuste nos modelos.
- Perde: o auto-login de demonstração passou a recusar caixa com qualquer permissão extra.

## Alternativas consideradas

- Mais papéis fixos (`FINANCEIRO`, `ESTOQUE`): menos flexível; cada combinação nova viraria um papel.
- Permissões numa tabela à parte: mais normalizado, mas uma coluna de array resolve com uma leitura só e sem junção.
