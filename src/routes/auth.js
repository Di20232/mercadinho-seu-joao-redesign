const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../db');
const config = require('../config');
const validate = require('../validate');
const httpError = require('../httpError');
const { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie, authenticate } = require('../auth');
const { generateUsername } = require('../username');
const { buildTransport } = require('../jobs/dailyAlerts');

const router = express.Router();

// Limita tentativas de login por IP para dificultar força bruta de senha.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Limites dedicados e mais apertados nos endpoints públicos de auto-cadastro
// e recuperação de senha — são portas de entrada que não devem ser bombardeadas.
// Por IP apenas: o token já limita o risco no reset, e o e-mail não é enviado
// (não há SMTP), então o vetor principal de abuso aqui é força bruta de token
// ou criação em massa de contas fantasmas.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
  skip: () => process.env.NODE_ENV === 'test',
});
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente em alguns minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});
const autoLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de auto-login. Tente novamente em alguns minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// `login` aceita o e-mail ou o nome de usuário (ex: diego1239). O campo antigo
// `email` continua aceito como apelido de `login`, para clientes e scripts que
// ainda o enviam.
const loginSchema = z.preprocess(
  (body) => (body && typeof body === 'object' && body.login === undefined ? { ...body, login: body.email } : body),
  z.object({
    login: z.string({ required_error: 'informe o e-mail ou o usuário.' })
      .trim()
      .min(1, 'informe o e-mail ou o usuário.')
      .max(255, 'muito longo.'),
    password: z.string({ required_error: 'informe a senha.' })
      .min(1, 'informe a senha.')
      .max(200, 'muito longa.'),
  }),
);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.').max(200),
}).strict();

const forgotSchema = z.object({
  email: z.string().trim().email().max(255),
});

const resetSchema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.').max(200),
});

// Hash do token de reset. SHA-256 (não bcrypt) porque o token é um valor
// aleatório de 256 bits — não uma senha humana —, então a alta entropia já
// derrota força bruta sem a necessidade de um hash lento. Bcrypt aqui só
// prejudicaria a performance no lookup sem ganho real de segurança.
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Gera token aleatório de 256 bits. Nunca Math.random() nem UUID (que têm
// entropia menor e podem ser previsíveis em implementações fracas).
function generateResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { password } = req.body;
  // Nome de usuário nunca tem "@", então ele decide se o login é e-mail ou usuário.
  const login = req.body.login.toLowerCase();
  const where = login.includes('@') ? { email: login } : { username: login };
  const user = await prisma.user.findUnique({ where });

  // Mensagens distintas para e-mail e senha, por escolha de usabilidade: o
  // usuário sabe qual dos dois corrigir. Contrapartida: revela se um e-mail
  // está cadastrado — a força bruta continua contida pelo loginLimiter.
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Login incorreto.' });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role });
});

// Auto-login existe só para demonstração local. Ele nunca aceita credenciais do
// navegador e nunca entra como ADMIN: lê usuário/senha do ambiente, valida a
// senha normalmente e bloqueia qualquer conta que não seja CASHIER.
router.post('/auto-login', autoLoginLimiter, async (req, res) => {
  if (!config.autoLogin.enabled) {
    return res.status(404).json({ error: 'Auto-login não está habilitado.' });
  }
  if (!config.autoLogin.email || !config.autoLogin.password) {
    return res.status(503).json({ error: 'Auto-login não está configurado.' });
  }

  const user = await prisma.user.findUnique({ where: { email: config.autoLogin.email } });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Usuário de demonstração indisponível.' });
  }
  if (user.role !== 'CASHIER') {
    return res.status(403).json({ error: 'Auto-login só pode usar perfil Caixa.' });
  }

  const ok = await verifyPassword(config.autoLogin.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciais de demonstração inválidas.' });
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// Auto-cadastro público. Conta nasce como CASHIER e ativa, e a sessão é aberta
// na mesma resposta, então quem se cadastra entra direto no sistema. Nunca
// aceita role do cliente — o schema é .strict() e o papel é fixado no servidor.
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw httpError(409, 'Já existe um usuário com este e-mail. Faça login ou solicite recuperação de senha.');

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        username: await generateUsername(prisma, name),
        passwordHash,
        role: 'CASHIER',
        active: true,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, 'Já existe um usuário com este e-mail.');
    throw err;
  }

  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role });
});

// Solicitação de reset. A resposta é SEMPRE genérica, independente do ambiente
// ou de o e-mail existir — isso evita enumeração de usuários e impede que
// qualquer pessoa com o e-mail de outro usuário obtenha um link de reset pelo
// HTTP. Fora de produção, o link é escrito no log do servidor para permitir
// teste manual sem expor o token na resposta HTTP.
router.post('/forgot-password', forgotLimiter, validate(forgotSchema), async (req, res) => {
  const { email } = req.body;
  // Mesma mensagem para e-mail existente e inexistente: evita enumeração de usuários.
  const generic = { message: 'Se o e-mail estiver cadastrado, as instruções para redefinir a senha serão disponibilizadas.' };
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.active) {
    return res.json(generic);
  }

  const rawToken = generateResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + config.passwordResetExpiresMin * 60 * 1000);

  // Política: só um token ativo por usuário. Invalida tokens pendentes
  // anteriores antes de criar o novo, dentro de uma transação.
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ]);

  const resetUrl = `${config.appBaseUrl}/reset-password.html?token=${encodeURIComponent(rawToken)}`;

  // Nunca devolve o token ou link via HTTP — qualquer ambiente, qualquer NODE_ENV.
  // Fora de produção escreve no log para viabilizar teste manual sem SMTP.
  if (config.nodeEnv !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[forgot-password] link de reset para ${email}: ${resetUrl}`);
  }

  // Reutiliza o mesmo transporte SMTP dos alertas de estoque quando configurado.
  // Falha no envio não muda a resposta genérica nem revela se o e-mail existe.
  const transport = buildTransport();
  if (transport) {
    try {
      await transport.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Redefinição de senha - Mercadinho do João',
        text: `Para redefinir sua senha, acesse: ${resetUrl}\n\nEste link expira em ${config.passwordResetExpiresMin} minutos e só pode ser usado uma vez.`,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[forgot-password] falha ao enviar e-mail de reset:', err.message);
    }
  }

  return res.json(generic);
});

// Conclusão do reset. Valida token (hash, não expirado, não usado), troca a
// senha e marca o token como usado — tudo numa transação, com um updateMany
// condicional que atua como compare-and-set: só uma requisição concorrente
// obtém count === 1. Também incrementa sessionVersion para derrubar sessões
// JWT já emitidas (cookie roubado antes do reset deixa de funcionar).
router.post('/reset-password', resetLimiter, validate(resetSchema), async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = hashResetToken(token);
  const now = new Date();

  // Calcula o hash da nova senha ANTES de abrir a transação — o bcrypt cost 12
  // é caro (~300ms) e não queremos segurar a transação aberta por esse tempo.
  const passwordHash = await hashPassword(password);

  const userId = await prisma.$transaction(async (tx) => {
    const resetRecord = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt <= now) {
      return null;
    }

    // Compare-and-set: só marca se ainda estiver não usado e não expirado.
    // Duas requisições concorrentes com o mesmo token: só uma passa.
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetRecord.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) return null;

    await tx.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    // Defesa em profundidade: invalida quaisquer outros tokens pendentes.
    await tx.passwordResetToken.updateMany({
      where: { userId: resetRecord.userId, usedAt: null },
      data: { usedAt: now },
    });

    return resetRecord.userId;
  });

  if (!userId) {
    return res.status(400).json({ error: 'Link de recuperação inválido, expirado ou já utilizado.' });
  }

  res.json({ message: 'Senha redefinida com sucesso. Faça login com a nova senha.' });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { id: true, name: true, email: true, username: true, role: true, active: true },
  });
  if (!user || !user.active) return res.status(401).json({ error: 'Não autenticado.' });
  res.json(user);
});

module.exports = router;
