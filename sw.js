const CACHE_NAME = 'au-trip-photo-v46';
const SOUVENIR_ASSETS = [
  'airlie-gallery','airlie-magnet','apollo-art','apollo-candy','apollo-homewares',
  'aquabumps-book','koko-black','melbourne-tram','opera-teatowel','phillip-penguin',
  'puffing-billy','squidinki-coasters','sydney-magnet','taronga-pinz'
].map(name => './assets/souvenirs/' + name + '.webp');
const CORE_ASSETS = ['./', './index.html', './tickets.html', './ticket-vault-builder.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...SOUVENIR_ASSETS];

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

let repairInFlight = null;
async function resourceStatus(cache){
  const found = await Promise.all(CORE_ASSETS.map(url => cache.match(url)));
  return {type:'OFFLINE_STATUS',version:CACHE_NAME,ready:found.every(r=>r && r.ok),photos:SOUVENIR_ASSETS.length,missing:found.filter(r=>!r || !r.ok).length};
}
async function repairResources(cache, port){
  const failed=[];
  for(let i=0;i<CORE_ASSETS.length;i++){
    const url=CORE_ASSETS[i], cached=await cache.match(url);
    if(!cached || !cached.ok){
      try{
        const response=await fetch(url,{cache:'reload'});
        if(!response.ok) throw new Error('download failed');
        await cache.put(url,response);
      }catch(_){failed.push(url);}
    }
    port.postMessage({type:'OFFLINE_PROGRESS',done:i+1,total:CORE_ASSETS.length});
  }
  return {...await resourceStatus(cache),failed:failed.length};
}
self.addEventListener('message', event => {
  const type=event.data && event.data.type, port=event.ports && event.ports[0];
  if(!['OFFLINE_STATUS','OFFLINE_REPAIR'].includes(type) || !port) return;
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE_NAME);
      if(type==='OFFLINE_REPAIR'){
        if(!repairInFlight) repairInFlight=repairResources(cache,port).finally(()=>{repairInFlight=null;});
        port.postMessage(await repairInFlight);
      }else port.postMessage(await resourceStatus(cache));
    }catch(_){port.postMessage({type:'OFFLINE_STATUS',version:CACHE_NAME,ready:false,error:true});}
  })());
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
