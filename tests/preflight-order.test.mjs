import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function data(){
 const c=vm.createContext({BOOKING_TASKS:[
  {id:'restaurant-late',date:'10/08',time:'18:30',category:'餐厅',name:'Late',group:'pending'},
  {id:'restaurant-early',date:'10/02',time:'18:00',category:'餐厅',name:'Early',group:'pending'},
  {id:'shuttle',preflightId:'ppp-return-bus',date:'10/05',name:'Shuttle',group:'pending'},
  {id:'booked',date:'10/01',name:'Booked',group:'confirmed'}
 ]});
 vm.runInContext(slice('const TODOS =','const TIPS =')+slice('function preflightKey(','function savePF('),c);
 return code=>vm.runInContext(code,c);
}
test('preflight order follows handling time, preserving IDs and deduplicating tasks',()=>{
 const get=data(),tasks=get('preflightTasks()'),ids=Array.from(tasks,t=>t.id);
 assert.equal(ids.filter(id=>id==='ppp-return-bus').length,1);assert.ok(!ids.includes('booked'));
 const expected=['rafting-online','great-ocean-driver','ppp-return-bus','ocean-phone','flight-return-transfer','xmn-return-connection'];
 for(let i=1;i<expected.length;i++)assert.ok(ids.indexOf(expected[i-1])<ids.indexOf(expected[i]));
 assert.ok(ids.indexOf('restaurant-early')<ids.indexOf('restaurant-late'));
 assert.ok(ids.indexOf('restaurant-late')<ids.indexOf('rafting-online'),'reserve ahead of travel, not on dining day');
 assert.ok(tasks.every(t=>t.when && t.sortKey));
 const original=Array.from(get('TODOS.map(preflightKey)'));
 get('preflightTasks()');assert.deepEqual(Array.from(get('TODOS.map(preflightKey)')),original);
 get('TODOS.reverse()');assert.deepEqual(Array.from(get('preflightTasks().map(preflightKey)')),ids);
});
