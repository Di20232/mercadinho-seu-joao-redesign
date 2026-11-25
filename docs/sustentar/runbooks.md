# Runbooks

Passo a passo para os incidentes conhecidos e as operações de rotina. Cada um diz o sintoma, como confirmar a causa e o que fazer. Os comandos de Docker valem para o ambiente local (`docker-compose.yml`); onde a nuvem é diferente, está indicado.

Regras gerais:

- **Confirme a causa antes de agir.** Leia o log (`docker compose logs --tail 100 app`) e veja o que está rodando (`docker compose ps`).
- **Antes de encerrar um processo, veja a linha de comando dele.**
- **Nunca use `docker compose down -v`** nem "Reset to factory defaults" do Docker Desktop: os dois apagam o banco.
- Antes de qualquer operação no banco de produção, faça um [backup](backup-e-continuidade.md).

## O sistema não abre ou o login dá erro

**Sintomas:** "Servidor indisponível..." na tela de entrada; ou "Não foi possível concluir o login. Verifique se o banco de dados/servidor está rodando..."; ou o navegador não carrega a página.

1. O Docker Desktop está aberto? `docker compose ps` responde?
   - Não responde: abra o Docker Desktop e espere ficar pronto. Os contêineres voltam sozinhos (`restart: unless-stopped`).
   - Numa sessão do Claude Code no Windows, abra o Docker Desktop pelo Explorer, não com `Start-Process` (ele trava ao herdar o ambiente do app).
2. Os dois contêineres estão `Up`? O `db` está `healthy`?
   ```bash
   docker compose ps
   ```
3. O log do app mostra "Banco de dados pronto!" e "rodando na porta 3000"?
   ```bash
   docker compose logs --tail 100 app
   ```
4. A página responde?
   ```bash
   curl -I http://localhost:3100/
   ```
   Esperado: `HTTP/1.1 200 OK`.
5. Se o `app` estiver em loop de reinício, veja os itens abaixo ("Contêiner app não sobe").

**Nuvem:** veja o status do serviço e os logs no painel do provedor; confira se o banco gerenciado está ativo (planos gratuitos podem suspender o banco por inatividade).

## Contêiner `app` não sobe

| O log diz | Causa | Ação |
|---|---|---|
| `wait-for-db.sh: not found` ou `/bin/sh^M` | Script com quebra de linha do Windows | `git add --renormalize .`, confira que o `.gitattributes` tem `*.sh text eol=lf`, `docker compose up -d --build app` |
| `✗ Banco de dados não ficou pronto em tempo hábil` | O `db` não subiu em 60 s | `docker compose logs db`; espaço em disco; reinicie com `docker compose up -d` |
| `Variável de ambiente obrigatória ausente em produção` / `JWT_SECRET inseguro` / `APP_BASE_URL ausente` | Configuração de produção incompleta | Defina a variável ([lista](deploy-e-infraestrutura.md#variáveis-de-ambiente)) |
| Erro do `prisma migrate deploy` | Migration falhou no banco | Não force. Leia o erro, restaure o backup se a migration ficou pela metade, corrija e publique de novo |
| `Error: P1001: Can't reach database server` | `DATABASE_URL` errada ou banco fora | Confira host, porta (5432 dentro do compose, 5433 fora) e senha |

## Porta ocupada

**Sintoma:** `docker compose up` falha com "port is already allocated", ou `npm run dev` com `EADDRINUSE`.

1. Descubra quem usa a porta (PowerShell):
   ```powershell
   Get-NetTCPConnection -LocalPort 3100 -State Listen | Select-Object OwningProcess
   ```
   ```powershell
   Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId, CommandLine
   ```
2. Se for um Node esquecido deste projeto, encerre-o. Se for outra coisa, mude a porta do lado deste projeto.
3. A 5432 costuma ser do PostgreSQL instalado no Windows. Por isso o compose usa a 5433. Não pare o PostgreSQL nativo sem saber quem usa.

## O sistema subiu sem usuários nem vendas

**Causa provável:** o compose criou um volume novo. Acontece quando o nome do projeto ou do volume muda.

1. Liste os volumes:
   ```bash
   docker volume ls | grep mercadinho
   ```
2. O volume certo é `mercadinho-seu-joao_mercadinho_joao_db_data`. Confira que o `docker-compose.yml` tem `name: mercadinho-seu-joao` e esse nome de volume.
3. Corrija o compose e suba de novo. Não apague nenhum volume antes de saber qual tem os dados.

## O código novo não aparece

**Sintoma:** mudou o código, mas o `localhost:3100` mostra a versão antiga.

O contêiner usa a imagem montada da última vez. Reconstrua só o app (o banco fica intacto):

```bash
docker compose up -d --build app
```

No log deve aparecer "No pending migrations to apply" ou a lista das migrations aplicadas.

## Reiniciar o sistema

```bash
docker compose restart app
```

Reiniciar zera os contadores de tentativas de login e dura poucos segundos. Quem estiver no meio de uma venda vê um erro e tenta de novo; a venda é tudo ou nada, não fica pela metade.

**Nuvem:** "Restart" ou "Manual deploy" no painel do provedor.

## Rollback de uma versão

1. **Sem migration nova na versão com problema:** volte o código.
   - Nuvem: no painel do provedor, "Rollback" para o deploy anterior; ou, no git, `git revert <commit>` em `master` e novo deploy.
   - Local: `git checkout <commit-anterior>` e `docker compose up -d --build app`.
2. **Com migration nova:** as migrations só andam para a frente. Voltar o código não desfaz a mudança no banco.
   - Se a migration só **adicionou** coluna ou tabela, o código antigo costuma funcionar com ela: volte só o código.
   - Se **removeu ou mudou** algo, restaure o backup feito antes do deploy ([backup](backup-e-continuidade.md#restaurar)) e então volte o código. Vendas feitas depois do backup se perdem: anote-as antes.
3. Registre o incidente na [base de conhecimento](seguranca-e-base-de-conhecimento.md#base-de-conhecimento).

## Dono esqueceu a senha

**Com e-mail configurado:** "Esqueci minha senha" na tela de entrada.

**Sem e-mail, fora de produção:** peça o link normalmente e copie do log:

```bash
docker compose logs app | grep forgot-password
```

**Em qualquer ambiente, com acesso ao servidor:**

```bash
docker compose exec app npm run reset-password -- dono@exemplo.com
```

O script pede a nova senha duas vezes sem mostrar na tela, reativa a conta se estava desativada e encerra as sessões abertas dela. Na nuvem, rode o mesmo comando no shell do serviço (`npm run reset-password -- dono@exemplo.com`).

## Funcionário esqueceu a senha

O dono define uma nova em **Usuários → lápis → Nova senha**. As sessões abertas do funcionário são encerradas.

## Funcionário saiu da empresa

O dono desliga a conta em **Usuários → lápis → Conta ativa**. O acesso cai na hora. A conta não é apagada porque as vendas dela continuam no histórico.

## Alguém precisa de uma permissão (ou perdeu uma)

O dono abre **Usuários → lápis** na conta da pessoa, marca ou desmarca a permissão e salva. Vale na próxima ação da pessoa; para a barra lateral mostrar as abas novas, ela atualiza a página. Se a pessoa diz que a tela mostra um botão mas a ação dá "Sem permissão para executar esta ação.", confira as permissões dela: a tela pode estar desatualizada, mas quem decide é o servidor.

## Produto não aparece no caixa

1. Está **aguardando preço**? Em Produtos, filtro "Aguardando preço" (visível para quem cadastra produtos). O dono ou o financeiro definem o preço.
2. Está **inativo**? Reative pelo lápis do produto.
3. A busca é só pelo nome (acento e maiúsculas não importam); código de barras não funciona na busca ([FAQ](../usar/faq.md#não-encontro-o-produto-na-busca)).

## Cancelar uma venda que não aparece nas recentes

A tela só cancela as 15 vendas mais recentes. Para uma mais antiga, logado no navegador como **dono** ou como alguém com "Ver as vendas de todos" e "Cancelar qualquer venda" (o tipo Financeiro):

1. Abra as ferramentas do desenvolvedor do navegador (F12), aba Console, na página do sistema.
2. Encontre a venda pela data. Nesta rota o `to` é exclusivo (meia-noite UTC do dia informado), então para o dia 20 use `to` = dia 21:
   ```js
   await fetch('/api/sales?from=2026-11-20&to=2026-11-21&pageSize=100').then(r => r.json())
   ```
3. Com o `id` da venda certa, cancele:
   ```js
   await fetch('/api/sales/<id>/cancel', { method: 'POST', headers: { 'X-Requested-With': 'fetch' } }).then(r => r.json())
   ```
   Esperado: `{ id: "...", canceled: true }`. O estoque volta e a devolução aparece no histórico.

Isso é contorno até existir uma tela de histórico de vendas ([roadmap](../evoluir/roadmap-e-divida-tecnica.md)).

## "Muitas tentativas..." (429)

**Login, cadastro ou senha:** espere 15 minutos (cadastro: 1 hora). Os contadores são por IP: numa loja com vários computadores na mesma internet, eles somam. Reiniciar o app zera os contadores.

**Uso normal (300 por minuto por IP) estourando:** suba `API_RATE_LIMIT_MAX` e reinicie. Na nuvem, confira se `TRUST_PROXY=1`: com `0`, o sistema vê o IP do proxy do provedor e todos os usuários contam como um só.

## E-mail não chega

1. Procure no log do app:
   ```bash
   docker compose logs app | grep -E "alertas|forgot-password"
   ```
2. Leia a linha:

| Log | Significa | Ação |
|---|---|---|
| `[alertas] SMTP não configurado` | `SMTP_HOST` vazio | Configure o SMTP |
| `[alertas] Não foi possível conectar ao servidor SMTP configurado` | Host, porta ou senha errados, ou porta bloqueada pelo provedor | Confira `SMTP_*`; no Gmail, use senha de app com verificação em duas etapas |
| `[alertas] Conexão SMTP verificada com sucesso.` | Conexão boa | O problema está no destino: spam, endereço |
| `[alertas] ALERT_EMAIL_TO contém um endereço inválido` | Endereço digitado errado | Corrija `ALERT_EMAIL_TO` |
| `[alertas] Nenhum alerta hoje.` | Nada para avisar | Normal |
| `[forgot-password] falha ao enviar e-mail de reset` | Envio falhou | Mesmo caminho da conexão |

3. No Docker local, lembre que o link sai com `http://localhost:3000` (dívida DT-14). Troque a porta por 3100 ao abrir.

## App instalado no celular

| Sintoma | Causa | Ação |
|---|---|---|
| Virou atalho com o selo do Google | Instalado pelo menu "Criar atalho" ou de dentro de outro app | Abrir no Chrome e usar "Instalar app"; apagar o atalho |
| Aviso de instalação não aparece | Sistema em HTTP fora de `localhost`, ou já instalado, ou o usuário tocou "Agora não" | Publicar em HTTPS; no Chrome, menu → "Instalar app" |
| Mostra a página "sem conexão" | Aparelho sem internet (o app não guarda dados) | Voltar à conexão; vendas no papel enquanto isso |
| Visual antigo depois de um deploy | Navegador com a página aberta há muito tempo | Fechar e abrir o app; o service worker busca tudo na rede primeiro |

## Estoque não bate com a prateleira

1. Veja o histórico do produto em **Estoque → Histórico**. Toda mudança tem saldo anterior e novo, quem fez e o motivo.
2. Confira se há venda cancelada, perda ou importação recente.
3. Ajuste com entrada ou perda, com o motivo "acerto de inventário" ([FAQ](../usar/faq.md#o-estoque-do-sistema-não-bate-com-a-prateleira)).

Se o histórico **não** explica a diferença, é um bug: abra um chamado N3 com o produto, as datas e um backup do banco.

## Aplicar migrations à mão

```bash
docker compose exec app npx prisma migrate status
docker compose exec app npx prisma migrate deploy
```

## Erro 500 numa tela

1. Anote a hora e a ação.
2. Procure o erro no log daquele horário: `docker compose logs --since 10m app`. O tratador central imprime a pilha completa.
3. Reproduza num ambiente local com o mesmo dado, corrija com teste e publique.
