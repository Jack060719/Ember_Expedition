import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../src/offline.ts',import.meta.url),'utf8').replace('import.meta.env.PROD','true'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(manifestUrl='https://example.test/manifest.webmanifest'){
  const worker=Object.assign(new EventTarget(),{state:'installing',postMessage(){}});
  const registration=Object.assign(new EventTarget(),{installing:worker as typeof worker|null,active:null as typeof worker|null,waiting:null as typeof worker|null,update:async()=>{}});
  let registerCall:any, lookupScope:string|undefined;
  const serviceWorker=Object.assign(new EventTarget(),{register:async(...args:any[])=>{registerCall=args;return registration;},getRegistration:async(scope:string)=>{lookupScope=scope;return registration;},ready:new Promise(()=>{})});
  let response={status:200,redirected:false,headers:{get:()=> 'text/javascript'}};
  const timers=new Map<number,()=>void>();let id=0,state:any;
  const context=vm.createContext({exports:{},navigator:{serviceWorker},document:{querySelector:()=>({href:manifestUrl})},AbortSignal,URL,fetch:async()=>response,setTimeout(callback:()=>void){timers.set(++id,callback);return id;},clearTimeout(key:number){timers.delete(key);}});
  vm.runInContext(source,context);
  context.exports.watchOffline((next:any)=>{state=next;});
  return {api:context.exports,worker,registration,serviceWorker,context,timers,setResponse(next:typeof response){response=next;},message(data:object){serviceWorker.dispatchEvent(Object.assign(new Event('message'),{data}));},get registerCall(){return registerCall;},get lookupScope(){return lookupScope;},get state(){return state;}};
}
test('GitHub Pages repository paths scope the service worker under the project directory',async()=>{
  const f=fixture('https://example.test/ember-expedition/manifest.webmanifest');await f.api.prepareOffline();
  assert.equal(f.lookupScope,'/ember-expedition/');
  assert.equal(f.registerCall[0],'/ember-expedition/sw.js');
  assert.equal(f.registerCall[1].scope,'/ember-expedition/');
  assert.equal(f.registerCall[1].updateViaCache,'none');
});
test('an already installing worker reports failure instead of waiting for ready forever',{timeout:1000},async()=>{
  const f=fixture();await f.api.prepareOffline();
  f.worker.state='redundant';f.worker.dispatchEvent(new Event('statechange'));
  assert.equal(f.state.working,false);assert.equal(f.state.ready,false);assert.match(f.state.message,/下載未完成/);
});
test('unresponsive offline setup times out and allows another attempt',async()=>{
  const f=fixture();await f.api.prepareOffline();
  assert.equal(f.timers.size,1);[...f.timers.values()][0]();
  assert.equal(f.state.working,false);assert.match(f.state.message,/逾時/);
  await f.api.prepareOffline();
  assert.equal(f.state.working,true);
});

test('manual update check keeps the installed version and reports when no update exists',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  await f.api.prepareOffline();f.message({type:'OFFLINE_READY',version:'installed-version'});
  let checks=0;f.registration.update=async()=>{checks++;};
  await f.api.checkForUpdates();
  assert.equal(checks,1);assert.equal(f.state.version,'installed-version');
  assert.equal(f.state.ready,true);assert.equal(f.state.working,false);assert.match(f.state.message,/已是最新版本/);
});

test('failed update check preserves offline play and exposes the error for retry',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  await f.api.prepareOffline();f.message({type:'OFFLINE_READY',version:'installed-version'});
  f.registration.update=async()=>{throw new Error('HTTP 401');};
  await f.api.checkForUpdates();
  assert.equal(f.state.ready,true);assert.equal(f.state.working,false);assert.equal(f.state.version,'installed-version');
  assert.match(f.state.message,/無法檢查更新/);assert.match(f.state.detail,/401/);
});

test('update check exposes a waiting version without activating it or claiming the installed version changed',async()=>{
  const f=fixture();f.registration.installing=null;
  f.registration.active=Object.assign(new EventTarget(),{state:'activated',postMessage(){}});
  await f.api.prepareOffline();f.message({type:'OFFLINE_READY',version:'installed-version'});
  let activations=0;f.worker.postMessage=()=>{activations++;};
  f.registration.update=async()=>{f.worker.state='installed';f.registration.waiting=f.worker;};
  await f.api.checkForUpdates();
  assert.equal(f.state.update,true);assert.equal(f.state.working,false);assert.match(f.state.message,/有新版本/);
  assert.equal(f.state.version,'installed-version');assert.equal(activations,0);
});

test('expired login during startup preserves the installed worker and exposes sign-in even after its cache reply',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  let checks=0;f.worker.postMessage=()=>{checks++;};
  f.serviceWorker.register=async()=>{throw new Error('Worker registration failed');};
  f.setResponse({status:401,redirected:false,headers:{get:()=> 'text/html'}});
  await f.api.prepareOffline();
  assert.equal(checks,1);assert.equal(f.state.authRequired,true);
  f.message({type:'OFFLINE_READY',version:'old-cache'});
  assert.equal(f.state.ready,true);assert.equal(f.state.version,'old-cache');
  assert.equal(f.state.authRequired,true);assert.match(f.state.message,/重新登入/);
});

test('login HTML during update exposes recovery and a successful retry clears the login warning',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  await f.api.prepareOffline();f.message({type:'OFFLINE_READY',version:'old-cache'});
  f.registration.update=async()=>{throw new Error('Invalid worker MIME type');};
  f.setResponse({status:200,redirected:false,headers:{get:()=> 'text/html'}});
  await f.api.checkForUpdates();
  assert.equal(f.state.authRequired,true);assert.equal(f.state.ready,true);
  f.registration.update=async()=>{};
  await f.api.checkForUpdates();
  assert.equal(f.state.authRequired,false);assert.equal(f.state.version,'old-cache');
  assert.match(f.state.message,/已是最新版本/);
});

test('a disconnected update does not claim the login expired',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  await f.api.prepareOffline();f.message({type:'OFFLINE_READY',version:'old-cache'});
  f.registration.update=async()=>{throw new Error('Network unavailable');};
  f.context.fetch=async()=>{throw new Error('Offline');};
  await f.api.checkForUpdates();
  assert.equal(f.state.authRequired,false);assert.equal(f.state.ready,true);
  assert.match(f.state.message,/無法檢查更新/);
});

test('startup explicitly checks an existing worker even when registration itself succeeds',async()=>{
  const f=fixture();f.registration.installing=null;f.registration.active=f.worker;
  let checks=0;f.registration.update=async()=>{checks++;throw new Error('Forbidden');};
  f.setResponse({status:403,redirected:false,headers:{get:()=> 'text/html'}});
  await f.api.prepareOffline();
  assert.equal(checks,1);assert.equal(f.state.authRequired,true);
});
