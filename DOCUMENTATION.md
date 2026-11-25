# Mercadinho do João — Documentação Técnica

Documentação de referência do projeto: o problema que ele resolve, o que foi usado para construí-lo, como as peças se encaixam, e o que cada funcionalidade faz. Para instruções de instalação/deploy do dia a dia, veja o [README.md](README.md); para o histórico completo da auditoria de segurança, veja a seção específica lá.

## Índice

1. [Visão geral e contexto](#1-visão-geral-e-contexto)
2. [Funcionalidades](#2-funcionalidades)
3. [Stack tecnológica](#3-stack-tecnológica)
4. [Arquitetura](#4-arquitetura)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Perfis de acesso](#6-perfis-de-acesso)
7. [Estrutura de pastas](#7-estrutura-de-pastas)
8. [Scripts disponíveis](#8-scripts-disponíveis)
9. [Segurança (resumo)](#9-segurança-resumo)
10. [Testes](#10-testes)

---

## 1. Visão geral e contexto

O Mercadinho do João foi criado para um cliente real: um pequeno comerciante dono de um mercadinho de secos e molhados, que enfrentava quatro problemas concretos:

- **Perda de controle do estoque** — sem saber ao certo o que tinha ou não em loja.
- **Compra excessiva** de produtos que ficavam parados, prendendo capital de giro (baixo, no caso de um pequeno comércio).
- **Produtos vencidos ou estragados**, por falta de aviso antecipado de validade.
- **Falta de produtos de alta demanda**, por não saber quando um item ia esgotar.

O sistema não precisa ser instalado na máquina do cliente — é uma aplicação web acessível de qualquer navegador, hospedável em qualquer provedor de nuvem com PostgreSQL.

## 2. Funcionalidades

### 2.1 Vendas (ponto de venda)

- Busca de produto por nome ou código de barras, com resultado instantâneo (busca com debounce de 250ms).
- Carrinho de venda: adicionar itens, ajustar quantidade, remover, ver subtotal/total em tempo real.
- Confirmar venda: dá baixa automática no estoque de cada item, dentro de uma única transação — ou a venda inteira é registrada, ou nada é (nunca fica pela metade).
- Histórico de vendas recentes, com vendedor, data/hora, itens e total.
- Cancelamento de venda (admin): devolve o estoque de cada item vendido, mesmo que o produto tenha sido descontinuado depois da venda.

### 2.2 Estoque

- Cadastro de produtos: nome, categoria, código de barras (opcional), unidade, preço de custo, preço de venda, estoque mínimo, estoque inicial, validade (opcional).
- Entrada de mercadoria (registro de compra): soma ao estoque existente, com motivo opcional.
- Ajuste/perda (produto vencido, quebra, etc.): soma ou subtrai do estoque, com motivo obrigatório.
- Histórico de movimentações: toda mudança de estoque (venda, entrada, ajuste, perda, cancelamento) fica registrada com data, usuário responsável, quantidade e saldo resultante — uma trilha de auditoria completa e imutável (não existe rota para editar ou apagar uma movimentação já registrada).
- Desativação e reativação de produto: um produto "removido" nunca é apagado do banco (preserva o histórico de vendas ligado a ele) — só marcado como inativo, e pode ser reativado a qualquer momento.

### 2.3 Previsão de esgotamento de estoque

Para cada produto, o sistema calcula a média de vendas diárias dos últimos 30 dias (janela configurável) e projeta em quantos dias o estoque atual vai zerar nesse ritmo. O Painel destaca os produtos com previsão de esgotar em até 7 dias que ainda não estão abaixo do mínimo cadastrado — um alerta antecipado, antes que vire falta de estoque.

### 2.4 Produtos parados

Lista produtos que têm estoque em mãos mas não tiveram nenhuma venda registrada nos últimos 60 dias (nos relatórios, essa janela é configurável). Mostra também o "capital parado" — quanto dinheiro está imobilizado nesse estoque parado (estoque × preço de custo) — ajudando a decidir o que promover ou parar de comprar.

### 2.5 Alertas de validade

Produtos com data de validade cadastrada que estejam a poucos dias de vencer (configurável, padrão 7 dias) aparecem destacados no Painel.

### 2.6 Alerta diário por e-mail (opcional)

Se um servidor SMTP for configurado, o sistema envia automaticamente, uma vez por dia num horário configurável, um e-mail resumindo: produtos abaixo do estoque mínimo, produtos com previsão de esgotar em breve, e produtos perto do vencimento. O e-mail é sempre enviado por conexão criptografada (TLS obrigatório) e em texto puro (nunca HTML).

### 2.7 Relatórios (administrador)

- **Resumo de vendas**: total vendido e número de vendas num período, com detalhamento por dia.
- **Mais vendidos**: ranking de produtos por quantidade vendida e receita gerada, num período.
- **Produtos parados**: mesma lógica do Painel, com janela de dias configurável.
- **Previsão de esgotamento**: a lista completa (não só os mais urgentes) de todos os produtos com sua previsão.

### 2.8 Painel (dashboard)

Primeira tela ao entrar no sistema — resume, num único lugar: estoque abaixo do mínimo, previsão de esgotar em 7 dias, produtos vencendo em breve, e (só para admin) vendas do dia/mês e produtos parados.

### 2.9 Gestão de usuários (administrador)

O sistema tem um único administrador (o dono); toda outra conta é funcionário (caixa), seja criada pelo administrador ou pelo auto-cadastro na tela de login — o perfil não é escolhido nem editável. A conta do auto-cadastro nasce **desativada** e não abre sessão: só entra depois que o administrador a liga em Usuários. No login, ela recebe uma mensagem própria ("ainda não foi liberada") só quando a senha confere. O administrador cadastra novos usuários (nome, e-mail, senha), edita nome/status ativo e redefine a senha de outro usuário. Ele não pode se autodesativar (trava contra ficar acidentalmente trancado fora do próprio sistema).

Toda conta recebe um **nome de usuário** gerado automaticamente — primeiro nome, minúsculo e sem acento, mais um código aleatório de 4 dígitos (ex: `diego1239`) — que serve para entrar no lugar do e-mail. Ele aparece no topo do sistema, ao lado do nome, e na lista de Usuários do administrador.

## 3. Stack tecnológica

### Backend

| Tecnologia | Papel | Por quê |
|---|---|---|
| **Node.js + Express** | Servidor HTTP e roteamento da API | Maduro, simples, sem necessidade de build step — roda o mesmo código em dev e produção |
| **PostgreSQL** | Banco de dados relacional | Robusto, suporta transações ACID (essencial para nunca vender com estoque incorreto), gratuito em vários provedores de nuvem |
| **Prisma ORM** | Acesso ao banco de dados | Todas as consultas são parametrizadas por construção (elimina SQL injection na raiz), migrations versionadas, tipagem |
| **jsonwebtoken + bcryptjs** | Autenticação | JWT para sessão sem estado no servidor; bcrypt (12 rounds) para nunca guardar senha em texto puro |
| **Zod** | Validação de entrada | Todo corpo de requisição é validado contra um schema explícito antes de tocar no banco |
| **Helmet** | Cabeçalhos de segurança HTTP | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, entre outros, num só pacote |
| **express-rate-limit** | Limite de requisições | Protege contra força bruta no login e abuso geral da API |
| **cors, cookie-parser** | Suporte HTTP | CORS restrito à origem configurada; leitura do cookie de sessão |
| **Nodemailer** | Envio de e-mail | Alerta diário de estoque, com TLS obrigatório |
| **node-cron** | Agendamento | Dispara o alerta diário no horário configurado |
| **node:test** (nativo do Node.js) | Testes automatizados | Suíte de integração sem adicionar nenhuma dependência nova ao projeto |

### Frontend

HTML, CSS e JavaScript puros (vanilla) — sem framework (React/Vue/etc.) e sem etapa de build. Cada tela é um `<template>` HTML clonado e populado via DOM API (nunca `innerHTML` com dado do servidor, o que elimina XSS por injeção de HTML). Essa escolha mantém o projeto simples de rodar (não precisa de bundler, webpack, etc.) e fácil de hospedar em qualquer lugar que sirva arquivos estáticos + Node.

### Ferramentas de desenvolvimento/operação

- **Docker** — usado durante o desenvolvimento para subir um PostgreSQL descartável em cada rodada de teste manual/automatizado; não é uma dependência de produção (qualquer PostgreSQL gerenciado serve).
- **GitHub CLI (`gh`)** — usado para criar e sincronizar o repositório remoto.
- **Git** — controle de versão.

## 4. Arquitetura

### 4.1 Visão geral do fluxo

```
Navegador (HTML/CSS/JS puro)
        │  fetch() com cookie httpOnly + header X-Requested-With
        ▼
Express (src/app.js)
  ├─ helmet, cors, rate limit, CSRF leve (X-Requested-With)
  ├─ authenticate (revalida usuário no banco a cada requisição)
  ├─ authorize('ADMIN') (por rota, quando aplicável)
  └─ rotas (src/routes/*.js)
        │  Prisma (parâmetros tipados, nunca string concatenada)
        ▼
    PostgreSQL
```

### 4.2 Autenticação e sessão

1. Login: `POST /api/auth/login` verifica e-mail ou nome de usuário + senha (bcrypt), emite um JWT assinado (`HS256` explícito) e o grava num cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em produção).
2. A cada requisição autenticada, o middleware `authenticate` (`src/auth.js`) verifica a assinatura do token **e** consulta o banco para confirmar que o usuário ainda está ativo e qual é o papel atual dele — uma mudança de status (demissão, rebaixamento) tem efeito imediato, mesmo que o token ainda não tenha expirado (validade de 8h).
3. Autorização por papel: `authorize('ADMIN')` bloqueia rotas administrativas para quem não é admin, checado no servidor em toda requisição (não é só uma questão de esconder botão na tela).

### 4.3 Fluxo de uma venda

1. Cliente envia a lista de itens (`productId` + `quantidade`) — nunca preço, nunca vendedor: esses vêm sempre do banco/sessão, nunca do cliente.
2. Servidor abre uma transação de banco.
3. Para cada item: um `UPDATE` condicional atômico (`WHERE estoque >= quantidade`) desconta o estoque — se não houver saldo suficiente, a transação inteira é desfeita e a venda é rejeitada (409).
4. Cada item vira um registro em `SaleItem` (com o preço no momento da venda) e um registro em `StockMovement` (tipo `SALE`, para a trilha de auditoria).
5. O total da venda é a soma de todos os subtotais, calculado no servidor.

Esse padrão (`UPDATE` condicional atômico em vez de "ler o estoque, calcular em código, escrever de volta") é o que garante que duas vendas simultâneas do mesmo produto nunca resultem em estoque negativo — validado com testes reais de concorrência (ver seção de testes).

### 4.4 Previsão de estoque

`src/forecast.js` calcula, para cada produto ativo, a soma de tudo que foi vendido (`StockMovement` do tipo `SALE`) nos últimos N dias, divide pelo número de dias para obter a média diária, e projeta `estoque_atual / média_diária` para estimar os dias restantes. É uma previsão simples e transparente (sem machine learning), fácil de entender e confiar por quem não é técnico.

## 5. Modelo de dados

Cinco entidades principais (definidas em [prisma/schema.prisma](prisma/schema.prisma)):

- **User** — usuários do sistema (`ADMIN` ou `CASHIER`), com senha em hash.
- **Product** — produtos do catálogo, com preço de custo/venda, estoque atual, estoque mínimo, validade opcional, e status ativo/inativo.
- **Sale** — uma venda, ligada ao vendedor (`User`), com total e status de cancelamento.
- **SaleItem** — cada item de uma venda (produto, quantidade, preço no momento da venda, subtotal).
- **StockMovement** — toda movimentação de estoque (entrada, venda, ajuste, perda), com saldo anterior/posterior, motivo e responsável — a trilha de auditoria completa do estoque.

Todos os valores monetários e de quantidade usam o tipo `Decimal` do PostgreSQL (nunca ponto flutuante), evitando erros de arredondamento em dinheiro.

## 6. Perfis de acesso

| Recurso | Administrador | Caixa (funcionário) |
|---|---|---|
| Registrar venda | ✅ | ✅ |
| Ver histórico de vendas (só as próprias) | ✅ (todas) | ✅ (só as suas) |
| Cancelar venda | ✅ | ❌ |
| Ver produtos (nome, estoque, preço de venda) | ✅ | ✅ |
| Ver preço de custo e margem | ✅ | ❌ (nunca enviado pela API) |
| Cadastrar/editar/desativar/reativar produto | ✅ | ❌ |
| Entrada de estoque / ajustes / perdas | ✅ | ❌ |
| Relatórios | ✅ | ❌ |
| Gestão de usuários | ✅ | ❌ |
| Painel (Vendas hoje/mês, produtos parados) | ✅ | ❌ (vê só os alertas de estoque/validade) |

## 7. Estrutura de pastas

```
mercadinho_joao/
├── prisma/
│   ├── schema.prisma        # modelo de dados
│   ├── migrations/          # histórico de migrations do banco
│   ├── seed.js               # cria o primeiro usuário administrador
│   ├── seedProducts.js       # carga de ~24 produtos de exemplo
│   └── resetPassword.js      # script de recuperação de senha de emergência
├── src/
│   ├── app.js                # configuração do Express (middlewares, rotas)
│   ├── server.js             # ponto de entrada (sobe o servidor + cron)
│   ├── config.js             # leitura/validação de variáveis de ambiente
│   ├── auth.js                # autenticação, hash de senha, middlewares
│   ├── db.js                  # cliente Prisma compartilhado
│   ├── forecast.js            # previsão de esgotamento, produtos parados
│   ├── stockOps.js            # operação atômica de soma/subtração de estoque
│   ├── validate.js            # middleware de validação com Zod
│   ├── queryHelpers.js        # validação de parâmetros de busca (datas, enums)
│   ├── httpError.js           # helper para erros HTTP tipados
│   ├── routes/                # uma rota por recurso (auth, products, sales, stock, users, reports, dashboard)
│   └── jobs/dailyAlerts.js    # e-mail diário de alerta
├── public/                    # frontend (HTML/CSS/JS puro, servido como estático)
│   ├── index.html             # tela de login
│   ├── app.html                # aplicação principal (templates de cada tela)
│   ├── css/style.css
│   └── js/                    # api.js (cliente HTTP), app.js (lógica das telas), login.js
└── test/
    ├── integration.test.js    # suíte de testes de integração
    └── helpers/                # utilitários de teste (banco, HTTP)
```

## 8. Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor em modo produção |
| `npm run dev` | Sobe o servidor com recarregamento automático (nodemon) |
| `npm run prisma:migrate` | Cria/aplica migrations em desenvolvimento |
| `npm run prisma:deploy` | Aplica migrations em produção |
| `npm run seed` | Cria o primeiro usuário administrador |
| `npm run seed:products` | Carrega produtos de exemplo |
| `npm run reset-password -- email@exemplo.com` | Redefine a senha de um usuário (recuperação de emergência): pede a nova senha sem exibi-la e encerra as sessões abertas da conta |
| `npm test` | Roda a suíte de testes de integração |

## 9. Segurança (resumo)

O projeto passou por múltiplas rodadas de auditoria de segurança, com 21 brechas reais encontradas e corrigidas — cada uma testada ao vivo contra um banco de dados real (nunca só analisada no código). Destaques: proteção contra SQL injection e XSS (testadas com payloads reais), CSRF, condição de corrida em estoque concorrente, revogação de sessão em tempo real, força bruta, TLS obrigatório no e-mail, e mais. **Lista completa, com o que foi encontrado e como foi corrigido, no [README.md](README.md#decisões-de-segurança).**

## 10. Testes

```bash
npm test
```

Suíte de integração (`test/integration.test.js`) rodando com o test runner nativo do Node.js (`node:test`, zero dependências novas) contra um PostgreSQL real — sobe a aplicação de verdade e faz requisições HTTP reais, sem mocks. Cobre regressão dos bugs mais graves já encontrados: condição de corrida em estoque, revogação de sessão, autorização por papel, CSRF, SQL injection, validação de data de calendário, overflow numérico e reativação de produto.

A suíte apaga todos os dados do banco configurado antes de rodar — por segurança, ela recusa executar a menos que o nome do banco contenha "test" (ou `ALLOW_DB_RESET=true` seja definido explicitamente). Detalhes em [README.md](README.md#testes-automatizados).
