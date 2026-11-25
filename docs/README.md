# Documentação do Mercadinho do João

Sistema web de vendas e estoque para um mercadinho de bairro (secos e molhados). Node.js + Express + PostgreSQL, com frontend em HTML, CSS e JavaScript puros.

Esta pasta organiza a documentação pelas quatro perguntas que alguém faz a um sistema: **como uso**, **como funciona**, **como mantenho no ar** e **como atualizo sem quebrar**. Cada documento responde a uma pergunta e tem um público certo.

> Retrato do `master` do repositório `Di20232/mercadinho-seu-joao-redesign` em 25/11/2026 (commit `0df94d5`, com os PRs #2 a #9 mesclados): permissões por pessoa, produto aguardando preço, venda idempotente e sem impasse, busca sem acento, relatório por e-mail e app instalável no celular. Suíte de testes: 72 de 72 passando nessa data. Atualizada depois com o PR #11 (cadastro com liberação do dono, validade e planilhas no horário da loja): 81 de 81. Com a retirada do relatório por e-mail, em 25/11: 79 de 79; com a planilha completa: 80 de 80.

## Mapa

| Eixo | Pergunta | Quem lê | Documentos |
|---|---|---|---|
| **Usar** | Como faço meu trabalho com o sistema? | Dono, caixa, estoque, financeiro | [Manual do usuário](usar/manual-do-usuario.md) · [Início rápido](usar/inicio-rapido.md) · [FAQ](usar/faq.md) · [Glossário de negócio](usar/glossario.md) · [Novidades (release notes)](usar/release-notes.md) · [Treinamento](usar/treinamento.md) |
| **Manter** | Como o sistema funciona e por que é assim? | Desenvolvedores | [Requisitos e regras de negócio](manter/requisitos-e-regras.md) · [Arquitetura (C4)](manter/arquitetura.md) · [ADRs](manter/adr/README.md) · [Modelo de dados](manter/modelo-de-dados.md) · [Contratos da API](manter/api.md) ([OpenAPI](manter/openapi.yaml)) · [Guia de desenvolvimento e testes](manter/guia-de-desenvolvimento.md) |
| **Sustentar** | Como mantenho o sistema no ar e recupero quando cai? | Quem opera e dá suporte | [Deploy e infraestrutura](sustentar/deploy-e-infraestrutura.md) · [Runbooks](sustentar/runbooks.md) · [Monitoramento](sustentar/monitoramento.md) · [Suporte e SLA](sustentar/suporte-e-sla.md) · [Backup e continuidade](sustentar/backup-e-continuidade.md) · [Segurança e base de conhecimento](sustentar/seguranca-e-base-de-conhecimento.md) |
| **Evoluir** | Como atualizo versão, tecnologia ou fornecedor sem quebrar? | Quem decide a arquitetura | [Inventário de dependências (SBOM)](evoluir/dependencias.md) · [Roadmap e dívida técnica](evoluir/roadmap-e-divida-tecnica.md) · [Changelog e versionamento](evoluir/changelog.md) · [Guias de migração](evoluir/guias-de-migracao.md) · [Matriz de compatibilidade](evoluir/matriz-de-compatibilidade.md) · [Testes de regressão](evoluir/testes-de-regressao.md) |

Referências usadas para cada eixo: ISO/IEC/IEEE 26514 (usar), ISO/IEC/IEEE 42010 (manter), práticas ITIL (sustentar) e ISO/IEC/IEEE 14764 (evoluir).

## O que existe e o que falta

A documentação descreve o sistema como ele é, inclusive o que ainda não existe. Onde algo falta, o documento diz isso em vez de inventar.

| Item | Situação |
|---|---|
| Manual, FAQ, glossário, treinamento | Escritos a partir do código das telas. |
| Vídeos de treinamento | **Não gravados.** O [roteiro de treinamento](usar/treinamento.md) serve de script. |
| Arquitetura, ADRs, dados, API | Escritos a partir do código e do histórico do git. |
| Pipeline de CI/CD | **Não existe.** Os testes rodam só na máquina do desenvolvedor. Ver [dívida técnica](evoluir/roadmap-e-divida-tecnica.md). |
| Monitoramento e alertas de infraestrutura | **Não existe.** O [documento de monitoramento](sustentar/monitoramento.md) diz o que olhar hoje e o mínimo a montar. |
| SLA e matriz de suporte | **Proposta**, a combinar com o cliente. |
| Sistema em produção | **Ainda não publicado.** O passo a passo está pronto em [deploy](sustentar/deploy-e-infraestrutura.md). |
| Versões (tags SemVer) | **Não há tags.** O [changelog](evoluir/changelog.md) propõe a primeira. |

## Critérios de aceite desta documentação

"Documentação entregue" só vale com critério. Os três critérios adotados:

1. **Teste do estranho.** Alguém que não participou do projeto sobe o ambiente e faz um deploy usando só estes documentos. Roteiro e registro em [teste do estranho](aceite/teste-do-estranho.md).
2. **Docs as code.** Os documentos ficam no repositório e mudam no mesmo pull request que muda o código. O [modelo de PR](../.github/pull_request_template.md) tem a caixa de conferência. A tabela abaixo diz qual documento atualizar.
3. **Transferência de conhecimento.** Sessões de passagem gravadas, com as perguntas registradas. Plano em [transferência de conhecimento](aceite/transferencia-de-conhecimento.md).

### Quando o código muda, qual documento muda junto

| Se você mudou... | Atualize |
|---|---|
| Uma tela ou um fluxo do usuário | [Manual](usar/manual-do-usuario.md), [FAQ](usar/faq.md) e [novidades](usar/release-notes.md) |
| Uma regra de negócio ou cálculo | [Requisitos e regras](manter/requisitos-e-regras.md) e [glossário](usar/glossario.md) |
| Uma permissão (`src/permissions.js`) | [Requisitos: permissões](manter/requisitos-e-regras.md#permissões), [manual: quem pode fazer o quê](usar/manual-do-usuario.md#quem-pode-fazer-o-quê) e o `PermissionKey` do [openapi.yaml](manter/openapi.yaml) |
| Uma rota da API | [api.md](manter/api.md) e [openapi.yaml](manter/openapi.yaml) |
| `prisma/schema.prisma` ou uma migration | [Modelo de dados](manter/modelo-de-dados.md) e [guias de migração](evoluir/guias-de-migracao.md) |
| Uma decisão de arquitetura | Um ADR novo em [manter/adr](manter/adr/README.md) |
| Uma variável de ambiente, o Dockerfile ou o compose | [Deploy e infraestrutura](sustentar/deploy-e-infraestrutura.md) |
| Uma dependência | [Inventário de dependências](evoluir/dependencias.md) e [matriz de compatibilidade](evoluir/matriz-de-compatibilidade.md) |
| Qualquer coisa que o usuário perceba | [Changelog](evoluir/changelog.md) |

## Documentos antigos na raiz

Os arquivos `DOCUMENTATION.md`, `MATRIZ_PERFIS_ADMIN_CAIXA.md`, `PROJETO_COMPLETO.md`, `SPRINT_REPORT.md`, `SPRINT_3_REPORT.md`, `REFACTORING_FINAL_REPORT.md`, `REBRANDING_COMPLETO.md`, `RELATORIO_DE_VENDAS_FIXES.md` e `PROGRESSO_TAREFAS.md` são registros de sessões anteriores. Valem como histórico, mas alguns números ali estão vencidos (ex.: "7/7 testes", "8 produtos de exemplo"). Em caso de conflito, vale o que está nesta pasta. A limpeza deles está na [dívida técnica](evoluir/roadmap-e-divida-tecnica.md). Também na raiz, e atuais: `TUTORIAL_INSTALACAO.md` (instalação em outra máquina) e `PLANO_SEMANA_12.md` (registro das pendências de 24/11/2026).
