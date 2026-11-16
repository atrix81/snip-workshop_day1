'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const links = [];
const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/links') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const input = JSON.parse(body);
      const link = {
        code: 'ABC123',
        url: input.url,
        shortUrl: 'http://localhost:3000/ABC123',
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.push(link);
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify(link));
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/links') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(links));
    return;
  }

  if (request.method === 'GET' && request.url === '/ABC123') {
    response.writeHead(302, { location: links[0].url });
    response.end();
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'Unknown link' }));
});

function run(args, api, preload = false) {
  const nodeArgs = preload ? ['-r', path.join(__dirname, 'mock-launcher.cjs'), 'cli.js', ...args]
    : ['cli.js', ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      cwd: __dirname,
      env: { ...process.env, SNIP_API: api },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', status => resolve({ status, stdout, stderr }));
  });
}

server.listen(0, '127.0.0.1', async () => {
  const api = `http://127.0.0.1:${server.address().port}`;
  const stallServer = http.createServer(() => {});
  stallServer.listen(0, '127.0.0.1', async () => {
    const stallApi = `http://127.0.0.1:${stallServer.address().port}`;
    const checks = [
      async () => {
      const result = await run(['help'], api);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /Usage:/);
      },
      async () => {
      const result = await run(['ls'], api);
      assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
      assert.equal(result.stdout.trim(), 'No links yet.');
      },
      async () => {
      const result = await run(['add', 'https://example.com/path'], api);
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), 'http://localhost:3000/ABC123');
      },
      async () => {
      const result = await run(['ls'], api);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /CODE\s+HITS\s+URL/);
      assert.match(result.stdout, /ABC123\s+0\s+https:\/\/example\.com\/path/);
      },
      async () => {
      const result = await run(['open', 'ABC123'], api, true);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /Opened https:\/\/example\.com\/path/);
      },
      async () => {
      const result = await run(['open', 'ZZZZZZ'], api);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Unknown link: ZZZZZZ/);
      },
      async () => {
      const result = await run(['add', 'file:///etc/passwd'], api);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /valid http\(s\) URL/);
      },
      async () => {
      const result = await run(['ls'], 'http://127.0.0.1:1');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Could not reach API/);
      },
      async () => {
        const result = await run(['ls'], stallApi);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /timed out after 10 seconds/);
      },
    ];

    try {
      for (const check of checks) await check();
      console.log(`Passed ${checks.length} CLI checks.`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      server.close();
      stallServer.close();
    }
  });
});
