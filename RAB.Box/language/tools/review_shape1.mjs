import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const uniq=xs=>[...new Set(xs)];
const low=x=>String(x??'').toLowerCase();

const candidatePath=process.argv[2]?path.resolve(process.argv[2]):null;
if(!candidatePath) throw new Error('usage: node language/tools/review_shape1.mjs <candidate.json> [output.json]');
const outputPath=process.argv[3]?path.resolve(process.argv[3]):null;
const [live,candidate]=await Promise.all([
  json(path.join(ROOT,'language','type-mapper.json')),
  json(candidatePath),
]);

const errors=[];
const warnings=[];
const liveByLemma=new Map();
const liveByForm=new Map();
for(const e of live.entries??[]){
  const list=liveByLemma.get(low(e.lemma))??[];list.push(e);liveByLemma.set(low(e.lemma),list);
  for(const form of e.forms??[]){const rows=liveByForm.get(low(form))??[];rows.push(e);liveByForm.set(low(form),rows)}
}
const livePhrase=new Map((live.phrases??[]).map(p=>[low(p.text),p]));
const knownTypes=new Set((live.entries??[]).flatMap(e=>e.types??[]));
const knownPhraseTypes=new Set((live.phrases??[]).flatMap(e=>e.types??[]));
const knownSenses=new Set([...(live.entries??[]).flatMap(e=>e.senses??[]),...(live.phrases??[]).flatMap(e=>e.senses??[])]);

const accepted=[];
const extensions=[];
for(const [i,e] of (candidate.entries??[]).entries()){
  const at=`entries[${i}]`;
  if(!e||typeof e!=='object'){errors.push({at,reason:'entry must be object'});continue}
  if(typeof e.lemma!=='string'||!e.lemma.trim()) errors.push({at,reason:'lemma required'});
  if(!Array.isArray(e.forms)||!e.forms.length) errors.push({at,reason:'forms[] required'});
  if(!Array.isArray(e.types)||!e.types.length) errors.push({at,reason:'types[] required'});
  if(!Array.isArray(e.senses)) errors.push({at,reason:'senses[] required'});
  if(errors.some(x=>x.at===at)) continue;
  const forms=uniq(e.forms.map(low));
  if(forms.length!==e.forms.length) warnings.push({at,reason:'duplicate forms inside candidate',forms:e.forms});
  if(!forms.includes(low(e.lemma))) warnings.push({at,reason:'lemma is not present as a surface form',lemma:e.lemma});
  const same=liveByLemma.get(low(e.lemma))??[];
  const collisions=uniq(forms.flatMap(form=>(liveByForm.get(form)??[]).map(x=>x.lemma))).filter(Boolean);
  const newTypes=e.types.filter(t=>!knownTypes.has(t));
  const newSenses=e.senses.filter(s=>!knownSenses.has(s));
  if(newTypes.length) warnings.push({at,reason:'new lexical type vocabulary',values:newTypes});
  if(same.length){
    extensions.push({entry:e,existing:same,form_collisions:collisions,new_senses:newSenses});
  } else {
    accepted.push({entry:e,form_collisions:collisions,new_senses:newSenses});
  }
}

const phraseAccepted=[];
const phraseExtensions=[];
for(const [i,e] of (candidate.phrases??[]).entries()){
  const at=`phrases[${i}]`;
  if(!e||typeof e!=='object'||typeof e.text!=='string'||!e.text.trim()){errors.push({at,reason:'text required'});continue}
  if(!Array.isArray(e.types)||!e.types.length){errors.push({at,reason:'types[] required'});continue}
  if(!Array.isArray(e.senses)){errors.push({at,reason:'senses[] required'});continue}
  const existing=livePhrase.get(low(e.text));
  const newTypes=e.types.filter(t=>!knownPhraseTypes.has(t));
  const newSenses=e.senses.filter(s=>!knownSenses.has(s));
  if(newTypes.length) warnings.push({at,reason:'new phrase type vocabulary',values:newTypes});
  if(existing) phraseExtensions.push({entry:e,existing,new_senses:newSenses});
  else phraseAccepted.push({entry:e,new_senses:newSenses});
}

const report={
  version:'rraabbiitt-shape1-review/v0.1',
  generated_at:new Date().toISOString(),
  candidate:path.relative(ROOT,candidatePath),
  live:{entries:(live.entries??[]).length,phrases:(live.phrases??[]).length,unique_forms:liveByForm.size},
  proposed:{entries:(candidate.entries??[]).length,phrases:(candidate.phrases??[]).length},
  result:{schema_ok:errors.length===0,new_entries:accepted.length,existing_lemma_extensions:extensions.length,new_phrases:phraseAccepted.length,existing_phrase_extensions:phraseExtensions.length,errors,warnings,accepted,extensions,phraseAccepted,phraseExtensions}
};
if(outputPath){await mkdir(path.dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8')}
console.log(JSON.stringify(report,null,2));
