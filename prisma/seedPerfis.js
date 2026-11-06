// Cria uma conta de teste para cada tipo de pessoa (Financeiro, Estoque, Caixa),
// para testar as permissões no navegador. O Dono é o administrador que você já
// usa (criado pelo "npm run seed"), porque o sistema só tem um Dono.
//
// Uso: npm run seed:perfis
// Senha de todas as contas abaixo: Teste1234!   (só para teste local)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { TEMPLATES } = require('../src/permissions');

const TEST_PASSWORD = 'Teste1234!';
const PEOPLE = [
  { name: 'Financeiro Teste', email: 'financeiro@teste.local', username: 'financeiroteste', template: 'financeiro' },
  { name: 'Estoque Teste', email: 'estoque@teste.local', username: 'estoqueteste', template: 'estoque' },
  { name: 'Caixa Teste', email: 'caixa@teste.local', username: 'caixateste', template: 'caixa' },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Contas de teste com senha conhecida não podem ser criadas em produção.');
  }
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  for (const p of PEOPLE) {
    const permissions = TEMPLATES[p.template].permissions;
    // upsert: rodar de novo só restaura senha e permissões, não duplica.
    await prisma.user.upsert({
      where: { email: p.email },
      update: { permissions, passwordHash, active: true, sessionVersion: { increment: 1 } },
      create: { name: p.name, email: p.email, username: p.username, role: 'CASHIER', permissions, passwordHash },
    });
    console.log(`${TEMPLATES[p.template].label.padEnd(10)} ${p.email}  (ou @${p.username})`);
  }
  console.log(`Senha de todas: ver o topo de prisma/seedPerfis.js`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
