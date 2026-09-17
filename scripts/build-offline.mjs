import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=path.resolve('dist');
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(full));else if(e.name!=='sw.js')out.push(full);}return out;}
const entries=await files(root), digest=createHash('sha256');
for(const file of entries.sort())digest.update(await readFile(file));
const version=digest.digest('hex').slice(0,12);
const urls=entries.map(file=>'/'+path.relative(root,file).replaceAll('\\','/'));
const script=`const CACHE='ember-${version}';
const FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try {
    for(const url of FILES){
      const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin'}));
      if(!response.ok||response.redirected)throw new Error('Asset unavailable: '+url);
      const type=response.headers.get('content-type')||'';
      if(/\\.(js|css|png|jpg|webp|json)$/.test(url)&&type.includes('text/html'))throw new Error('Unexpected sign-in page');
      await cache.put(url,response);
    }
  }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('ember-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||event.request.method!=='GET')return;
  if(event.request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/index.html'))||fetch(event.request)));return;
  }
  if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE')self.skipWaiting();
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);let ready=true;
    for(const url of FILES)if(!await cache.match(url)){ready=false;break;}
    event.source?.postMessage({type:ready?'OFFLINE_READY':'OFFLINE_MISSING',version:'${version}'});
  })());
});
`;
await writeFile(path.join(root,'sw.js'),script);
console.log('Offline cache:',urls.length,'files, version',version);
