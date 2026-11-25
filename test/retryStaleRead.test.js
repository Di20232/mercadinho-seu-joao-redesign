const { test } = require('node:test');
const assert = require('node:assert/strict');
const { retryStaleRead } = require('../src/retryStaleRead');

// Devolve uma função que falha `failures` vezes com o código dado e depois funciona.
function flaky(failures, code = 'P1017') {
  let calls = 0;
  const run = async () => {
    calls += 1;
    if (calls <= failures) throw Object.assign(new Error('Server has closed the connection.'), { code });
    return 'ok';
  };
  return { run, calls: () => calls };
}

test('conexão morta: leitura é repetida e acaba funcionando', async () => {
  const f = flaky(3);
  assert.equal(await retryStaleRead('findMany', f.run), 'ok');
  assert.equal(f.calls(), 4);
});

test('conexão morta: escrita nunca é repetida (evita gravar duas vezes)', async () => {
  const f = flaky(1);
  await assert.rejects(retryStaleRead('create', f.run), { code: 'P1017' });
  assert.equal(f.calls(), 1);
});

test('outros erros não são repetidos, e a leitura desiste depois de 5 tentativas', async () => {
  const other = flaky(1, 'P2002');
  await assert.rejects(retryStaleRead('findMany', other.run), { code: 'P2002' });
  assert.equal(other.calls(), 1);

  const dead = flaky(99);
  await assert.rejects(retryStaleRead('findUnique', dead.run), { code: 'P1017' });
  assert.equal(dead.calls(), 5);
});
