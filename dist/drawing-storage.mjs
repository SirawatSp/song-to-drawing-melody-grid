const KEY='singing-sketchbook-sequence-v1';
let connection;
function database(){
  if(!globalThis.indexedDB)return Promise.resolve(null);
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('singing-sketchbook',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return connection;
}
export async function loadDraft(){
  try{
    const db=await database();
    if(db){const value=await new Promise((resolve,reject)=>{const request=db.transaction('drafts').objectStore('drafts').get('sequence');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(value)return value;}
  }catch{}
  return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('singing-sketchbook-v1')||'null');
}
export async function saveDraft(project){
  let db;try{db=await database();}catch{}
  if(!db){localStorage.setItem(KEY,JSON.stringify(project));return;}
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(project,'sequence');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Saving interrupted.'));
  });
}
