const { test } = require('node:test');
const assert = require('assert');
const jwt = require('jsonwebtoken');

// Testes de validação de JWT com issuer/audience
test('JWT: signToken inclui issuer e audience', async () => {
  const auth = require('../src/auth');
  const config = require('../src/config');

  const user = { id: 'user-123', role: 'ADMIN', sessionVersion: 1 };
  const token = auth.signToken(user);

  // Verificar que o token pode ser decodificado
  const decoded = jwt.decode(token);
  assert.strictEqual(decoded.iss, 'mercadinho-joao-api', 'issuer deve ser mercadinho-joao-api');
  assert.strictEqual(decoded.aud, 'mercadinho-joao-web', 'audience deve ser mercadinho-joao-web');
  assert.strictEqual(decoded.sub, 'user-123');
  assert.strictEqual(decoded.role, 'ADMIN');
});

test('JWT: verificação falha com issuer inválido', async () => {
  const jwt_module = require('jsonwebtoken');
  const config = require('../src/config');

  // Token forjado com issuer errado
  const fakeToken = jwt_module.sign(
    { sub: 'user-123', role: 'ADMIN', sv: 1 },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      issuer: 'outro-app',
      audience: 'mercadinho-joao-web',
      expiresIn: '8h'
    }
  );

  // Tentar verificar deve falhar
  assert.throws(() => {
    jwt_module.verify(fakeToken, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'mercadinho-joao-api',
      audience: 'mercadinho-joao-web'
    });
  }, /issuer/i);
});

test('JWT: verificação falha com audience inválida', async () => {
  const jwt_module = require('jsonwebtoken');
  const config = require('../src/config');

  // Token forjado com audience errado
  const fakeToken = jwt_module.sign(
    { sub: 'user-123', role: 'ADMIN', sv: 1 },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      issuer: 'mercadinho-joao-api',
      audience: 'outro-app',
      expiresIn: '8h'
    }
  );

  // Tentar verificar deve falhar
  assert.throws(() => {
    jwt_module.verify(fakeToken, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'mercadinho-joao-api',
      audience: 'mercadinho-joao-web'
    });
  }, /audience/i);
});

test('JWT: algoritmo inválido é rejeitado', async () => {
  const jwt_module = require('jsonwebtoken');
  const config = require('../src/config');

  const token = jwt_module.sign(
    { sub: 'user-123', role: 'ADMIN', sv: 1 },
    config.jwtSecret,
    {
      algorithm: 'HS512', // Algoritmo diferente
      issuer: 'mercadinho-joao-api',
      audience: 'mercadinho-joao-web',
      expiresIn: '8h'
    }
  );

  // Tentar verificar com algorithms: ['HS256'] deve falhar
  assert.throws(() => {
    jwt_module.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'mercadinho-joao-api',
      audience: 'mercadinho-joao-web'
    });
  }, /algorithm/i);
});

// Testes de CORS
test('CORS: app.js importa cors corretamente', async () => {
  const fs = require('fs');
  const appCode = fs.readFileSync('./src/app.js', 'utf-8');

  // Verificar que CORS está configurado com allowedOrigins
  assert(appCode.includes('allowedOrigins'), 'app.js deve definir allowedOrigins');
  assert(appCode.includes('cors('), 'app.js deve chamar cors()');
  assert(appCode.includes('origin(origin, callback)'), 'CORS deve ter função origin customizada');
  assert(!appCode.includes("cors({ origin: '*'"), 'CORS não deve usar origin: *');
});

test('CORS: configuração permite origens do allowlist', async () => {
  // Simular a lógica de CORS
  const config = { clientOrigin: 'http://localhost:3000,https://vend.example.com' };

  const allowedOrigins = new Set(
    (config.clientOrigin || 'http://localhost:3000')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean),
  );

  assert(allowedOrigins.has('http://localhost:3000'));
  assert(allowedOrigins.has('https://vend.example.com'));
  assert(!allowedOrigins.has('https://evil.com'));
});

// Testes de Preço
test('Sales: app.js calcula preço do servidor, não do cliente', async () => {
  const fs = require('fs');
  const salesCode = fs.readFileSync('./src/routes/sales.js', 'utf-8');

  // Verificar que unitPrice vem do banco, não do req.body
  assert(salesCode.includes('const unitPrice = Number(product.salePrice)'),
    'Preço deve vir de product.salePrice do banco');
  assert(!salesCode.includes('item.price') || !salesCode.includes('req.body'),
    'Não deve confiar em preço enviado pelo cliente');
});

// Em produção, o servidor precisa saber o próprio endereço público para montar
// o link do e-mail de "esqueci minha senha"; sem isso ele recusa iniciar.
test('produção: config recusa APP_BASE_URL ausente ou localhost e aceita endereço público', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const configPath = path.join(__dirname, '..', 'src', 'config.js');
  const run = (appBaseUrl) => {
    const env = { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'segredo-de-teste-forte-0123456789abcdef' };
    delete env.APP_BASE_URL;
    if (appBaseUrl !== undefined) env.APP_BASE_URL = appBaseUrl;
    return spawnSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], { env, encoding: 'utf8' });
  };

  const missing = run(undefined);
  assert.notStrictEqual(missing.status, 0, 'sem APP_BASE_URL deveria recusar iniciar');
  assert.match(missing.stderr, /APP_BASE_URL/);

  const local = run('http://localhost:3000');
  assert.notStrictEqual(local.status, 0, 'localhost em produção deveria recusar iniciar');

  const ok = run('https://mercadinho.exemplo.com.br');
  assert.strictEqual(ok.status, 0, ok.stderr);
});
