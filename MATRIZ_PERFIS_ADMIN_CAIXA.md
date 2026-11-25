# Matriz de Perfis — Admin/Caixa

**Projeto:** Mercadinho do João  
**Data:** 2026-10-14  
**Status:** decisão documentada para orientar Estoque, Relatórios, Recuperação de Senha e Auto-login.

## Decisão principal

O sistema tem dois perfis:

- **ADMIN**: dono/administrador do mercadinho. Pode acessar operações administrativas e relatórios financeiros globais.
- **CASHIER / Caixa**: operador de caixa. Pode vender e consultar informações operacionais mínimas, mas não administra estoque, usuários, importações ou relatórios globais.

Autorização precisa existir no backend. Esconder botão no frontend é apenas experiência de uso.

## Matriz de permissões

| Recurso / ação | ADMIN | CASHIER / Caixa | Observação técnica |
|---|---:|---:|---|
| Login/logout | ✅ | ✅ | Ambos usam `/api/auth/login`, cookie HttpOnly e `/api/auth/me`. |
| Auto-cadastro público | ✅* | ✅* | Conta nova nasce sempre como `CASHIER` e **desativada**, sem sessão, até o dono ligar em Usuários; não aceita `role` do cliente. |
| Auto-login de demonstração | ❌ | ✅ | Só local/dev, via `AUTO_LOGIN_ENABLED=true`; backend bloqueia ADMIN. |
| Registrar venda | ✅ | ✅ | `/api/sales` exige autenticação. Preço vem do banco. |
| Ver lista de vendas | ✅ todas | ✅ próprias | Backend filtra por `sellerId` para Caixa. |
| Ver detalhe de venda | ✅ todas | ✅ próprias | Caixa recebe 403 se acessar venda de outro usuário. |
| Cancelar venda | ✅ | ❌ | `/api/sales/:id/cancel` com `authorize('ADMIN')`. |
| Ver produtos ativos | ✅ | ✅ | Caixa não recebe `costPrice` nem margem. |
| Ver produtos inativos | ✅ | ❌ | `includeInactive=true` só vale para ADMIN. |
| Criar/editar/desativar produto | ✅ | ❌ | Rotas de escrita em produtos usam `authorize('ADMIN')`. |
| Entrada de estoque | ✅ | ❌ | Estoque administrativo, não operação de caixa. |
| Ajuste/perda de estoque | ✅ | ❌ | Evita que caixa altere saldo manualmente. |
| Histórico de movimentações | ✅ | ❌ | Hoje fica dentro do roteador de estoque ADMIN-only. |
| Importar planilha | ✅ | ❌ | Importação altera cadastro/estoque em massa. |
| Relatório de vendas | ✅ | ❌ | `/api/reports/*` permanece ADMIN-only. |
| Painel financeiro do dashboard | ✅ | ❌ | Totais de hoje/mês e produtos parados só para ADMIN. |
| Alertas operacionais do dashboard | ✅ | ✅ | Estoque baixo/vencimento são operacionais. |
| Gerenciar usuários | ✅ | ❌ | Usuários criados pelo ADMIN são sempre `CASHIER`. |
| Redefinir senha própria por token | ✅ | ✅ | Token hashado, expira e uso único. |
| Redefinir senha de terceiros na tela de usuários | ✅ | ❌ | Via edição de usuário pelo ADMIN; incrementa `sessionVersion`. |

## Regras para os próximos ajustes

1. **Auto-login nunca deve entrar como ADMIN.** Se a conta configurada for ADMIN, a rota deve retornar 403.
2. **Produção nunca deve habilitar auto-login.** Mesmo com env configurada, `NODE_ENV=production` deve manter desabilitado.
3. **Caixa nunca vê preço de custo, margem ou relatórios globais.** Isso precisa ser garantido na API.
4. **Estoque e importação são administrativos.** Caixa registra venda; baixa de estoque acontece na transação da venda.
5. **Recuperação de senha não deve enumerar usuários.** E-mail inexistente recebe mensagem genérica e não gera erro 500.
6. **Tokens de reset são de uso único.** Reutilização ou token expirado deve retornar erro.

## Checks antes de commitar

- Rodar testes de integração e segurança.
- Conferir que não há `.env`, cookie, token, senha real ou resposta de login no commit.
- Conferir que `/api/auth/auto-login`:
  - fica 404 quando desabilitado;
  - recusa ADMIN com 403;
  - só cria sessão para `CASHIER` configurado no servidor.
- Conferir que `/api/reports/*`, `/api/stock/*`, `/api/users/*` e `/api/imports/*` bloqueiam Caixa.
- Conferir que a UI esconde abas administrativas para Caixa, mas sem depender disso para segurança.
