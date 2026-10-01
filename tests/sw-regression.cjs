'use strict';

// Real service-worker handler, fictional response bodies, no browser data access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const scope = 'https://vault-test.example/au-trip-photo/';

function worker(fetchImpl, initialShell = 'FICTIONAL cached shell') {
  const callbacks = new Map(), content = new Map(), timers = [], deletedCaches = [];
  if (initialShell !== null) content.set(new URL('./tickets.html', scope).href, new Response(initialShell));
  const urlOf = request => new URL(typeof request === 'string' ? request : request.url, scope).href;
  const sandbox = {
    URL, Response, Request,
    fetch: fetchImpl,
    clearTimeout,
    setTimeout(callback, milliseconds) { timers.push(milliseconds); return setTimeout(callback, Math.min(milliseconds, 10)); },
    caches: {
      async keys() { return ['au-trip-photo-v58', 'au-trip-photo-v59', 'au-trip-ticket-v1']; },
      async delete(name) { deletedCaches.push(name); return true; },
      async open() { return {
        async match(request) { return content.get(urlOf(request))?.clone(); },
        async put(request, response) { content.set(urlOf(request), response.clone()); }
      }; }
    },
    self: {
      location: { origin: new URL(scope).origin }, registration: { scope },
      clients: { async claim() {} },
      addEventListener(name, handler) { callbacks.set(name, handler); }
    }
  };
  vm.runInNewContext(source, sandbox, { filename: 'sw.js' });
  return {
    content, timers, deletedCaches,
    navigate({ pathname = 'tickets.html', cache = 'default', mode = 'navigate' } = {}) {
      let result;
      const background = [];
      callbacks.get('fetch')({
        request: { method: 'GET', url: new URL(pathname, scope).href, cache, mode },
        respondWith(value) { result = Promise.resolve(value); },
        waitUntil(value) { background.push(value); }
      });
      return { response: result, background };
    },
    async activate() { let finished; callbacks.get('activate')({ waitUntil(value) { finished = value; } }); await finished; }
  };
}

async function main() {
  const tests = [
    ['slow tickets navigation serves cached page within the 3-second budget', async () => {
      let resolveNetwork;
      const app = worker(() => new Promise(resolve => { resolveNetwork = resolve; }));
      const navigation = app.navigate();
      assert.equal(await (await navigation.response).text(), 'FICTIONAL cached shell');
      assert.ok(app.timers.length && app.timers.every(ms => ms <= 3000));
      resolveNetwork(new Response('FICTIONAL fresh shell'));
      await Promise.all(navigation.background);
      assert.equal(await app.content.get(new URL('tickets.html', scope).href).clone().text(), 'FICTIONAL fresh shell', 'late network response refreshes next-open shell');
    }],
    ['offline tickets navigation returns saved shell', async () => {
      const app = worker(async () => { throw Error('fictional offline'); });
      const navigation = app.navigate();
      assert.equal(await (await navigation.response).text(), 'FICTIONAL cached shell');
      await Promise.all(navigation.background);
    }],
    ['non-OK network response cannot replace a good cached shell', async () => {
      const app = worker(async () => new Response('upstream failure', { status: 503 }));
      const navigation = app.navigate();
      assert.equal(await (await navigation.response).text(), 'FICTIONAL cached shell');
      await Promise.all(navigation.background);
      assert.equal(await app.content.get(new URL('tickets.html', scope).href).clone().text(), 'FICTIONAL cached shell');
    }],
    ['explicit package refresh bypasses service-worker cache', async () => {
      let fetches = 0;
      const app = worker(async () => { fetches++; return new Response('FICTIONAL fresh ciphertext'); });
      const request = app.navigate({ pathname: 'tickets.enc.manifest.json', cache: 'no-store', mode: 'cors' });
      assert.equal(await (await request.response).text(), 'FICTIONAL fresh ciphertext');
      assert.equal(fetches, 1);
    }],
    ['app-shell upgrade never deletes the separate encrypted vault cache', async () => {
      const app = worker(async () => new Response('unused'));
      await app.activate();
      assert.equal(app.deletedCaches.includes('au-trip-ticket-v1'), false);
      assert.ok(app.deletedCaches.includes('au-trip-photo-v58'));
    }]
  ];
  let failures = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n  ${error.message}`); }
  }
  console.log(`${tests.length - failures}/${tests.length} service-worker cases passed.`);
  process.exitCode = failures ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
