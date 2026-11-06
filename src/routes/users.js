const express = require('express');
const { z } = require('zod');
const prisma = require('../db');
const validate = require('../validate');
const httpError = require('../httpError');
const { authenticate, authorize, hashPassword } = require('../auth');
const { generateUsername } = require('../username');
const { PERMISSIONS, ALL, TEMPLATES } = require('../permissions');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres.').max(200),
  permissions: z.array(z.enum(ALL)).max(ALL.length).default([]),
});

// O perfil não é editável: o sistema tem um único administrador (o dono) e
// toda outra conta é funcionário. Um `role` enviado pelo cliente é descartado
// pelo schema (Zod remove chaves desconhecidas).
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
  permissions: z.array(z.enum(ALL)).max(ALL.length).optional(),
});

// Lista de caixinhas e modelos (Financeiro, Estoque, Caixa) para o formulário.
router.get('/permissions', (req, res) => {
  res.json({ permissions: PERMISSIONS, templates: TEMPLATES });
});

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, username: true, role: true, permissions: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.post('/', validate(createSchema), async (req, res) => {
  const { name, email, password, permissions } = req.body;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw httpError(409, 'Já existe um usuário com este e-mail.');

  const passwordHash = await hashPassword(password);
  let user;
  try {
    // Contas criadas pelo admin são sempre funcionário — só existe um administrador.
    const username = await generateUsername(prisma, name);
    user = await prisma.user.create({ data: { name, email: email.toLowerCase(), username, passwordHash, role: 'CASHIER', permissions } });
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, 'Já existe um usuário com este e-mail.');
    throw err;
  }
  res.status(201).json({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, permissions: user.permissions, active: user.active });
});

router.put('/:id', validate(updateSchema), async (req, res) => {
  const data = req.body;

  // Evita que o administrador se autodesative por engano e fique trancado fora do sistema.
  if (req.params.id === req.user.sub && data.active === false) {
    throw httpError(400, 'Você não pode desativar seu próprio usuário.');
  }

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw httpError(404, 'Usuário não encontrado.');

  const update = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.active !== undefined) update.active = data.active;
  if (data.permissions !== undefined) update.permissions = [...new Set(data.permissions)];
  // O hash (bcrypt, ~12 rounds) só é calculado depois de confirmar que o
  // usuário existe — evita gastar CPU cara de hashing em requisições para
  // IDs inexistentes, o que serviria de amplificador de custo para um
  // atacante disparando muitas requisições PUT em sequência.
  if (data.password) {
    update.passwordHash = await hashPassword(data.password);
    // Trocar a senha do usuário também derruba sessões existentes — consistente
    // com o fluxo de reset (ambos mudam a credencial).
    update.sessionVersion = { increment: 1 };
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data: update });
  res.json({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, permissions: user.permissions, active: user.active });
});

module.exports = router;
