const CACHE_NAME = 'au-trip-photo-v36';
const SOUVENIR_ASSETS = [
  'airlie-gallery','airlie-magnet','apollo-art','apollo-candy','apollo-homewares',
  'aquabumps-book','koko-black','melbourne-tram','opera-teatowel','phillip-penguin',
  'puffing-billy','squidinki-coasters','sydney-magnet','taronga-pinz'
].map(name => './assets/souvenirs/' + name + '.webp');
const CORE_ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...SOUVENIR_ASSETS];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('au-trip-photo-') && key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if(!event.data || event.data.type !== 'OFFLINE_STATUS' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    const found = await Promise.all(CORE_ASSETS.map(url => cache.match(url)));
    event.ports[0].postMessage({type:'OFFLINE_STATUS',version:CACHE_NAME,ready:found.every(Boolean),photos:SOUVENIR_ASSETS.length});
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;
  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request).then(response => {
        if(response.ok){
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy)));
        }
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if(response && response.ok){
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    }))
  );
});
