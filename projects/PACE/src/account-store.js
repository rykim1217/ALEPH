export const SYNC_KEYS=['pace.certifications.v1','pace.study-plans.v1','pace.availability.v1','pace.availability.v2','pace.planning-settings.v1','pace.distribution-settings.v1','pace.personal-events.v1'];
// Refreshing a token for the same user must not freeze an active study form.
export function accountStorageNeedsReload(event,userId){
 if(event.key==='supabase-pace-auth'){
  try{return (JSON.parse(event.newValue||'null')?.user?.id||null)!==(userId||null);}catch{return true;}
 }
 return !!userId&&event.key==='pace-account-cache:'+userId&&event.oldValue!==event.newValue;
}
export function payloadEqual(a,b){return JSON.stringify(Object.entries(a).sort(([x],[y])=>x.localeCompare(y)))===JSON.stringify(Object.entries(b).sort(([x],[y])=>x.localeCompare(y)));}
export function syncPayload(storage){return Object.fromEntries(SYNC_KEYS.filter(key=>storage.getItem(key)!==null).map(key=>[key,storage.getItem(key)]));}
export function validatePayload(payload){if(!payload||Array.isArray(payload)||typeof payload!=='object')throw Error('계정 데이터 형식 오류');for(const [key,value] of Object.entries(payload)){if(!SYNC_KEYS.includes(key)||typeof value!=='string')throw Error('허용되지 않은 계정 데이터');JSON.parse(value,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('잘못된 필드');return v;});}return payload;}
export function createAccountStore(storage,userId,onChange=()=>{}){
 const key='pace-account-cache:'+userId;let envelope=JSON.parse(storage.getItem(key)||'null')||{payload:{},revision:0,dirty:false};validatePayload(Object.fromEntries(Object.entries(envelope.payload).filter(([k])=>SYNC_KEYS.includes(k))));
 let frozen=false,locked=false;
 const persist=next=>{if(frozen)throw Error('계정이 변경되었습니다. 새로고침해 주세요.');const disk=storage.getItem(key);if(disk!==last)throw Error('다른 탭에서 데이터가 변경되었습니다. 새로고침해 주세요.');storage.setItem(key,JSON.stringify(next));last=storage.getItem(key);envelope=next;};let last=storage.getItem(key);
 const change=(name,value,remove=false)=>{if(locked)throw Error('계정 초기화 확인 중입니다. 잠시 후 다시 시도해 주세요.');const payload={...envelope.payload};if(remove)delete payload[name];else payload[name]=String(value);persist({...envelope,payload,dirty:SYNC_KEYS.includes(name)||envelope.dirty});onChange();};
 return {get length(){return Object.keys(envelope.payload).length;},key:index=>Object.keys(envelope.payload)[index]??null,getItem:name=>envelope.payload[name]??null,setItem:(name,value)=>{if(!name.startsWith('pace.'))throw Error('잘못된 저장 키');change(name,value);},removeItem:name=>change(name,null,true),snapshot:()=>structuredClone(envelope),freeze:()=>{frozen=true;},lock:()=>{locked=true;},unlock:()=>{locked=false;},
 resetConfirmed(revision){persist({payload:{},revision,dirty:false});frozen=true;},
 adopt(payload,revision){if(envelope.dirty)throw Error('저장 대기 데이터가 있습니다.');validatePayload(payload);const next={...envelope.payload};for(const k of SYNC_KEYS)delete next[k];persist({payload:{...next,...payload},revision,dirty:false});},
 replaceFromServer(payload,revision){validatePayload(payload);const next={...envelope.payload};for(const k of SYNC_KEYS)delete next[k];persist({payload:{...next,...payload},revision,dirty:false});},
 acknowledge(payload,revision){persist({...envelope,revision,dirty:!payloadEqual(syncPayload(this),payload)});},
 copy(payload,{serverSnapshot}={}){
 if(locked)throw Error('계정 초기화 확인 중입니다. 잠시 후 다시 시도해 주세요.');
 if(envelope.dirty||Object.keys(syncPayload(this)).length)throw Error('계정 데이터 또는 저장 대기 기록이 있어 복사를 중단했습니다.');
 let revision=envelope.revision;
 if(serverSnapshot!==undefined){
  if(serverSnapshot!==null){validatePayload(serverSnapshot.payload);if(Object.keys(serverSnapshot.payload).length)throw Error('계정에 이미 서버 데이터가 있습니다. 자동 교체하지 않습니다.');}
  revision=serverSnapshot?.revision??0;
  if(!Number.isSafeInteger(revision)||revision<0||(serverSnapshot!==null&&revision===0)||revision<envelope.revision)throw Error('서버 revision이 변경되었습니다. 서버 기록을 다시 확인해 주세요.');
 }
 validatePayload(payload);persist({...envelope,revision,payload:{...envelope.payload,...payload},dirty:true});onChange();
 }
 };
}
export function createSyncEngine(store,remote,onStatus=()=>{}){
 let busy=false,blocked=false;
 return {get blocked(){return blocked;},
 async reset({confirmed=false,expectedSnapshot}={}){
  if(!confirmed)throw Error('초기화 동의가 필요합니다.');
  if(busy)throw Error('동기화 중입니다. 완료 후 다시 시도해 주세요.');
  if(blocked)throw Error('동기화 오류 또는 충돌을 먼저 확인해 주세요. 백업 후 서버 기록을 다시 불러와 주세요.');
  const before=store.snapshot();if(JSON.stringify(before)!==expectedSnapshot)throw Error('계정 기록이 변경되었습니다. 확인창을 다시 열어 주세요.');
  busy=true;store.lock();onStatus('계정 초기화 확인 중');
  try{
   const saved=await remote.reset(before.revision);
   if(!Number.isSafeInteger(saved?.revision)||saved.revision<=before.revision)throw Error('서버 revision 확인 실패');
   const row=await remote.read();if(row?.revision!==saved.revision||!payloadEqual(validatePayload(row.payload),{}))throw Error('서버 초기화 재조회 확인 실패');
   store.resetConfirmed(saved.revision);onStatus('계정 초기화 완료');return true;
  }catch(error){blocked=true;onStatus(error.code==='40001'?'서버 충돌 · 기존 기록은 기기에 보존됩니다. 백업 후 서버 기록을 확인해 주세요.':'초기화 확인 실패 · 기존 기록은 기기에 보존됩니다. 백업 후 서버 기록을 확인해 주세요.');throw Error(error.code==='40001'?'서버 기록이 변경되어 초기화하지 못했습니다. 백업 후 서버 기록을 다시 불러와 주세요.':'초기화 완료를 확인하지 못했습니다. 서버에 반영됐을 수도 있습니다. 현재 기록을 백업한 뒤 서버 기록을 확인해 주세요.');}
  finally{store.unlock();busy=false;}
 },async sync(){if(busy||blocked)return false;busy=true;try{const before=store.snapshot();if(before.dirty){onStatus('동기화 중');const payload=syncPayload(store),row=await remote.save(payload,before.revision);store.acknowledge(payload,row.revision);onStatus(store.snapshot().dirty?'동기화 대기':'동기화 완료');return false;}const row=await remote.read();if((row?.revision||0)!==before.revision){store.adopt(row?.payload||{},row?.revision||0);return true;}onStatus('동기화 완료');return false;}catch(error){if(error.code==='40001'){blocked=true;onStatus('서버 충돌 · 현재 변경은 기기에 보존됩니다. 백업 후 확인해 주세요.');}else onStatus('동기화 실패 · 변경은 기기에 보존됩니다. 다시 시도해 주세요.');return false;}finally{busy=false;}}};
}
