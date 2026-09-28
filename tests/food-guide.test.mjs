import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /data-section="food"/, 'top navigation must include the food guide');
assert.match(html, /id="sectFood"/, 'food guide section must exist');
assert.match(html, /food:'sectFood'/, 'section routing must include the food guide');

for(const item of [
  'Higher Ground · 一甜一咸早午餐 + 墨尔本咖啡',
  'Apollo Bay Bakery · 扇贝派',
  'The Pavilion · 海鲜 + 日落特调',
  'Fruitezy · 现场鲜榨果汁',
  'Coogee Pavilion · 木火披萨 / 海鲜'
]){
  assert.ok(html.includes(item), `missing food recommendation: ${item}`);
}

assert.ok(html.includes("loc:'Shop C2, Sydney Fish Market, 1 Bridge Rd, Glebe NSW 2037'"), 'Fruitezy must use its current 2026 location');
assert.ok(html.includes('周四 Fruitezy 07:00–22:00'), 'D8 recommendation must include verified Thursday hours');
assert.ok(html.includes('07:15 酒店打车'), 'Fruitezy must have a route-safe insertion plan');
assert.ok(html.includes('data-food-nav='), 'food cards must use the navigation choice flow');
assert.ok(html.includes('xhsActionButtonsHTML(item.query'), 'food cards must reuse tested Xiaohongshu actions');
assert.ok(!html.includes("fishmarket:{n:'悉尼鱼市场 Sydney Fish Market',loc:'Bank St"), 'obsolete fish market address must be removed');

console.log('PASS: food guide covers each destination, Fruitezy uses the 2026 site and hours, and actions are wired.');
