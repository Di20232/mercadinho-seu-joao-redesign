# Backup e continuidade

Como copiar o banco, como restaurar e quanto dado e tempo se aceita perder.

## Situação em 24/11/2026

| Item | Situação |
|---|---|
| Backup automático | **Não existe.** |
| Últimos backups manuais | 3 arquivos `.sql` (pg_dump em texto, PostgreSQL 16.15) em `backups/`, todos de **16/10/2026**, feitos antes de um reset de senha |
| Onde ficam | Pasta `backups/` na máquina do desenvolvedor, fora do git (`.gitignore`) e fora da imagem Docker (`.dockerignore`). Sem cópia em outro lugar |
| Restauração testada | **Sim, em 24/11/2026**: dump do banco de desenvolvimento restaurado num banco novo, com contagens e somas idênticas (ver ensaio abaixo) |
| RPO real hoje | O tempo desde o último backup manual: mais de 5 semanas |

O que precisa de backup é só o **banco**. O código está no git, e a configuração está no `.env` e no painel do provedor (anote as variáveis num cofre de senhas, não aqui).

## Objetivos propostos (RPO e RTO)

| | Proposta | Como atingir |
|---|---|---|
| **RPO** (quanto dado se aceita perder) | 24 horas | Backup diário automático. Na nuvem, o recurso de backup do provedor do banco; no Docker local, uma tarefa agendada com o comando abaixo |
| **RTO** (quanto tempo fora do ar) | 4 horas no horário da loja | Este roteiro de restauração, já ensaiado; o restore em si leva segundos com o volume atual |

Enquanto o sistema estiver fora, as vendas vão para o papel ([plano de contingência](suporte-e-sla.md#severidade-e-prazos-propostos)).

## Fazer backup

### Docker local

O formato custom (`-Fc`) é compactado e restaura com `pg_restore`. O arquivo é gerado dentro do contêiner e depois copiado, o que evita problemas de codificação do redirecionamento `>` no PowerShell.

```powershell
docker compose exec db pg_dump -U postgres -Fc -f /tmp/backup.dump mercadinho_joao
```
```powershell
docker compose cp db:/tmp/backup.dump backups/backup_mercadinho_joao_AAAA-MM-DD.dump
```
```powershell
docker compose exec db rm /tmp/backup.dump
```

No Git Bash, prefixe os comandos com `MSYS_NO_PATHCONV=1`; sem isso o Git Bash troca `/tmp` por um caminho do Windows e o `pg_dump` falha com "could not open output file".

Depois, copie o arquivo para fora da máquina (pendrive, nuvem pessoal criptografada). O backup contém e-mails e hashes de senha dos usuários: trate como dado sensível.

### Nuvem

Use o backup do provedor do banco (Neon e Supabase têm, com retenção conforme o plano; confirme no plano escolhido). Além disso, um `pg_dump` mensal de fora:

```bash
pg_dump "<DATABASE_URL de produção>" -Fc -f backup_mercadinho_joao_AAAA-MM-DD.dump
```

O `pg_dump` local precisa ser da mesma versão maior do servidor (16) ou mais nova.

## Restaurar

**Sempre restaure primeiro num banco novo**, confira, e só então troque.

### 1. Restaurar num banco novo (Docker local)

```powershell
docker compose cp backups/backup_mercadinho_joao_AAAA-MM-DD.dump db:/tmp/restore.dump
```
```powershell
docker compose exec db createdb -U postgres mercadinho_joao_restore
```
```powershell
docker compose exec db pg_restore -U postgres -d mercadinho_joao_restore --no-owner /tmp/restore.dump
```

Para os backups antigos em `.sql` (texto), em vez do `pg_restore`:

```powershell
docker compose cp backups/backup_mercadinho_joao_pre-reset_2026-10-16.sql db:/tmp/restore.sql
```
```powershell
docker compose exec db psql -U postgres -d mercadinho_joao_restore -f /tmp/restore.sql
```

Esses `.sql` começam com `\restrict`, comando dos clientes PostgreSQL 16.10 em diante. O `psql` do contêiner (16.15) entende; um `psql` mais antigo falha.

### 2. Conferir

Abra o `psql` no banco restaurado (sessão interativa, para não brigar com aspas do PowerShell):

```powershell
docker compose exec db psql -U postgres -d mercadinho_joao_restore
```

E rode:

```sql
select count(*) from "User";
select count(*) from "Sale";
select max("createdAt") from "Sale";
\q
```

A data da última venda diz até quando o backup vai.

### 3. Trocar

Opção simples: aponte o app para o banco restaurado. No compose, troque `mercadinho_joao` por `mercadinho_joao_restore` no `DATABASE_URL` do serviço `app` e rode `docker compose up -d app`. O banco antigo fica guardado até você ter certeza.

Na nuvem: crie um banco (ou branch, no Neon) a partir do backup, troque o `DATABASE_URL` do serviço e reinicie.

## Ensaio de 24/11/2026

Feito no ambiente local, sem tocar no banco de desenvolvimento além da leitura:

| Etapa | Resultado |
|---|---|
| `pg_dump -Fc` de `mercadinho_joao` | 36.693 bytes |
| `createdb` + `pg_restore` em `mercadinho_joao_restore_ensaio` | sem erro |
| Tempo total (dump + restore) | cerca de 1 s |
| Usuários / produtos / vendas / itens / movimentações / migrations | 8 / 25 / 103 / 104 / 130 / 4 nas duas bases |
| Soma do estoque / soma das vendas | 284,000 / R$ 1.588,43 nas duas bases |

Repita o ensaio a cada 3 meses e depois de toda mudança grande no banco.

## Cuidados que evitam perda de dados

- `docker compose down -v` e "Reset to factory defaults" do Docker Desktop **apagam o banco local**.
- Renomear o projeto ou o volume no compose faz o sistema subir com um banco vazio (o antigo continua no volume velho) ([ADR-0010](../manter/adr/0010-docker-compose-local-com-nomes-fixos.md)).
- A suíte de testes apaga o banco apontado por `DATABASE_URL`; ela recusa bancos sem `test` no nome. Não use `ALLOW_DB_RESET=true` sem certeza.
- Faça backup antes de todo deploy com migration nova.

## Continuidade sem a equipe original

Para alguém de fora assumir o sistema, precisa ter: acesso ao repositório no GitHub, acesso ao painel do provedor da aplicação e do banco, os valores das variáveis de produção (num cofre de senhas), e esta documentação. A lista de acessos está em [segurança](seguranca-e-base-de-conhecimento.md#acessos).
