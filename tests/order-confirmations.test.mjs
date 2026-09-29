import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('D3 shows both confirmed adult vouchers and the actual pickup time', () => {
  assert.match(html, /两张独立成人凭证均已确认/);
  assert.match(html, /08:15 接载 · 601 Lonsdale Street/);
  assert.match(html, /¥ 2,381\.40（2 人合计）/);
});

test('D6 and D7 reflect the confirmed Ocean Rafting pickup and flight schedule', () => {
  assert.match(html, /10\/06 08:45 · Harbour Cove 酒店门口车道接载/);
  assert.match(html, /10\/07 11:00 · Harbour Cove 酒店门口车道接载；11:30–12:30 飞行/);
  assert.match(html, /实际飞行 11:30–12:30/);
  assert.doesNotMatch(html, /珊瑚海码头 · 观光飞机 check-in/);
});

test('D6 clearly records that both travellers will not snorkel', () => {
  assert.match(html, /两人都不参加浮潜/);
  assert.match(html, /浮潜停靠期间 · 船上休息观景（不浮潜）/);
  assert.match(html, /登船时主动告诉船员/);
  assert.doesNotMatch(html, /title:'Ocean Rafting 南线 · 白天堂沙滩 \+ 浮潜'/);
});

test('D7 hotel luggage storage is confirmed while pickup and transfers stay separate', () => {
  assert.match(html, /退房 · 行李寄存（酒店已同意）/);
  assert.match(html, /"id": "harbour-luggage",\s*"t": "Harbour Cove 已同意[^\n]+\s*"u": false,\s*"done": true/);
  assert.doesNotMatch(html, /退房 · 行李寄存（待酒店确认）|寄存待酒店确认|确认 Harbour Cove 10\/07 退房后能否寄存/);
  assert.match(html, /并非酒店确认的取件时段/);
  assert.match(html, /飞行接驳返回点及机场小巴时间仍待商家确认/);
});

test('PPP transfers prioritize the red Airlie Airport Bus in both directions', () => {
  assert.match(html, /抵达 PPP · 优先找红色小巴/);
  assert.match(html, /Airlie Airport Bus → 艾尔利海滩/);
  assert.match(html, /乘红色小巴前往 PPP/);
  assert.match(html, /当场登记 10\/07 返程时间与集合点/);
  assert.match(html, /若接驳未确认或未出现，立即改乘出租车/);
});

test('public page excludes personal booking identifiers and management tokens', () => {
  assert.doesNotMatch(html, /\b(?:YJN|KCN)\d{6,}\b|FRS\d{4}-\d+|[?&]token=[A-Za-z0-9%]{20,}/);
  assert.doesNotMatch(html, /(?<!\d)1[3-9]\d{9}(?!\d)/);
});
