export interface OfflineState { ready:boolean; working:boolean; update:boolean; message:string; detail?:string; version?:string; authRequired?:boolean; }
let state:OfflineState={ready:false,working:false,update:false,message:'準備離線內容'};
let listener:(s:OfflineState)=>void=()=>{};
let registration:ServiceWorkerRegistration|undefined;
let timeout:ReturnType<typeof setTimeout>|undefined, listening=false, repairing=false;
const watchedWorkers=new WeakSet<ServiceWorker>(), watchedRegistrations=new WeakSet<ServiceWorkerRegistration>();
const send=(next:Partial<OfflineState>)=>{state={...state,...next};if(!state.working)clearTimeout(timeout);listener(state);};
function downloading(message:string){
  clearTimeout(timeout);send({working:true,message,detail:undefined,authRequired:false});
  timeout=setTimeout(()=>send({working:false,message:state.ready?'已可離線遊玩 · 更新逾時':'下載等候逾時，請保持連網後重試',detail:'若仍無法完成，請回報這個畫面上的提示。'}),45000);
}
function check(){registration?.active?.postMessage({type:'CHECK_OFFLINE'});}
async function updateFailed(error:unknown){
  let authRequired=false;
  try{
    // Worker registration errors do not expose an HTTP status consistently across browsers.
    const response=await fetch('/sw.js',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(5000)});
    authRequired=response.status===401||response.status===403||response.redirected||!!response.headers.get('content-type')?.includes('text/html');
  }catch{/* Being offline does not mean the login expired. */}
  send({working:false,authRequired,message:authRequired?(state.ready?'已可離線遊玩 · 請重新登入以更新':'請重新登入以下載離線內容'):(state.ready?'已可離線遊玩 · 無法檢查更新':'無法啟用離線下載'),detail:authRequired?'請登入原本用來遊玩的帳號，完成後會回到遊戲。':(error as Error).message});
}
function watchWorker(worker:ServiceWorker|null){
  if(!worker||watchedWorkers.has(worker))return;
  watchedWorkers.add(worker);
  const changed=()=>{
    if(worker.state==='installed'&&registration?.active&&registration.active!==worker)send({update:true,working:false,message:state.ready?'已可離線遊玩 · 有新版本':'新版本已下載，請套用更新',detail:undefined});
    if(worker.state==='activated')check();
    if(worker.state==='redundant'&&state.working)send({working:false,message:state.ready?'已可離線遊玩 · 更新未完成':'下載未完成，請連網後重試'});
  };
  worker.addEventListener('statechange',changed);changed();
}
export function watchOffline(callback:(s:OfflineState)=>void){listener=callback;callback(state);}
export async function prepareOffline(){
  if(state.working)return;
  if(!import.meta.env.PROD){send({message:'本機預覽',working:false});return;}
  if(!('serviceWorker' in navigator)){send({message:'此瀏覽器不支援離線安裝'});return;}
  repairing=false;
  downloading('正在檢查離線內容…');
  if(!listening){
    listening=true;
    navigator.serviceWorker.addEventListener('message',event=>{
      const data=event.data;
      if(data?.type==='OFFLINE_PROGRESS')downloading(`正在下載離線內容 ${data.done}/${data.total}`);
      if(data?.type==='OFFLINE_ERROR')send({working:false,authRequired:!!data.authRequired,message:data.authRequired?'請重新登入以更新':state.ready?'已可離線遊玩 · 更新未完成':data.message,detail:data.detail});
      if(data?.type==='OFFLINE_READY')send({ready:true,working:false,version:data.version,message:state.authRequired?'已可離線遊玩 · 請重新登入以更新':state.update?'已可離線遊玩 · 有新版本':'已可離線遊玩',detail:state.authRequired?state.detail:undefined});
      if(data?.type==='OFFLINE_MISSING'){
        send({ready:false});
        if(data.repaired)send({working:false,message:'離線內容未能完整保存，請重試',detail:data.missing});
        else if(!repairing){repairing=true;downloading('正在補齊離線內容…');registration?.active?.postMessage({type:'PREPARE_OFFLINE'});}
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange',check);
  }
  try{
    registration=await navigator.serviceWorker.getRegistration('/');check();
    registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
    if(!watchedRegistrations.has(registration)){
      watchedRegistrations.add(registration);
      registration.addEventListener('updatefound',()=>watchWorker(registration!.installing));
    }
    watchWorker(registration.installing);watchWorker(registration.waiting);check();
    if(registration.active&&!registration.installing&&!registration.waiting)await registration.update();
    void navigator.storage?.persist?.().catch(()=>{});
  }catch(error){await updateFailed(error);}
}
export async function checkForUpdates(){
  if(!registration?.active||!state.ready||state.working||state.update)return;
  downloading('正在檢查更新…');
  try{
    await registration.update();
    watchWorker(registration.installing);watchWorker(registration.waiting);
    if(!registration.installing&&!registration.waiting)send({working:false,message:'已可離線遊玩 · 已是最新版本'});
  }catch(error){await updateFailed(error);}
}
export function applyUpdate(){
  if(!registration?.waiting)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
  registration.waiting.postMessage({type:'ACTIVATE'});
}
