# Monitoramento

O que observar para saber se o sistema está bem e o que cada sinal significa.

## Situação em 24/11/2026

**Não existe monitoramento montado.** Não há endpoint de saúde, métricas, painel nem alerta de infraestrutura. Hoje, quem percebe que o sistema caiu é o usuário. Os únicos sinais disponíveis são os logs do processo e o e-mail diário de estoque (que é de negócio, não de infraestrutura).

O que montar está no fim deste documento e na [dívida técnica](../evoluir/roadmap-e-divida-tecnica.md) (DT-05).

## Logs

O sistema escreve só na saída padrão (`console.log` e `console.error`). Não há arquivo de log nem agregador.

| Ambiente | Como ver |
|---|---|
| Docker local | `docker compose logs -f app` (e `db`) |
| Nuvem | aba de logs do serviço no painel do provedor |

### Mensagens e o que significam

| Mensagem no log | Significa | Gravidade | Ação |
|---|---|---|---|
| `Mercadinho do João rodando na porta 3000 (production)` | Subiu | informação | |
| `✓ Banco de dados pronto!` / `No pending migrations to apply` | Banco alcançado, migrations em dia (só Docker) | informação | |
| `[fatal] Exceção não tratada — encerrando para reinício controlado` | Erro grave; o processo sai com código 1 para o Docker ou o provedor reiniciar | **alta** | Ler a pilha; abrir chamado N3 |
| `[fatal] Promise rejeitada sem tratamento` | Erro fora de uma requisição; o processo continua | média | Ler a pilha; abrir chamado N3 |
| Pilha de erro seguida de resposta 500 | Falha numa requisição (o usuário viu "Erro interno do servidor.") | média a alta, conforme a frequência | [Runbook do erro 500](runbooks.md#erro-500-numa-tela) |
| `[server] SIGTERM recebido, encerrando graciosamente...` | Parada normal (deploy, `docker compose stop`) | informação | |
| `[alertas] Conexão SMTP verificada com sucesso.` | E-mail funcionando, checado na subida | informação | |
| `[alertas] Não foi possível conectar ao servidor SMTP configurado: ...` | E-mail quebrado: nem link de senha nem alerta diário vão sair | **alta** se o e-mail é usado | [Runbook do e-mail](runbooks.md#e-mail-não-chega) |
| `[alertas] SMTP não configurado — envio de e-mail desativado.` | E-mail desligado de propósito ou por esquecimento | baixa | Configurar, se o cliente usa |
| `[alertas] ALERT_EMAIL_TO contém um endereço inválido` | Alerta diário não sai | média | Corrigir a variável |
| `[alertas] E-mail de alerta enviado.` / `Nenhum alerta hoje.` | Alerta diário rodou | informação | |
| `[forgot-password] link de reset para ...` | Pedido de nova senha (só fora de produção; o log contém um link válido) | informação | Não compartilhe esse log |
| `[forgot-password] falha ao enviar e-mail de reset` | Usuário pediu senha e o e-mail falhou | média | Runbook do e-mail |
| `✗ Banco de dados não ficou pronto em tempo hábil` | O contêiner do banco não respondeu em 60 s | **alta** | [Runbook do contêiner](runbooks.md#contêiner-app-não-sobe) |

O rate limit (429) não aparece no log.

## Sinais de saúde que dá para checar hoje

| Checagem | Comando | Resposta saudável | Cobre |
|---|---|---|---|
| Página no ar | `curl -I <endereço>/` | `200` | processo e rede |
| API e banco | `curl <endereço>/api/products` sem cookie | `401` "Não autenticado." | só o processo: o 401 sai **antes** de consultar o banco |
| Banco no Docker | `docker compose ps` | `db` `healthy` | PostgreSQL local |
| Migrations | `docker compose exec app npx prisma migrate status` | "Database schema is up to date!" | esquema |

Nenhuma rota pública hoje prova que o banco responde. Um login de teste prova, mas conta no limite de tentativas.

## Mínimo recomendado para a produção

| O quê | Como | Alerta quando | Quem recebe |
|---|---|---|---|
| Disponibilidade | Serviço externo gratuito de checagem HTTP (ex.: UptimeRobot, Better Stack) em `GET /` a cada 5 min | 2 falhas seguidas | N2 |
| Banco | Criar `GET /api/health` que faça `SELECT 1` e apontar a checagem para ele (DT-05) | falha | N2 |
| Erros | Busca por `[fatal]` e por pilhas de erro nos logs do provedor, se o plano permitir alerta por texto | qualquer ocorrência | N2 |
| E-mail | Busca por `Não foi possível conectar ao servidor SMTP` | qualquer ocorrência | N2 |
| Backup | Conferir semanalmente a data do último backup ([backup](backup-e-continuidade.md)) | backup com mais de 1 dia | N2 |
| Uso de disco do banco | Painel do provedor do banco | 80% da cota do plano | N2 |

## Métricas de negócio que já existem

Não são monitoramento técnico, mas mostram se o sistema está sendo usado:

- **Painel**: vendas do dia e do mês. Zero vendas num dia normal de loja é sinal de problema (ou da loja fechada).
- **E-mail diário de estoque**: se parar de chegar sem motivo, o processo ou o SMTP caiu.
