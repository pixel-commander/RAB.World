import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolHouse } from '../bridge/tool-house.mjs';
import { createSeatParser } from '../bridge/seat-parser.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const house=createToolHouse({root});
const parser=await createSeatParser({languageRoot:path.join(root,'language')});

const cases=[
  ['audit jwt secrets','audit/security/jwt-secrets'],
  ['check exposed admin routes','audit/network/exposed-admin-routes'],
  ['review state ownership','audit/code-review/state-ownership'],
  ['review css tokens','audit/code-review/css-tokens'],
  ['check html standards','audit/standards/html'],
  ['test network guards','audit/guard-test/network'],
  ['add css state hover to class button','css/add/state/class']
];

for(const [text,expected] of cases){
  test(`merged lookup resolves: ${text}`,async()=>{
    const frame=parser.parse(text,{context:{},knownEntities:[]}).frames[0];
    const found=await house.findTools({query:text,includeStamps:true,requestFrame:frame});
    assert.equal(found.items[0]?.path,expected,JSON.stringify(found.items.slice(0,5).map(x=>({path:x.path,score:x.score,shape:x.shape_score,path:x.path_score,text:x.text_score}))));
  });
}
