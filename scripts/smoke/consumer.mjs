// ESM consumer check: installs from the packed tarball, talks to a local stub of the API, and
// asserts both the success path and a typed error.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { Affic, AfficAuthenticationError } from '@affic/sdk';

const server = createServer((request, response) => {
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/api/v1/integration-api/activity');

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

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;

try {
  const ok = new Affic({ apiKey: 'good-key', baseURL });
  const result = await ok.activity.create({ name: 'purchase', value: 149.9 });
  assert.equal(result, undefined, 'a 204 resolves to undefined');

  const bad = new Affic({ apiKey: 'bad-key', baseURL });
  await assert.rejects(
    () => bad.activity.create({ name: 'purchase', value: 149.9 }),
    (error) => {
      assert.ok(error instanceof AfficAuthenticationError, 'a 401 is a typed authentication error');
      assert.deepEqual(error.codes, ['INTEGRATION_NOT_FOUND']);
      return true;
    },
  );
} finally {
  server.close();
}

console.log('ESM consumer OK');
