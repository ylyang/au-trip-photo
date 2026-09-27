import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /id="pwaInstallBtn"/, '顶部应保留可随时找到的安装入口');
assert.match(html, /id="pwaInstallBanner"/, '未安装时应显示添加到桌面提示卡');
assert.match(html, /beforeinstallprompt/, '应接住浏览器的 PWA 安装事件');
assert.match(html, /deferredInstallPrompt\.prompt\s*\(/, '用户点击后应调用系统安装提示');
assert.match(html, /display-mode:\s*standalone/, '已从桌面打开时不应重复提示安装');
assert.match(html, /添加到主屏幕/, '不支持系统安装框时应提供手动添加说明');

console.log('PASS: PWA install entry, prompt flow, standalone guard and manual fallback are present.');
