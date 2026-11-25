# Teste do estranho

Critério de aceite da documentação: **alguém que não participou do projeto sobe o ambiente e faz um deploy usando só estes documentos.** Se travar, a documentação está incompleta, não a pessoa.

## Como aplicar

1. Escolha alguém que não conhece o código (outro desenvolvedor, um colega da faculdade).
2. Entregue só o link do repositório e esta página. Quem escreveu a documentação **não ajuda**, só observa e anota.
3. A pessoa marca cada etapa e registra onde parou, o que adivinhou e o que perguntou.
4. Cada trava vira uma correção na documentação, no mesmo dia.

## Roteiro

| # | Etapa | Documento | Pronto quando |
|---|---|---|---|
| 1 | Instalar os pré-requisitos e clonar | [guia de dev](../manter/guia-de-desenvolvimento.md#pré-requisitos) | `git clone` feito, `node --version` 20+ |
| 2 | Configurar o `.env` | [guia de dev](../manter/guia-de-desenvolvimento.md#configurar-o-env) | `.env` com `ADMIN_PASSWORD` próprio |
| 3 | Subir tudo no Docker | [modo A](../manter/guia-de-desenvolvimento.md#modo-a-tudo-no-docker-mais-simples) | `http://localhost:3100` abre |
| 4 | Criar o dono e entrar | idem | Painel aparece |
| 5 | Carregar dados de exemplo e as contas de teste | idem | 24 produtos; contas Financeiro, Estoque e Caixa |
| 6 | Fazer e cancelar uma venda como caixa | [manual](../usar/manual-do-usuario.md#vendas) | estoque volta; histórico mostra as duas linhas |
| 7 | Rodar os testes | [testes](../manter/guia-de-desenvolvimento.md#testes) | 72/72 |
| 8 | Fazer um backup e restaurar num banco novo | [backup](../sustentar/backup-e-continuidade.md) | contagens iguais |
| 9 | Simular um incidente: fechar o Docker Desktop e recuperar | [runbook](../sustentar/runbooks.md#o-sistema-não-abre-ou-o-login-dá-erro) | sistema de volta sem ajuda |
| 10 | Publicar num ambiente de nuvem de teste | [deploy](../sustentar/deploy-e-infraestrutura.md#publicar-na-nuvem-primeira-vez) | endereço público com HTTPS, login e venda de teste |
| 11 | Responder, só com os documentos: "por que a venda baixa o estoque com UPDATE condicional?" e "quem pode definir preço?" | [ADR-0005](../manter/adr/0005-baixa-de-estoque-atomica-no-banco.md), [manual](../usar/manual-do-usuario.md#quem-pode-fazer-o-quê) | resposta certa |

## Registro

| Data | Quem (papel, sem dados pessoais) | Até onde chegou | Travas encontradas | Correções feitas |
|---|---|---|---|---|
| 24 e 25/11/2026 | autor da documentação (**não vale como estranho**) | etapas 7 e 8 executadas de verdade: 54/54 e depois 72/72 testes num banco de teste separado, e ensaio de backup e restauração | Git Bash troca `/tmp` por caminho do Windows (`MSYS_NO_PATHCONV=1`); aspas do PowerShell no `psql -c` | registradas no [backup](../sustentar/backup-e-continuidade.md) |

**Situação: o teste do estranho ainda não foi feito.** A etapa 10 depende das contas de nuvem, que ainda não existem.
