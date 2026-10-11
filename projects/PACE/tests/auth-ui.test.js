import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowWelcome,WELCOME_KEY,signupValidation} from '../src/auth-ui.js';
import {syncPayload,createAccountStore} from '../src/account-store.js';
import {createPaceBackup} from '../src/backup.js';
const memory=()=>{const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};};
test('new visitor sees welcome, remembered guest/account choice bypasses it',()=>{
 const storage=memory();assert.equal(shouldShowWelcome(storage,null),true);
 for(const choice of ['guest','account']){storage.setItem(WELCOME_KEY,choice);assert.equal(shouldShowWelcome(storage,null),false);}
});
test('session or existing local workspace bypasses welcome without mutating storage',()=>{
 const storage=memory();assert.equal(shouldShowWelcome(storage,{user:{id:'fake'}}),false);assert.equal(storage.length,0);
 storage.setItem('pace.study-plans.v1','{"catalog":[{"id":"virtual"}]}');const before=storage.getItem('pace.study-plans.v1');
 assert.equal(shouldShowWelcome(storage,null),false);assert.equal(storage.getItem('pace.study-plans.v1'),before);
});
test('private recovery copy also bypasses welcome; malformed workspace is not reset',()=>{
 const storage=memory();storage.setItem('pace.before-catalog-migration.v1','private');assert.equal(shouldShowWelcome(storage,null),false);
 const malformed=memory();malformed.setItem('pace.study-plans.v1','bad json');assert.equal(shouldShowWelcome(malformed,null),false);assert.equal(malformed.getItem('pace.study-plans.v1'),'bad json');
});
test('signup checks minimum length and confirmation; matching password passes',()=>{
 assert.match(signupValidation('short','short'),/8자/);assert.match(signupValidation('virtual-pass','different'),/일치/);assert.equal(signupValidation('virtual-pass','virtual-pass'),'');
});
test('welcome choice and tokens stay outside learning backup and account sync',()=>{
 const storage=memory();storage.setItem(WELCOME_KEY,'guest');storage.setItem('supabase-pace-auth','virtual-session');storage.setItem('pace.certifications.v1','[]');
 assert.deepEqual(syncPayload(storage),{'pace.certifications.v1':'[]'});assert.deepEqual(createPaceBackup(storage).rawStorage,{'pace.certifications.v1':'[]'});
 const account=createAccountStore(storage,'virtual');assert.equal(account.getItem('pace.certifications.v1'),null);assert.equal(storage.getItem('pace.certifications.v1'),'[]');
});
