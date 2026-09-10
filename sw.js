const CACHE='case-lab-v4';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./assets/logo-header.png','./assets/favicon.png','./assets/logo-loader.png']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.pathname.startsWith('/api/'))return; e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
