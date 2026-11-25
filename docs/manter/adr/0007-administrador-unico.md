# ADR-0007: Ter um único administrador; toda outra conta é caixa

- **Status:** Substituído em parte por [ADR-0014](0014-permissoes-por-pessoa.md). Continua valendo: um único administrador, perfil não escolhido pelo cliente, admin não se desativa. Deixou de valer: "toda outra conta é só caixa".
- **Data:** 02/10/2026 (commit `4193f48`)

## Contexto

O mercadinho tem um dono e alguns funcionários. Com o auto-cadastro público ("Criar conta") e a criação de contas pela tela, aceitar o perfil vindo do cliente permitiria a qualquer pessoa se cadastrar como administrador. Um segundo admin também dividiria a responsabilidade pelos números.

## Decisão

- O perfil não é escolhido nem editado pela API. `POST /api/auth/register` usa um schema `.strict()` e fixa `CASHIER`; `POST /api/users` fixa `CASHIER`; `PUT /api/users/:id` não aceita `role`.
- O único admin é criado pelo `npm run seed`, que não cria outro se já existir um.
- O admin não pode desativar a si mesmo.

## Consequências

- Ganha: não existe caminho pela API para virar administrador.
- Ganha: ninguém fica trancado fora por se autodesativar.
- Perde: trocar de dono ou ter um gerente com acesso total exige mexer no banco. Não há tela para isso.
- Perde: se o dono perder a senha e o e-mail não estiver configurado, só quem tem acesso ao servidor resolve (`npm run reset-password`).

## Alternativas consideradas

- Perfis livres com tela de permissões: flexível demais para o tamanho do negócio e mais superfície de erro.
- Um perfil intermediário de gerente: não pedido pelo cliente.
