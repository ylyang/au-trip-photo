import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.ok(
  /function xhsWebURL\(query\)[\s\S]*?https:\/\/www\.xiaohongshu\.com\/search_result\/?\?keyword=/.test(html),
  'primary XiaoHongShu action must use an official HTTPS search URL'
);
assert.ok(
  /class="xhs-open" href="' \+ xhsWebURL\(q\)/.test(html),
  'the visible XiaoHongShu search button must use the HTTPS URL'
);
assert.ok(
  !/class="xhs-open" href="' \+ xhsAppURL\(q\)/.test(html),
  'the visible search button must not rely only on a custom app protocol'
);

console.log('PASS: XiaoHongShu search always has an official HTTPS destination');
