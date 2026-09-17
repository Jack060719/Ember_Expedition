import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(readFileSync(new URL('../src/offline.ts',import.meta.url),'utf8').replace('import.meta.env.PROD','true'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){
  const worker=Object.assign(new EventTarget(),{state:'installing',postMessage(){}});
  const registration=Object.assign(new EventTarget(),{installing:worker,active:null,waiting:null});
  const serviceWorker=Object.assign(new EventTarget(),{register:async()=>registration,ready:new Promise(()=>{})});
  const timers=new Map<number,()=>void>();let id=0,state:any;
  const context=vm.createContext({exports:{},navigator:{serviceWorker},setTimeout(callback:()=>void){timers.set(++id,callback);return id;},clearTimeout(key:number){timers.delete(key);}});
  vm.runInContext(source,context);
  context.exports.watchOffline((next:any)=>{state=next;});
  return {api:context.exports,worker,timers,get state(){return state;}};
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
