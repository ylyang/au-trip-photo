'use strict';

// Uses only freshly generated fictional tickets. Never reads published ticket data.
// Run: node tests/vault-regression.cjs [path-to-tickets.html]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const args = process.argv.slice(2);
const target = args.find(value => !value.startsWith('--')) || path.join(__dirname, '..', 'tickets.html');
const html = args.includes('--source-head') ? execFileSync('git', ['show', 'HEAD:tickets.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }) : fs.readFileSync(target, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline application script exists');
const code = match[1]
  .replace(/loadPublishedPackage\(\)\.then\(/, 'globalThis.__bootPromise=loadPublishedPackage().then(')
  .replace(/^startPackageLoad\(\);/m, 'globalThis.__bootPromise=startPackageLoad();');
assert.ok(code !== match[1], 'capture the real startup promise without bypassing its call chain');
const baseURL = 'https://vault-test.example/au-trip-photo/tickets.html';
const password = 'Vault-test-only-2026';
const enc = new TextEncoder();
const b64 = value => Buffer.from(value).toString('base64');

async function fixture() {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const file = { name: 'FICTIONAL-ticket.txt', category: '其他', date: '2030-01-01', mime: 'text/plain', data: b64(enc.encode('Fictional regression ticket; no personal information.')) };
  const data = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(file)));
  return { package: { format: 'au-trip-ticket-v1', salt: b64(salt), iterations: 1000, items: [{ iv: b64(iv), data: b64(data) }] }, file, rawKey: b64(await webcrypto.subtle.exportKey('raw', key)) };
}

function persistentState() {
  return { databases: new Map(), caches: new Map(), local: new Map() };
}

function fakeIndexedDB(persistent, disabled = false) {
  return { open(name) {
    const request = {};
    setTimeout(() => {
      if (disabled) { request.error = Error('test: IndexedDB unavailable'); request.onerror?.(); return; }
      const isNew = !persistent.databases.has(name);
      if (isNew) persistent.databases.set(name, new Map());
      const stores = persistent.databases.get(name);
      request.result = {
        objectStoreNames: { contains: key => stores.has(key) },
        createObjectStore: key => stores.set(key, new Map()),
        close() {},
        transaction(storeName) {
          const store = stores.get(storeName);
          assert.ok(store, 'transaction uses an existing object store');
          const transaction = {};
          transaction.objectStore = () => ({
            get(key) {
              const read = {};
              setTimeout(() => { read.result = structuredClone(store.get(key)); read.onsuccess?.(); transaction.oncomplete?.(); }, 0);
              return read;
            },
            put(value, key) { store.set(key, structuredClone(value)); setTimeout(() => transaction.oncomplete?.(), 0); return {}; },
            delete(key) { store.delete(key); setTimeout(() => transaction.oncomplete?.(), 0); return {}; }
          });
          return transaction;
        }
      };
      if (isNew) request.onupgradeneeded?.();
      request.onsuccess?.();
    }, 0);
    return request;
  } };
}

function fakeElement(id) {
  const classes = new Set(['vaultView', 'modal'].includes(id) ? ['hidden'] : []);
  return {
    id, value: '', checked: id === 'rememberDevice', disabled: false,
    textContent: '', innerHTML: '', className: '', style: {}, hidden: false,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle(name, force) { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); } },
    removeAttribute(name) { delete this[name]; },
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return null; }
  };
}

async function openPage(data, persistent, { offline = false, indexedDBDisabled = false, splitPackage = false } = {}) {
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const elements = new Map(ids.map(id => [id, fakeElement(id)]));
  const listeners = new Map();
  const network = [];
  let networkData = data, networkOffline = offline, networkSplit = splitPackage;
  const cacheKey = request => typeof request === 'string' ? new URL(request, baseURL).href : request.url;
  const sandbox = {
    console, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, URL, Blob, Request, Response, AbortController,
    atob, btoa, setTimeout, clearTimeout, structuredClone,
    document: { querySelector: selector => elements.get(selector.replace(/^#/, '')), querySelectorAll: () => [], addEventListener() {} },
    location: { href: baseURL },
    navigator: { storage: { persist: async () => true, persisted: async () => true } },
    indexedDB: fakeIndexedDB(persistent, indexedDBDisabled),
    localStorage: { getItem: key => persistent.local.get(key) ?? null, setItem: (key, value) => persistent.local.set(key, String(value)), removeItem: key => persistent.local.delete(key) },
    caches: { async open(name) {
      if (!persistent.caches.has(name)) persistent.caches.set(name, new Map());
      const cache = persistent.caches.get(name);
      return { async put(request, response) { cache.set(cacheKey(request), response.clone()); }, async match(request) { return cache.get(cacheKey(request))?.clone(); } } } },
    async fetch(url) {
      network.push(String(url));
      if (networkOffline) throw Error('test: network offline');
      const json = JSON.stringify(networkData.package), partSize = Math.ceil(json.length / 3);
      const parts = Array.from({ length: 3 }, (_, i) => json.slice(i * partSize, (i + 1) * partSize));
      const pathname = new URL(url, baseURL).pathname;
      if (pathname.endsWith('/tickets.enc.json') && !networkSplit) return new Response(json, { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (networkSplit && pathname.endsWith('/tickets.enc.manifest.json')) return new Response(JSON.stringify({ parts: parts.map((_, i) => `tickets.enc.part-0${i + 1}`) }), { status: 200 });
      const part = pathname.match(/\/tickets\.enc\.part-0([1-3])$/);
      if (networkSplit && part) return new Response(parts[Number(part[1]) - 1], { status: 200 });
      return new Response('not found', { status: 404 });
    },
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(handler); }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context, { filename: target });
  await context.__bootPromise;
  return {
    context, elements, network,
    setNetwork({ data: nextData = networkData, offline: nextOffline = networkOffline, splitPackage: nextSplit = networkSplit } = {}) { networkData = nextData; networkOffline = nextOffline; networkSplit = nextSplit; },
    evaluate: expression => vm.runInContext(expression, context),
    async unlock(remember = true, suppliedPassword = password) {
      elements.get('rememberDevice').checked = remember;
      elements.get('password').value = suppliedPassword;
      await elements.get('unlock').onclick();
    },
    async event(name, extra = {}) {
      const previousStatus = elements.get('lockStatus').textContent;
      for (const listener of listeners.get(name) || []) await listener({ type: name, ...extra });
      // Browser handlers do not return the tryAutoUnlock promise; wait until its true call chain is idle.
      for (let tries = 0; tries < 100; tries++) {
        await delay(5);
        if (name === 'pageshow' && extra.persisted && elements.get('lockStatus').textContent === previousStatus) continue;
        if (!vm.runInContext('unlocking', context) && !elements.get('lockStatus').textContent.includes('正在使用')) break;
      }
    }
  };
}

function expectUnlocked(page) {
  assert.equal(page.elements.get('vaultView').classList.contains('hidden'), false, 'ticket list should be visible without another password');
  assert.equal(page.context.__vaultFiles?.[0]?.name, 'FICTIONAL-ticket.txt', 'actual decrypted file should reach render');
}

function storedUnlock(persistent) {
  return persistent.databases.get('au-trip-ticket-device-v1')?.get('state')?.get('unlock')
    || JSON.parse(persistent.local.get('au-trip-ticket-device-v1-fallback') || 'null');
}

async function main() {
  const data = await fixture();
  const tests = [
    ['manual unlock with remember stores usable device key', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock(); expectUnlocked(page);
      const state = storedUnlock(persistent);
      assert.ok(state, 'remember was checked but no device unlock state was saved');
      assert.equal(state.fingerprint, data.package.salt);
      assert.ok(state.key, 'device persistence stores the actual CryptoKey, never a boolean');
      assert.equal(state.key.extractable, false, 'persisted CryptoKey must not be exportable');
      assert.equal(state.rawKey, undefined, 'new writes must not persist an exportable raw key');
      assert.equal(JSON.stringify(state).includes(password), false, 'never store the password');
      assert.doesNotMatch(page.elements.get('offlineBadge').textContent, /未启用|失败/);
    }],
    ['new page automatically opens remembered tickets online', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock();
      const reopened = await openPage(data, persistent); expectUnlocked(reopened);
      assert.equal(reopened.elements.get('password').value, '');
      assert.equal(reopened.network.length, 0, 'a cached reopen must not redownload the encrypted package');
      assert.ok(storedUnlock(persistent), 'automatic unlock must not erase its own saved state');
    }],
    ['new page automatically opens all cached tickets offline', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock();
      const reopened = await openPage(data, persistent, { offline: true }); expectUnlocked(reopened);
      assert.equal(reopened.network.length, 0, 'offline reopen should use local cache directly');
      assert.equal(reopened.context.__vaultFiles[0].data, data.file.data, 'cached encrypted package decrypts original fictional file bytes');
    }],
    ['pagehide then persisted pageshow automatically restores remembered vault', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock(); await page.event('pagehide');
      assert.equal(page.elements.get('vaultView').classList.contains('hidden'), true);
      await page.event('pageshow', { persisted: true }); expectUnlocked(page);
    }],
    ['split package is cached completely and reopens offline without downloads', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent, { splitPackage: true });
      await page.unlock(); expectUnlocked(page);
      assert.equal(page.network.filter(url => /part-0/.test(url)).length, 3, 'load each fictional split part');
      const reopened = await openPage(data, persistent, { offline: true, splitPackage: true }); expectUnlocked(reopened);
      assert.equal(reopened.network.length, 0);
      assert.equal(reopened.context.__vaultFiles[0].data, data.file.data);
    }],
    ['unchecked remember does not store keys or unlock on reopen', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock(false); expectUnlocked(page);
      assert.equal(storedUnlock(persistent), null);
      const reopened = await openPage(data, persistent);
      assert.equal(reopened.elements.get('vaultView').classList.contains('hidden'), true);
    }],
    ['incorrect password never exposes files or creates a device key', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock(true, 'wrong-fictional-password');
      assert.equal(page.elements.get('vaultView').classList.contains('hidden'), true);
      assert.ok(page.context.__vaultFiles == null, 'failed decryption does not retain plaintext files');
      assert.equal(storedUnlock(persistent), null);
      assert.match(page.elements.get('lockStatus').textContent, /密码不正确/);
    }],
    ['forget device removes remembered key and prevents automatic reopen', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock();
      assert.ok(storedUnlock(persistent));
      await page.elements.get('forgetDevice').onclick();
      assert.equal(storedUnlock(persistent), null);
      assert.equal(page.elements.get('vaultView').classList.contains('hidden'), true);
      const reopened = await openPage(data, persistent);
      assert.equal(reopened.elements.get('vaultView').classList.contains('hidden'), true);
    }],
    ['unavailable secure key storage reports failure without exposing raw key', async () => {
      const persistent = persistentState(), options = { indexedDBDisabled: true };
      const page = await openPage(data, persistent, options); await page.unlock();
      expectUnlocked(page);
      assert.equal(storedUnlock(persistent), null, 'never fall back to writing exportable raw key material');
      assert.match(page.elements.get('offlineBadge').textContent, /失败|不可用|不支持/, 'storage failure must be visible to the user');
      const reopened = await openPage(data, persistent, options);
      assert.equal(reopened.elements.get('vaultView').classList.contains('hidden'), true);
    }],
    ['already saved raw key remains saved after automatic unlock', async () => {
      const persistent = persistentState();
      persistent.databases.set('au-trip-ticket-device-v1', new Map([['state', new Map([['unlock', { rawKey: data.rawKey, fingerprint: data.package.salt, savedAt: Date.now() }]])]]));
      const page = await openPage(data, persistent); expectUnlocked(page);
      assert.ok(storedUnlock(persistent), 'automatic unlock deleted existing device key');
      assert.equal(storedUnlock(persistent).rawKey, undefined, 'legacy raw key is migrated rather than rewritten');
      assert.equal(storedUnlock(persistent).key.extractable, false);
    }],
    ['failed manual refresh preserves previous cache, key, and open ticket list', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock();
      const beforeSalt = page.evaluate('pkg.salt');
      page.setNetwork({ offline: true });
      assert.ok(page.elements.get('refreshPackage'), 'manual refresh control exists');
      await page.elements.get('refreshPackage').onclick();
      expectUnlocked(page);
      assert.equal(page.evaluate('pkg.salt'), beforeSalt);
      assert.equal(storedUnlock(persistent).fingerprint, beforeSalt);
      const reopened = await openPage(data, persistent, { offline: true }); expectUnlocked(reopened);
      assert.equal(reopened.evaluate('pkg.salt'), beforeSalt);
    }],
    ['successful refresh replaces cached package and establishes its own remembered key', async () => {
      const persistent = persistentState(), page = await openPage(data, persistent);
      await page.unlock();
      const replacement = await fixture();
      page.setNetwork({ data: replacement, splitPackage: true });
      assert.ok(page.elements.get('refreshPackage'), 'manual refresh control exists');
      await page.elements.get('refreshPackage').onclick();
      assert.equal(page.evaluate('pkg.salt'), replacement.package.salt);
      assert.equal(page.elements.get('vaultView').classList.contains('hidden'), true, 'changed encryption salt requires a password once');
      await page.unlock(); expectUnlocked(page);
      assert.equal(storedUnlock(persistent).fingerprint, replacement.package.salt);
      const reopened = await openPage(data, persistent, { offline: true }); expectUnlocked(reopened);
      assert.equal(reopened.evaluate('pkg.salt'), replacement.package.salt, 'new complete snapshot persists across reopen');
    }]
  ];
  let failures = 0;
  for (const [name, test] of tests) {
    try { await test(); console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}\n  ${error.message}`); }
  }
  console.log(`${tests.length - failures}/${tests.length} passed; all fixtures are fictional.`);
  process.exitCode = failures ? 1 : 0;
}

async function serve() {
  const data = await fixture();
  const root = path.resolve(__dirname, '..');
  const allowedFiles = new Set(['index.html', 'tickets.html', 'ticket-vault-builder.html', 'sw.js', 'ticket-pdf-viewer.mjs', 'icon-192.png', 'icon-512.png', 'icon.svg', 'manifest.webmanifest']);
  const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:8766');
    if (url.pathname === '/tickets.enc.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data.package)); return;
    }
    let relative;
    try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'tickets.html'; }
    catch (_) { res.writeHead(400); res.end(); return; }
    if (relative.includes('\\') || relative.split('/').includes('..')) { res.writeHead(404); res.end(); return; }
    const file = path.resolve(root, relative);
    if (!(allowedFiles.has(relative) || relative.startsWith('vendor/') || relative.startsWith('assets/souvenirs/')) || !file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('Test server only exposes fictional tickets and allowlisted UI assets.'); return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(relative === 'tickets.html' ? fs.readFileSync(target) : fs.readFileSync(file));
  });
  server.listen(8766, '127.0.0.1', () => {
    console.log('Fictional-only vault UI: http://127.0.0.1:8766/tickets.html');
    console.log(`Test password: ${password}`);
    console.log('No user tickets, keys, or passwords are loaded by this server.');
  });
}

(args.includes('--serve') ? serve() : main()).catch(error => { console.error(error); process.exitCode = 1; });
