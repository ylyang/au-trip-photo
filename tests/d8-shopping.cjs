'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(code);
function section(start, end) {
  const a = code.indexOf(start), b = code.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `source section: ${start}`);
  return code.slice(a, b);
}
const context = vm.createContext({URL, encodeURIComponent});
vm.runInContext(section('const POIS =', 'function renderTripFlow') +
  section('const TICKETS =', 'const HOTELS =') +
  section('const TODOS =', 'const TIPS =') +
  section('const esc =', '/* 导航选择面板') +
  section('const REGIONS =', 'const REGION_VIEWS =') +
  section('function dayGoogleRouteKeys', 'function updateGoogleMap') +
  section('const SOUVENIRS =', 'function shoppingOptionHTML') +
  section('const FOOD_GROUPS =', 'function foodItemHTML') +
  section('const DAY_TRANSIT =', 'function dayHTML') +
  section('const PREFLIGHT_TIMING =', 'function preflightTiming') +
  '\nglobalThis.app={POIS,DAYS,TRIP_FLOW,TICKETS,TODOS,REGIONS,SOUVENIRS,FOOD_GROUPS,DAY_TRANSIT,PREFLIGHT_TIMING,dayRouteSections,dayGoogleRouteKeys,multiNav};', context);
const {POIS,DAYS,TRIP_FLOW,TICKETS,TODOS,REGIONS,SOUVENIRS,FOOD_GROUPS,DAY_TRANSIT,PREFLIGHT_TIMING,dayRouteSections,dayGoogleRouteKeys,multiNav} = context.app;
const d8 = DAYS.find(day => day.n === 8);
const items = d8.items;
const at = (time, poi) => items.find(item => item.t === time && item.p === poi);
assert.equal(d8.date, '2026-10-08');
assert.equal(d8.tz, 'Australia/Sydney');
assert.ok(items.every((item, i) => !i || item.t >= items[i - 1].t), 'D8 stays chronological');
assert.match(at('09:15', 'qvb').d, /09:40/);
const shopping = at('10:00', 'sydsouvenirs');
assert.equal(shopping.id, 'd8-sydney-souvenirs');
assert.ok(!shopping.optional && !shopping.skipDefault, 'confirmed shopping remains on main itinerary');
assert.match(shopping.d, /10:40/);
assert.ok(at('11:10', 'hydepark'));
assert.ok(at('11:30', 'stmary'));
const gallery = at('11:55', 'artgallery');
assert.ok(gallery.optional, 'free gallery visit can be shortened or skipped');
assert.equal(gallery.id, '新南威尔士州美术馆（常设展免费）', 'keep the existing check-in identity when retitling');
assert.match(at('12:00', 'gallerycafe').d, /12:35/);
assert.match(POIS.gallerycafe.tip.join(' '), /12:00[\s\S]*12:35/);
assert.ok(at('12:40', 'botanic'));
assert.ok(at('13:10', 'macquaries'));
assert.ok(at('13:40', 'operahouse'));
assert.ok(at('14:15', 'welcome'));
assert.match(at('14:30', 'operahouse').ttl, /中文讲解/);
assert.ok(at('18:30', 'glenmore'));
assert.ok(items.every(item => !['fishmarket', 'fruitezy'].includes(item.p)), 'remove early fish-market detour');

const shop = POIS.sydsouvenirs;
assert.equal(shop.kind, 'shop');
for (const text of [shop.loc, shop.mapQuery]) {
  assert.match(text, /Stall\s*460/i);
  assert.match(text, /Paddy[’']?s\s+Markets/i);
  assert.match(text, /Haymarket/i);
  assert.doesNotMatch(text, /460\s*George/i);
}
assert.match(shop.loc, /Thomas[\s\S]*Hay/i);
assert.ok(shop.lat < -33.878 && shop.lat > -33.883 && shop.lng > 151.2 && shop.lng < 151.207, 'map pin is at Haymarket');
assert.ok(REGIONS.syd.keys.includes('sydsouvenirs'));
const routes = dayRouteSections(d8);
assert.equal(routes[0].keys.join(','), 'grace,qvb,sydsouvenirs');
assert.equal(routes[1].keys.join(','), 'sydsouvenirs,hydepark,stmary,gallerycafe');
assert.equal(dayGoogleRouteKeys(d8).join(','), 'grace,qvb,sydsouvenirs');
assert.ok(routes.every(route => route.keys.length <= 5 && route.keys.every(key => POIS[key])));
assert.ok(routes.every(route => !route.keys.some(key => ['fishmarket', 'fruitezy'].includes(key))));
const navigation = new URL(multiNav(routes[0].keys));
assert.equal(navigation.searchParams.get('travelmode'), 'walking');
assert.match(navigation.searchParams.get('destination'), /Stall\s*460/i);
assert.doesNotMatch(navigation.searchParams.get('destination'), /460\s*George/i);
const flow = TRIP_FLOW.find(day => day.d === 8).stops.join(' ');
assert.match(flow, /10:00[\s\S]*(?:460|Paddy|购物)/i);
assert.match(flow, /14:15[\s\S]*14:30/);
assert.doesNotMatch(flow, /Fruitezy|鱼市场/i);
const transit = DAY_TRANSIT[8];
assert.ok(transit.some(leg => /QVB/.test(leg.from) && /460|Paddy/i.test(leg.to)));
assert.ok(transit.some(leg => /460|Paddy/i.test(leg.from) && /Hyde|海德/.test(leg.to)));
assert.ok(!transit.some(leg => /QVB/.test(leg.from) && /Hyde|海德/.test(leg.to)));

const todo = TODOS.find(task => task.id === 'sydney-souvenirs-stock');
assert.ok(todo && todo.u && !todo.done, 'stock check is pending and visible in preflight');
assert.match(todo.t, /Croissant/i);
assert.match(todo.t, /Barista|Coffee\s*Koala/i);
assert.match(todo.t.replace(/\s/g, ''), /\+?61405171420/);
assert.match(PREFLIGHT_TIMING[todo.id].join(' '), /10\/07/);
assert.match(code, /https:\/\/wa\.me\/61405171420/);
const souvenirs = SOUVENIRS.find(group => group.day === 'D8');
const koala = souvenirs.items.find(item => item.id === 'koala-duo');
assert.ok(koala);
const koalaText = JSON.stringify(koala);
assert.match(koalaText, /Croissant/i);
assert.match(koalaText, /Barista|Coffee\s*Koala/i);
assert.match(koalaText, /库存/);
assert.match(koalaText, /不保证|不能保证|未确认|需确认|待确认/);
const d9 = DAYS.find(day => day.n === 9);
assert.ok(!d9.items.some(item => item.p === 'sydsouvenirs' && !item.optional), 'D9 does not gain a required shopping detour');
const fishFood = FOOD_GROUPS.flatMap(group => group.items).filter(item => ['fishmarket', 'fruitezy'].includes(item.poi));
assert.ok(fishFood.length, 'retain fish-market information as a reference');
assert.doesNotMatch(JSON.stringify(fishFood), /07:15|08:45|可选早起/);
assert.doesNotMatch(code, /可选早起支线 · 鱼市场往返|D8 若加入，建议早起打车往返|11:50 左右入座，12:30 前离开/);

const operaTicket = TICKETS.find(ticket => /悉尼歌剧院.*中文讲解团/.test(ticket.t));
assert.ok(operaTicket.ok);
assert.match(operaTicket.rows.find(row => row[0] === '场次')[1], /14:30.*Adult Tour × 2/);
assert.match(operaTicket.rows.find(row => row[0] === '金额')[1], /AUD 100.*已全额付清/);
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const pageCacheVersion = code.match(/const OFFLINE_CACHE_VERSION = ['"]([^'"]+)['"]/);
const workerCacheVersion = worker.match(/const CACHE_NAME = ['"]([^'"]+)['"]/);
assert.ok(pageCacheVersion && workerCacheVersion, 'offline version constants are present');
assert.equal(pageCacheVersion[1], workerCacheVersion[1], 'page offline readiness matches active service-worker cache');
assert.match(code, /info\.version === OFFLINE_CACHE_VERSION/);
assert.match(code, /info\.version !== OFFLINE_CACHE_VERSION/);
for (const file of ['index.html', 'sw.js']) {
  assert.ok(fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(root, 'dist', file))), `dist/${file} is synchronized`);
}
console.log('PASS D8 shopping timing, stable IDs, Haymarket address and navigation, stock reminder, optional D9, preserved opera tickets, matching offline cache version and synchronized mirrors.');
