# 🛒 Mercadinho do João - Sistema de Vendas & Estoque

Um sistema moderno e seguro de controle de vendas e estoque para pequenos comércios, desenvolvido com Node.js, Express, PostgreSQL e JavaScript vanilla.

## 📋 Características Principais

### 🔐 Segurança em Primeiro Lugar
- ✅ **JWT com Issuer/Audience** - Validação rigorosa de tokens
- ✅ **CORS com Allowlist Dinâmico** - Apenas origens autorizadas
- ✅ **CSRF Protection** - Header `X-Requested-With` validado
- ✅ **XSS Protegido** - Renderização segura com DOM API
- ✅ **Rate Limiting** - Proteção contra força bruta
- ✅ **Bcrypt (factor 12)** - Hashing seguro de senhas
- ✅ **Helmet** - Headers de segurança HTTP
- ✅ **Zod Validation** - Validação rigorosa de schemas

### 📦 Funcionalidades
- **Gestão de Produtos** - Criar, editar, deletar produtos com categorias
- **Controle de Estoque** - Rastrear entrada, saída e ajustes
- **Sistema de Vendas** - Registrar vendas com múltiplos itens
- **Relatórios** - Visualizar dados de vendas e estoque
- **Gerenciamento de Usuários** - Admin e Cashier roles
- **Importação em Lote** - Upload de produtos via CSV
- **Audit Trail** - Histórico completo de movimentações

### 🏗️ Arquitetura
- **Backend**: Node.js + Express 4.x
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5.20
- **Frontend**: HTML/CSS/JavaScript puro (sem framework)
- **Containerização**: Docker + Docker Compose
- **Validação**: Zod
- **Autenticação**: JWT + Cookies HttpOnly

## 🚀 Quick Start

### Pré-requisitos
- Node.js 22.x+
- Docker & Docker Compose
- Git

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/Di20232/mercadinho-seu-joao-2.git
cd mercadinho-seu-joao-2
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o ambiente**
```bash
cp .env.example .env
```

4. **Inicie o Docker**
```bash
docker-compose up -d
```

5. **Execute as migrations**
```bash
npm run prisma:migrate
```

6. **Crie um usuário admin**
```bash
npm run seed
```

Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` no `.env` antes de rodar o seed. Não há senha padrão segura para produção.

7. **Inicie o servidor**
```bash
npm start
```

8. **Acesse no navegador**
```
http://localhost:3000
```

## 🔐 Credenciais de Acesso

Não há credencial padrão hardcoded. Crie o primeiro administrador com `npm run seed` usando as variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`.

Para demonstração local, o auto-login usa somente uma conta `CASHIER` configurada no servidor (`AUTO_LOGIN_ENABLED=true`, `AUTO_LOGIN_EMAIL`, `AUTO_LOGIN_PASSWORD`) e nunca entra como `ADMIN`.

## 📁 Estrutura do Projeto

```
src/
├── auth.js                 # JWT, cookies, autenticação
├── app.js                  # Configuração Express, CORS, middleware
├── config.js              # Variáveis de ambiente
├── db.js                  # Cliente Prisma
├── server.js              # Entry point
├── routes/
│   ├── auth.js           # Login, registro, recuperação de senha
│   ├── products.js       # CRUD de produtos
│   ├── sales.js          # Registro e cancelamento de vendas
│   ├── stock.js          # Entrada e ajuste de estoque
│   ├── users.js          # Gerenciamento de usuários
│   └── imports.js        # Importação em lote
├── middleware/
│   └── ...
└── validate.js           # Validação com Zod

public/
├── index.html            # Página de login
├── app.html              # Dashboard
├── js/
│   ├── app.js           # Lógica do dashboard
│   └── api.js           # Cliente HTTP e helpers UI
└── css/
    └── style.css        # Estilos

prisma/
├── schema.prisma        # Schema do banco
├── seed.js             # Seed inicial
└── migrations/         # Histórico de migrations

test/
└── security.test.js    # Testes de segurança (7 testes)

docker-compose.yml      # Composição de containers
.env.example           # Variáveis de exemplo
```

## 📖 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Solicitar reset de senha
- `POST /api/auth/reset-password` - Redefinir senha

### Produtos
- `GET /api/products` - Listar produtos
- `GET /api/products/:id` - Obter produto
- `POST /api/products` - Criar produto (ADMIN)
- `PUT /api/products/:id` - Editar produto (ADMIN)
- `DELETE /api/products/:id` - Deletar produto (ADMIN)

### Vendas
- `GET /api/sales` - Listar vendas
- `POST /api/sales` - Criar venda
- `POST /api/sales/:id/cancel` - Cancelar venda (ADMIN)

### Estoque
- `GET /api/stock/movements` - Listar movimentações
- `POST /api/stock/entries` - Entrada de estoque (ADMIN)
- `POST /api/stock/adjustments` - Ajuste de estoque (ADMIN)

### Usuários
- `GET /api/users` - Listar usuários (ADMIN)
- `POST /api/users` - Criar usuário (ADMIN; conta nasce como CASHIER)
- `PUT /api/users/:id` - Editar usuário (ADMIN)

### Auto-login de demonstração
- `POST /api/auth/auto-login` - Login local/demo somente com perfil CASHIER; desabilitado por padrão e sempre bloqueado em produção

### Importações
- `POST /api/imports/products` - Importar produtos em lote (ADMIN)

## 🧪 Testes

### Executar os testes
```bash
npm test
```

Roda as duas suítes (`test/integration.test.js` e `test/security.test.js`), com 48 testes. A suíte de integração **apaga todas as tabelas** antes de rodar e se recusa a rodar se o nome do banco em `DATABASE_URL` não contiver `test`. Aponte para um banco só de testes, por exemplo `.../mercadinho_joao_test`.

O que é coberto: login e sessão, CSRF e CORS, vendas e estoque (inclusive vendas simultâneas), cancelamento, permissões de dono e caixa, recuperação de senha, importação e exportação de planilhas, relatórios, "já cadastrado" (e-mail e código de barras), JWT e a configuração exigida em produção.

## 🔐 Segurança - Implementações

### JWT com Issuer e Audience
```javascript
// src/auth.js
jwt.sign({ ... }, secret, {
  issuer: 'mercadinho-joao-api',
  audience: 'mercadinho-joao-web',
})
```

### CORS com Allowlist Dinâmico
```javascript
// src/app.js
const allowedOrigins = new Set(
  (config.clientOrigin || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
)
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Origin não permitida'))
    }
  }
}))
```

### XSS Protection
```javascript
// public/js/api.js
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const child of Array.isArray(children) ? children : [children]) {
    // Strings são convertidas em TextNode (seguro contra XSS)
    node.appendChild(typeof child === 'string' 
      ? document.createTextNode(child) 
      : child
    )
  }
  return node
}
```

## 📊 Dados de Exemplo

O projeto inclui dados simulados:

- **8 Produtos Iniciais** com estoque
- **5 Vendas Simuladas** (Total: R$ 312.42)
- **27 Movimentações de Estoque**

### Importar produtos em lote
1. Acesse: http://localhost:3000
2. Vá para "Importar Produtos"
3. Selecione `produtos-importacao.csv`
4. Adicione 26 novos produtos

## 🛠️ Variáveis de Ambiente

```bash
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://usuario:senha@localhost:5433/mercadinho_joao?schema=public"

# JWT
JWT_SECRET=troque_por_um_segredo_longo_e_aleatorio
JWT_EXPIRES_IN=8h

# CORS
CLIENT_ORIGIN=http://localhost:3000

# Endereço público (link do e-mail de "esqueci minha senha"); obrigatório em produção
APP_BASE_URL=http://localhost:3000

# Proxies confiáveis na frente do app (1 no Render/Railway, 0 local)
TRUST_PROXY=0

# Cookies
COOKIE_SECURE=false

# Rate Limiting
API_RATE_LIMIT_MAX=300

# Admin padrão (escolha uma senha própria; o seed recusa senha vazia)
ADMIN_NAME="Dono do Mercado"
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=

# Auto-login local/demo (nunca usar ADMIN)
AUTO_LOGIN_ENABLED=false
AUTO_LOGIN_EMAIL=
AUTO_LOGIN_PASSWORD=
```

## 🐳 Docker

### Iniciar containers
```bash
docker-compose up -d
```

### Ver logs
```bash
docker-compose logs -f app
docker-compose logs -f db
```

### Parar containers
```bash
docker-compose down
```

## ✉️ E-mail de "esqueci minha senha"

O código já envia o e-mail; basta configurar o SMTP no `.env`. Com o Gmail:

1. Ative a verificação em duas etapas na conta Google que vai enviar.
2. Em *Conta Google → Segurança → Senhas de app*, crie uma senha de app (16 letras).
3. Preencha no `.env`:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=conta.que.envia@gmail.com
   SMTP_PASS=a-senha-de-app
   SMTP_FROM="Mercadinho do João <conta.que.envia@gmail.com>"
   ALERT_EMAIL_TO=dono@exemplo.com   # opcional: recebe o alerta diário de estoque
   ```
4. Reinicie o servidor, abra *Esqueci minha senha* e informe um e-mail cadastrado.

Sem SMTP, fora de produção, o link aparece no log do servidor (`[forgot-password] link de reset...`). A resposta da tela é sempre a mesma mensagem genérica, exista ou não o e-mail.

## ☁️ Publicando na nuvem

Use o modo **Node** do provedor, não o `Dockerfile`: o `Dockerfile` foi feito para o `docker-compose` e espera um banco com o nome `db`, que não existe na nuvem.

1. **Banco (Neon ou Supabase):** crie um projeto PostgreSQL e copie a string de conexão **direta** (sem pooler). Ela vai em `DATABASE_URL`, com `?sslmode=require` no fim se o provedor não colocar.
2. **App (Render ou Railway):** crie um serviço web a partir do repositório.
   - Build: `npm ci --include=dev && npx prisma migrate deploy` (o `--include=dev` é necessário: com `NODE_ENV=production`, o `npm ci` pula o `prisma`, que é devDependency)
   - Start: `node src/server.js`
   - Variáveis:
     | Variável | Valor |
     |---|---|
     | `NODE_ENV` | `production` |
     | `DATABASE_URL` | a string do passo 1 |
     | `JWT_SECRET` | um segredo longo (`openssl rand -base64 48`) |
     | `APP_BASE_URL` | o endereço do serviço, ex.: `https://mercadinho.onrender.com` |
     | `CLIENT_ORIGIN` | o mesmo endereço |
     | `TRUST_PROXY` | `1` |
     | `SMTP_*` | como na seção de e-mail (opcional) |

   Em produção o servidor **recusa iniciar** sem um `JWT_SECRET` forte ou sem `APP_BASE_URL` público. O cookie de sessão passa a ser `Secure` automaticamente.
3. **Primeiro usuário:** no shell do serviço, rode uma vez
   `ADMIN_NAME="Seu João" ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed`.
   Entre no sistema e troque a senha.
4. **Conferência:** abra o endereço, faça uma venda de teste e cancele-a em *Vendas recentes*. O estoque volta.

## 📚 Documentação

- [REFACTORING_FINAL_REPORT.md](./REFACTORING_FINAL_REPORT.md) - Relatório completo de refatoração
- [SPRINT_REPORT.md](./SPRINT_REPORT.md) - Detalhes dos Sprints 1-2
- [SPRINT_3_REPORT.md](./SPRINT_3_REPORT.md) - Auditoria XSS
- [PROJETO_COMPLETO.md](./PROJETO_COMPLETO.md) - Resumo executivo

## 🔄 Fluxo de Vendas

1. **Criar Venda**
   - Selecionar produtos
   - Informar quantidades
   - Escolher forma de pagamento

2. **Atualização de Estoque**
   - Estoque é decrementado automaticamente
   - Movimentação é registrada com tipo SALE
   - Audit trail completo

3. **Cancelamento**
   - Admin pode cancelar vendas
   - Estoque é restaurado automaticamente
   - Histórico é preservado

## 🚨 Taxa de Erro Padrão

```json
{
  "error": "Descrição do erro"
}
```

## 📞 Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no GitHub.

## 📄 Licença

MIT License - veja LICENSE para detalhes.

## 👥 Autores

- **Diego** - Desenvolvedor Principal
- **Claude Code AI** - Assistência em Segurança e Arquitetura

## 🎯 Status do Projeto

✅ **Pronto para Produção**

- ✅ Segurança: 5/5 Problemas P0 Resolvidos
- ✅ Testes: 7/7 Passando
- ✅ Funcionalidades: 100% Operacional
- ✅ Documentação: Completa
- ✅ Dados: Simulados e Validados

---

**Última atualização**: 2026-10-09

Desenvolvido com ❤️ usando Node.js, Express e PostgreSQL.
