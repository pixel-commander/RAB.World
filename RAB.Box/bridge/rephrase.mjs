import { readFile } from 'node:fs/promises';
import path from 'node:path';

const normalize = value => String(value ?? '').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const low = value => normalize(value).toLowerCase();
const tokenRe = /[A-Za-z_$][A-Za-z0-9_$'-]*|\d+(?:\.\d+)?|[^\s\w]/g;
const sentenceCase = value => value ? value[0].toUpperCase()+value.slice(1) : value;
const stripCommand = text => {
  let value = normalize(text);
  const match = value.match(/^re[- ]?phrase(?:\s+check)?\s+([\s\S]+)$/i);
  if (match) value = match[1].trim();
  const quote = value.match(/^(["'])([\s\S]*)\1$/);
  return quote ? quote[2].trim() : value;
};
const inflectionKind = token => {
  const x=low(token);
  if (/ed$/.test(x)) return 'past';
  if (/ing$/.test(x)) return 'gerund';
  if (/s$/.test(x) && !/ss$/.test(x)) return 'present3';
  return 'base';
};
const createIndex = mapper => {
  const forms=new Map(), senses=new Map();
  for(const entry of mapper.entries??[]){
    for(const form of entry.forms??[entry.lemma]){const k=low(form),list=forms.get(k)??[];list.push(entry);forms.set(k,list);}
    for(const sense of entry.senses??[]){const list=senses.get(sense)??[];list.push(entry);senses.set(sense,list);}
  }
  return {forms,senses};
};
const chooseSense = (entries, token, tokens, index) => {
  const senses=[...new Set(entries.flatMap(x=>x.senses??[]))];
  if(!senses.length)return null;
  if(senses.length===1)return senses[0];
  const prev=low(tokens[index-1]??''),next=low(tokens[index+1]??'');
  if(senses.includes('find') && ['me','all','every','each','the','a','an'].includes(next)) return 'find';
  if(senses.includes('display') && ['me','it','this','that'].includes(next)) return 'display';
  if(senses.includes('create') && ['a','an','new'].includes(next)) return 'create';
  if(senses.includes('attach') && ['to','on','onto'].includes(next)) return 'attach';
  if(senses.includes('succeed') && ['not','did','does','do'].includes(prev)) return 'succeed';
  return senses[0];
};
const alternateForSense = ({ sense, original, index, indexBySense, relations }) => {
  const preferred=relations.preferred_surfaces?.[sense]??[];
  const originalLow=low(original);
  let lemmas=[...preferred];
  for(const entry of indexBySense.get(sense)??[]) if(!lemmas.includes(entry.lemma))lemmas.push(entry.lemma);
  lemmas=lemmas.filter(x=>low(x)!==originalLow);
  if(!lemmas.length)return null;
  const chosen=lemmas[0];
  const inflect=inflectionKind(original);
  return relations.inflections?.[chosen]?.[inflect] ?? chosen;
};

export const createRephraser = ({ languageRoot }) => {
  let cache=null;
  const load=async()=>{
    if(cache)return cache;
    const mapper=JSON.parse(await readFile(path.join(languageRoot,'type-mapper.json'),'utf8'));
    const relations=JSON.parse(await readFile(path.join(languageRoot,'semantic-relations.json'),'utf8'));
    cache={mapper,relations,index:createIndex(mapper)};return cache;
  };
  const rephrase=async rawInput=>{
    const {mapper,relations,index}=await load();
    const source=stripCommand(rawInput);
    let normalized=source;
    const normalizations=[];
    for(const [from,to] of Object.entries(relations.contractions??{})){
      const re=new RegExp(`\\b${from.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\b`,'gi');
      if(re.test(normalized)){normalized=normalized.replace(re,to);normalizations.push({from,to,reason:'known-contraction'});}
    }
    const tokens=normalized.match(tokenRe)??[];
    const analysis=[];const unknown=[];
    for(let i=0;i<tokens.length;i++){
      const token=tokens[i];
      if(/^[^A-Za-z0-9_$]+$/.test(token)){analysis.push({token,kind:'punct'});continue;}
      const entries=index.forms.get(low(token))??[];
      if(!entries.length){unknown.push(token);analysis.push({token,kind:'unknown',types:[],senses:[]});continue;}
      const types=[...new Set(entries.flatMap(x=>x.types??[]))],sense=chooseSense(entries,token,tokens,i),senses=[...new Set(entries.flatMap(x=>x.senses??[]))];
      analysis.push({token,kind:'known',lemma:entries[0].lemma,types,senses,chosen_sense:sense});
    }
    if(unknown.length)return {status:'language-gap',input:source,normalized,unknown:[...new Set(unknown)],analysis,primary:null,alternatives:[],authority:0};

    // Compositional negation: SUBJECT + do/does/did + not + VERB(sense) -> SUBJECT + opposite(VERB).
    const notAt=tokens.findIndex(x=>low(x)==='not');
    if(notAt>0 && notAt+1<tokens.length){
      const aux=low(tokens[notAt-1]),verb=tokens[notAt+1],verbRec=analysis[notAt+1];
      const opposite=relations.opposites?.[verbRec?.chosen_sense];
      if(['do','does','did'].includes(aux)&&opposite){
        const subject=tokens.slice(0,notAt-1).join(' ').trim();
        const lemma=(relations.preferred_surfaces?.[opposite]??[opposite])[0];
        const tense=aux==='did'?'past':aux==='does'?'present3':'base';
        const surface=relations.inflections?.[lemma]?.[tense]??relations.inflections?.[opposite]?.[tense]??lemma;
        const tail=tokens.slice(notAt+2).join(' ').replace(/\s+([,.;!?])/g,'$1').trim();
        const primary=sentenceCase(`${subject} ${surface}${tail?` ${tail}`:''}`.trim()) + (/[.!?]$/.test(source)?'':'.');
        return {status:'ok',input:source,normalized,analysis,shape:{subject,negated:true,predicate:verbRec.chosen_sense,opposite},primary,alternatives:[],rule:'negated-predicate→opposite-predicate',authority:0};
      }
    }

    // General same-sense rewording. Change a few content words while keeping structure/order.
    const out=[...tokens],changes=[];
    for(let i=0;i<analysis.length;i++){
      const rec=analysis[i]; if(rec.kind!=='known'||!rec.chosen_sense)continue;
      if(rec.types.every(t=>['determiner','auxiliary','pronoun','preposition','conjunction','negation'].includes(t)))continue;
      const alt=alternateForSense({sense:rec.chosen_sense,original:rec.token,index:i,indexBySense:index.senses,relations});
      if(alt&&low(alt)!==low(rec.token)){out[i]=alt;changes.push({from:rec.token,to:alt,sense:rec.chosen_sense});if(changes.length>=3)break;}
    }
    for(let i=1;i<out.length;i++){
      const priorQuantifier = [i-1,i-2].some(j => j>=0 && ['every','each'].includes(low(out[j])));
      if(priorQuantifier && analysis[i]?.types?.includes('noun') && /s$/i.test(tokens[i])) out[i]=analysis[i].lemma ?? tokens[i].replace(/s$/i,'');
    }
    let primary=out.join(' ').replace(/\s+([,.;!?])/g,'$1').replace(/\(\s+/g,'(').replace(/\s+\)/g,')');
    if(primary===normalized){primary=normalized;}
    primary=sentenceCase(primary);
    return {status:changes.length?'ok':'same-shape-no-alternative',input:source,normalized,analysis,shape:{senses:analysis.filter(x=>x.chosen_sense).map(x=>x.chosen_sense)},primary,alternatives:[],changes,authority:0};
  };
  return Object.freeze({rephrase});
};
