// CommonJS consumer check: `require()` must work for backends that have not moved to ESM.
const assert = require('node:assert/strict');
const { createServer } = require('node:http');

const { Affic, AfficAuthenticationError } = require('@affic/sdk');

const server = createServer((request, response) => {
  if (request.headers['x-api-key'] === 'good-key') {
    response.writeHead(204).end();
    return;
  }

  response.writeHead(401, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      statusCode: 401,
      message: ['INTEGRATION_NOT_FOUND'],
      error: 'Unauthorized',
    }),
  );
});

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseURL = `http://127.0.0.1:${server.address().port}`;

  try {
    const ok = new Affic({ apiKey: 'good-key', baseURL });
    assert.equal(await ok.activity.create({ name: 'signup' }), undefined);

    const bad = new Affic({ apiKey: 'bad-key', baseURL });
    await assert.rejects(
      () => bad.activity.create({ name: 'signup' }),
      (error) => error instanceof AfficAuthenticationError,
    );
  } finally {
    server.close();
  }

  console.log('CJS consumer OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
