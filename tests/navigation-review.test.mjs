import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const context=vm.createContext({URL,encodeURIComponent});
vm.runInContext(section('const POIS =','const PHOTOS =')+section('const DAYS =','const TRIP_FLOW =')+section('function navWeb(','function goSameTab(')+section('function multiNav(','function routeButtons('),context);
const get=code=>vm.runInContext(code,context);
test('every navigation target uses a named place, not approximate coordinates',()=>{
 for(const [key,p] of Object.entries(get('POIS'))){assert.ok(p.mapQuery,key);const u=new URL(get(`navWeb(POIS.${key})`));assert.equal(u.searchParams.get('destination')||u.searchParams.get('query'),p.mapQuery);assert.equal(u.searchParams.get('api'),'1');}
 assert.match(get('POIS.dorsett.mapQuery'),/615 Little Lonsdale/);
 assert.match(get('POIS.higherground.mapQuery'),/650 Little Bourke/);
 assert.match(get('POIS.luluemporium.mapQuery'),/lululemon.*287 Lonsdale/);
 assert.match(get('POIS.apollocoop.mapQuery'),/18 Pascoe/);
 assert.match(get('POIS.fruitezy.mapQuery'),/1 Bridge Road/);
});
test('route order, waypoint limit and transport mode survive URL encoding',()=>{
 const pois=get('POIS');
 for(const d of get('DAYS'))for(const s of get(`dayRouteSections(DAYS[${d.n-1}])`)){
  const u=new URL(get(`multiNav(${JSON.stringify(s.keys)},${JSON.stringify(s.mode)})`));
  assert.ok(s.keys.length<=5);assert.ok(u.href.length<=2048);
  if(s.keys.length>1){assert.equal(u.searchParams.get('origin'),pois[s.keys[0]].mapQuery);assert.equal(u.searchParams.get('destination'),pois[s.keys.at(-1)].mapQuery);assert.equal(u.searchParams.get('waypoints')||'',s.keys.slice(1,-1).map(k=>pois[k].mapQuery).join('|'));assert.equal(u.searchParams.get('travelmode'),s.mode);}
 }
 const d8=get('dayRouteSections(DAYS[7]).filter(s=>!s.label.startsWith("可选"))');assert.ok(d8.every(s=>!s.keys.some(k=>['fruitezy','hbrbridge','observatory'].includes(k))));
 const d9=get('dayRouteSections(DAYS[8])');assert.deepEqual(Array.from(d9.find(s=>s.label.includes('海岸步道')).keys),['bondi','tamarama','bronte','clovelly','coogee']);assert.equal(d9.find(s=>s.mode==='transit').keys[0],'tarongawharf');
 assert.match(get('POIS.taronga.mapQuery'),/Main Entrance/);
 for(const key of ['whitehaven','hillinlet','heartreef','mantaray'])assert.equal(new URL(get(`navWeb(POIS.${key})`)).pathname,'/maps/search/');
});
test('flight navigation uses departure terminal and Lakeside lunch is not Belgrave',()=>{
 for(const day of get('DAYS'))for(const it of day.items){const f=get('FLIGHT_NAV')[it.ttl.split(' ')[0]];if(f){assert.equal(it.p,f[0]);assert.equal(it.arrivalPoi,f[1]);}}
 assert.equal(get('DAYS[2].items.find(i=>i.ttl.includes("午餐")).p'),'lakeside');
 assert.match(get('POIS.lakeside.mapQuery'),/Emerald Lake Road/);
});
test('toilets remain small inline badges with daily plans retained',()=>{
 assert.match(html,/\.toilet-badge\{[^}]*font-size:11px/);
 const render=section('function toiletHTML(','const DAY_TOILET_PLANS');
 assert.match(render,/TOILET_SOURCES\[t.source\]/);assert.doesNotMatch(render,/<aside|<p>|<b>/);
 assert.match(render,/return ''/);assert.match(html,/今天的如厕安排/);
 assert.doesNotMatch(html,/class="toilet-note"/);
});
