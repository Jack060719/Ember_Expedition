import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=path.resolve('dist');
const base=process.env.VITE_BASE_PATH||'/';
const basePath=base.endsWith('/')?base:`${base}/`;
const manifestPath=path.join(root,'manifest.webmanifest');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.id=basePath;manifest.start_url=basePath;manifest.scope=basePath;
for(const icon of manifest.icons)icon.src=`${basePath}${icon.src.replace(/^\/+/,'')}`;
await writeFile(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,e.name);if(e.isDirectory())out.push(...await files(full));else if(e.name!=='sw.js')out.push(full);}return out;}
const entries=await files(root), digest=createHash('sha256');
for(const file of entries.sort())digest.update(await readFile(file));
digest.update(await readFile(new URL(import.meta.url)));
const version=digest.digest('hex').slice(0,12);
const urls=entries.map(file=>file===path.join(root,'index.html')?basePath:`${basePath}${path.relative(root,file).replaceAll('\\','/')}`);
const script=`const CACHE='ember-${version}';
const BASE=${JSON.stringify(basePath)};
const FILES=${JSON.stringify(urls)};
let download;
async function notify(message){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(message);}
function failure(message,detail,authRequired=false){return Object.assign(new Error(message),{detail,authRequired});}
function prepare(installing=false){
  if(download)return download;
  download=(async()=>{
    const cache=await caches.open(CACHE);let done=0;
    for(const url of FILES){
      if(!await cache.match(url)){
        const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),20000);
        try{
          const response=await fetch(new Request(url,{cache:'reload',credentials:'same-origin',signal:controller.signal}));
          const type=response.headers.get('content-type')||'';
          if(response.status===401||response.status===403||response.redirected)throw failure('登入驗證未通過，請連網重新開啟遊戲',url+' · HTTP '+response.status,true);
          if(!response.ok)throw failure('部分內容下載失敗，請重試',url+' · HTTP '+response.status);
          if(url===BASE){
            if(!type.includes('text/html')||!(await response.clone().text()).includes('<meta name="application-name" content="Ember Expedition"'))throw failure('取得登入頁面，請重新登入遊戲',url,true);
          }else if(type.includes('text/html'))throw failure('取得登入頁面，請重新登入遊戲',url,true);
          await cache.put(url,response);
        }catch(error){
          if(error.detail)throw error;
          throw failure(error.name==='QuotaExceededError'?'手機儲存空間不足，請先釋出空間':error.name==='AbortError'?'下載逾時，請連網後重試':'無法儲存離線內容，請重試',url+' · '+error.message);
        }finally{clearTimeout(timer);}
      }
      await notify({type:'OFFLINE_PROGRESS',done:++done,total:FILES.length});
    }
  })().catch(async error=>{if(installing)await caches.delete(CACHE);await notify({type:'OFFLINE_ERROR',message:error.message,detail:error.detail,authRequired:error.authRequired});throw error;}).finally(()=>{download=null;});
  return download;
}
async function check(client,repaired=false){
  const cache=await caches.open(CACHE);let missing;
  for(const url of FILES)if(!await cache.match(url)){missing=url;break;}
  client?.postMessage({type:missing?'OFFLINE_MISSING':'OFFLINE_READY',missing,repaired,version:'${version}'});
}
self.addEventListener('install',event=>event.waitUntil(prepare(true)));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('ember-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||event.request.method!=='GET')return;
  if(event.request.mode==='navigate'&&(url.pathname===BASE||url.pathname===BASE+'index.html')){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(BASE))||fetch(event.request)));return;
  }
  if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE')self.skipWaiting();
  if(event.data?.type==='CHECK_OFFLINE')event.waitUntil(check(event.source));
  if(event.data?.type==='PREPARE_OFFLINE')event.waitUntil(prepare().then(()=>check(event.source,true)).catch(()=>{}));
});
`;
await writeFile(path.join(root,'sw.js'),script);
console.log('Offline cache:',urls.length,'files, version',version);
