import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /data-section="souvenirs"/, 'top navigation must include the souvenir page');
assert.match(html, /id="sectSouvenirs"/, 'souvenir page container must exist');
assert.match(html, /souvenirs:'sectSouvenirs'/, 'section routing must include souvenirs');

for(const destination of [
  '墨尔本市中心',
  '普芬比利蒸汽火车 · 菲利普岛',
  '大洋路 · 阿波罗湾',
  '艾尔利海滩 · 圣灵群岛',
  '悉尼歌剧院 · 岩石区',
  '塔龙加动物园 · 邦迪海滩'
]){
  assert.ok(html.includes(destination), `missing souvenir group: ${destination}`);
}

for(const officialHost of [
  'kokoblack.com',
  'puffingbillyrailway.org.au',
  'penguins.org.au',
  'visitgreatoceanroad.org.au',
  'tourismwhitsundays.com.au',
  'sydneyoperahouseshop.com',
  'taronga.org.au',
  'aquabumps.com'
]){
  assert.ok(html.includes(officialHost), `missing official source: ${officialHost}`);
}

assert.match(html, /xhsActionButtonsHTML\(item\.query/, 'each item must reuse the tested Xiaohongshu action flow');
assert.match(html, /沙、珊瑚、贝壳与动植物不要带走/, 'natural-site protection reminder must be visible');

console.log('PASS: souvenir page covers every trip region, official sources, Xiaohongshu actions, and protection guidance.');
