/* Bump VERSION whenever a cached application file changes. */
const VERSION='ella-voca-20260923-stage-resume';
const ASSETS=['/','/index.html','/styles.css','/app.js','/data/vocabulary.json','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ella-voca-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Keep each app version coherent; a new worker downloads the next version atomically.
  if(!ASSETS.includes(url.pathname))return;
  event.respondWith(caches.open(VERSION).then(async cache=>{
    const cached=await cache.match(url.pathname);if(cached)return cached;
    return fetch(event.request);
  }));
});
