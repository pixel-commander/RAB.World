import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../magic-box/index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('const syncStorageHome ='),html.indexOf('const acceptSession ='));
for(const old of [null,'old-home','canonical-home'])test(`tab restores session IDs only for the same known home (${old})`,()=>{
  const data=new Map([['rraabbiitt.window.session','65'],['rraabbiitt.window.project','63']]);
  if(old)data.set('rraabbiitt.window.storage-home',old);
  const sessionStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const scope=vm.createContext({sessionStorage,rememberSession:()=>data.delete('rraabbiitt.window.session')});
  vm.runInContext(code+'syncStorageHome("canonical-home");',scope);
  assert.equal(data.has('rraabbiitt.window.session'),old==='canonical-home');
  assert.equal(data.has('rraabbiitt.window.project'),old==='canonical-home');
  assert.equal(data.get('rraabbiitt.window.storage-home'),'canonical-home');
});
