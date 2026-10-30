const path = require('path');
const express = require('express');
require('express-async-errors'); // faz erros lançados em handlers async caírem no error handler abaixo
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { requireFetchHeader } = require('./auth');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const usersRoutes = require('./routes/users');
const importsRoutes = require('./routes/imports');

const app = express();

app.disable('x-powered-by');
// Por padrão (0) não confia em X-Forwarded-For — só habilite via TRUST_PROXY
// no .env se este app estiver de fato atrás de um proxy reverso confiável
// (ver comentário em config.js). Confiar nesse cabeçalho sem um proxy real
// na frente permite que qualquer requisição forje seu próprio "IP", furando
// o limite de tentativas de login.
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
      },
    },
  }),
);

// CORS com allowlist: apenas origens explicitamente configuradas
const allowedOrigins = new Set(
  (config.clientOrigin || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
);

// A própria página do app chamando a API não é cross-origin, seja qual for o
// endereço em que ele foi aberto (outra porta, 127.0.0.1, o IP da máquina na
// rede da loja). O navegador manda Origin mesmo assim em POST, então sem esta
// checagem o login falhava em qualquer endereço fora de CLIENT_ORIGIN. Um site
// de terceiros não engana isto: o navegador não deixa a página forjar o Host.
function isSameOrigin(req, origin) {
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

app.use(
  cors((req, done) => {
    done(null, {
      origin(origin, callback) {
        // Requisições sem Origin (server-to-server, health checks) são permitidas
        if (!origin || allowedOrigins.has(origin) || isSameOrigin(req, origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin não permitida por CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
      maxAge: 86400,
    });
  }),
);
// 100kb cobre com folga qualquer requisição normal do app. A importação de
// planilha é a exceção — a grade lida do arquivo volta ao servidor a cada
// pré-visualização — então aquele roteador traz o próprio parser, com limite
// maior, e é pulado aqui.
const jsonBodyParser = express.json({ limit: '100kb' });
app.use((req, res, next) => {
  if (req.path.startsWith('/api/imports/')) return next();
  jsonBodyParser(req, res, next);
});
app.use(cookieParser());

// Limite geral de requisições por IP para toda a API (proteção básica contra abuso/DoS simples).
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: config.apiRateLimitMax, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api', requireFetchHeader);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/imports', importsRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => res.status(404).json({ error: 'Não encontrado.' }));

// Error handler central: nunca vaza detalhes internos (stack, mensagens do Prisma) em erros 500.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Erro interno do servidor.' : err.message });
});

module.exports = app;
