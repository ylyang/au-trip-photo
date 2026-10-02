'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(code);
function section(start,end){
  const a=code.indexOf(start),b=code.indexOf(end,a);
  assert.ok(a>=0&&b>a,start);
  return code.slice(a,b);
}
const context=vm.createContext({URL,encodeURIComponent});
vm.runInContext(section('const POIS =','function renderTripFlow')+
  section('const esc =','/* 导航选择面板')+
  '\nglobalThis.app={DAYS,TRIP_FLOW,dayRouteSections,multiNav};',context);
const {DAYS,TRIP_FLOW,dayRouteSections,multiNav}=context.app;
const d2=DAYS.find(d=>d.n===2);
const items=d2.items;
const swisse=items.find(it=>it.p==='cwspencer');
assert.equal(swisse.t,'13:40');
assert.equal(swisse.id,'★ Chemist Warehouse 买 Swisse');
assert.ok(!swisse.optional&&!swisse.skipDefault);
assert.ok(items.every(it=>it.p!=='luluemporium'));
assert.match(items.find(it=>it.p==='higherground').d,/13:30/);
assert.equal(items.find(it=>it.p==='asado').t,'18:30');
assert.equal(items.find(it=>it.p==='royalarcade').t,'14:40');
assert.equal(items.find(it=>it.p==='blockarcade').t,'15:05');
assert.equal(items.find(it=>it.p==='blockarcade').id,'皇家拱廊 + 布洛克拱廊（弹性短逛）');
assert.equal(items.at(-1).t,'20:45');
assert.ok(items.find(it=>it.p==='southbank').optional);
assert.ok(items.every((it,i)=>!i||it.t>=items[i-1].t),'timeline stays chronological');
const flow=TRIP_FLOW.find(d=>d.d===2).stops.join(' ');
assert.doesNotMatch(flow,/Emporium|lululemon|可选：Swisse/);
assert.match(flow,/13:40–14:15 Swisse（确定去）/);
const routes=dayRouteSections(d2);
assert.equal(routes[0].keys.join(','),'higherground,cwspencer,royalarcade,blockarcade');
assert.ok(routes.every(r=>r.keys.length<=5&&!r.keys.includes('luluemporium')));
assert.ok(!routes.filter(r=>!r.label.startsWith('可选')).some(r=>r.keys.includes('southbank')));
assert.match(decodeURIComponent(multiNav(routes[0].keys)),/Chemist Warehouse Spencer Outlet Centre, 201 Spencer/);
assert.doesNotMatch(code,/默认跳过 Swisse|13:15 左右结账|12:15–13:15|可选 · Chemist Warehouse 买 Swisse/);
assert.ok(fs.readFileSync(path.join(root,'index.html')).equals(fs.readFileSync(path.join(root,'dist','index.html'))));
console.log('PASS D2 timeline, Swisse required/stable ID, cancelled lululemon, afternoon route, optional river, dinner unchanged and synchronized mirror.');
