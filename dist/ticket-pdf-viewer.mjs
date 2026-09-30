// Same-origin, on-device PDF rendering. No document URL or bytes leave the device.
export function createPdfViewer(root, bytes) {
  const find = s => root.querySelector(s);
  const canvas = find('canvas'), stage = find('.pdf-stage'), status = find('[data-pdf-status]');
  const prev = find('[data-pdf-prev]'), next = find('[data-pdf-next]');
  const minus = find('[data-pdf-minus]'), plus = find('[data-pdf-plus]'), fit = find('[data-pdf-fit]');
  let disposed = false, loading = null, doc = null, rendering = null, version = 0, pageNumber = 1, zoom = 1;
  let resizeTimer;
  const busy = value => { for (const b of [prev,next,minus,plus,fit]) b.disabled = value; };
  function message(text) { if (!disposed) status.textContent = text; }
  function controls() {
    if (disposed || !doc) return;
    prev.disabled = pageNumber <= 1; next.disabled = pageNumber >= doc.numPages;
    minus.disabled = zoom <= 1; plus.disabled = zoom >= 3; fit.disabled = false;
    find('[data-pdf-page]').textContent = pageNumber + ' / ' + doc.numPages + ' 页';
  }
  async function draw() {
    if (disposed || !doc) return;
    const serial = ++version;
    busy(true); message('正在显示第 ' + pageNumber + ' 页…');
    try {
      if (rendering) { rendering.cancel(); await rendering.promise.catch(() => {}); }
      if (disposed || serial !== version) return;
      const page = await doc.getPage(pageNumber);
      if (disposed || serial !== version) return;
      const original = page.getViewport({scale:1});
      const width = Math.max(200, stage.clientWidth - 24);
      const viewport = page.getViewport({scale:width / original.width * zoom});
      const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6000000 / (viewport.width * viewport.height)));
      canvas.width = Math.max(1, Math.floor(viewport.width * density));
      canvas.height = Math.max(1, Math.floor(viewport.height * density));
      canvas.style.width = viewport.width + 'px'; canvas.style.height = viewport.height + 'px';
      rendering = page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[density,0,0,density,0,0]});
      await rendering.promise;
      if (disposed || serial !== version) return;
      canvas.hidden = false; stage.scrollTop = 0; stage.scrollLeft = 0;
      message('第 ' + pageNumber + ' 页已显示 · ' + Math.round(zoom * 100) + '% · 可放大后拖动查看');
      controls();
    } catch (error) {
      if (disposed || serial !== version) return;
      canvas.hidden = true;
      message('此页暂时无法显示，请重试翻页，或点击“下载原件”用手机 PDF 阅读器打开。');
      controls();
    }
  }
  prev.onclick = () => { pageNumber--; draw(); };
  next.onclick = () => { pageNumber++; draw(); };
  minus.onclick = () => { zoom = Math.max(1, zoom - .5); draw(); };
  plus.onclick = () => { zoom = Math.min(3, zoom + .5); draw(); };
  fit.onclick = () => { zoom = 1; draw(); };
  function resize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 180); }
  window.addEventListener('resize', resize);
  const ready = (async () => {
    busy(true);
    try {
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
      if (disposed) return;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
      loading = pdfjs.getDocument({data:bytes,
        cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
        standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,
        wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,
        isEvalSupported:false,enableXfa:false});
      doc = await loading.promise;
      if (disposed) return;
      controls(); await draw();
    } catch (error) {
      message(error?.name === 'PasswordException'
        ? '这份 PDF 另有文件密码。请下载原件，用手机 PDF 阅读器输入文件密码查看。'
        : 'PDF 预览未成功：文件可能损坏，或浏览器版本过旧。请点击“下载原件”用手机 PDF 阅读器打开，也可换用新版浏览器。');
    }
  })();
  return {ready, dispose() {
    disposed = true; version++; clearTimeout(resizeTimer); window.removeEventListener('resize', resize);
    for (const b of [prev,next,minus,plus,fit]) b.onclick = null;
    if (rendering) rendering.cancel();
    if (loading) Promise.resolve(loading.destroy()).catch(() => {});
    canvas.width = 0; canvas.height = 0; doc = null; bytes = null;
  }};
}
