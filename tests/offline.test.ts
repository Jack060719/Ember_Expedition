import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../src/offline.ts',import.meta.url),'utf8').replace('import.meta.env.PROD','true'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){
  const worker=Object.assign(new EventTarget(),{state:'installing',postMessage(){}});
  const registration=Object.assign(new EventTarget(),{installing:worker as typeof worker|null,active:null as typeof worker|null,waiting:null as typeof worker|null,update:async()=>{}});
  const serviceWorker=Object.assign(new EventTarget(),{register:async()=>registration,ready:new Promise(()=>{})});
  const timers=new Map<number,()=>void>();let id=0,state:any;
  const context=vm.createContext({exports:{},navigator:{serviceWorker},setTimeout(callback:()=>void){timers.set(++id,callback);return id;},clearTimeout(key:number){timers.delete(key);}});
  vm.runInContext(source,context);
  context.exports.watchOffline((next:any)=>{state=next;});
  return {api:context.exports,worker,registration,timers,message(data:object){serviceWorker.dispatchEvent(Object.assign(new Event('message'),{data}));},get state(){return state;}};
}
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
