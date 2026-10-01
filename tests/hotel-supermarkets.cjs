'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
function section(start, end) {
  const a = script.indexOf(start), b = script.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `source section: ${start}`);
  return script.slice(a, b);
}
const context = vm.createContext({URL, encodeURIComponent});
vm.runInContext(section('const POIS =', 'const DAYS =') +
  section('const HOTEL_SUPERMARKETS =', 'const TODOS =') +
  section('const esc =', 'function goSameTab') +
  '\nglobalThis.data={HOTEL_SUPERMARKETS,POIS,hotelSupermarketsHTML,supermarketRouteURL,mapQuery};', context);
const {HOTEL_SUPERMARKETS: groups, POIS, hotelSupermarketsHTML: render, supermarketRouteURL: route, mapQuery} = context.data;
assert.deepEqual(Object.keys(groups).sort(), ['dorsett', 'grace', 'harbourcove']);
const ids = new Set();
for (const [hotelKey, group] of Object.entries(groups)) {
  const output = render(hotelKey);
  assert.match(output, /当地时间/);
  assert.equal((output.match(/class="market-item"/g) || []).length, group.stores.length);
  for (const store of group.stores) {
    assert.ok(!ids.has(store.id), 'unique store ID'); ids.add(store.id);
    assert.match(store.walk, /估算/);
    assert.ok(store.loc && store.hours && store.source, 'address, hours and evidence provided');
    const url = new URL(route(hotelKey, store));
    assert.equal(url.hostname, 'www.google.com');
    assert.equal(url.searchParams.get('origin'), mapQuery(POIS[hotelKey]));
    assert.equal(url.searchParams.get('destination'), store.n + ', ' + store.loc);
    assert.equal(url.searchParams.get('travelmode'), 'walking');
    assert.equal(url.searchParams.has('waypoints'), false);
    assert.ok(output.includes('data-market-id="' + store.id + '"'));
    assert.equal(new URL(store.source).protocol, 'https:');
  }
}
assert.equal(ids.size, 5);
assert.equal(render('non-hotel'), '');
assert.match(groups.harbourcove.note, /特殊营业时间尚未确认/);
assert.match(groups.harbourcove.stores[0].sourceLabel, /非官方/);
assert.match(groups.grace.note, /22:30.*已关门/);
assert.match(groups.dorsett.stores[0].hours, /次日 00:00/);
assert.ok(script.includes('hotelSupermarketsHTML(d.hotel)'));
assert.ok(script.includes('hotelSupermarketsHTML(HOTEL_POI_KEYS[hi])'));
for (const file of ['index.html', 'sw.js']) {
  assert.ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(root,'dist',file))), `dist/${file} is synchronized`);
}
console.log('PASS hotel supermarket data, five map destinations, holiday/arrival caveats, shared rendering, syntax and deployment mirrors.');
