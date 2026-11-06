/* Incheve back office: open even without internet (app shell cache). Data sync is done by Firestore. */
const C="incheve-v4";const SHELL=["./","index.html","config.js","shim.js","manifest.json","icon-192.png","favicon-32.png","icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);
  const shell=u.origin===location.origin;const lib=/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(u.href);
  if(!shell&&!lib)return;if(shell&&u.pathname.startsWith("/__/"))return;
  if(shell){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html"))));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));return res})))});
