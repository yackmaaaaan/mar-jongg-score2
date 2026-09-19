const CACHE="mahjong-4p-complete-v5";
const TILES=["1m","2m","3m","4m","5m","6m","7m","8m","9m","1p","2p","3p","4p","5p","6p","7p","8p","9p","1s","2s","3s","4s","5s","6s","7s","8s","9s","1z","2z","3z","4z","5z","6z","7z"];
const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./icon/app-icon-192.png","./icon/app-icon-512.png","./title/mahjong.svg","./title/calculator.svg","./title/hand.svg","./tiles/tile-back.svg",...TILES.map(x=>`./tiles/${x}.svg`)];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
