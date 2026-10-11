import {SYNC_KEYS} from './account-store.js';
export const WELCOME_KEY='pace-ui-welcome.v1';
export function shouldShowWelcome(storage,session){
 if(session?.user||storage.getItem(WELCOME_KEY))return false;
 // Conservatively preserve access to every existing local workspace, including malformed data.
 return !SYNC_KEYS.some(key=>storage.getItem(key)!==null)&&storage.getItem('pace.before-catalog-migration.v1')===null;
}
export function signupValidation(password,confirmation){
 if(password.length<8)return '비밀번호는 8자 이상 입력해 주세요.';
 if(password!==confirmation)return '비밀번호가 일치하지 않습니다.';
 return '';
}
