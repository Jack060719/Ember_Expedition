export interface OfflineState { ready:boolean; working:boolean; update:boolean; message:string; }
let state:OfflineState={ready:false,working:false,update:false,message:'準備離線內容'};
let listener:(s:OfflineState)=>void=()=>{};
let registration:ServiceWorkerRegistration|undefined;
const send=(next:Partial<OfflineState>)=>{state={...state,...next};listener(state);};
export function watchOffline(callback:(s:OfflineState)=>void){listener=callback;callback(state);}
export async function prepareOffline(){
  if(!import.meta.env.PROD){send({message:'本機預覽',working:false});return;}
  if(!('serviceWorker' in navigator)){send({message:'此瀏覽器不支援離線安裝'});return;}
  send({working:true,message:'正在準備離線內容…'});
  try{
    registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.data?.type==='OFFLINE_READY')send({ready:true,working:false,message:'已可離線遊玩'});
      if(event.data?.type==='OFFLINE_MISSING')send({ready:false,working:false,message:'離線內容未完整，請連網重試'});
    });
    registration.addEventListener('updatefound',()=>{
      const worker=registration?.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'){
          if(navigator.serviceWorker.controller)send({update:true,working:false,message:state.ready?'已可離線遊玩 · 有新版本':'新版本已下載'});
          else worker.postMessage({type:'CHECK_OFFLINE'});
        }
        if(worker.state==='redundant'&&!state.ready)send({working:false,message:'下載未完成，連網後可重試'});
      });
    });
    const ready=await navigator.serviceWorker.ready;
    ready.active?.postMessage({type:'CHECK_OFFLINE'});
    if(registration.waiting)send({update:true});
    navigator.serviceWorker.addEventListener('controllerchange',()=>navigator.serviceWorker.controller?.postMessage({type:'CHECK_OFFLINE'}));
    void navigator.storage?.persist?.();
  }catch{send({working:false,message:state.ready?'已可離線遊玩':'暫時無法下載，請連網後重試'});}
}
export function applyUpdate(){
  if(!registration?.waiting)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
  registration.waiting.postMessage({type:'ACTIVATE'});
}
