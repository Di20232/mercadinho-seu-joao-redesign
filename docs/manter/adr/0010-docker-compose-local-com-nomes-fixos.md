# ADR-0010: Fixar o nome do projeto e do volume no Docker Compose e publicar o banco na porta 5433

- **Status:** Aceito
- **Data:** 16/10/2026 (decisão), commitada em `d806716` (23/10/2026)

## Contexto

- Sem `name:`, o Compose usa o nome da pasta. Quando a pasta mudou de `contro-vend` para `mercadinho-seu-joao`, o Compose criou um volume novo e vazio, e o sistema subiu sem os usuários e as vendas.
- Na máquina de desenvolvimento, um PostgreSQL instalado no Windows já ocupa a porta 5432.

## Decisão

- `name: mercadinho-seu-joao` no topo do `docker-compose.yml`.
- Volume com nome explícito: `mercadinho-seu-joao_mercadinho_joao_db_data`.
- Banco publicado no host na porta **5433** (`5433:5432`); o app no host na **3100** (`3100:3000`).
- `restart: unless-stopped` nos dois contêineres e `healthcheck` no banco.

## Consequências

- Ganha: renomear, mover ou copiar a pasta não troca o banco.
- Ganha: convive com o PostgreSQL nativo.
- Perde: duas cópias da pasta rodando ao mesmo tempo usam **o mesmo volume**. Cuidado ao subir uma cópia de teste.
- Perde: quem lê `DATABASE_URL` precisa lembrar da 5433 fora do Docker e da 5432 dentro dele (`db:5432`).
- Perde: `docker compose down -v` continua apagando o banco. O nome fixo não protege contra isso.

## Alternativas consideradas

- Variável `COMPOSE_PROJECT_NAME` no `.env`: some se alguém rodar o Compose sem o `.env`.
- Banco na 5432 e parar o PostgreSQL nativo: atrapalha outros projetos da máquina.
