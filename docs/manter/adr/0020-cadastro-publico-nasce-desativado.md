# ADR-0020: Conta do cadastro público nasce desativada

- **Status:** Aceito
- **Data:** 25/11/2026 (commit `08843e7`, PR #11; decisão do Diego no teste do sistema inteiro da Semana 13)

## Contexto

O link "Criar conta" da tela de entrada criava um caixa **ativo** e já abria a sessão. Enquanto o sistema rodava só na rede da loja, isso era cômodo. Publicado na internet (link de teste e, depois, o deploy na nuvem), qualquer pessoa que achasse o endereço poderia se cadastrar e registrar vendas, mexendo no estoque. O teste do sistema inteiro da Semana 13 registrou isso como achado 5.

## Decisão

- `POST /api/auth/register` cria a conta `CASHIER`, sem permissões, com `active = false`, e **não** abre sessão. A resposta traz o nome de usuário e uma mensagem dizendo que o dono precisa liberar.
- O dono libera ligando a conta em Usuários (`PUT /api/users/:id` com `active: true`).
- Login de conta desativada: com a senha certa, 403 com mensagem própria ("Sua conta ainda não foi liberada, ou foi desativada..."); com a senha errada, o mesmo 401 "Login incorreto." de uma conta que não existe, para não confirmar a um estranho que a conta existe e está parada.
- Contas já criadas pelo cadastro antes da mudança continuam ativas.

## Consequências

- Ganha: com o sistema na internet, ninguém de fora vende nem mexe no estoque sem o dono saber.
- Ganha: a pessoa nova continua podendo se cadastrar sozinha; o dono só liga a conta.
- Perde: um passo a mais para o dono a cada funcionário novo.
- Perde: a mensagem própria do 403 confirma que a conta existe a quem já sabe a senha, o que é aceitável.

## Alternativas consideradas

- Tirar o "Criar conta": o dono teria de digitar a senha de cada funcionário na tela Usuários.
- Código de convite: mais seguro para muitas contas, mas exige gerar e mandar o código; exagero para um mercadinho com poucos funcionários.
- Manter como estava: inaceitável com o endereço público.
