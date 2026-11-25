# Plano de desenvolvimento — pendências da Semana 12 (24/11/2026)

Arquivo de acompanhamento, atualizado durante o trabalho. Fonte das tarefas: ClickUp,
lista "Semana 12 · 09/11–13/11 · Interface e deploy".

- **Branch:** `claude/pendencias-semana-12` (rebaseada sobre `redesign/master`, `a82c5a1`)
- **Banco de teste:** `mercadinho_joao_test` no container (porta 5433). O banco de desenvolvimento não é tocado por teste.
- **Regra:** um commit por tarefa. Sem push e sem PR até o Diego pedir.

## Ordem e motivo

Primeiro o que garante a rede de segurança (testes), depois limpeza e refatoração
(mudam código, precisam dos testes), depois o teste manual (pega o que os testes
não pegam), e por último o que depende de conta ou senha do Diego.

| # | Etapa | Tarefa no ClickUp | Depende do Diego? | Situação |
|---|---|---|---|---|
| 0 | Ambiente: Docker, branch, rodar as duas suítes como linha de base | — | não | concluído: 44/44 de base |
| 1 | Incluir `test/security.test.js` no `npm test` | [86e3z0j15](https://app.clickup.com/t/86e3z0j15) | não | concluído `5c60563` |
| 2 | Apagar `src/mock-db.js` (sem uso, tem senha no código) | [86e3z0j16](https://app.clickup.com/t/86e3z0j16) | não | concluído `76dc802` |
| 3 | Apagar scripts soltos da raiz e o auto-login repetido | [86e3z0j18](https://app.clickup.com/t/86e3z0j18) | não | concluído `1baead3` |
| 4 | Juntar o erro "já cadastrado" numa função só | [86e3pu0j3](https://app.clickup.com/t/86e3pu0j3) | não | concluído `d0f08c3` |
| 5 | Abrir o sistema e clicar em cada tela, com uma venda de teste | [86e3z0j13](https://app.clickup.com/t/86e3z0j13) | não | concluído (ver registro) |
| 6 | Revisar as telas no celular (375 px) e corrigir | [86e3pu0p4](https://app.clickup.com/t/86e3pu0p4) | não | concluído `b7f7b41` |
| 7 | E-mail de "esqueci minha senha" | [86e3pu0e5](https://app.clickup.com/t/86e3pu0e5) | **sim**: senha de app do Gmail no `.env` | código e README prontos; falta o `.env` |
| 8 | Colocar o sistema no ar | [86e3pu0qv](https://app.clickup.com/t/86e3pu0qv) | **sim**: contas no Neon/Supabase e Render/Railway | README e build prontos; falta publicar |
| 9 | Atualizar ClickUp, este arquivo e o cofre | — | não | concluído |

## Detalhe de cada etapa

### 1. Testes de segurança no `npm test`
- Hoje o script roda só `test/integration.test.js`; `test/security.test.js` fica de fora.
- Mudar para `node --test test/integration.test.js test/security.test.js` e rodar.

### 2. `src/mock-db.js`
- Nenhum arquivo importa `mock-db` (conferido com grep). Apagar e rodar os testes.

### 3. Scripts soltos
Levantamento (grep por nome em todo o projeto, fora `node_modules`):

| Arquivo | Usado por | Decisão |
|---|---|---|
| `create-admin.js` | nada (o `npm run seed` já cria o admin) | conferir e apagar |
| `setup-diego.js` | nada | conferir e apagar |
| `verify-user.js` | nada | conferir e apagar |
| `simulate-data.js` | só citado em `PROJETO_COMPLETO.md` (`npm run simulate:sales` substitui) | conferir e apagar |
| `fluxos-completos.js` | só citado em `REBRANDING_COMPLETO.md` | conferir e apagar |
| `test-relatorios.js` | só citado em `RELATORIO_DE_VENDAS_FIXES.md` (coberto pela suíte) | conferir e apagar |
| `reset-password.js` (raiz) | o `npm run reset-password` usa `prisma/resetPassword.js` | conferir e apagar |
| `public/auto-login.js`, `public/auto-login.css` | a página usa `/js/auto-login.js` e `/css/style.css` | apagar |
| `public/css/auto-login.css` | nenhuma página carrega | apagar |
| `wait-for-db.sh` | `Dockerfile` | **manter** |
| `produtos-importacao.csv` | exemplo citado no README | **manter** |

As citações nos `.md` antigos são atualizadas junto.

### 4. Erro "já cadastrado"
A mesma regra aparece em `routes/auth.js`, `routes/users.js`, `routes/products.js` (2×) e `routes/imports.js`:
checar se já existe → 409, e de novo tratar `P2002` (corrida entre duas requisições) → 409.
Criar um helper único (ex.: `src/uniqueError.js`) que traduz o `P2002` para 409 com a mensagem
de cada recurso, e usá-lo nos 5 lugares sem mudar nenhuma mensagem que o usuário vê.

### 5 e 6. Teste com as mãos
- Subir o app, entrar como dono e como caixa, passar por todas as telas e fazer uma venda de teste
  (no banco de desenvolvimento; a venda pode ser cancelada depois, e o estoque volta).
- Repetir em 375 px. Cada erro vira uma tarefa no ClickUp; o que for de layout no celular é corrigido aqui.

### 7. E-mail (precisa do Diego)
- Eu confiro o código e o `.env.example`. O Diego cria a senha de app do Gmail e preenche `SMTP_*` no `.env`.
- Depois eu testo o "esqueci minha senha" e conferimos juntos se o e-mail chegou.

### 8. Deploy (precisa do Diego)
- Eu reviso a seção "Publicando na nuvem" do README, o `Dockerfile` e a configuração de produção
  (`COOKIE_SECURE`, `TRUST_PROXY`, `CLIENT_ORIGIN`, `JWT_SECRET`) e deixo um passo a passo.
- Criar as contas e publicar fica com o Diego (eu não crio contas nem publico nada sem ele).

## Registro

**24/11/2026**
- Linha de base: 44/44. Final antes do rebase: **48/48**.
- **Rebase:** o repositório `Di20232/mercadinho-seu-joao` não existe mais; o ativo é `Di20232/mercadinho-seu-joao-redesign`, cujo `master` tinha 5 commits a mais (permissões por pessoa, idempotência da venda, tutorial, planilhas de teste). A branch foi rebaseada sobre ele. Conflitos só na regra de "já cadastrado" (rotas com `requirePermission` e preço opcional via `decimalOrNull`, ambos mantidos) e nos testes (os dois lados ficaram). Os 47 testes do upstream eram a origem do "47" do ClickUp. Final: **54/54**.
- `5c60563` `npm test` roda as duas suítes.
- `76dc802` remove `src/mock-db.js`.
- `1baead3` remove 7 scripts soltos da raiz e as 3 cópias antigas do auto-login; ajusta citações nos `.md`.
- `d0f08c3` regra única de "já cadastrado" em `src/uniqueError.js`. Os 409 de duplicado não tinham teste: foram adicionados 3, que passam no código antigo e no novo.
- Teste manual num banco separado (`mercadinho_joao_test_manual`, porta 3001): venda de R$ 54,70, entrada de estoque, usuário com e-mail repetido, painel e relatórios. **Não feito à mão:** login como caixa e importação completa (cobertos pelos testes).
- `b7f7b41` celular e notebook: filtro de datas estourando, valores cortados, alvos de toque de 17–31px, coluna de ações escondida, carrinho espremido em 1024px.
- `dec27db` rótulos do gráfico encavalados no último dia.
- `3e2ecdd` produção exige `APP_BASE_URL` (o link do e-mail sairia como localhost).
- `798359d` README: e-mail, deploy (modo Node, `npm ci --include=dev`) e testes. Build e subida em produção conferidos localmente.
- Erro registrado no ClickUp: busca sem acento.
