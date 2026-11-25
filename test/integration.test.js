process.env.NODE_ENV = 'test';
// Testes de integração de regressão: rodam contra um PostgreSQL real (não
// mocks) e sobem a aplicação de verdade na memória, exatamente como ela
// roda em produção. Protegem especificamente contra os bugs mais graves
// encontrados durante a auditoria de segurança — sem eles, seria fácil uma
// mudança futura reintroduzir silenciosamente qualquer um desses problemas.
//
// Requer uma DATABASE_URL de teste configurada (.env) apontando para um
// PostgreSQL dedicado a testes — a suíte APAGA todos os dados desse banco
// antes de rodar. Nunca aponte para um banco com dados reais.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcryptjs');

const app = require('../src/app');
const config = require('../src/config');
const { prisma, resetDb } = require('./helpers/db');
const { makeCookieJar, request } = require('./helpers/http');

let server;
let baseUrl;
let adminJar;

before(async () => {
  await resetDb();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const passwordHash = await bcrypt.hash('TesteSenha123!', 12);
  await prisma.user.create({
    data: { name: 'Admin Teste', email: 'admin.test@example.com', username: 'admin1000', passwordHash, role: 'ADMIN' },
  });

  adminJar = makeCookieJar();
  const login = await request(baseUrl, adminJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.test@example.com', password: 'TesteSenha123!' },
  });
  assert.equal(login.status, 200, 'login do admin de teste deveria funcionar');
});

after(async () => {
  // `server` pode nunca ter sido criado se before() falhou cedo (ex: a
  // trava de segurança do resetDb recusando um banco que não parece ser de
  // teste) — sem esta checagem, o after() lançaria um segundo erro
  // (TypeError) que mascara a mensagem real do problema.
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

// Atenção: o loginLimiter permite 10 logins por IP a cada 15 min e a suíte
// inteira roda do mesmo IP — novos testes de login precisam caber nesse total.
test('login: retorna mensagens específicas para campo, e-mail e senha', async () => {
  // Sem "@" o valor é tratado como nome de usuário — inexistente vira "Login incorreto."
  const unknownUsername = await request(baseUrl, null, '/api/auth/login', {
    method: 'POST',
    body: { login: 'naoexiste9999', password: 'qualquer' },
  });
  assert.equal(unknownUsername.status, 401);
  assert.equal(unknownUsername.body.error, 'Login incorreto.');

  const missingPassword = await request(baseUrl, null, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.test@example.com', password: '' },
  });
  assert.equal(missingPassword.status, 400);
  assert.match(missingPassword.body.error, /Senha: informe a senha/);

  const wrongEmail = await request(baseUrl, null, '/api/auth/login', {
    method: 'POST',
    body: { email: 'nao-existe@example.com', password: 'TesteSenha123!' },
  });
  assert.equal(wrongEmail.status, 401);
  assert.equal(wrongEmail.body.error, 'Login incorreto.');

  const wrongPassword = await request(baseUrl, null, '/api/auth/login', {
    method: 'POST',
    body: { email: 'admin.test@example.com', password: 'senha-errada' },
  });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.body.error, 'Senha incorreta.');
});

test('login: aceita o nome de usuário gerado no cadastro', async () => {
  const register = await request(baseUrl, makeCookieJar(), '/api/auth/register', {
    method: 'POST',
    body: { name: 'Joaquim Ávila', email: 'joaquim.username@example.com', password: 'SenhaUsuario123!' },
  });
  assert.equal(register.status, 201);
  // Primeiro nome, minúsculo e sem acento, seguido de 4 dígitos.
  assert.match(register.body.username, /^joaquim\d{4}$/);

  // O login pelo e-mail continua coberto pelos demais testes (todos entram por e-mail).
  const byUsername = await request(baseUrl, makeCookieJar(), '/api/auth/login', {
    method: 'POST',
    body: { login: register.body.username.toUpperCase(), password: 'SenhaUsuario123!' },
  });
  assert.equal(byUsername.status, 200, 'login pelo usuário deveria funcionar, sem diferenciar maiúsculas');
  assert.equal(byUsername.body.email, 'joaquim.username@example.com');
});

test('CORS: a própria página do app passa em qualquer endereço; outro site continua bloqueado', async () => {
  // baseUrl (127.0.0.1:porta aleatória) não está em CLIENT_ORIGIN — é o caso de
  // abrir o app por outra porta ou pelo IP da máquina na rede da loja.
  const sameOrigin = await fetch(`${baseUrl}/api/auth/me`, { headers: { Origin: baseUrl } });
  assert.equal(sameOrigin.status, 401, 'deveria chegar à rota (sem sessão = 401), não ser barrada pelo CORS');
  assert.equal(sameOrigin.headers.get('access-control-allow-origin'), baseUrl);

  const otherSite = await fetch(`${baseUrl}/api/auth/me`, { headers: { Origin: 'https://site-de-terceiros.example' } });
  assert.notEqual(otherSite.status, 401, 'origem de terceiros não pode chegar à rota');
  assert.equal(otherSite.headers.get('access-control-allow-origin'), null);
});

test('CSRF: rota que altera estado rejeita requisição sem X-Requested-With', async () => {
  const res = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminJar.header() },
    body: JSON.stringify({ name: 'x', unit: 'UN', costPrice: 1, salePrice: 2 }),
  });
  assert.equal(res.status, 403);
});

test('SQL injection: payload é armazenado como texto literal, nunca executado', async () => {
  const payload = "Teste'; DROP TABLE \"Product\"; --";
  const created = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: payload, unit: 'UN', costPrice: 1, salePrice: 2 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, payload);

  const list = await request(baseUrl, adminJar, '/api/products');
  assert.equal(list.status, 200, 'a tabela Product precisa continuar existindo e consultável');
});

test('validação de calendário rejeita datas impossíveis (30 de fevereiro)', async () => {
  const res = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Data Impossível', unit: 'UN', costPrice: 1, salePrice: 2, expiryDate: '2026-02-30' },
  });
  assert.equal(res.status, 400);
});

test('barreira de overflow numérico rejeita uma venda absurdamente alta', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Caro', unit: 'UN', costPrice: 1, salePrice: 900_000, initialStock: 100_000 },
  });
  assert.equal(product.status, 201);

  const sale = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 10_000 }] },
  });
  assert.equal(sale.status, 400);
});

test('venda decrementa o estoque corretamente e rejeita venda além do disponível', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Venda Simples', unit: 'UN', costPrice: 1, salePrice: 10, initialStock: 5 },
  });

  const sale = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 3 }] },
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.body.totalAmount, 30);

  const afterSale = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(afterSale.body.currentStock, 2);

  const oversell = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 999 }] },
  });
  assert.equal(oversell.status, 409);
});

test('condição de corrida: entradas de estoque simultâneas nunca perdem atualizações', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Race Entradas', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 0 },
  });

  await Promise.all(
    Array.from({ length: 20 }, () =>
      request(baseUrl, adminJar, '/api/stock/entries', {
        method: 'POST',
        body: { productId: product.body.id, quantity: 1, reason: 'teste de regressão' },
      }),
    ),
  );

  const after1 = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(after1.body.currentStock, 20, '20 entradas simultâneas de +1 devem somar exatamente 20');
});

test('condição de corrida: vendas simultâneas nunca vendem além do estoque disponível', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Race Vendas', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 10 },
  });

  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request(baseUrl, adminJar, '/api/sales', {
        method: 'POST',
        body: { items: [{ productId: product.body.id, quantity: 1 }] },
      }),
    ),
  );

  const successCount = results.filter((r) => r.status === 201).length;
  assert.equal(successCount, 10, 'só 10 das 20 vendas simultâneas podem ter sucesso (estoque inicial de 10)');

  const after1 = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(after1.body.currentStock, 0, 'o estoque nunca pode ficar negativo');
});

test('idempotência: repetir a venda com a mesma Idempotency-Key devolve a mesma venda e baixa o estoque uma vez só', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Idempotente', unit: 'UN', costPrice: 1, salePrice: 4, initialStock: 10 },
  });
  const send = () => request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    headers: { 'Idempotency-Key': 'venda-repetida-0001' },
    body: { items: [{ productId: product.body.id, quantity: 3 }] },
  });

  const first = await send();
  const retry = await send();
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200, 'a repetição responde com a venda já criada');
  assert.equal(retry.body.id, first.body.id);
  assert.deepEqual(retry.body.items, first.body.items);

  const after1 = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(after1.body.currentStock, 7, 'o estoque só pode ser baixado uma vez');
});

test('idempotência: requisições simultâneas com a mesma chave criam uma única venda', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Idempotente Simultâneo', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 10 },
  });

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request(baseUrl, adminJar, '/api/sales', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'venda-simultanea-0001' },
        body: { items: [{ productId: product.body.id, quantity: 1 }] },
      }),
    ),
  );

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 200, 200, 200, 200, 200, 200, 201]);
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1, 'todas as respostas apontam para a mesma venda');
  assert.equal(await prisma.sale.count({ where: { idempotencyKey: 'venda-simultanea-0001' } }), 1);

  const after1 = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(after1.body.currentStock, 9);
});

test('idempotência: chave reaproveitada em outro carrinho é recusada e chave malformada dá 400', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Chave Reusada', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 10 },
  });
  const sell = (key, quantity) => request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: { items: [{ productId: product.body.id, quantity }] },
  });

  assert.equal((await sell('venda-reusada-0001', 1)).status, 201);
  assert.equal((await sell('venda-reusada-0001', 2)).status, 422, 'outro carrinho com a mesma chave não pode virar a venda antiga');
  assert.equal((await sell('curta', 1)).status, 400);
  assert.equal((await sell('com espaço inválido', 1)).status, 400);

  const after1 = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(after1.body.currentStock, 9);
});

test('revogação de sessão: usuário desativado perde acesso imediatamente, mesmo com token ainda válido', async () => {
  const created = await request(baseUrl, adminJar, '/api/users', {
    method: 'POST',
    body: { name: 'Caixa Regressão', email: 'caixa.regressao@example.com', password: 'SenhaCaixa123!', role: 'CASHIER' },
  });
  assert.equal(created.status, 201);

  const cashierJar = makeCookieJar();
  const login = await request(baseUrl, cashierJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'caixa.regressao@example.com', password: 'SenhaCaixa123!' },
  });
  assert.equal(login.status, 200);

  const meBefore = await request(baseUrl, cashierJar, '/api/auth/me');
  assert.equal(meBefore.status, 200);

  await request(baseUrl, adminJar, `/api/users/${created.body.id}`, { method: 'PUT', body: { active: false } });

  const meAfter = await request(baseUrl, cashierJar, '/api/auth/me');
  assert.equal(meAfter.status, 401, 'o mesmo token, agora com a conta desativada, precisa parar de funcionar na hora');
});

test('autorização: funcionário (caixa) é bloqueado de rotas administrativas e nunca vê preço de custo', async () => {
  const created = await request(baseUrl, adminJar, '/api/users', {
    method: 'POST',
    body: { name: 'Caixa Autorização', email: 'caixa.auth@example.com', password: 'SenhaCaixa123!', role: 'CASHIER' },
  });
  assert.equal(created.status, 201);

  const cashierJar = makeCookieJar();
  await request(baseUrl, cashierJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'caixa.auth@example.com', password: 'SenhaCaixa123!' },
  });

  const usersRes = await request(baseUrl, cashierJar, '/api/users');
  assert.equal(usersRes.status, 403);

  const reportsRes = await request(baseUrl, cashierJar, '/api/reports/forecast');
  assert.equal(reportsRes.status, 403);

  const salesSummaryRes = await request(baseUrl, cashierJar, '/api/reports/sales-summary');
  assert.equal(salesSummaryRes.status, 403);

  const productsRes = await request(baseUrl, cashierJar, '/api/products');
  assert.equal(productsRes.status, 200);
  for (const p of productsRes.body) {
    assert.equal('costPrice' in p, false, `produto "${p.name}" não deveria expor costPrice para o caixa`);
    assert.equal('margin' in p, false);
  }
});

test('produto desativado pode ser reativado pelo administrador', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Reativação', unit: 'UN', costPrice: 1, salePrice: 2 },
  });

  await request(baseUrl, adminJar, `/api/products/${product.body.id}`, { method: 'DELETE' });
  const deactivated = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(deactivated.body.active, false);

  await request(baseUrl, adminJar, `/api/products/${product.body.id}`, { method: 'PUT', body: { active: true } });
  const reactivated = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(reactivated.body.active, true);
});

test('produto desativado fica invisível para o caixa na rota de detalhe (não só na listagem)', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Oculto', unit: 'UN', costPrice: 1, salePrice: 2 },
  });
  await request(baseUrl, adminJar, `/api/products/${product.body.id}`, { method: 'DELETE' });

  const cashierJar = makeCookieJar();
  await request(baseUrl, cashierJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'caixa.auth@example.com', password: 'SenhaCaixa123!' },
  });

  const res = await request(baseUrl, cashierJar, `/api/products/${product.body.id}`);
  assert.equal(res.status, 404);

  // reativa para não deixar lixo para os próximos testes/rodadas manuais
  await request(baseUrl, adminJar, `/api/products/${product.body.id}`, { method: 'PUT', body: { active: true } });
});

test('auto-login: fica desabilitado por padrão', async () => {
  const previous = { ...config.autoLogin };
  config.autoLogin = { enabled: false, email: '', password: '' };
  try {
    const res = await request(baseUrl, null, '/api/auth/auto-login', { method: 'POST' });
    assert.equal(res.status, 404);
  } finally {
    config.autoLogin = previous;
  }
});

test('auto-login: recusa conta ADMIN mesmo com senha correta', async () => {
  const previous = { ...config.autoLogin };
  config.autoLogin = { enabled: true, email: 'admin.test@example.com', password: 'TesteSenha123!' };
  try {
    const res = await request(baseUrl, null, '/api/auth/auto-login', { method: 'POST' });
    assert.equal(res.status, 403);
  } finally {
    config.autoLogin = previous;
  }
});

test('auto-login: permite apenas usuário CASHIER configurado no servidor', async () => {
  const passwordHash = await bcrypt.hash('SenhaCaixaAuto123!', 12);
  await prisma.user.create({
    data: { name: 'Caixa Auto Login', email: 'caixa.auto@example.com', username: 'caixa1001', passwordHash, role: 'CASHIER' },
  });

  const previous = { ...config.autoLogin };
  config.autoLogin = { enabled: true, email: 'caixa.auto@example.com', password: 'SenhaCaixaAuto123!' };
  const jar = makeCookieJar();
  try {
    const res = await request(baseUrl, jar, '/api/auth/auto-login', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'CASHIER');
    assert.match(jar.header(), /mj_token=/, 'auto-login deve criar cookie de sessão HttpOnly pelo backend');
  } finally {
    config.autoLogin = previous;
  }
});

test('recuperação de senha: e-mail inexistente recebe resposta genérica sem erro 500', async () => {
  const res = await request(baseUrl, null, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'nao-existe@example.com' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Se o e-mail estiver cadastrado, as instruções para redefinir a senha serão disponibilizadas.');
  assert.equal('resetUrl' in res.body, false);
});

test('recuperação de senha: resposta nunca contém token ou link, para e-mail existente ou inexistente', async () => {
  // E-mail existente: cria conta temporária para garantir que o usuário existe
  const passwordHash = await bcrypt.hash('SenhaSegNunca123!', 12);
  await prisma.user.create({
    data: { name: 'Seg Teste', email: 'seg.teste@example.com', username: 'seg1010', passwordHash, role: 'CASHIER' },
  });

  const resExistente = await request(baseUrl, null, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'seg.teste@example.com' },
  });
  assert.equal(resExistente.status, 200);
  // A resposta HTTP nunca pode conter token, URL de reset ou qualquer dado sensível
  const bodyStr = JSON.stringify(resExistente.body);
  assert.ok(!bodyStr.includes('token'), 'resposta para e-mail EXISTENTE não pode conter "token"');
  assert.ok(!bodyStr.includes('reset-password'), 'resposta para e-mail EXISTENTE não pode conter link de reset');
  assert.ok(!bodyStr.includes('resetUrl'), 'resposta para e-mail EXISTENTE não pode conter "resetUrl"');

  // E-mail inexistente: mesma garantia
  const resInexistente = await request(baseUrl, null, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'nunca-existiu@example.com' },
  });
  assert.equal(resInexistente.status, 200);
  const bodyStr2 = JSON.stringify(resInexistente.body);
  assert.ok(!bodyStr2.includes('token'), 'resposta para e-mail INEXISTENTE não pode conter "token"');
  assert.ok(!bodyStr2.includes('reset-password'), 'resposta para e-mail INEXISTENTE não pode conter link de reset');
  // Resposta idêntica para existente e inexistente (evita enumeração de usuários)
  assert.equal(resExistente.body.message, resInexistente.body.message, 'mensagem deve ser idêntica para e-mail existente e inexistente');
});

test('relatórios: filtro até uma data inclui vendas do dia inteiro', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Relatório Dia', unit: 'UN', costPrice: 1, salePrice: 10, initialStock: 5 },
  });
  assert.equal(product.status, 201);

  const sale = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 1 }] },
  });
  assert.equal(sale.status, 201);

  const today = new Date().toISOString().slice(0, 10);
  const summary = await request(baseUrl, adminJar, `/api/reports/sales-summary?to=${today}`);
  assert.equal(summary.status, 200);
  assert.ok(summary.body.count >= 1, 'to=AAAA-MM-DD precisa incluir vendas feitas em qualquer horário desse dia');
  assert.ok(summary.body.total >= 10);

  const topProducts = await request(baseUrl, adminJar, `/api/reports/top-products?to=${today}`);
  assert.equal(topProducts.status, 200);
  assert.ok(topProducts.body.some((p) => p.name === 'Produto Relatório Dia'));
});

test('relatórios: slow-moving identifica produto parado com capital calculado', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Sem Venda 60d', unit: 'UN', costPrice: 15, salePrice: 30, initialStock: 10 },
  });
  assert.equal(product.status, 201);

  const res = await request(baseUrl, adminJar, '/api/reports/slow-moving?days=30');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  const found = res.body.find((p) => p.name === 'Produto Sem Venda 60d');
  assert.ok(found, 'produto sem nenhuma venda deve aparecer no relatório de itens parados');
  assert.equal(found.currentStock, 10);
  assert.equal(found.capitalParado, 150, 'capital parado deve ser currentStock (10) * costPrice (15) = 150');
});

test('recuperação de senha: token é de uso único', async () => {
  const crypto = require('crypto');
  const passwordHash = await bcrypt.hash('SenhaReset123!', 12);
  const user = await prisma.user.create({
    data: { name: 'Reset Teste', email: 'reset.teste@example.com', username: 'reset1002', passwordHash, role: 'CASHIER' },
  });

  // Solicita o reset via HTTP (sem resetUrl na resposta — o token é obtido pelo Prisma)
  const forgot = await request(baseUrl, null, '/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'reset.teste@example.com' },
  });
  assert.equal(forgot.status, 200);
  // A resposta HTTP nunca pode conter o token ou link — verificação de segurança
  assert.equal('resetUrl' in forgot.body, false, 'a resposta HTTP nunca pode expor resetUrl');

  // Obtém o token direto do banco (como faria um teste de integração real —
  // o hash está salvo, mas o rawToken não; precisamos gerar e salvar na rota,
  // então buscamos o registro e recriamos o token via rawToken gravado como hash).
  // Como a rota grava apenas o tokenHash (SHA-256 do rawToken), e não o rawToken,
  // precisamos criar um token de reset diretamente pelo Prisma para o teste.
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  // Invalida tokens anteriores e cria um novo direto pelo banco (simula o que a rota faz)
  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const first = await request(baseUrl, null, '/api/auth/reset-password', {
    method: 'POST',
    body: { token: rawToken, password: 'NovaSenhaReset123!' },
  });
  assert.equal(first.status, 200);

  const second = await request(baseUrl, null, '/api/auth/reset-password', {
    method: 'POST',
    body: { token: rawToken, password: 'OutraSenhaReset123!' },
  });
  assert.equal(second.status, 400, 'token de reset reutilizado precisa ser recusado');
});

// ---------- Estoque ----------

test('estoque: cancelamento de venda devolve o estoque e grava movimentação ADJUSTMENT', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Cancelamento', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 10 },
  });
  assert.equal(product.status, 201);

  const sale = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 4 }] },
  });
  assert.equal(sale.status, 201);

  // Estoque deve ter caído de 10 para 6
  const afterSale = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(afterSale.body.currentStock, 6);

  const cancel = await request(baseUrl, adminJar, `/api/sales/${sale.body.id}/cancel`, { method: 'POST' });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.canceled, true);

  // Após cancelamento o estoque deve voltar a 10
  const afterCancel = await request(baseUrl, adminJar, `/api/products/${product.body.id}`);
  assert.equal(afterCancel.body.currentStock, 10, 'cancelamento precisa devolver o estoque vendido');

  // Deve haver uma movimentação ADJUSTMENT registrada para o cancelamento
  const movements = await request(baseUrl, adminJar, `/api/stock/movements?productId=${product.body.id}`);
  const adjustment = movements.body.find((m) => m.type === 'ADJUSTMENT' && m.reason && m.reason.includes(sale.body.id));
  assert.ok(adjustment, 'cancelamento precisa gravar movimentação ADJUSTMENT no extrato');
  assert.equal(adjustment.newStock, 10, 'newStock da movimentação de cancelamento deve ser 10');
  assert.equal(adjustment.previousStock, 6, 'previousStock deve refletir o saldo após a venda');
  assert.equal(Number(adjustment.quantity), 4, 'quantidade da movimentação deve ser 4 (o que foi vendido)');
});

test('estoque: cancelamento duplo retorna 409', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Cancel Duplo', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 5 },
  });
  const sale = await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: product.body.id, quantity: 1 }] },
  });
  assert.equal(sale.status, 201);

  await request(baseUrl, adminJar, `/api/sales/${sale.body.id}/cancel`, { method: 'POST' });
  const second = await request(baseUrl, adminJar, `/api/sales/${sale.body.id}/cancel`, { method: 'POST' });
  assert.equal(second.status, 409, 'cancelar a mesma venda duas vezes deve retornar 409');
});

test('estoque: ajuste/perda grava previousStock e newStock corretos', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Ajuste Estoque', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 20 },
  });
  assert.equal(product.status, 201);

  // Ajuste negativo (perda de 5 unidades)
  const adj = await request(baseUrl, adminJar, '/api/stock/adjustments', {
    method: 'POST',
    body: { productId: product.body.id, quantity: -5, reason: 'Perda por avaria', type: 'LOSS' },
  });
  assert.equal(adj.status, 201);
  assert.equal(adj.body.currentStock, 15, 'após perda de 5 о estoque deve ser 15');

  // Verifica que a movimentação registrou os valores corretos
  const movements = await request(baseUrl, adminJar, `/api/stock/movements?productId=${product.body.id}&type=LOSS`);
  const loss = movements.body[0];
  assert.ok(loss, 'deve existir uma movimentação do tipo LOSS');
  assert.equal(Number(loss.previousStock), 20, 'previousStock deve ser 20 (antes do ajuste)');
  assert.equal(Number(loss.newStock), 15, 'newStock deve ser 15 (após o ajuste)');
  assert.equal(Number(loss.quantity), -5, 'quantity deve ser -5 (negativo para perda)');
});

test('estoque: histórico filtra por productId e por type', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Historico Filtro', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 10 },
  });
  assert.equal(product.status, 201);
  const pid = product.body.id;

  // Gera uma entrada e uma venda para ter movimentações de tipos diferentes
  await request(baseUrl, adminJar, '/api/stock/entries', {
    method: 'POST',
    body: { productId: pid, quantity: 5, reason: 'Compra extra' },
  });
  await request(baseUrl, adminJar, '/api/sales', {
    method: 'POST',
    body: { items: [{ productId: pid, quantity: 2 }] },
  });

  // Filtro por productId — deve retornar apenas movimentações deste produto
  const byProduct = await request(baseUrl, adminJar, `/api/stock/movements?productId=${pid}`);
  assert.equal(byProduct.status, 200);
  assert.ok(Array.isArray(byProduct.body), 'deve retornar array');
  assert.ok(byProduct.body.length >= 2, 'deve ter ao menos ENTRY (inicial) + ENTRY (compra extra) + SALE');
  for (const m of byProduct.body) {
    assert.equal(m.product, 'Produto Historico Filtro', 'todas as movimentações devem ser deste produto');
  }

  // Filtro por type=ENTRY — deve retornar apenas entradas
  const byType = await request(baseUrl, adminJar, `/api/stock/movements?productId=${pid}&type=ENTRY`);
  assert.equal(byType.status, 200);
  assert.ok(byType.body.length >= 1);
  for (const m of byType.body) {
    assert.equal(m.type, 'ENTRY', 'filtro por type=ENTRY deve retornar só movimentações do tipo ENTRY');
  }

  // Filtro por type=SALE — deve retornar apenas vendas
  const bySale = await request(baseUrl, adminJar, `/api/stock/movements?productId=${pid}&type=SALE`);
  assert.equal(bySale.status, 200);
  assert.ok(bySale.body.length >= 1);
  for (const m of bySale.body) {
    assert.equal(m.type, 'SALE', 'filtro por type=SALE deve retornar só movimentações do tipo SALE');
  }
});

test('estoque: CASHIER é bloqueado nas rotas administrativas de estoque', async () => {
  const cashier = await prisma.user.findUnique({ where: { email: 'caixa.auth@example.com' } });
  const { signToken } = require('../src/auth');
  const token = signToken(cashier);
  const cashierJar = {
    apply() {},
    header() { return `mj_token=${token}`; },
  };

  // Produto qualquer para usar nos testes (o id não importa, pois deve ser barrado antes)
  const anyProductId = '00000000-0000-0000-0000-000000000001';

  const entry = await request(baseUrl, cashierJar, '/api/stock/entries', {
    method: 'POST',
    body: { productId: anyProductId, quantity: 1 },
  });
  assert.equal(entry.status, 403, 'CASHIER não pode registrar entrada de estoque');

  const adjustment = await request(baseUrl, cashierJar, '/api/stock/adjustments', {
    method: 'POST',
    body: { productId: anyProductId, quantity: -1, reason: 'Teste', type: 'LOSS' },
  });
  assert.equal(adjustment.status, 403, 'CASHIER não pode registrar ajuste/perda');

  const movements = await request(baseUrl, cashierJar, '/api/stock/movements');
  assert.equal(movements.status, 403, 'CASHIER não pode ver histórico de movimentações');
});

test('estoque: produtos abaixo de minStock aparecem na previsão de estoque (alerta)', async () => {
  // Cria produto com estoque abaixo do mínimo
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Abaixo Min', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 2, minStock: 10 },
  });
  assert.equal(product.status, 201);

  const forecast = await request(baseUrl, adminJar, '/api/reports/forecast');
  assert.equal(forecast.status, 200);
  assert.ok(Array.isArray(forecast.body), 'forecast deve retornar array');

  // O produto com estoque (2) abaixo do mínimo (10) deve aparecer na lista
  const found = forecast.body.some((p) => p.name === 'Produto Abaixo Min');
  assert.ok(found, 'produto com currentStock < minStock deve aparecer no alerta de estoque mínimo');
});

// ---------- Importação de planilha ----------

const IMPORT_HEADERS = ['Nome', 'Código de Barras', 'Categoria', 'Unidade', 'Preço de Custo', 'Preço de Venda', 'Estoque', 'Estoque Mínimo', 'Validade'];
const IMPORT_MAPPING = { name: 0, barcode: 1, category: 2, unit: 3, costPrice: 4, salePrice: 5, stock: 6, minStock: 7, expiryDate: 8 };

function importBody(rows, options = {}) {
  return {
    headers: IMPORT_HEADERS,
    rows,
    mapping: IMPORT_MAPPING,
    options: { mode: 'upsert', matchBy: 'barcode', stockMode: 'ignore', ...options },
  };
}

test('importação: caixa é bloqueado em todas as rotas de importação', async () => {
  const cashierJar = makeCookieJar();
  await request(baseUrl, cashierJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'caixa.auth@example.com', password: 'SenhaCaixa123!' },
  });

  const template = await request(baseUrl, cashierJar, '/api/imports/products/template');
  assert.equal(template.status, 403);

  const parse = await request(baseUrl, cashierJar, '/api/imports/products/parse', { method: 'POST', body: { text: 'Nome\nX' } });
  assert.equal(parse.status, 403);

  const commit = await request(baseUrl, cashierJar, '/api/imports/products/commit', { method: 'POST', body: importBody([]) });
  assert.equal(commit.status, 403, 'gravar produtos em massa nunca pode ficar disponível para o caixa');
});

test('importação: números em formato brasileiro e datas dd/mm/aaaa são gravados corretamente', async () => {
  const commit = await request(baseUrl, adminJar, '/api/imports/products/commit', {
    method: 'POST',
    body: importBody([['Produto Importado BR', '7890000000101', 'Mercearia', 'cx', 'R$ 1.234,56', '2.499,90', '12,5', '3', '31/12/2027']]),
  });
  assert.equal(commit.status, 200);
  assert.equal(commit.body.created, 1);

  const list = await request(baseUrl, adminJar, '/api/products?query=Produto Importado BR');
  const product = list.body[0];
  assert.equal(product.costPrice, 1234.56, '"R$ 1.234,56" precisa virar 1234.56, não 1.23456');
  assert.equal(product.salePrice, 2499.9);
  assert.equal(product.currentStock, 12.5);
  assert.equal(product.unit, 'CX');
  assert.equal(product.expiryDate.slice(0, 10), '2027-12-31');
});

test('importação: acerto de saldo registra movimentação com o estoque anterior e o novo', async () => {
  const created = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Import Saldo', barcode: '7890000000102', unit: 'UN', costPrice: 1, salePrice: 5, initialStock: 10 },
  });
  assert.equal(created.status, 201);

  const commit = await request(baseUrl, adminJar, '/api/imports/products/commit', {
    method: 'POST',
    body: importBody([['Produto Import Saldo', '7890000000102', 'Mercearia', 'UN', '1,00', '5,00', '25', '0', '']], { stockMode: 'set' }),
  });
  assert.equal(commit.body.updated, 1);

  const after = await request(baseUrl, adminJar, `/api/products/${created.body.id}`);
  assert.equal(after.body.currentStock, 25);

  const movements = await request(baseUrl, adminJar, `/api/stock/movements?productId=${created.body.id}`);
  const adjustment = movements.body.find((m) => m.type === 'ADJUSTMENT');
  assert.ok(adjustment, 'o acerto de saldo por importação precisa deixar rastro no extrato de movimentações');
  assert.equal(adjustment.quantity, 15);
  assert.equal(adjustment.previousStock, 10);
  assert.equal(adjustment.newStock, 25, 'saldo anterior e novo precisam bater com o estoque real — é o que torna o extrato auditável');
});

test('importação: código de barras repetido no arquivo não cadastra o produto duas vezes', async () => {
  const rows = [
    ['Produto Import Duplicado', '7890000000103', 'Mercearia', 'UN', '2,00', '4,00', '10', '1', ''],
    ['Produto Import Duplicado', '7890000000103', 'Mercearia', 'UN', '2,00', '4,00', '10', '1', ''],
  ];

  const preview = await request(baseUrl, adminJar, '/api/imports/products/preview', { method: 'POST', body: importBody(rows) });
  assert.equal(preview.body.summary.create, 1);
  assert.equal(preview.body.summary.error, 1, 'a segunda linha com o mesmo código de barras precisa ser barrada na conferência');

  const commit = await request(baseUrl, adminJar, '/api/imports/products/commit', { method: 'POST', body: importBody(rows) });
  assert.equal(commit.body.created, 1);

  const list = await request(baseUrl, adminJar, '/api/products?query=Produto Import Duplicado&includeInactive=true');
  assert.equal(list.body.length, 1, 'a planilha com a linha repetida nunca pode gerar dois cadastros do mesmo produto');
});

test('importação: código de barras que pertence a outro produto é recusado, nunca sobrescrito', async () => {
  await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'Produto Import Dono do Código', barcode: '7890000000104', unit: 'UN', costPrice: 1, salePrice: 2 },
  });

  // Mesmo código de barras, outro nome: casar por nome criaria um produto novo
  // com um código já usado (violação de unicidade) ou roubaria o código do dono.
  const rows = [['Produto Import Invasor', '7890000000104', 'Mercearia', 'UN', '1,00', '3,00', '5', '1', '']];
  const preview = await request(baseUrl, adminJar, '/api/imports/products/preview', {
    method: 'POST',
    body: importBody(rows, { matchBy: 'name' }),
  });
  assert.equal(preview.body.summary.error, 1);

  const commit = await request(baseUrl, adminJar, '/api/imports/products/commit', {
    method: 'POST',
    body: importBody(rows, { matchBy: 'name' }),
  });
  assert.equal(commit.body.created, 0);
  assert.equal(commit.body.updated, 0);

  const owner = await request(baseUrl, adminJar, '/api/products?query=Produto Import Dono do Código');
  assert.equal(owner.body[0].barcode, '7890000000104', 'o dono do código de barras não pode perdê-lo para outra linha da planilha');
});

test('importação: aceita corpo grande, mas as demais rotas continuam limitadas a 100kb', async () => {
  // A grade da planilha volta ao servidor a cada conferência, então só a
  // importação tem limite ampliado. Se um dia o parser JSON global voltar a
  // valer para /api/imports, este teste falha antes de o usuário descobrir
  // sozinho que planilhas médias param de abrir.
  const padding = 'Produto Volume '.padEnd(90, 'x');
  const rows = Array.from({ length: 800 }, (_, i) => [`${padding}${i}`, '', 'Mercearia', 'UN', '1,00', '2,00', '1', '0', '']);
  const body = importBody(rows, { mode: 'updateOnly' });
  assert.ok(JSON.stringify(body).length > 100 * 1024, 'o payload de teste precisa passar de 100kb para o teste fazer sentido');

  const preview = await request(baseUrl, adminJar, '/api/imports/products/preview', { method: 'POST', body });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.summary.skip, 800);

  const oversized = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST',
    body: { name: 'x'.repeat(120 * 1024), unit: 'UN', costPrice: 1, salePrice: 2 },
  });
  assert.equal(oversized.status, 413, 'as rotas normais precisam continuar recusando corpos gigantes');
});

test('importação: planilha .xlsx é lida e as colunas são reconhecidas pelo cabeçalho', async () => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lista');
  // Cabeçalhos com nomes diferentes dos do modelo: é o reconhecimento por
  // sinônimo que faz a planilha do fornecedor funcionar sem edição manual.
  sheet.addRow(['DESCRICAO', 'EAN', 'VLR VENDA', 'QTDE', 'VENCIMENTO']);
  sheet.addRow(['Produto Import Xlsx', 7890000000105, 9.9, 7, new Date(Date.UTC(2027, 4, 20))]);
  const buffer = await workbook.xlsx.writeBuffer();

  const form = new FormData();
  form.append('file', new Blob([buffer]), 'fornecedor.xlsx');
  const res = await fetch(`${baseUrl}/api/imports/products/parse`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'fetch', Cookie: adminJar.header() },
    body: form,
  });
  assert.equal(res.status, 200);

  const parsed = await res.json();
  assert.deepEqual(parsed.mapping, { name: 0, barcode: 1, salePrice: 2, stock: 3, expiryDate: 4 });

  const commit = await request(baseUrl, adminJar, '/api/imports/products/commit', {
    method: 'POST',
    body: { headers: parsed.headers, rows: parsed.rows, mapping: parsed.mapping, options: { mode: 'upsert', matchBy: 'barcode', stockMode: 'ignore' } },
  });
  assert.equal(commit.body.created, 1);

  const list = await request(baseUrl, adminJar, '/api/products?query=Produto Import Xlsx');
  assert.equal(list.body[0].salePrice, 9.9);
  assert.equal(list.body[0].currentStock, 7);
  assert.equal(list.body[0].expiryDate.slice(0, 10), '2027-05-20', 'a data do Excel (número de série) precisa virar a mesma data no banco');
});

// ---------- Exportação de Relatórios e Movimentações ----------

test('exportação: administrador consegue exportar relatórios e movimentações em CSV e XLSX', async () => {
  const endpoints = [
    '/api/reports/forecast/export?format=csv',
    '/api/reports/forecast/export?format=xlsx',
    '/api/reports/sales-summary/export?format=csv',
    '/api/reports/sales-summary/export?format=xlsx',
    '/api/reports/top-products/export?format=csv',
    '/api/reports/top-products/export?format=xlsx',
    '/api/reports/slow-moving/export?format=csv',
    '/api/reports/slow-moving/export?format=xlsx',
    '/api/stock/movements/export?format=csv',
    '/api/stock/movements/export?format=xlsx',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(res.status, 200, `endpoint ${ep} deveria retornar 200`);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType, `endpoint ${ep} deve ter content-type`);
    const disposition = res.headers.get('content-disposition');
    assert.match(disposition, /attachment; filename="/, `endpoint ${ep} deve ter content-disposition de anexo`);
  }
});

test('exportação: caixa é bloqueado (403) em todas as rotas de exportação', async () => {
  const created = await request(baseUrl, adminJar, '/api/users', {
    method: 'POST',
    body: { name: 'Caixa Exportação', email: 'caixa.export@example.com', password: 'SenhaCaixa123!', role: 'CASHIER' },
  });
  assert.equal(created.status, 201);

  const cashierJar = makeCookieJar();
  const loginRes = await request(baseUrl, cashierJar, '/api/auth/login', {
    method: 'POST',
    body: { email: 'caixa.export@example.com', password: 'SenhaCaixa123!' },
  });
  assert.equal(loginRes.status, 200, `login do caixa falhou: ${JSON.stringify(loginRes.body)}`);

  const endpoints = [
    '/api/reports/forecast/export',
    '/api/reports/sales-summary/export',
    '/api/reports/top-products/export',
    '/api/reports/slow-moving/export',
    '/api/stock/movements/export',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${baseUrl}${ep}`, {
      headers: { Cookie: cashierJar.header() },
    });
    assert.equal(res.status, 403, `caixa deveria ser bloqueado em ${ep}`);
  }
});


// ---------- Perfis e permissões por pessoa ----------

// Cria um funcionário com as permissões dadas e devolve o "navegador" já logado.
async function loginWithPermissions(email, permissions) {
  const passwordHash = await bcrypt.hash('SenhaPerfil123!', 4);
  await prisma.user.create({
    data: { name: email.split('@')[0], email, username: email.split('@')[0].replace(/\W/g, ''), passwordHash, role: 'CASHIER', permissions },
  });
  const jar = makeCookieJar();
  const res = await request(baseUrl, jar, '/api/auth/login', { method: 'POST', body: { email, password: 'SenhaPerfil123!' } });
  assert.equal(res.status, 200, `login de ${email} falhou: ${JSON.stringify(res.body)}`);
  return jar;
}

test('perfis: estoque cadastra produto sem preço, financeiro recebe o aviso e libera para venda', async () => {
  const estoque = await loginWithPermissions('estoque.perfil@example.com', ['products.manage', 'stock.manage']);
  const financeiro = await loginWithPermissions('financeiro.perfil@example.com', ['sales.viewAll', 'sales.cancel', 'reports.view', 'prices.manage']);
  const caixa = await loginWithPermissions('caixa.perfil@example.com', []);

  // Estoque não pode mandar preço.
  const withPrice = await request(baseUrl, estoque, '/api/products', {
    method: 'POST', body: { name: 'Produto Com Preço do Estoque', unit: 'UN', salePrice: 5, initialStock: 3 },
  });
  assert.equal(withPrice.status, 403);

  const created = await request(baseUrl, estoque, '/api/products', {
    method: 'POST', body: { name: 'Produto Aguardando Preço', unit: 'UN', initialStock: 10 },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.pricePending, true);
  assert.equal(created.body.salePrice, null);
  assert.equal('costPrice' in created.body, false, 'estoque não vê custo');

  // Ninguém vende produto sem preço.
  const sale = await request(baseUrl, caixa, '/api/sales', {
    method: 'POST', body: { items: [{ productId: created.body.id, quantity: 1 }] },
  });
  assert.equal(sale.status, 409);
  assert.match(sale.body.error, /aguardando preço/);

  // Aviso no painel: só para quem define preço.
  const finDash = await request(baseUrl, financeiro, '/api/dashboard');
  assert.ok(finDash.body.pricePending.some((p) => p.id === created.body.id));
  assert.equal((await request(baseUrl, estoque, '/api/dashboard')).body.pricePending, undefined);
  assert.equal((await request(baseUrl, caixa, '/api/dashboard')).body.pricePending, undefined);

  const priced = await request(baseUrl, financeiro, `/api/products/${created.body.id}`, {
    method: 'PUT', body: { salePrice: 6.5, costPrice: 4 },
  });
  assert.equal(priced.status, 200);
  assert.equal(priced.body.pricePending, false);
  assert.equal(priced.body.margin, 2.5);

  const saleAfter = await request(baseUrl, caixa, '/api/sales', {
    method: 'POST', body: { items: [{ productId: created.body.id, quantity: 1 }] },
  });
  assert.equal(saleAfter.status, 201);
  assert.equal(saleAfter.body.totalAmount, 6.5);
});

test('perfis: cada permissão abre só a sua parte da API e vale na hora em que o dono muda', async () => {
  const estoque = await loginWithPermissions('estoque.rotas@example.com', ['stock.manage']);
  const financeiro = await loginWithPermissions('financeiro.rotas@example.com', ['reports.view']);

  assert.equal((await request(baseUrl, estoque, '/api/stock/movements')).status, 200);
  assert.equal((await request(baseUrl, estoque, '/api/reports/sales-summary')).status, 403);
  assert.equal((await request(baseUrl, estoque, '/api/imports/products/template')).status, 403);
  assert.equal((await request(baseUrl, estoque, '/api/users')).status, 403);

  assert.equal((await request(baseUrl, financeiro, '/api/reports/sales-summary')).status, 200);
  assert.equal((await request(baseUrl, financeiro, '/api/stock/movements')).status, 403);
  assert.equal((await request(baseUrl, financeiro, '/api/users')).status, 403);

  // O dono tira a permissão: a mesma sessão perde o acesso sem precisar sair.
  const user = await prisma.user.findUnique({ where: { email: 'estoque.rotas@example.com' } });
  const update = await request(baseUrl, adminJar, `/api/users/${user.id}`, { method: 'PUT', body: { permissions: [] } });
  assert.equal(update.status, 200);
  assert.deepEqual(update.body.permissions, []);
  assert.equal((await request(baseUrl, estoque, '/api/stock/movements')).status, 403);

  const invalid = await request(baseUrl, adminJar, `/api/users/${user.id}`, { method: 'PUT', body: { permissions: ['virar.dono'] } });
  assert.equal(invalid.status, 400);
});

test('perfis: caixa cancela a própria venda só nos primeiros 10 minutos; financeiro cancela qualquer uma', async () => {
  const caixa = await loginWithPermissions('caixa.cancela@example.com', []);
  const outroCaixa = await loginWithPermissions('caixa.outro@example.com', []);
  const financeiro = await loginWithPermissions('financeiro.cancela@example.com', ['sales.viewAll', 'sales.cancel']);

  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST', body: { name: 'Produto Cancelamento Perfil', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 20 },
  });
  const sell = async (jar) => (await request(baseUrl, jar, '/api/sales', {
    method: 'POST', body: { items: [{ productId: product.body.id, quantity: 1 }] },
  })).body.id;

  const recent = await sell(caixa);
  const list = await request(baseUrl, caixa, '/api/sales');
  assert.equal(list.body.sales.find((s) => s.id === recent).canCancel, true);
  assert.equal((await request(baseUrl, outroCaixa, `/api/sales/${recent}/cancel`, { method: 'POST' })).status, 403, 'outro caixa não cancela');
  assert.equal((await request(baseUrl, caixa, `/api/sales/${recent}/cancel`, { method: 'POST' })).status, 200);

  const old = await sell(caixa);
  await prisma.sale.update({ where: { id: old }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
  const late = await request(baseUrl, caixa, `/api/sales/${old}/cancel`, { method: 'POST' });
  assert.equal(late.status, 403);
  assert.match(late.body.error, /10 minutos/);

  // Financeiro vê a venda de outra pessoa e cancela mesmo depois do prazo.
  const finList = await request(baseUrl, financeiro, '/api/sales?pageSize=100');
  assert.ok(finList.body.sales.some((s) => s.id === old));
  assert.equal((await request(baseUrl, financeiro, `/api/sales/${old}/cancel`, { method: 'POST' })).status, 200);
});

// ---------- Relatório por e-mail ----------

test('relatório por e-mail: sem SMTP avisa, e-mail inválido dá 400 e quem não vê relatórios recebe 403', async () => {
  const semRelatorio = await loginWithPermissions('estoque.email@example.com', ['stock.manage']);
  assert.equal((await request(baseUrl, semRelatorio, '/api/reports/email', { method: 'POST', body: { email: 'a@b.com' } })).status, 403);

  const invalido = await request(baseUrl, adminJar, '/api/reports/email', { method: 'POST', body: { email: 'nao-e-email' } });
  assert.equal(invalido.status, 400);

  const semSmtp = await request(baseUrl, adminJar, '/api/reports/email', { method: 'POST', body: { email: 'dono@example.com' } });
  assert.equal(semSmtp.status, 503);
  assert.match(semSmtp.body.error, /SMTP_HOST/);
});

test('relatório por e-mail: manda resumo no corpo e um Excel com uma aba por relatório', async () => {
  const mailer = require('../src/jobs/dailyAlerts');
  const original = mailer.buildTransport;
  let sent = null;
  mailer.buildTransport = () => ({ sendMail: async (mail) => { sent = mail; } });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(baseUrl, adminJar, '/api/reports/email', {
      method: 'POST', body: { email: 'financeiro@example.com', from: '2020-01-01', to: today },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(sent.to, 'financeiro@example.com');
    assert.match(sent.subject, /Relatório de vendas — 01\/01\/2020 a /);
    assert.match(sent.text, /Total vendido: R\$/);
    assert.match(sent.text, /Mais vendidos:/);

    const ExcelJS = require('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(sent.attachments[0].content);
    assert.deepEqual(book.worksheets.map((w) => w.name), ['Resumo', 'Vendas por dia', 'Mais vendidos', 'Produtos parados', 'Previsão de estoque']);
    assert.equal(book.getWorksheet('Resumo').getCell('A2').value, 'Período');
  } finally {
    mailer.buildTransport = original;
  }
});

test('exportação: histórico do estoque sai com o tipo em português', async () => {
  const product = await request(baseUrl, adminJar, '/api/products', {
    method: 'POST', body: { name: 'Produto Exporta Tipo', unit: 'UN', costPrice: 1, salePrice: 2, initialStock: 5 },
  });
  assert.equal(product.status, 201);
  const res = await fetch(`${baseUrl}/api/stock/movements/export?format=csv&type=ENTRY`, { headers: { Cookie: adminJar.header() } });
  const csv = await res.text();
  assert.match(csv, /Produto Exporta Tipo;Entrada;/);
  assert.doesNotMatch(csv, /;ENTRY;/);
});
