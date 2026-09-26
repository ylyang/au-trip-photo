import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const functions = html.slice(html.indexOf('function xhsWebURL('), html.indexOf('function xhsInspirationHTML('));
const clickHandler = html.slice(html.indexOf('function handleXhsClick('), html.indexOf("document.addEventListener('click', handleXhsClick);"));
const nodes = Object.fromEntries(['xhsQuery', 'xhsCopyQuery', 'xhsLaunch', 'xhsIntent', 'xhsLaunchStatus', 'xhsDialog'].map(id => ['#' + id, { dataset: {}, showModal(){ this.open = true; } }]));
const context = vm.createContext({ navigator: { userAgent: '' }, $: key => nodes[key], esc: text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'), showToast(){} });
vm.runInContext(functions + clickHandler, context);
const query = '墨尔本 Higher Ground & "海边" #打卡';
for(const ua of ['Mozilla/5.0 (Linux; Android 14) HuaweiBrowser/15.0', 'Mozilla/5.0 (Linux; Android 14) Chrome/130', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'HarmonyOS']){
  context.navigator.userAgent = ua;
  const buttons = context.xhsActionButtonsHTML(query);
  assert.ok(buttons.includes('data-xhs-mobile='), 'mobile must offer the in-page App entry');
  assert.ok(!buttons.includes('search_result/'), 'mobile must never visit the broken desktop search page');
  let prevented = false;
  context.handleXhsClick({ target: { closest: selector => selector === '[data-xhs-mobile]' ? { dataset: { xhsMobile: query } } : null }, preventDefault(){ prevented = true; } });
  assert.ok(prevented && nodes['#xhsDialog'].open, 'mobile click must visibly open the search dialog');
  assert.equal(nodes['#xhsQuery'].value, query);
  assert.equal(nodes['#xhsCopyQuery'].dataset.xhsCopy, query);
  assert.equal(new URL(nodes['#xhsLaunch'].href).searchParams.get('keyword'), query);
  assert.ok(nodes['#xhsIntent'].href.startsWith('intent://search/result?'));
  assert.equal(nodes['#xhsIntent'].hidden, /iPhone/.test(ua));
  prevented = false;
  context.handleXhsClick({ target: { closest: selector => selector === '#xhsLaunch, #xhsIntent' ? {} : null }, preventDefault(){ prevented = true; } });
  assert.equal(prevented, false, 'native App link must preserve the user gesture');
  assert.ok(nodes['#xhsLaunchStatus'].textContent.includes('复制关键词'), 'blocked App launch must retain visible help');
}
context.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130';
const desktop = context.xhsActionButtonsHTML(query);
assert.ok(desktop.includes('https://www.xiaohongshu.com/search_result/'));
assert.ok(!desktop.includes('data-xhs-mobile='));
assert.equal(new URL(context.xhsWebURL(query)).searchParams.get('keyword'), query);
console.log('PASS: mobile click opens App choices and preserves keywords; desktop keeps official search; native launch has no async interception. Device App launch needs real-phone verification.');
