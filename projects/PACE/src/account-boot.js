import {openAccountReset} from './account-reset-dialog.js';
import {openPasswordChange} from './password-change-dialog.js';
import {confirmLocalCopy} from './local-copy-dialog.js';
import {openUnifiedSettings,arrangeAccountActions} from './settings-ui.js';
import {WELCOME_KEY,shouldShowWelcome,signupValidation} from './auth-ui.js';
import {downloadPaceBackup} from './backup.js';
import {appStorage} from './runtime-storage.js';
import {setAppStorage} from './runtime-storage.js';
import {createAccountStore,createSyncEngine,syncPayload,validatePayload,payloadEqual,accountStorageNeedsReload} from './account-store.js';
import {SUPABASE_URL,SUPABASE_KEY} from './supabase-config.js';
import {validatePaceBackup} from './backup-import.js';
import {loadCertifications} from './certifications.js';
import {loadStudy} from './study.js';
import {loadScopedAvailability,loadAvailability} from './availability.js';
import {loadDistributionSettings} from './distribution-settings.js';
import {loadPlanning} from './study-planning.js';
const nativeStorage=window.localStorage;
const box=document.querySelector('.settings-account-row');
const open=document.getElementById('pace-account'),settingsButton=document.getElementById('pace-settings');
const accountLabel=open.querySelector('.account-label');
const backupButton=document.createElement('button');backupButton.id='backup-import-settings';backupButton.hidden=true;backupButton.type='button';document.body.append(backupButton);
const status=document.createElement('p');status.setAttribute('role','status');status.textContent='이 브라우저에 저장';
let client,store,engine,user,debounce,launched=false,transition=false;
const firstVisit=shouldShowWelcome(nativeStorage,null);
const passwordRecovery=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
function validated(payload){validatePayload(payload);const storage={getItem:key=>payload[key]??null};loadCertifications(storage,[]);if(payload['pace.study-plans.v1'])loadStudy(storage);loadScopedAvailability(storage);loadAvailability(storage);loadDistributionSettings(storage);loadPlanning(storage);if(payload['pace.study-plans.v1']&&payload['pace.certifications.v1'])validatePaceBackup(JSON.stringify({format:'pace-local-backup',version:1,rawStorage:payload}));return payload;}
async function sdk(){if(client)return client;const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:nativeStorage,storageKey:'supabase-pace-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client;}
async function connect(){await sdk();const {data,error}=await client.auth.getSession();if(error)throw error;return data.session;}
function remote(id){return {async reset(revision){const {data,error}=await client.rpc('pace_reset_snapshot',{p_expected_user_id:id,p_expected_revision:revision});if(error)throw error;if(!data?.[0])throw Error('서버 응답 오류');return data[0];},async read(){const {data,error}=await client.from('pace_account_data').select('payload,revision').eq('user_id',id).maybeSingle();if(error)throw error;if(data)validated(data.payload);return data;},async save(payload,revision){validated(payload);const {data,error}=await client.rpc('pace_save_snapshot',{p_payload:payload,p_expected_revision:revision});if(error)throw error;if(!data?.[0])throw Error('서버 응답 오류');return data[0];}};}
async function launch(){if(launched)return;launched=true;await import('./app.js');}
async function setup(session){user=session?.user;if(!user){setAppStorage(nativeStorage);await launch();if(firstVisit)showWelcome();return;}accountLabel.textContent='내 계정';const api=remote(user.id);store=createAccountStore(nativeStorage,user.id,()=>{clearTimeout(debounce);status.textContent='동기화 대기';debounce=setTimeout(sync,700);});const cached=store.snapshot();try{const row=await api.read();if(cached.dirty){status.textContent='이 기기의 저장 대기 기록 유지';}else store.adopt(row?.payload||{},row?.revision||0);}catch{status.textContent='서버 연결 실패 · 계정 캐시 사용';}
 setAppStorage(store);engine=createSyncEngine(store,api,text=>{status.textContent=text;status.dataset.warning=/실패|충돌|보존|유지/.test(text)?'true':'false';});await launch();await sync();}
async function sync(){if(!engine||transition)return;if(await engine.sync())location.reload();}
function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
function openAccount(showSettings=false,sourceButton=null,recover=false,mount=null){const dialog=document.createElement(mount?'div':'dialog');dialog.className=mount?'account-management-content':'account-dialog';const head=document.createElement('div');head.className='dialog-top';const title=document.createElement('h2');title.textContent=recover?'새 비밀번호 설정':showSettings||user?'설정':'로그인';head.append(title,button('×',()=>dialog.close()));const message=document.createElement('p');message.setAttribute('role','status');if(!mount)dialog.append(head);const actions=document.createElement('div');actions.className='certification-actions';dialog.append(actions,message);const activeButton=sourceButton||(showSettings?settingsButton:open);if(!mount){activeButton.classList.add('active');activeButton.setAttribute('aria-expanded','true');dialog.addEventListener('close',()=>{activeButton.classList.remove('active');activeButton.setAttribute('aria-expanded','false');dialog.remove();},{once:true});} (mount||document.body).append(dialog);
 const run=async(fn)=>{for(const b of dialog.querySelectorAll('button'))b.disabled=true;try{await fn();}catch(e){message.textContent=({'invalid_credentials':'이메일 또는 비밀번호를 확인해 주세요.','email_not_confirmed':'이메일 인증을 완료한 뒤 로그인해 주세요.','user_already_exists':'이미 가입된 이메일입니다. 로그인해 주세요.','over_email_send_rate_limit':'인증 메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.','weak_password':'더 안전한 비밀번호를 입력해 주세요.'}[e.code])||('처리 실패: '+(e.message||'네트워크 상태를 확인해 주세요.'));}finally{for(const b of dialog.querySelectorAll('button'))b.disabled=b.dataset.resetReady==='false';}};
 if(showSettings||user&&!recover){const section=document.createElement('section');section.className='settings-account-section';const heading=document.createElement('h3');heading.textContent='계정 관리';section.append(heading);dialog.insertBefore(section,actions);section.append(status);if(!user){const hint=document.createElement('p');hint.textContent='로그인하면 계정별 학습 기록을 동기화할 수 있습니다.';section.append(hint,button('로그인 / 회원가입',()=>{dialog.close();openAccount(false);}));}const dataSection=document.createElement('section');dataSection.className='settings-data-section';const dataTitle=document.createElement('h3');dataTitle.textContent='데이터 관리';const dataActions=document.createElement('div');dataActions.className='certification-actions';dataActions.append(button('백업 파일 내보내기',()=>run(async()=>downloadPaceBackup(appStorage))),button('백업 파일 가져오기',()=>{dialog.close();backupButton.click();}));dataSection.append(dataTitle,dataActions);if(!mount)dialog.insertBefore(dataSection,message);actions.classList.add('account-management-actions');}
 if(user&&!recover){const label=document.createElement('p');label.textContent=user.email+' · '+status.textContent;dialog.querySelector('.settings-account-section').insertBefore(label,status);actions.append(button('동기화 다시 시도',()=>run(sync)),button('로그아웃',()=>run(async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;transition=true;store.freeze();location.reload();})),button('로컬 기록을 계정으로 복사',()=>run(async()=>{if(engine.blocked)throw Error('서버 충돌을 먼저 해결해 주세요.');const payload=validated(syncPayload(nativeStorage));const checked=validatePaceBackup(JSON.stringify({format:'pace-local-backup',version:1,rawStorage:payload}));if(!await confirmLocalCopy({items:checked.items,completed:checked.completed}))return;if(!payloadEqual(payload,syncPayload(nativeStorage)))throw Error('로컬 기록이 변경되었습니다. 다시 가져와 주세요.');const row=await remote(user.id).read();store.copy(payload,{serverSnapshot:row});await sync();if(!store.snapshot().dirty&&!engine.blocked){const verified=await remote(user.id).read();if(!verified||!payloadEqual(verified.payload,payload))throw Error('서버 재조회 검증에 실패했습니다.');location.reload();}else location.reload();})));
 actions.append(button('비밀번호 변경',()=>openPasswordChange({changePassword:async(current,next)=>{const verified=await client.auth.signInWithPassword({email:user.email,password:current});if(verified.error)throw verified.error;const changed=await client.auth.updateUser({password:next});if(changed.error)throw changed.error;}})));
 if(engine.blocked){const note=document.createElement('p');note.textContent='충돌한 현재 기록은 보존되어 있습니다. 설정에서 먼저 백업한 뒤 서버 기록을 선택하세요.';dialog.append(note,button('현재 변경 보관 후 서버 기록 불러오기',()=>run(async()=>{if(!confirm('현재 변경을 별도 로컬 사본으로 보관하고 서버 기록을 불러올까요?'))return;const row=await remote(user.id).read();nativeStorage.setItem('pace-account-recovery:'+user.id+':'+Date.now(),JSON.stringify(store.snapshot()));store.replaceFromServer(row?.payload||{},row?.revision||0);location.reload();})));}
  }else if(!showSettings){
 dialog.classList.add('auth-dialog');const form=document.createElement('form'),email=document.createElement('input'),password=document.createElement('input'),confirmation=document.createElement('input');
 email.type='email';email.required=true;email.autocomplete='username';password.type=confirmation.type='password';password.required=true;password.autocomplete='current-password';confirmation.autocomplete='new-password';
 const field=(name,input)=>{const label=document.createElement('label');label.append(name,input);return label;};
 const emailField=field('이메일',email),passwordField=field(recover?'새 비밀번호':'비밀번호',password),confirmationField=field('비밀번호 확인',confirmation);form.append(emailField,passwordField,confirmationField);dialog.insertBefore(form,actions);actions.classList.add('auth-actions');
 const passwordError=document.createElement('span'),confirmationError=document.createElement('span');passwordError.className=confirmationError.className='password-field-error';passwordError.setAttribute('role','status');confirmationError.setAttribute('role','status');passwordField.append(passwordError);confirmationField.append(confirmationError);
 let signup=false;
 const validatePasswords=()=>{passwordError.textContent=confirmationError.textContent='';if(!signup&&!recover)return true;const error=signupValidation(password.value,confirmation.value);if(error){if(password.value.length<8)passwordError.textContent=error;else confirmationError.textContent='비밀번호가 일치하지 않습니다.';return false;}return true;};
 password.addEventListener('input',()=>{if(passwordError.textContent||confirmationError.textContent)validatePasswords();});confirmation.addEventListener('input',()=>{if(passwordError.textContent||confirmationError.textContent)validatePasswords();});
 const submit=()=>run(async()=>{
  message.textContent='';if(!validatePasswords()||!form.reportValidity())return;
  await sdk();
  if(recover){
   const verified=await client.auth.getUser();if(verified.error)throw verified.error;if(!verified.data.user||verified.data.user.id!==user?.id)throw Error('재설정 링크가 만료되었습니다. 다시 요청해 주세요.');
   const changed=await client.auth.updateUser({password:password.value});password.value=confirmation.value='';if(changed.error)throw changed.error;
   message.textContent='비밀번호를 변경했습니다.';form.hidden=true;actions.replaceChildren(button('달력으로 돌아가기',()=>location.reload()));return;
  }
  const {data,error}=signup?await client.auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:location.origin+'/'}}):await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
  password.value=confirmation.value='';if(error)throw error;
  if(signup&&!data.session){message.textContent='가입 요청을 접수했습니다. 이메일의 인증 링크를 확인한 뒤 로그인해 주세요. 이미 가입한 주소라면 로그인하세요.';return;}
  nativeStorage.setItem(WELCOME_KEY,'account');location.reload();
 });
 const requestReset=()=>run(async()=>{
  message.textContent='';if(!email.reportValidity())return;await sdk();const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+'/'});if(error)throw error;message.textContent='가입된 이메일이라면 비밀번호 재설정 메일이 전송됩니다. 받은 메일의 링크를 확인해 주세요.';
 });
 const renderAuth=next=>{
  signup=next;passwordError.textContent=confirmationError.textContent='';title.textContent=recover?'새 비밀번호 설정':signup?'회원가입':'로그인';message.textContent='';password.value=confirmation.value='';password.minLength=signup||recover?8:1;password.autocomplete=signup||recover?'new-password':'current-password';confirmation.required=signup||recover;confirmationField.hidden=!signup&&!recover;emailField.hidden=recover;email.required=!recover;actions.classList.add('auth-login-actions');actions.replaceChildren();
  const primary=button(recover?'비밀번호 변경 저장':signup?'회원가입 완료':'로그인',submit);primary.className='auth-primary';primary.type='submit';
  if(recover)actions.append(primary);else{
   const links=document.createElement('div');links.className='auth-links';const hint=document.createElement('span');hint.textContent=signup?'이미 계정이 있으신가요?':'아직 계정이 없으신가요?';
   const link=button(signup?'로그인':'회원가입',()=>renderAuth(!signup));link.className='auth-link';links.append(hint,link);actions.append(primary,links);
  }
 };
 // Submit buttons live outside the form, so route Enter and clicks through the same validated handler.
 form.onsubmit=e=>{e.preventDefault();submit();};renderAuth(false);
 }

 if(mount&&user){dialog.querySelector('.settings-account-section')?.remove();arrangeAccountActions(actions);const resetRow=document.createElement('div');resetRow.className='settings-account-feature';const resetText=document.createElement('div');resetText.className='settings-account-feature-text';const resetTitle=document.createElement('h4');resetTitle.textContent='계정 데이터 초기화';const resetDescription=document.createElement('p');resetDescription.textContent='계정에 저장된 모든 학습 데이터와 개인 일정을 삭제합니다.';resetText.append(resetTitle,resetDescription);const resetButton=button('초기화',()=>{if(resetButton.dataset.resetReady!=='true')return;const expectedSnapshot=JSON.stringify(store.snapshot()),expectedUser=user.id;openAccountReset({reset:async({confirmed})=>{const verified=await client.auth.getUser();if(verified.error)throw verified.error;if(transition||verified.data.user?.id!==expectedUser||user?.id!==expectedUser)throw Error('로그인 계정이 변경되었습니다. 새로고침해 주세요.');clearTimeout(debounce);await engine.reset({confirmed,expectedSnapshot});},onSuccess:()=>{transition=true;location.reload();}});});resetButton.className='settings-reset-button';resetButton.dataset.resetReady='false';resetButton.disabled=true;const resetSetup=document.createElement('p');resetSetup.textContent='서버 초기화 설정을 확인하고 있습니다.';client.rpc('pace_account_reset_ready').then(({data,error})=>{if(error||data!==1){resetSetup.textContent='서버 초기화 설정이 필요합니다. Supabase에서 account-reset.sql을 먼저 실행해 주세요.';return;}resetSetup.remove();resetButton.dataset.resetReady='true';resetButton.disabled=false;}).catch(()=>{resetSetup.textContent='서버 초기화 설정을 확인하지 못했습니다. 네트워크 연결과 SQL 설정을 확인해 주세요.';});resetRow.append(resetText,resetButton);actions.append(resetRow,resetSetup);status.classList.add('settings-detail-sync');status.dataset.warning=/실패|충돌|보존|유지/.test(status.textContent)?'true':'false';dialog.insertBefore(status,message);}
 if(!mount)dialog.showModal();}
function openSettings(menu,sourceButton){openUnifiedSettings({initialMenu:menu,sourceButton,storage:appStorage,preferenceStorage:nativeStorage,guestStorage:nativeStorage,onGuestReset:()=>location.reload(),user,status,openLogin:()=>openAccount(false,open),renderAccountManagement:mount=>openAccount(true,null,false,mount),logout:async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;transition=true;store.freeze();location.reload();}});}
open.onclick=()=>user?openSettings('account',open):openAccount(false,open);settingsButton.onclick=()=>openSettings('display',settingsButton);
function showWelcome(){
 const screen=document.createElement('section');screen.className='pace-welcome';screen.setAttribute('aria-label','PACE 시작');
 const card=document.createElement('div');card.className='pace-welcome-card';
 const brand=document.createElement('h1');brand.className='pace-welcome-brand';brand.textContent='✦ PACE';
 const service=document.createElement('p');service.className='pace-welcome-service';service.textContent='자격증 학습 일정 관리';
 const controls=document.createElement('div');controls.className='pace-welcome-actions';
 const account=button('로그인 | 회원가입',()=>{nativeStorage.setItem(WELCOME_KEY,'account');openAccount(false,open);});account.className='auth-primary';
 const guest=button('로그인 없이 시작하기',()=>{nativeStorage.setItem(WELCOME_KEY,'guest');screen.remove();});controls.append(account,guest);
 const hint=document.createElement('p');hint.className='pace-welcome-hint';hint.textContent='로그인하면 여러 기기에서 학습 기록을 이어갈 수 있어요.';
 card.append(brand,service,controls,hint);screen.append(card);document.body.append(screen);
}

try{const session=await connect();await setup(session);if(passwordRecovery&&session?.user)openAccount(false,open,true);client.auth.onAuthStateChange((_event,next)=>{if((next?.user?.id||null)!==(user?.id||null)){transition=true;store?.freeze();setTimeout(()=>location.reload(),0);}});}catch(error){status.textContent='인증 연결 실패 · 계정 버튼에서 다시 시도해 주세요.';if(!nativeStorage.getItem('supabase-pace-auth')){setAppStorage(nativeStorage);await launch();if(firstVisit)showWelcome();}else{const p=document.createElement('p');p.textContent='로그인 상태를 확인하지 못했습니다. 계정 데이터를 보호하기 위해 화면 로딩을 중단했습니다.';document.querySelector('main')?.append(p);p.append(button('다시 불러오기',()=>location.reload()));}}
window.addEventListener('online',sync);window.addEventListener('focus',sync);setInterval(()=>{if(document.visibilityState==='visible')sync();},30000);
window.addEventListener('beforeunload',e=>{if(!transition&&store?.snapshot().dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(accountStorageNeedsReload(e,user?.id)){transition=true;store?.freeze();location.reload();}});
