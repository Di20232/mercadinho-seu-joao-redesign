# Inventário de dependências (SBOM)

Bibliotecas, versões, licenças, vulnerabilidades conhecidas e fim de suporte. Levantado em **24/11/2026** a partir do `package-lock.json` (versões travadas), do registro do npm (últimas versões) e do `npm audit`.

O SBOM completo, legível por máquina, está em [`sbom.cdx.json`](sbom.cdx.json) (CycloneDX 1.5, 228 componentes). Para gerar de novo depois de mudar dependências:

```bash
npm sbom --package-lock-only --sbom-format cyclonedx --sbom-type application > docs/evoluir/sbom.cdx.json
```

O npm grava o nome da pasta como nome do componente raiz; corrija para `mercadinho-joao` se a pasta tiver outro nome.

## Plataforma

| Componente | Versão em uso | Fim de suporte | Situação |
|---|---|---|---|
| Node.js na imagem Docker | 20.20.2 (`node:20-bookworm-slim`) | **30/04/2026** | **Fora de suporte.** Trocar para `node:22-bookworm-slim` ([guia](guias-de-migracao.md#node-20-para-node-22)) |
| Node.js na máquina de desenvolvimento | 22.23.2 | 30/04/2027 | Em manutenção (LTS) |
| `engines.node` no `package.json` | `>=18` | Node 18 terminou em 30/04/2025 | Inconsistente: `node-cron` 4 exige Node 20+. Corrigir para `>=22` |
| PostgreSQL | 16 (16.15 no contêiner) | novembro de 2028 | Em suporte |
| Imagem base | Debian 12 (bookworm) slim | | Em suporte |

## Dependências diretas

| Pacote | Faixa no `package.json` | Travada | Licença | Mais nova (24/11/2026) | Situação |
|---|---|---|---|---|---|
| `express` | ^4.19.2 | 4.22.2 | MIT | 5.3.0 (linha 4: 4.22.3) | 1 versão maior atrás; vulnerabilidades em dependências dele (abaixo) |
| `express-async-errors` | ^3.1.1 | 3.1.1 | ISC | 3.1.1 | Desnecessário no Express 5, que já trata erro de handler `async` |
| `@prisma/client` | ^5.20.0 | 5.22.0 | Apache-2.0 | 7.10.1 (8 em pré-lançamento) | 2 versões maiores atrás |
| `prisma` (dev) | ^5.20.0 | 5.22.0 | Apache-2.0 | 7.10.1 | Sobe junto com o `@prisma/client` |
| `zod` | ^3.23.8 | 3.25.76 | MIT | 4.6.7 | 1 maior atrás; **vulnerabilidade alta** corrigida só na 4 |
| `helmet` | ^7.1.0 | 7.2.0 | MIT | 8.3.0 | 1 maior atrás |
| `express-rate-limit` | ^7.4.0 | 7.5.1 | MIT | 8.7.5 | 1 maior atrás |
| `bcryptjs` | ^2.4.3 | 2.4.3 | MIT | 3.0.3 | 1 maior atrás |
| `jsonwebtoken` | ^9.0.2 | 9.0.3 | MIT | 9.0.3 | Em dia |
| `cookie-parser` | ^1.4.6 | 1.4.7 | MIT | 1.4.7 | Em dia |
| `cors` | ^2.8.5 | 2.8.6 | MIT | 2.8.6 | Em dia |
| `dotenv` | ^16.4.5 | 16.6.1 | BSD-2-Clause | 18.0.10 | 2 maiores atrás |
| `exceljs` | ^4.4.0 | 4.4.0 | MIT | 4.4.0 | Em dia, mas puxa `uuid` vulnerável |
| `multer` | ^2.3.0 | 2.3.0 | MIT | 2.5.0 | **Vulnerabilidade alta**, corrigida na 2.5 (dentro da faixa) |
| `node-cron` | ^4.6.0 | 4.6.0 | ISC | 4.6.0 | Em dia; exige Node 20+ |
| `nodemailer` | ^9.0.5 | 9.0.5 | MIT-0 | 10.6.1 | 1 maior atrás; **vulnerabilidades altas** (versões até 10.1.3) |
| `nodemon` (dev) | ^3.1.4 | 3.1.14 | MIT | 3.1.14 | Em dia |

Para conferir de novo: `npm outdated` e `npm view <pacote> version`.

## Vulnerabilidades conhecidas (`npm audit`, só produção)

Resultado em 24/11/2026: **9 pacotes vulneráveis: 1 crítica, 5 altas, 3 moderadas.**

| Pacote | Severidade | Como entra | Problema (resumo) | Correção |
|---|---|---|---|---|
| `proxy-addr` | **crítica** | via `express` | Falsificação de IP com IPv6 mapeado em sub-rede confiável (GHSA-jqcg-44mw-7w3h) | `npm audit fix` |
| `body-parser` | alta | via `express` | Negação de serviço com bytes extras em corpo comprimido (GHSA-27r3-jxmh-p828) | `npm audit fix` |
| `multer` | alta | direta | Negação de serviço em upload abortado (GHSA-q7qp-rjg7-q26m e outra) | `npm audit fix` (2.5) |
| `nodemailer` | alta | direta | Vários: negação de serviço no parser de endereços, desvio de validação de domínio do destinatário | subir para a linha 10 acima de 10.1.3 (versão maior) |
| `zod` | alta | direta | Consumo de memória ao validar coleções grandes (GHSA-mrhx-c7xc-m3w5) | subir para 4.6.6 ou mais (versão maior) |
| `brace-expansion` | alta | transitiva | Negação de serviço por recursão | `npm audit fix` |
| `qs` | moderada | via `express` | Negação de serviço e desvio de limite de array | `npm audit fix` |
| `uuid` | moderada | via `exceljs` | Falta de checagem de limites em v3/v5/v6 com buffer | `overrides` de `uuid` para 11.1.1+ no `package.json` (testar a importação e a exportação) |
| `exceljs` | moderada | direta | Só por causa do `uuid` | idem |

Contexto que reduz (mas não zera) o risco: a API limita o corpo a 100 kB (4 MB na importação), os arrays validados têm tamanho máximo, e o `trust proxy` usa contagem de saltos, não sub-rede. Ainda assim, a ordem recomendada é: `npm audit fix` agora (sem quebra), depois as migrações maiores ([roadmap](roadmap-e-divida-tecnica.md)).

Rode `npm audit --omit=dev` antes de cada deploy e registre aqui o resultado quando mudar.

## Licenças

### Do próprio projeto

O `package.json` é `"private": true` e **não declara licença**, e não há arquivo `LICENSE`. O README antigo diz "MIT License - veja LICENSE", mas o arquivo não existe. Para um sistema feito para um cliente, definir a licença (ou o contrato de cessão) é decisão do dono do código (dívida DT-19).

### De terceiros (228 pacotes no lockfile)

| Licença | Pacotes | Observação |
|---|---|---|
| MIT | 182 | permissiva |
| ISC | 21 | permissiva |
| Apache-2.0 | 10 | permissiva, com aviso de patente (Prisma) |
| BSD-3-Clause | 4 | permissiva |
| MIT/X11 | 2 | permissiva |
| BSD-2-Clause | 1 | permissiva (`dotenv`) |
| MIT-0 | 1 | permissiva sem atribuição (`nodemailer`) |
| Unlicense | 1 | domínio público (`big-integer`, via `exceljs`) |
| BlueOak-1.0.0 | 1 | permissiva (`minimatch`) |
| (MIT AND Zlib) | 1 | permissivas (`pako`) |
| (MIT OR GPL-3.0-or-later) | 1 | `jszip`, via `exceljs`: usar sob **MIT** |
| sem licença no lockfile | 3 | `buffers`, `busboy`, `streamsearch`: conferir no pacote |

Nenhuma licença copyleft obrigatória.

### Recursos embutidos no frontend

| Recurso | Licença | Onde |
|---|---|---|
| Fonte Inter | SIL Open Font License 1.1 | `public/fonts/`, licença em `public/fonts/LICENSE-Inter.txt` |
| Ícones Lucide v0.460.0 | ISC | `public/js/icons.js` (cabeçalho cita a licença) |

## Regras para mexer em dependência

1. Uma dependência por pull request, com o motivo.
2. Leia as notas de versão; versão maior quase sempre quebra algo.
3. `npm test` completo no banco de teste, mais a conferência manual das telas que usam a biblioteca ([testes de regressão](testes-de-regressao.md)).
4. Atualize esta página, o `sbom.cdx.json` e a [matriz de compatibilidade](matriz-de-compatibilidade.md).
