# ADR-0003: Guardar a sessão num JWT em cookie `httpOnly` e revalidar o usuário no banco a cada requisição

- **Status:** Aceito
- **Data:** 02/10/2026 (commit `4193f48`, migration `20261002000000_add_session_version_and_password_reset`). O JWT em cookie existe desde 27/08/2026.

## Contexto

Um JWT sozinho prova quem o usuário era no momento do login. Sem consultar o banco, desativar um funcionário demitido ou trocar uma senha vazada só teria efeito quando o token expirasse (até 8 horas). Guardar o token em `localStorage` o deixaria ao alcance de qualquer script injetado na página.

## Decisão

- O JWT (HS256, issuer `mercadinho-joao-api`, audience `mercadinho-joao-web`, validade 8 h) vai no cookie `mj_token`, `httpOnly`, `SameSite=Lax`, `Secure` em produção.
- O token carrega `sub` (id), `role` e `sv` (versão da sessão).
- A cada requisição, `authenticate` (`src/auth.js`) busca o usuário pelo id e exige que exista, esteja ativo e tenha `sessionVersion` igual a `sv`.
- Trocar a senha (reset, tela de usuários ou `npm run reset-password`) incrementa `sessionVersion`, o que invalida todos os tokens emitidos antes.

## Consequências

- Ganha: desativar conta e trocar senha cortam o acesso na hora (teste "revogação de sessão").
- Ganha: o papel usado na autorização é o atual do banco, não o que estava no token.
- Ganha: JavaScript da página não lê o token.
- Perde: uma consulta por chave primária em toda requisição autenticada. Desprezível neste volume.
- Perde: não há "sair de todos os aparelhos" sem trocar a senha, e o logout só apaga o cookie daquele navegador (o token continua válido até expirar se alguém o tiver copiado).

## Alternativas consideradas

- Sessão em tabela no banco: mesmo custo de consulta, mais uma tabela para limpar.
- JWT sem revalidação: barato, mas não revoga acesso.
