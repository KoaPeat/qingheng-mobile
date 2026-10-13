// Cache only publicly distributable app files, never personal food/weight data.
const CACHE='qingheng-offline-v1';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('qingheng-offline-') && k !== CACHE).map(k => caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch', e => {
  const req=e.request;
  if (req.method!=='GET'||new URL(req.url).origin!==location.origin) return;
  if(req.mode==='navigate') {
    e.respondWith(fetch(req).then(r => {if(r.ok) {const copy=r.clone();caches.open(CACHE).then(c => c.put('./index.html',copy));}return r;}).catch(() => caches.match('./index.html')));
  } else {
    e.respondWith(caches.match(req).then(cached => cached || fetch(req)));
  }
});
