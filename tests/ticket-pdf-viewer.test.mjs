import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../tickets.html',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../ticket-pdf-viewer.mjs',import.meta.url),'utf8');
test('ticket preview uses local PDF renderer rather than native iframe',()=>{
 assert.doesNotMatch(html,/<iframe/);
 for(const token of ['pdfCanvas','data-pdf-next','data-pdf-plus','下载原件','previewGeneration','pdfPreview.dispose()'])assert.ok(html.includes(token),token);
 assert.match(html,/import\('\.\/ticket-pdf-viewer.mjs'\)/);
 assert.match(viewer,/getDocument\(\{data:bytes/);
 assert.match(viewer,/isEvalSupported:false/);
 assert.match(viewer,/loading.destroy\(\)/);
 assert.match(viewer,/canvas.width = 0; canvas.height = 0/);
 assert.doesNotMatch(viewer,/https?:\/\/|localStorage|indexedDB/);
});
test('PDF renderer, worker and licenses are local and available for deployment',()=>{
 for(const path of ['pdf.mjs','pdf.worker.mjs','LICENSE','cmaps/LICENSE','standard_fonts/LICENSE_FOXIT','wasm/LICENSE_PDFJS_OPENJPEG'])assert.ok(existsSync(new URL('../vendor/pdfjs/'+path,import.meta.url)),path);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['ticket-pdf-viewer.mjs','vendor/pdfjs/pdf.mjs','vendor/pdfjs/pdf.worker.mjs'])assert.ok(sw.includes(file));
});
