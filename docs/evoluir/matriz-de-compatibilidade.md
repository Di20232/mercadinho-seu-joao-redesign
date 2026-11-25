# Matriz de compatibilidade

Com o que o sistema funciona. Cada linha diz se foi **testado** (rodou e funcionou, com data), **declarado** (o código ou a configuração dizem, mas ninguém rodou) ou **incompatível**.

## Runtime e banco

| Componente | Versão | Situação | Observação |
|---|---|---|---|
| Node.js 22 | 22.23.2 | **testado** em 25/11/2026: 72/72 testes, servidor local | recomendado (LTS em manutenção até 30/04/2027) |
| Node.js 20 | 20.20.2 (imagem Docker) | **testado** em 24/11/2026: contêiner `app` rodando | fora de suporte desde 30/04/2026; trocar ([guia](guias-de-migracao.md#node-20-para-node-22)) |
| Node.js 18 | | **incompatível** | o `package.json` aceita `>=18`, mas o `node-cron` 4 exige 20+ |
| PostgreSQL 16 | 16.15 (contêiner) | **testado** em 24/11/2026: testes, backup e restauração | versão do compose e do alvo na nuvem |
| PostgreSQL 13 a 15, 17 | | declarado | o Prisma 5.22 suporta, mas ninguém rodou o sistema nelas |
| Prisma | 5.22.0 | **testado** | |
| npm | 10.9.8 | **testado** | `npm ci` precisa do `package-lock.json` versão 3 |

## Sistema operacional

| Onde | Situação |
|---|---|
| Windows 11 + Docker Desktop 29 (desenvolvimento) | **testado** em 24/11/2026 |
| Debian 12 bookworm (imagem `node:20-bookworm-slim`) | **testado** (é a imagem do contêiner) |
| Linux de provedor de nuvem (Render, Railway) | declarado; build e start conferidos localmente no modo de produção em 24/11/2026, mas não publicado |
| macOS | declarado (nada específico de Windows no código; o `wait-for-db.sh` roda dentro do contêiner) |

## Navegadores

O CSS usa `:has()` e `color-mix()`, e o JavaScript usa `fetch`, `crypto.getRandomValues` e sintaxe ES2020 (como `?.`) sem transpilação. Isso define o mínimo:

| Navegador | Versão mínima (pelos recursos usados) | Situação |
|---|---|---|
| Chrome / Edge | 111+ | **testado** num navegador Chromium (26/10 e 24/11/2026), em 375 px, notebook e desktop, claro e escuro |
| Firefox | 121+ | declarado |
| Safari (macOS e iOS) | 16.2+ | declarado |
| Chrome no Android | recente | declarado |
| Internet Explorer | | **incompatível** |

**App instalável (PWA):** precisa de HTTPS (ou `localhost`). No Android, a instalação de verdade é pelo Chrome; outros navegadores e os navegadores embutidos de apps criam só atalho (visto no primeiro teste, 24/11/2026). No iPhone, pelo Safari ("Adicionar à Tela de Início"): declarado.

`crypto.randomUUID` (usado na chave de idempotência) só existe em HTTPS ou `localhost`; acessando pelo IP da rede da loja em HTTP, a tela usa `crypto.getRandomValues`, que funciona.

## Telas e dispositivos

| Largura | Situação |
|---|---|
| 375 px (celular) | **testado** e ajustado em 24/11/2026 (`6216c5a`) |
| 780 px (tablet) | **testado** em 26/10/2026 |
| 1024 a 1366 px (notebook do caixa) | **testado** em 26/10 e 24/11/2026 |
| Mais de 1366 px (monitor grande) | declarado |
| Impressão do comprovante | declarado: CSS de impressão existe (`@media print`); impressora térmica não testada |

## Integrações

| Integração | Situação | Observação |
|---|---|---|
| SMTP Gmail (587, STARTTLS) | declarado | código pronto; aguarda a senha de app (pendência da semana 12) |
| SMTP na porta 465 (TLS implícito) | declarado | |
| SMTP sem TLS | **incompatível** de propósito | o transporte exige TLS |
| Neon / Supabase (PostgreSQL gerenciado) | declarado | conexão direta, sem pooler, `sslmode=require` |
| Render / Railway | declarado | modo Node ([ADR-0013](../manter/adr/0013-deploy-na-nuvem-em-modo-node.md)) |
| Excel `.xlsx` / `.xlsm`, CSV, TSV, texto colado | **testado** pelos testes de importação | |
| Excel `.xls`, LibreOffice `.ods` | **incompatível** | salvar como `.xlsx` ou `.csv` |
| CSV exportado aberto no Excel em português | declarado | `;` como separador, vírgula decimal, UTF-8 com BOM |
| Leitor de código de barras | **incompatível** hoje | a busca da venda não procura código ([DT-02](roadmap-e-divida-tecnica.md)) |

## Como manter esta matriz

Ao trocar runtime, banco, dependência ou ao testar num navegador ou dispositivo novo, atualize a linha com a situação e a data. "Declarado" só vira "testado" com execução de verdade.
