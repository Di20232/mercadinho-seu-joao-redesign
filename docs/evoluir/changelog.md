# Changelog e versionamento

Mudanças técnicas, da mais nova para a mais antiga, no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). A versão para quem usa o sistema, em linguagem do dia a dia, está em [novidades](../usar/release-notes.md).

## Política de versão

O projeto ainda **não tem tags** e o `package.json` está parado em `1.0.0`. Proposta:

- O `master` de 25/11/2026 (primeira versão pronta para produção, com os PRs #2 a #9) vira a tag **`v1.0.0`**. O histórico anterior fica como "pré-1.0", por data.
- Daí em diante, [SemVer](https://semver.org/lang/pt-BR/) adaptado a um sistema web:
  - **MAIOR** (`2.0.0`): exige ação manual para atualizar (variável de ambiente nova obrigatória, migration que precisa de cuidado, rota da API removida ou com contrato diferente, função removida).
  - **MENOR** (`1.1.0`): função nova sem quebrar nada; migration que só acrescenta.
  - **CORREÇÃO** (`1.0.1`): correção de defeito, sem mudar contrato.
- Toda mudança que quebra algo vem marcada com **⚠ Quebra** e diz o que fazer.
- Para lançar: atualizar `version` no `package.json`, mover "Não lançado" para a versão nova com a data, commit e `git tag -a vX.Y.Z -m "..."`.

## [Não lançado]: candidata a 1.0.0

`master` do repositório `Di20232/mercadinho-seu-joao-redesign` em 25/11/2026: PRs #2 a #9, mesclados entre 24 e 25/11, esta documentação, o PR #11 (correções do teste do sistema inteiro) e o PR #12 (Vendas no celular).

### Adicionado
- `render.yaml` (Blueprint do Render): serviço web Node 22, `TZ=America/Sao_Paulo`, `JWT_SECRET` gerado e o dono criado no build, sem shell. Sem `APP_BASE_URL`, o sistema usa o `RENDER_EXTERNAL_URL`.
- Documentação completa em `docs/`, organizada em usar, manter, sustentar e evoluir, com OpenAPI, ADRs e SBOM.
- Relatório por e-mail: `POST /api/reports/email`, resumo no corpo e Excel com cinco abas (`5090d02`, PR #3).
- App instalável no celular (PWA): manifest, service worker sem cache de dados, página offline, ícones e aviso "Instalar app" ([ADR-0018](../manter/adr/0018-app-instalavel-sem-cache-de-dados.md); `a60716d`, `b7cd290`, PRs #7 e #9).
- Busca de produto sem acento e sem maiúsculas (`1ad7a0e`, PR #5).
- `npm run simulate:history`: 2 anos de histórico de demonstração que fecha no estoque atual (`e404cf8`, PR #3).
- Planilha de exemplo com 300 produtos (`d479b1f`).
- `src/storeTime.js`: horário da loja (Brasília) independente do relógio do servidor, usado na planilha do histórico do estoque e no aviso de validade da importação (`8c4e3ed`, `f33e8fc`, PR #11).
- Conferência da importação mostra o que a linha muda num produto existente (nome, categoria, unidade, mínimo, validade) e avisa validade vencida (`e1bf58f`, PR #11).
- README: e-mail de "esqueci minha senha", publicação na nuvem e a suíte de testes (`2e99c72`).
- Testes de "já cadastrado", de vendas simultâneas, de quantidade, do relatório por e-mail e de unidade (exportador, histórico, conexão morta): a suíte foi de 54 para 72. Com o PR #11, de 72 para 81.

### Alterado
- `npm test` roda também `test/security.test.js` (`2c582f4`) e os três arquivos de teste de unidade.
- Venda e cancelamento travam os produtos em ordem fixa antes de ler o saldo ([ADR-0017](../manter/adr/0017-travar-produtos-da-venda-em-ordem.md); `50d7eef`, PR #8).
- Previsão mostra dias até esgotar como inteiro (`aa55de2`).
- Alvos de toque de 48 px no celular (`ac3ca35`, PR #6).
- Exportação do histórico do estoque: até 20.000 linhas com aviso de corte e tipo em português; CSV com campos entre aspas quando preciso (`5090d02`, `50d7eef`).
- A regra de "já cadastrado" ficou num lugar só, `src/uniqueError.js`, sem mudar mensagens (`c0d7f22`).
- Telas ajustadas para celular (375 px) e para o caixa em notebook (`6216c5a`).
- **⚠ Quebra (API):** `POST /api/auth/register` cria a conta **desativada** e não abre sessão; responde `{ id, name, email, username, role, active: false, message }`. Login de conta desativada com a senha certa dá 403 com mensagem própria; com a senha errada, o 401 "Login incorreto." de sempre ([ADR-0020](../manter/adr/0020-cadastro-publico-nasce-desativado.md); `08843e7`, PR #11). Contas já criadas pelo cadastro continuam ativas.
- O limite geral da API sobe só dentro da suíte de testes (`7fc3270`, PR #11).

### Corrigido
- Rótulos do gráfico do Painel encavalados no último dia (`18c6cc6`).
- Tela de Vendas cortada no celular com produtos no carrinho: a grade de uma coluna (`1fr`) não encolhia abaixo da largura da tabela. Agora `minmax(0, 1fr)`, e até 600 px o carrinho e as vendas recentes viram cartões (`5db36b8`, PR #12).
- Validade exibida um dia antes (gravada em meia-noite UTC e lida no fuso local), com o selo de vencido e os "dias para vencer" errados por um; o alerta diário deixava de fora o produto que vence hoje (`fedb477`, PR #11).
- Planilha do histórico do estoque com a data no fuso do servidor e sem a hora; no XLSX, a Data/Hora agora é data de verdade, e não texto (`04bca1a`, `8c4e3ed`, PR #11).
- Aviso de validade vencida da importação usava o dia do servidor: em UTC, das 21h à meia-noite, o produto que vence hoje saía como vencido (`f33e8fc`, PR #11).
- Erro 500 por impasse com dois caixas vendendo os mesmos produtos; histórico com saldos repetidos em vendas simultâneas (`50d7eef`).
- Quantidade com mais de 3 casas virava venda de R$ 0,00; produto por unidade aceitava fração (`50d7eef`). **⚠ Quebra (API):** essas vendas agora dão 400.
- Primeiro acesso depois de o banco ficar parado dava 500 ou demorava ([ADR-0019](../manter/adr/0019-repetir-leitura-com-conexao-morta.md); `d491b32`, PR #2).

### Removido
- `src/mock-db.js`, sem uso e com senha no código (`b41a5ae`).
- Scripts soltos da raiz (`create-admin.js`, `setup-diego.js`, `verify-user.js`, `simulate-data.js`, `fluxos-completos.js`, `test-relatorios.js`, `reset-password.js`) e as cópias antigas do auto-login (`4b4eec4`). Use os scripts `npm run` equivalentes.

### Segurança
- **⚠ Quebra (configuração):** em produção o servidor recusa subir sem `APP_BASE_URL` público (`c366295`). Defina a variável com o endereço do sistema antes de atualizar.

## Pré-1.0

### 06/11/2026: permissões por pessoa (`3d54ef3`, `dc61bdc`, PR #1)
- **Adicionado:** permissões por pessoa (`User.permissions`) e tipos Financeiro, Estoque e Caixa ([ADR-0014](../manter/adr/0014-permissoes-por-pessoa.md)); `GET /api/users/permissions`; produto aguardando preço ([ADR-0016](../manter/adr/0016-produto-aguardando-preco.md)); cancelamento da própria venda em até 10 minutos; `npm run seed:perfis`; planilhas de teste em `planilhas-teste/`.
- **Migration:** `20261106000000_add_user_permissions_and_pending_price`.
- **⚠ Quebra (API):** rotas antes exclusivas do `ADMIN` passam a exigir permissões; `costPrice`, `salePrice` e `margin` podem vir `null`; produto ganha `pricePending`; o auto-login recusa caixa com permissões extras. Contas existentes ficam sem permissões extras (continuam só vendendo).

### 30/10/2026 (`7678571`, `27aa549`)
- **Adicionado:** confirmação de venda idempotente com `Idempotency-Key` ([ADR-0015](../manter/adr/0015-venda-idempotente.md)); `TUTORIAL_INSTALACAO.md`.
- **Migration:** `20261030000000_add_sale_idempotency_key`.

### 26/10/2026: redesign (`d770846`, `d1c77b7`, `876523f`, `a7225f7`)
- **Alterado:** todas as telas redesenhadas (barra lateral, tema escuro, ícones e fonte locais, gráficos em SVG, `confirmDialog` no lugar do `confirm()`). Relatórios abrem em 30 dias em vez de "tudo".
- **Alterado:** limites de tentativa de login desligados com `NODE_ENV=test`.

### 23/10/2026 (`d806716`)
- **Adicionado:** exportação de relatórios e movimentações em CSV e XLSX. Nome fixo do projeto e do volume no compose ([ADR-0010](../manter/adr/0010-docker-compose-local-com-nomes-fixos.md)).

### 16/10/2026 (`5c6f5e1`, `a731a4f`, `89a0ab5`, `4f09428`)
- **Segurança:** a resposta de `forgot-password` nunca leva o token; o reset de senha derruba as sessões.
- **⚠ Quebra (implantação):** o admin não nasce mais com senha padrão; o seed exige `ADMIN_PASSWORD`.
- **Adicionado:** testes de estoque (cancelamento, ajuste, histórico) e de produtos parados.

### 14/10/2026 (`7acc972`, `8ef9c0b`, `da159fd`)
- **Alterado:** nome do sistema para Mercadinho do João, inclusive o issuer e a audience do JWT (`mercadinho-joao-api`, `mercadinho-joao-web`): sessões abertas antes deixam de valer.
- **Adicionado:** login por nome de usuário. Migration `20261014000000_add_user_username`, que preenche as contas existentes.
- **Corrigido:** o CORS aceita sempre a própria origem (o login falhava fora de `CLIENT_ORIGIN`).

### 09/10/2026 (`c26a819`)
- **Segurança:** JWT com issuer e audience, CORS com lista de origens, preço sempre calculado no servidor. Tokens emitidos antes ficam inválidos: todos entram de novo.
- **Adicionado:** simulação de vendas.

### 02/10/2026 (`4193f48`)
- **Adicionado:** auto-cadastro, recuperação de senha, paginação, comprovante de venda. Migration `20261002000000_add_session_version_and_password_reset`.

### 08/09/2026 (`e0824f8`)
- **Adicionado:** importação de produtos por planilha ([ADR-0008](../manter/adr/0008-importacao-em-duas-fases.md)).

### 27/08/2026 (`5a358a3` a `8ca8821`)
- **Adicionado:** primeira versão: vendas, produtos, estoque com histórico, previsão, produtos parados, alertas, relatórios, usuários, alerta diário por e-mail, suíte de testes, Docker Compose. Migration `20260827005750_init`.
