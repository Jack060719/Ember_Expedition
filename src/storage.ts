import { initialSave, validateSave, type Save } from './core.ts';
const dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('ember-expedition',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('save');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('無法開啟本機存檔，請確認不是私密瀏覽，並保留足夠儲存空間。'));
});
export async function loadSave(): Promise<Save> {
  const db=await dbPromise;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('save','readonly'), request=tx.objectStore('save').get('current');
    request.onsuccess=()=>{try{resolve(request.result?validateSave(request.result):initialSave());}catch(e){reject(e);}};
    request.onerror=()=>reject(new Error('讀取存檔失敗。請重新開啟遊戲。'));
  });
}
export async function writeSave(save:Save): Promise<void> {
  const db=await dbPromise;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('save','readwrite');
    tx.objectStore('save').put(save,'current');
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(new Error('存檔失敗，請先匯出備份並檢查裝置空間。'));
    tx.onabort=()=>reject(new Error('存檔中斷。進度尚未寫入，請重試。'));
  });
}
