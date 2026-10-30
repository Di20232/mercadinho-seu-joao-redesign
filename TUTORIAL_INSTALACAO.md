# Tutorial: clonar e rodar o Mercadinho do João em outra máquina

Este passo a passo leva do zero até o sistema aberto no navegador. Os comandos são para **PowerShell no Windows**; no Mac/Linux funcionam iguais, trocando só o que está marcado.

Repositório: https://github.com/Di20232/mercadinho-seu-joao-redesign

## 1. O que instalar antes

| Programa | Para quê | Versão | Download |
|---|---|---|---|
| **Git** | baixar o código | qualquer recente | https://git-scm.com/downloads |
| **Docker Desktop** | rodar o banco PostgreSQL (e, se quiser, o app inteiro) | qualquer recente | https://www.docker.com/products/docker-desktop |
| **Node.js** | rodar o app sem Docker e os testes | 20 ou mais novo (o `package.json` exige 18+) | https://nodejs.org (versão LTS) |

O Node só é necessário no **Caminho B**. No Caminho A tudo roda dentro do Docker.

Confira no terminal:

```bash
git --version
docker --version
node --version
```

Abra o **Docker Desktop** e espere ele ficar "Running" antes de continuar. Sem isso, qualquer comando `docker` falha com "failed to connect to the docker API".

## 2. Baixar o código

```bash
git clone https://github.com/Di20232/mercadinho-seu-joao-redesign.git
cd mercadinho-seu-joao-redesign
```

Se o repositório for privado, o Git abre o navegador para você entrar no GitHub na primeira vez. Use a conta que tem acesso ao repositório.

## 3. Criar o arquivo `.env`

O `.env` guarda senhas e configurações e **nunca vai para o GitHub**, então cada máquina cria o seu:

```bash
copy .env.example .env
```

No Mac/Linux: `cp .env.example .env`.

Abra o `.env` e preencha pelo menos estas linhas:

| Variável | O que colocar |
|---|---|
| `JWT_SECRET` | um texto longo e aleatório, por exemplo 40 letras e números. Não deixe o valor de exemplo. |
| `ADMIN_EMAIL` | o e-mail com que você vai entrar no sistema |
| `ADMIN_PASSWORD` | uma senha sua, com **8 ou mais caracteres**. O sistema recusa criar o administrador sem ela. |

O restante pode ficar como está. `SMTP_*` e `ALERT_EMAIL_TO` só servem para enviar e-mail e podem ficar em branco.

## 4. Escolha um caminho

### Caminho A: tudo no Docker (mais simples)

O Docker sobe o banco e o app juntos. Não precisa instalar o Node.

```bash
docker compose up -d --build
```

Na primeira vez demora alguns minutos, porque baixa as imagens e instala as dependências. Depois crie o administrador (uma vez só):

```bash
docker compose exec app npm run seed
```

Abra **http://localhost:3100** e entre com o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` do `.env`.

Para parar e ligar de novo, sem perder os dados:

```bash
docker compose stop
docker compose start
```

> **Cuidado:** `docker compose down -v` apaga o banco inteiro (o `-v` remove o volume com os dados).

### Caminho B: Node na máquina + banco no Docker (para desenvolver)

Aqui o app roda direto no seu computador e o Docker só fornece o PostgreSQL.

**1. Suba só o banco:**

```bash
docker compose up -d db
```

O banco fica na porta **5433** do seu computador, com usuário `postgres` e a senha padrão `changeme_local_only`.

**2. Aponte o `.env` para esse banco.** Ajuste estas linhas:

```
DATABASE_URL="postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao?schema=public"
PORT=3000
CLIENT_ORIGIN=http://localhost:3000
```

**3. Instale as dependências.** O `npm ci` instala exatamente as versões do `package-lock.json` e já gera o cliente do Prisma sozinho:

```bash
npm ci
```

**4. Crie as tabelas e o administrador:**

```bash
npx prisma migrate deploy
npm run seed
```

**5. Inicie o servidor:**

```bash
npm start
```

Abra **http://localhost:3000**. Para reiniciar sozinho a cada alteração no código, use `npm run dev`.

## 5. Dados de exemplo (opcional)

Para ver o painel e os relatórios com conteúdo, rode (no Caminho A, coloque `docker compose exec app` na frente):

```bash
npm run seed:products
npm run simulate:sales
```

O primeiro cadastra produtos de exemplo, alguns perto de vencer. O segundo cria um histórico de vendas dos últimos dias. `SIMULATE_DAYS=60 npm run simulate:sales` muda a janela de dias.

Também é possível importar produtos por planilha na tela **Importar**. O arquivo `produtos-importacao.csv` na raiz é um modelo.

## 6. Rodar os testes

Os testes **apagam todas as tabelas** do banco em que rodam. Por isso o sistema se recusa a rodar se o nome do banco não tiver "test". Crie um banco separado só para isso:

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE mercadinho_joao_test"
```

Aponte `DATABASE_URL` para ele e rode. No PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://postgres:changeme_local_only@localhost:5433/mercadinho_joao_test?schema=public"
npx prisma migrate deploy
npm test
node --test test/security.test.js
```

No Mac/Linux, troque a primeira linha por `export DATABASE_URL="..."` com o mesmo endereço.

O `$env:DATABASE_URL` vale só para aquela janela do terminal. O banco de verdade (`mercadinho_joao`) não é tocado.

## 7. Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `failed to connect to the docker API` | O Docker Desktop está fechado. Abra e espere ficar "Running". |
| `Can't reach database server at localhost:5433` | O banco não subiu. Rode `docker compose up -d db` e confira com `docker compose ps`. |
| `port is already allocated` | Outro programa usa a porta (3100 ou 5433). Feche-o ou troque a porta no `docker-compose.yml`. |
| `Defina ADMIN_PASSWORD (mínimo 8 caracteres)` | Falta a senha no `.env`. Preencha e rode o seed de novo. |
| `ADMIN_PASSWORD ainda é a senha de exemplo` | Troque por uma senha só sua. |
| Login não funciona logo depois do seed | O seed só cria o administrador se ainda não existir um. Para trocar a senha: `npm run reset-password -- seu@email.com` (a senha nova é pedida no terminal). |
| `Origin não permitida por CORS` | `CLIENT_ORIGIN` no `.env` não bate com o endereço que você abriu no navegador. |
| O app subiu mas a página não abre no Caminho A | A porta é **3100**, não 3000. |

## 8. Resumo rápido (Caminho A)

```bash
git clone https://github.com/Di20232/mercadinho-seu-joao-redesign.git
cd mercadinho-seu-joao-redesign
copy .env.example .env
# edite o .env: JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
docker compose exec app npm run seed
# abra http://localhost:3100
```
