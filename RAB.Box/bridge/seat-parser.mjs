import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseCssStateRequest } from './css-state-request.mjs';

const CORE_SEATS = ['domain','operation','target','target_type','quantifier','predicate','relation','name','value','reference','scope','output'];
const normalize = value => String(value ?? '').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim();
const low = value => normalize(value).toLowerCase();
const uniq = xs => [...new Set(xs.filter(x => x !== null && x !== undefined && x !== ''))];
const pathLike = value => /^(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))/.test(String(value)) || /^[A-Za-z0-9_$.-]+(?:[\\/][A-Za-z0-9_$.-]+)+$/.test(String(value));
const quoted = value => /^(["']).*\1$/.test(String(value));
const unquote = value => quoted(value) ? String(value).slice(1,-1) : String(value);
const isPascalish = value => /^[A-Z][A-Za-z0-9_-]{1,127}$/.test(String(value));
const isHyphenId = value => /^[A-Za-z_][A-Za-z0-9_]*-[A-Za-z0-9_-]+$/.test(String(value));
const tokenRe = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z]:[\\/][^\s,;]+|\\\\[^\s,;]+|\/(?:[^\s,;]+)|[A-Za-z0-9_$.-]+(?:[\\/][A-Za-z0-9_$.-]+)+|[A-Za-z_$][A-Za-z0-9_$-]*|\d+(?:\.\d+)?|[^\s]/g;

const splitClauses = text => {
  // Protect quoted names/content from command boundary detection.
  const literals=[];
  const protectedText=normalize(text).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,part=>`\u0000${literals.push(part)-1}\u0000`);
  return protectedText
  .split(/(?<=[.!?])\s+|\s+(?:and\s+then|then)\s+|\s+and\s+(?=(?:add|make|create|build|start|find|show|get|list|report|count|scan|audit|inspect|check|remove|delete|detach|attach|wrap|apply|rename|replace|set|update|edit|run)\b)|\s+(?=(?:make|create|build)\s+(?:new\s+)?(?:react\s+)?(?:component|page|atom|div)\b)/i)
  .map(x=>x.replace(/\u0000(\d+)\u0000/g,(_,i)=>literals[Number(i)]))
  .map(x=>x.trim().replace(/^[,;]+|[,;]+$/g,''))
  .filter(Boolean);
};

const makeLexicon = data => {
  const forms = new Map();
  for (const entry of data.entries ?? []) for (const form of entry.forms ?? [entry.lemma]) {
    const key = low(form);
    const prev = forms.get(key) ?? [];
    prev.push({ lemma:entry.lemma, types:entry.types ?? [], senses:entry.senses ?? [], source:'base' });
    forms.set(key, prev);
  }
  const phrases = [...(data.phrases ?? [])].sort((a,b)=>b.text.length-a.text.length);
  return { forms, phrases };
};
const mergeLexicons = (base, override) => makeLexicon({
  entries:[...(base.entries??[]), ...(override.entries??[])],
  phrases:[...(base.phrases??[]), ...(override.phrases??[])]
});

const findPhraseMatches = (text, lexicon, tokens=[]) => {
  const hay=low(text);
  const out=[];
  for (const item of lexicon.phrases) {
    const needle=low(item.text);
    let start=0;
    while (needle && (start=hay.indexOf(needle,start))>=0) {
      const before=start===0?' ':hay[start-1];
      const end=start+needle.length;
      const after=end>=hay.length?' ':hay[end];
      const leftOk=!/[a-z0-9_$-]/i.test(before);
      const rightOk=!/[a-z0-9_$-]/i.test(after);
      if(leftOk&&rightOk) {
        const tokenIndexes=tokens.filter(t=>t.start>=start&&t.end<=end).map(t=>t.index);
        out.push({text:item.text,start,end,types:item.types??[],senses:item.senses??[],tokenIndexes});
      }
      start=end||start+1;
    }
  }
  return out.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start));
};

const targetFromNoun = lemma => ({
  project:'project', app:'project', application:'project', site:'project', workspace:'project',
  component:'component', page:'page', screen:'page', view:'page', route:'page', homepage:'page', home:'page',
  atom:'atom', style:'style', class:'class', classname:'class', div:'div', element:'div', node:'element', container:'container', wrapper:'container', grid:'grid', area:'area', section:'section',
  file:'file', folder:'folder', directory:'folder', path:'path', hook:'hook', import:'import', export:'export', dependency:'dependency', reference:'reference', function:'function', method:'function', callback:'function', comment:'comment', svg:'svg', icon:'icon',
  report:'report', stamp:'stamp', tool:'tool', script:'script', capability:'capability', id:'id', note:'text', setting:'setting', option:'option', field:'field', seat:'seat', token:'token', database:'database', text:'text', content:'text', code:'code', prop:'prop', property:'property', attribute:'attribute', button:'component', form:'component', header:'component', footer:'component', menu:'component', sidebar:'component'
})[lemma] ?? null;

const operationSenses = new Set(['create','attach','insert','include','increment','append','set','update','reset','empty','detach','delete','replace','rename','move','copy','find','count','inspect','measure','verify','execute','save','write','display','import','export','select','continue','cancel','confirm','determine']);
const opPriority = ['delete','rename','replace','detach','attach','insert','create','count','find','inspect','determine','reset','empty','update','move','copy','save','execute','select'];
const exactOutput = op => ({ count:'count', find:'list', inspect:'report', verify:'report', display:'view', save:'file' })[op] ?? null;

const spanEvidence = (seat, value, tokens, indexes, reason) => ({ seat, value, text:indexes.map(i=>tokens[i]?.raw).filter(Boolean).join(' '), tokenIndexes:indexes, reason });
const addEvidence = (frame, seat, value, tokens, indexes, reason) => {
  frame.evidence.push(spanEvidence(seat,value,tokens,indexes,reason));
};

const classifyTokens = (text, lexicon, known = new Map()) => {
  const normalized=normalize(text);
  const matches=[...normalized.matchAll(tokenRe)];
  return matches.map((match,index) => {
    const piece=match[0];
    const start=match.index??0;
    const end=start+piece.length;
    const key = low(piece);
    if (/^[,.;!?():]+$/.test(piece)) return { index,start,end,raw:piece,key,kind:'punct',candidates:[] };
    if (quoted(piece)) return { index,start,end,raw:piece,key,kind:'literal',value:unquote(piece),candidates:[] };
    if (pathLike(piece)) return { index,start,end,raw:piece,key,kind:'path',value:piece,candidates:[] };
    if (/^\d+(?:\.\d+)?$/.test(piece)) return { index,start,end,raw:piece,key,kind:'number',value:Number(piece),candidates:[] };
    const entity = known.get(key);
    const candidates = lexicon.forms.get(key) ?? [];
    const genericTypeWord=candidates.some(c=>(c.types??[]).includes('noun') && targetFromNoun(c.lemma));
    // A verified/project entity normally wins, except for generic type words such as "div" or
    // "component". Those remain grammar nouns so a previous artifact named "div" cannot
    // turn every later "add div" into an entity reference.
    if (entity && !genericTypeWord) return { index,start,end,raw:piece,key,kind:'entity',entity,candidates:[] };
    // Capitalized tokens inside a clause are often project identifiers even when the lowercase
    // spelling is also an English/domain noun (Header, Menu, Form). Keep React as vocabulary.
    if (index>0 && isPascalish(piece) && key!=='react') return { index,start,end,raw:piece,key,kind:'identifier',value:piece,candidates:[] };
    if (candidates.length) return { index,start,end,raw:piece,key,kind:'word',candidates };
    if (entity) return { index,start,end,raw:piece,key,kind:'entity',entity,candidates:[] };
    if (isPascalish(piece)) return { index,start,end,raw:piece,key,kind:'identifier',value:piece,candidates:[] };
    if (isHyphenId(piece)) return { index,start,end,raw:piece,key,kind:'identifier-hyphen',value:piece,candidates:[] };
    return { index,start,end,raw:piece,key,kind:'unknown',candidates:[] };
  });
};

const candidateTypes = token => uniq((token.candidates??[]).flatMap(x=>x.types??[]));
const candidateSenses = token => uniq((token.candidates??[]).flatMap(x=>x.senses??[]));
const candidateSensesForType = (token,type) => uniq((token.candidates??[]).filter(x=>(x.types??[]).includes(type)).flatMap(x=>x.senses??[]));
const hasType = (token,type) => candidateTypes(token).includes(type);
const hasSense = (token,sense) => candidateSenses(token).includes(sense);
const firstToken = (tokens,pred) => tokens.find(pred);
const tokenIndexes = (tokens,pred) => tokens.filter(pred).map(t=>t.index);

// Population shorthand addresses the selected component's existing DOM areas.
// Area identifiers remain literal addresses; the DOM owner validates the selected file.
const populationInsertion = (tokens, context) => {
  if (!context.populationTarget && context.componentPopulation !== true) return null;
  const active=tokens.filter(token=>token.kind!=='punct');
  const [verb,component,relation,...destination]=active;
  if (verb?.key!=='add' || !['to','into','inside'].includes(relation?.key)) return null;
  const componentName=component?.kind==='entity'?component.entity?.name:component?.kind==='literal'?component.value:component?.raw;
  const componentKnown=component?.kind==='entity'&&component.entity?.type==='component';
  if (!componentKnown && (component?.kind==='entity' || !isPascalish(componentName))) return null;
  const explicitArea=destination[0]?.key==='data-area';
  const areaTokens=explicitArea?destination.slice(destination[1]?.raw==='='?2:1):destination;
  if (areaTokens.length!==1) return null;
  const areaToken=areaTokens[0];
  const area=areaToken.kind==='literal'?areaToken.value:areaToken.raw;
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(area) || (!explicitArea&&!/^[a-z][a-z0-9_-]*$/.test(area))) return null;
  return {componentName,area,component,verb,relation,destination};
};

const inferFrame = ({ text, tokens, context, lexicon, mode }) => {
  const frame = {
    text,
    seats:Object.fromEntries(CORE_SEATS.map(k=>[k,null])),
    data_types:[],
    resources:[],
    evidence:[],
    unknownTokens:[],
    typedUnknowns:[],
    composition:{version:'typed-composition/v0.8.5',applications:[],unresolved:[]},
    ambiguousSeats:[],
    conflicts:[],
    unconsumed:[],
    negated:false,
    lexical:{ recognized:[], protected:[], unknown:[] }
  };
  const active = tokens.filter(t=>t.kind!=='punct');
  const insertion=mode==='request'?populationInsertion(tokens,context):null;
  if(insertion){
    frame.seats={...frame.seats,domain:'react',operation:'insert',target_type:'component-use',name:insertion.componentName,relation:'child-of',scope:'current-target'};
    frame.data_types=['component-use','component','data-area'];
    addEvidence(frame,'domain','react',tokens,[],'selected React component population context');
    addEvidence(frame,'operation','insert',tokens,[insertion.verb.index],'add named component into selected component area');
    addEvidence(frame,'target_type','component-use',tokens,[insertion.component.index],'existing component use in population context');
    addEvidence(frame,'name',insertion.componentName,tokens,[insertion.component.index],'named component to insert');
    addEvidence(frame,'component',insertion.componentName,tokens,[insertion.component.index],'component insertion tool input');
    addEvidence(frame,'relation','child-of',tokens,[insertion.relation.index],'population destination');
    addEvidence(frame,'area',insertion.area,tokens,insertion.destination.map(token=>token.index),'literal data-area in selected component');
    frame.lexical.recognized=active.map(token=>token.raw);
    frame.completeLanguage=true;
    frame.occupiedSeats=Object.keys(frame.seats).filter(key=>frame.seats[key]!==null);
    return frame;
  }
  const cssState=mode==='request'?parseCssStateRequest(text,context):null;
  if(cssState){
    frame.seats={...frame.seats,domain:'css',operation:'create',target_type:cssState.target_type,name:cssState.name,output:'css-update'};
    frame.data_types=['css',cssState.target_type,'state'];
    addEvidence(frame,'domain','css',tokens,tokens.map(t=>t.index),'explicit CSS state construction');
    addEvidence(frame,'css_state',cssState.states.join(', '),tokens,tokens.filter(t=>cssState.states.includes(t.key.replace(/^[:.]/,''))).map(t=>t.index),'CSS state names from shared vocabulary');
    if(cssState.location)addEvidence(frame,'css_location',cssState.location,tokens,[],'explicit CSS location');
    if(cssState.current&&!cssState.name)frame.ambiguousSeats.push({seat:'name',candidates:[],evidence:'this atom/class',reason:'current CSS target is unavailable'});
    frame.lexical.recognized=active.map(t=>t.raw);
    frame.completeLanguage=!frame.ambiguousSeats.length;
    frame.occupiedSeats=Object.keys(frame.seats).filter(key=>frame.seats[key]!==null);
    return frame;
  }
  const phraseMatches=findPhraseMatches(text,lexicon,tokens);
  const phraseCovered=new Set(phraseMatches.flatMap(p=>p.tokenIndexes));
  const at = i => tokens[i];
  const before = (a,b) => a?.index < b?.index;
  const areaToken=active.find(t=>t.key==='data-area');
  const areaEquals=areaToken&&at(areaToken.index+1)?.raw==='=';
  const areaCandidate=areaToken&&at(areaToken.index+(areaEquals?2:1));
  const areaLiteral=areaCandidate?.kind==='literal'?areaCandidate.value:areaCandidate?.raw;
  const areaValue=/^[A-Za-z][A-Za-z0-9_-]*$/.test(areaLiteral??'')?areaCandidate:null;
  const areaIndexes=new Set(areaValue?[areaToken.index,...(areaEquals?[areaToken.index+1]:[]),areaValue.index]:[]);
  if(areaValue){
    const value=areaValue.kind==='literal'?areaValue.value:areaValue.raw;
    addEvidence(frame,'data_area',value,tokens,[...areaIndexes],'explicit data-area assignment');
  }

  // Lexical bookkeeping. Identifiers are only protected later when a construction earns them.
  for (const t of active) {
    if (['word','entity'].includes(t.kind)) frame.lexical.recognized.push(t.raw);
    else if (['literal','path','number'].includes(t.kind)) frame.lexical.protected.push(t.raw);
    else if (t.kind === 'unknown' && !phraseCovered.has(t.index)) { frame.unknownTokens.push({ token:t.raw,index:t.index,reason:'unknown-word' }); frame.lexical.unknown.push(t.raw); }
  }

  // Negation is a hard semantic guard.
  const neg = firstToken(active,t=>hasType(t,'negation'));
  if (neg) { frame.negated=true; addEvidence(frame,'operation','NEGATED',tokens,[neg.index],'negation token blocks execution'); }

  // Domain: explicit work-domain beats inherited context. React can describe the target while audit remains the work domain.
  const auditVerb = firstToken(active,t=>['audit','scan','inspect','analyze'].some(s=>hasSense(t,s)||t.key===s));
  const auditNoun = firstToken(active,t=>t.key==='audit');
  const reactWord = firstToken(active,t=>t.key==='react');
  const buildNoun = firstToken(active,t=>['project','component','page','atom','div','element'].includes(t.key));
  if (auditVerb || (auditNoun && !buildNoun)) {
    frame.seats.domain='audit'; addEvidence(frame,'domain','audit',tokens,[...(auditVerb?[auditVerb.index]:[]),...(auditNoun?[auditNoun.index]:[])],'explicit audit work cue');
  } else if (context.domain && !/\b(?:switch|change)\b/i.test(text)) {
    frame.seats.domain=context.domain; frame.evidence.push({seat:'domain',value:context.domain,text:'<inherited>',tokenIndexes:[],reason:'Bag/context domain'});
  } else if (reactWord || buildNoun) {
    frame.seats.domain='react'; addEvidence(frame,'domain','react',tokens,[...(reactWord?[reactWord.index]:[]),...(buildNoun?[buildNoun.index]:[])],'build target/domain cue');
  }

  // Quantifier.
  const q = firstToken(active,t=>hasType(t,'quantifier'));
  if (q) {
    const senses=candidateSenses(q); const value=senses.find(x=>['all','any','some','many','one','two','three','none'].includes(x)) ?? q.key;
    frame.seats.quantifier=value; addEvidence(frame,'quantifier',value,tokens,[q.index],'quantifier role');
  }
  if (!frame.seats.quantifier) {
    const pq=phraseMatches.find(p=>p.types.includes('quantifier-phrase')&&p.senses.some(s=>['all','any','some','many','one','two','three','none'].includes(s)));
    if(pq){const value=pq.senses.find(s=>['all','any','some','many','one','two','three','none'].includes(s));frame.seats.quantifier=value;addEvidence(frame,'quantifier',value,tokens,pq.tokenIndexes,'recognized quantifier phrase');}
  }

  // Target type from nouns, noun phrases and known entities.
  let targetToken = null;
  const phraseText = low(text);
  const hookTerm = active.find(t=>hasSense(t,'state-hook') || hasSense(t,'effect-hook'));
  if (hookTerm) {
    const predicate=hasSense(hookTerm,'state-hook')?'state':'effect';
    if(!frame.seats.domain){frame.seats.domain='react';addEvidence(frame,'domain','react',tokens,[hookTerm.index],'React-scoped reserved hook term');}
    frame.seats.target_type='hook'; frame.seats.predicate=predicate;
    addEvidence(frame,'target_type','hook',tokens,[hookTerm.index],'reserved/domain hook term');
    addEvidence(frame,'predicate',predicate,tokens,[hookTerm.index],'reserved/domain hook term');
  }
  const phraseTarget = [
    [/\bstate hooks?\b/,'hook','state'],
    [/\beffect hooks?\b/,'hook','effect'],
    [/\borphan(?:ed)? files?\b|\bunreferenced files?\b|\bunused files?\b/,'file','orphaned'],
    [/\borphan(?:ed)? components?\b|\bunreferenced components?\b|\bunused components?\b/,'component','orphaned'],
    [/\bfile types?\b/,'file','file-type'],
    [/\bsvg(?:s)?\b/,'svg',null],
  ].find(([re])=>re.test(phraseText));
  if (phraseTarget) {
    frame.seats.target_type=phraseTarget[1];
    if (phraseTarget[2]) frame.seats.predicate=phraseTarget[2];
    frame.evidence.push({seat:'target_type',value:phraseTarget[1],text:phraseText.match(phraseTarget[0])?.[0]??'',tokenIndexes:[],reason:'recognized noun phrase'});
    if (phraseTarget[2]) frame.evidence.push({seat:'predicate',value:phraseTarget[2],text:phraseText.match(phraseTarget[0])?.[0]??'',tokenIndexes:[],reason:'recognized predicate phrase'});
  }
  if (!frame.seats.target_type) {
    // Prefer an explicit noun over a known entity. In "container-main div", div is the thing and container-main is a resource.
    for (const t of active) {
      const lemmas=uniq((t.candidates??[]).map(x=>x.lemma));
      const mapped=lemmas.map(targetFromNoun).find(Boolean);
      if (!mapped) continue;
      if(t.key==='container'&&at(t.index+1)?.key==='atom'){
        addEvidence(frame,'resource_family','container',tokens,[t.index],'container atom family modifier');
        continue;
      }
      // House shorthand: `stamp a new react project ...` uses `stamp` as the leading verb.
      // If another concrete noun follows, do not let the same word steal the target seat.
      const leadingVerbAsAction = t.index===active[0]?.index && hasType(t,'verb') && active.some(other=>other.index>t.index && uniq((other.candidates??[]).map(x=>x.lemma)).some(lemma=>targetFromNoun(lemma)) && other.key!==t.key);
      if (leadingVerbAsAction) continue;
      targetToken=t; frame.seats.target_type=mapped; addEvidence(frame,'target_type',mapped,tokens,[t.index],'noun role'); break;
    }
    if (!frame.seats.target_type) {
      const entity=active.find(t=>t.kind==='entity' && t.entity?.type);
      if (entity) { targetToken=entity; frame.seats.target_type=entity.entity.type; frame.seats.target=entity.entity.name??entity.raw; addEvidence(frame,'target_type',entity.entity.type,tokens,[entity.index],'known entity type'); addEvidence(frame,'target',frame.seats.target,tokens,[entity.index],'known entity reference'); }
    }
  }

  // Explicit resource binders: "with class container-main", "using atom container-main".
  // The identifier becomes a typed resource candidate rather than an unknown language word.
  const resourceBinder=active.find(t=>['class','classname','atom','style'].includes(t.key));
  if (resourceBinder && frame.seats.target_type!==targetFromNoun(resourceBinder.key)) {
    const next=active.find(t=>t.index>resourceBinder.index && ['entity','identifier','identifier-hyphen','literal'].includes(t.kind));
    if (next) {
      const value=next.kind==='entity'?(next.entity?.name??next.raw):next.kind==='literal'?next.value:next.raw;
      const type=next.kind==='entity'?(next.entity?.type??resourceBinder.key):targetFromNoun(resourceBinder.key);
      frame.resources.push({type,name:value,source:next.kind==='entity'?'known-entity':'request-resource'});
      if(!frame.seats.reference)frame.seats.reference=value;
      addEvidence(frame,'reference',value,tokens,[resourceBinder.index,next.index],'explicit resource binder');
      if(['identifier','identifier-hyphen'].includes(next.kind))frame.lexical.protected.push(next.raw);
    }
  }

  // Known resources can modify a newly-created noun without becoming that noun.
  if (targetToken) {
    const resource=active.find(t=>t.kind==='entity' && ['atom','class','style'].includes(t.entity?.type) && t.index < targetToken.index);
    if (resource) {
      const item={ type:resource.entity.type, name:resource.entity.name??resource.raw, source:'known-entity' };
      frame.resources.push(item);
      frame.seats.reference=item.name;
      addEvidence(frame,'reference',item.name,tokens,[resource.index],'known resource modifying target noun');
    }
  }

  // Predicates from adjectives / domain terms.
  if (!frame.seats.predicate) {
    const predicateSenses=new Set(['orphaned','missing','duplicate','invalid','empty','active','inactive','nested','required','optional','state','effect','unobstructed']);
    const adjectivePosition=t=>{
      const beforeTokens=active.filter(x=>x.index<t.index);
      const prev=beforeTokens.at(-1);
      const next=active.find(x=>x.index>t.index);
      const followsCopula=prev&&['am','is','are','was','were','be','been','being'].includes(prev.key);
      const precedesNoun=next&&hasType(next,'noun');
      const leadingVerb=t.index===active[0]?.index&&hasType(t,'verb')&&!followsCopula;
      return !leadingVerb&&(followsCopula||precedesNoun||!hasType(t,'verb'));
    };
    const pred = firstToken(active,t=>hasType(t,'adjective') && adjectivePosition(t) && candidateSensesForType(t,'adjective').some(s=>predicateSenses.has(s)));
    if (pred) { const value=candidateSensesForType(pred,'adjective').find(s=>predicateSenses.has(s)); frame.seats.predicate=value; addEvidence(frame,'predicate',value,tokens,[pred.index],'predicate/adjective role + word order'); }
  }
  if (frame.seats.target_type==='hook' && !frame.seats.predicate) {
    const typedHook=active.find(t=>hasSense(t,'state-hook')||hasSense(t,'effect-hook'));
    if (typedHook) frame.seats.predicate=hasSense(typedHook,'state-hook')?'state':'effect';
    else if (/\bstate\b/i.test(text)) frame.seats.predicate='state';
    else if (/\beffect\b/i.test(text)) frame.seats.predicate='effect';
  }
  if (!frame.seats.predicate && /\b(?:not imported|nothing references|no inbound references)\b/i.test(text)) frame.seats.predicate='orphaned';

  // Explicit name binders first.
  const binderIndex = active.findIndex(t=>['named','called'].includes(t.key) || (t.key==='name' && hasType(t,'binder')));
  if (binderIndex>=0) {
    const binder=active[binderIndex], next=active[binderIndex+1];
    if (next && ['literal','identifier','identifier-hyphen','entity','word'].includes(next.kind)) {
      const value=next.kind==='literal'?next.value:next.raw;
      frame.seats.name=value; addEvidence(frame,'name',value,tokens,[binder.index,next.index],'explicit naming construction');
      if (['identifier','identifier-hyphen'].includes(next.kind)) frame.lexical.protected.push(next.raw);
    }
  }

  // Creation shorthand: "component TestOne" / "div Thing". Unknown lowercase words never become names.
  if (!frame.seats.name && targetToken) {
    const next=at(targetToken.index+1);
    if (next && (['identifier','identifier-hyphen','literal'].includes(next.kind) || frame.seats.target_type==='project' && next.kind==='unknown')) {
      const value=next.kind==='literal'?next.value:next.raw; frame.seats.name=value; addEvidence(frame,'name',value,tokens,[targetToken.index,next.index],'target followed by explicit identifier/literal');
      frame.lexical.protected.push(next.raw);
    } else if(next?.kind==='entity'&&['class','atom','style'].includes(frame.seats.target_type)){
      frame.seats.name=next.entity?.name??next.raw;
      addEvidence(frame,'name',frame.seats.name,tokens,[targetToken.index,next.index],'named existing class or atom resource');
    } else if (next?.kind==='entity' && ['component','page','div','container'].includes(frame.seats.target_type)) {
      frame.conflicts.push({ seat:'name', value:next.entity?.name??next.raw, reason:'create request names an entity already known in this run/project' });
    }
  }

  // Quoted literal near a project/component/page target may be a name when no content binder exists.
  const contentCue = active.find(t=>['say','says','text','content'].includes(t.key));
  const literals = active.filter(t=>t.kind==='literal'&&!areaIndexes.has(t.index));
  if (!frame.seats.name && ['project','component','page','atom','div'].includes(frame.seats.target_type) && literals.length && !contentCue) {
    frame.seats.name=literals[0].value; addEvidence(frame,'name',literals[0].value,tokens,[literals[0].index],'quoted artifact value');
  }

  // Value/content.
  if (contentCue) {
    const next=active.find(t=>t.index>contentCue.index && ['literal','identifier','number'].includes(t.kind));
    if (next) { frame.seats.value=next.kind==='literal'?next.value:next.value??next.raw; addEvidence(frame,'value',frame.seats.value,tokens,[contentCue.index,next.index],'content/value binder'); }
  } else if (mode==='capability' && /\breturns?\b/i.test(text)) {
    // output handled below; no arbitrary value.
  }

  // Known explicit entity/name target: after relation or direct object when not being created.
  const resourceNames=new Set(frame.resources.map(r=>low(r.name)));
  const entityTokens=active.filter(t=>t.kind==='entity' && !resourceNames.has(low(t.entity?.name??t.raw)));
  if (!frame.seats.target && entityTokens.length) {
    const last=entityTokens.at(-1); frame.seats.target=last.entity?.name??last.raw; addEvidence(frame,'target',frame.seats.target,tokens,[last.index],'known project/run entity');
  }

  // Relation / reference.
  const relativeThat = t => t.key==='that' && active.some(prev=>prev.index<t.index && hasType(prev,'noun')) && active.some(next=>next.index>t.index && hasType(next,'verb'));
  const pron = firstToken(active,t=>hasType(t,'pronoun') && ['it','this','that','them','those','these','one','ones'].includes(t.key) && !relativeThat(t));
  if (pron) { const value=['them','those','these','ones'].includes(pron.key)?'current-plural':'current'; frame.seats.reference=value; addEvidence(frame,'reference',value,tokens,[pron.index],'pronoun reference'); }
  const nextTo=active.find((t,i)=>t.key==='next'&&active[i+1]?.key==='to');
  const relationToken=active.find(t=>['inside','into','under','within','around','from','off','after','before','with','using','to'].includes(t.key) && (hasType(t,'preposition')||['inside','into','under','within','around','from','off','after','before','with','using','to'].includes(t.key)));
  const relationValue=nextTo?'beside':relationToken?({inside:'child-of',into:'child-of',under:'child-of',within:'child-of',around:'wrap',from:'from',off:'from',after:'after',before:'before',with:'with',using:'with',to:'to'}[relationToken.key]):null;
  if (relationValue) {
    frame.seats.relation=relationValue;
    const indexes=nextTo?[nextTo.index,active.find(t=>t.index>nextTo.index&&t.key==='to')?.index].filter(Number.isInteger):[relationToken.index];
    addEvidence(frame,'relation',relationValue,tokens,indexes,'preposition/relation construction');
  }

  // Scope.
  if (/\b(?:current|this|the) project\b|\bwhole project\b|\bentire project\b/i.test(text)) frame.seats.scope='current-project';
  else if (/\brecursive(?:ly)?\b|\beverything under\b|\ball children\b/i.test(text)) frame.seats.scope='recursive';
  else if (context.currentTarget && !frame.seats.scope) frame.seats.scope='current-target';

  // Candidate verb meanings. Grammar/context eliminate before ranking.
  const relToken=active.find(t=>['to','inside','into','under','within','around','from','after','before'].includes(t.key));
  const predicateTokenIndexes=new Set(frame.evidence.filter(e=>e.seat==='predicate').flatMap(e=>e.tokenIndexes??[]));
  const verbs=active.filter(t=>hasType(t,'verb')&&!predicateTokenIndexes.has(t.index));
  // A clause can contain secondary verbs that describe its output (for example
  // "create an index and return a report").  Operation selection belongs to the
  // first verb that actually advertises an executable operation sense; later verbs
  // can still contribute output/value structure without competing for the operation seat.
  const operativeVerbs=verbs.filter(v=>candidateSensesForType(v,'verb').some(s=>operationSenses.has(s)));
  const primaryVerb=operativeVerbs[0]??verbs[0];
  const candidateOps=[];
  if (primaryVerb) for (const sense of candidateSensesForType(primaryVerb,'verb')) if (operationSenses.has(sense)) candidateOps.push({op:sense,token:primaryVerb});
  const operativePhrases=phraseMatches.filter(p=>p.senses.some(s=>operationSenses.has(s)));
  for(const phrase of operativePhrases) for(const sense of phrase.senses) if(operationSenses.has(sense)) candidateOps.push({op:sense,phrase});
  let ops=uniq(candidateOps.map(x=>x.op));
  if (frame.negated) ops=[];
  const verbKey=primaryVerb?.key;
  if (frame.seats.domain==='audit') {
    if (verbKey==='count' || /\bhow many\b/.test(phraseText)) ops=['count'];
    else if (['find','show','get','list','locate','report','tell','give'].includes(verbKey)) ops=['find'];
    else if (['audit','scan','inspect','check','analyze','measure','run'].includes(verbKey)) {
      // The audit verb establishes the work domain. Once a concrete audit subject is present,
      // the useful canonical operation is retrieval/measurement rather than the surface verb.
      // A bare "audit this project" stays inspect so the Box can treat it as domain/context setup.
      const concrete = frame.seats.target_type && !['project','path','folder'].includes(frame.seats.target_type);
      ops=[concrete?'find':'inspect'];
    }
  } else if (verbKey==='add') {
    // "add class/atom X to Y" is attach. "add component/div X to Y" is create+child relation.
    const resourceNoun=active.find(t=>['class','atom','style'].includes(t.key));
    const hasResourceNoun=!!resourceNoun;
    const nounBeforeRelation=targetToken && (!relToken || targetToken.index < relToken.index);
    const knownResource=active.some(t=>t.kind==='entity' && ['atom','class','style'].includes(t.entity?.type) && (!targetToken || t.index < targetToken.index));
    const creatingThing=targetToken && ['component','div','page','project','container','element'].includes(frame.seats.target_type) && (!resourceNoun || targetToken.index < resourceNoun.index);
    if (frame.seats.target_type==='atom' && !relToken) ops=['create'];
    else if (creatingThing) ops=['create'];
    else if (hasResourceNoun || knownResource) ops=['attach'];
    else if (!nounBeforeRelation && relToken) ops=['insert'];
    else if (['component','div','page','project','atom','container','element'].includes(frame.seats.target_type)) ops=['create'];
  } else if (['make','create','build','start','generate','construct','stamp'].includes(verbKey)) ops=['create'];
  else if (['wrap','attach','apply','use'].includes(verbKey)) ops=['attach'];
  else if (verbKey==='remove') {
    if (frame.seats.relation==='from') ops=['detach'];
    else ops=['detach','delete'];
  } else if (verbKey==='detach') ops=['detach'];
  else if (['delete','destroy','erase'].includes(verbKey)) ops=['delete'];
  else if (['replace','swap'].includes(verbKey)) ops=['replace'];
  else if (verbKey==='rename') ops=['rename'];
  else if (['set','update','edit','change','modify'].includes(verbKey)) ops=['update'];
  else if (['run','execute','fire'].includes(verbKey)) ops=['execute'];

  ops=uniq(ops);
  if (ops.length===1) {
    frame.seats.operation=ops[0];
    const hit=candidateOps.find(x=>x.op===ops[0]);
    if(hit?.token) addEvidence(frame,'operation',ops[0],tokens,[hit.token.index],'verb + grammar/context');
    else if(hit?.phrase) addEvidence(frame,'operation',ops[0],tokens,hit.phrase.tokenIndexes,'phrase + grammar/context');
  }
  else if (ops.length>1) frame.ambiguousSeats.push({ seat:'operation', candidates:ops, evidence:primaryVerb?.raw??null, reason:'more than one operation survives grammar/context' });

  // Typed composition: strong construction evidence may establish the canonical operation
  // while an unknown leading surface word remains a visible, non-authoritative alias hole.
  const creatableTypes=new Set(['component','div','page','project','atom','container','element']);
  const newCue=active.find(t=>t.key==='new'&&targetToken&&t.index<targetToken.index);
  const leadingUnknown=active.find(t=>['unknown','identifier-hyphen'].includes(t.kind)&&(!targetToken||t.index<targetToken.index));
  if(newCue&&creatableTypes.has(frame.seats.target_type)){
    if(frame.seats.operation!=='create'){
      frame.seats.operation='create';
      addEvidence(frame,'operation','create',tokens,[newCue.index,targetToken?.index].filter(Number.isInteger),'typed construction: new + creatable target');
    }
    if(leadingUnknown){
      const hole={value:leadingUnknown.raw,type:'operation-alias',seat:'operation',known:false,index:leadingUnknown.index,reason:'leading unknown occurs where an operation surface form may occur; canonical create is independently established'};
      frame.typedUnknowns.push(hole); frame.composition.unresolved.push(hole);
    }
  }

  // Typed modifier hole: an unresolved token directly before a known target can occupy
  // Predicate without inventing its lexical meaning. It blocks authority until taught.
  if(!frame.seats.predicate&&targetToken){
    const modifier=active.find(t=>['unknown','identifier-hyphen'].includes(t.kind)&&t.index===targetToken.index-1);
    if(modifier){
      const hole={value:modifier.raw,type:'predicate',seat:'predicate',known:false,index:modifier.index,reason:'unknown modifier directly precedes a typed target'};
      frame.seats.predicate={value:modifier.raw,type:'predicate',known:false};
      frame.typedUnknowns.push(hole); frame.composition.unresolved.push(hole);
      addEvidence(frame,'predicate',frame.seats.predicate,tokens,[modifier.index],'typed composition inferred role only; meaning unresolved');
    }
  }

  // Create/insert relation normalization.
  if (frame.seats.operation==='create' && frame.seats.relation==='to' && ['component','div','page','element','container'].includes(frame.seats.target_type)) frame.seats.relation='child-of';
  if (frame.seats.operation==='attach' && frame.seats.relation==='to') frame.seats.relation='attach-to';
  if (frame.seats.operation==='insert' && !frame.seats.reference) {
    frame.seats.reference='previous-result';
    frame.evidence.push({seat:'reference',value:'previous-result',text:'<implicit>',tokenIndexes:[],reason:'insert clause omitted a new object; previous clause result supplies it'});
  }

  // Destination/parent target after relation. Unknown lowercase is not accepted; known entity or explicit identifier is.
  if (relToken) {
    const next=active.find(t=>t.index>relToken.index && !areaIndexes.has(t.index) && ['entity','identifier','literal'].includes(t.kind));
    if (next) {
      const value=next.kind==='entity'?(next.entity?.name??next.raw):next.kind==='literal'?next.value:next.raw;
      if (!frame.seats.target || frame.seats.operation==='create') {
        frame.seats.target=value; addEvidence(frame,'target',value,tokens,[next.index],'relation destination/reference');
      }
      if (next.kind==='identifier') frame.lexical.protected.push(next.raw);
    }
  }

  // Common terse nesting: "add component to SideBar BootBar" => parent SideBar, new name BootBar.
  if (!frame.seats.name && frame.seats.operation==='create' && relToken) {
    const dest=active.find(t=>t.index>relToken.index && ['entity','identifier','literal'].includes(t.kind));
    const trailing=dest && active.find(t=>t.index>dest.index && ['identifier','literal'].includes(t.kind));
    if (trailing) {
      const value=trailing.kind==='literal'?trailing.value:trailing.raw;
      frame.seats.name=value; addEvidence(frame,'name',value,tokens,[trailing.index],'trailing name after explicit parent/destination');
      frame.lexical.protected.push(trailing.raw);
    }
  }

  // Paths are values/context facts, not lexical unknowns.
  const pathToken=active.find(t=>t.kind==='path');
  if (pathToken) {
    if (!frame.seats.value && frame.seats.target_type==='path') frame.seats.value=pathToken.value;
    frame.evidence.push({seat:'value',value:pathToken.value,text:pathToken.raw,tokenIndexes:[pathToken.index],reason:'path literal available to Bag/contract binding'});
  }

  // House convention: singular find-* asks for one; plural find-* asks for all unless an explicit quantifier already won.
  if (frame.seats.operation==='find' && !frame.seats.quantifier && frame.seats.target_type) {
    const noun=active.find(t=>candidateTypes(t).includes('noun') && uniq((t.candidates??[]).map(x=>x.lemma)).map(targetFromNoun).includes(frame.seats.target_type));
    if (noun) { const plural=/s$/i.test(noun.raw) && !/ss$/i.test(noun.raw); frame.seats.quantifier=plural?'all':'one'; addEvidence(frame,'quantifier',frame.seats.quantifier,tokens,[noun.index],'house singular/plural find convention'); }
  }

  // Output from verb/nouns.
  const explicitOutput = active.find(t=>['list','report','count','json','tree','chart','graph','view'].includes(t.key));
  if (explicitOutput && ['list','report','count','json','tree','chart','graph','view'].includes(explicitOutput.key)) frame.seats.output=explicitOutput.key==='graph'?'chart':explicitOutput.key;
  if (/\breturns?\s+(?:a\s+)?report\b/i.test(text)) frame.seats.output='report';
  if (/\breturns?\s+(?:a\s+)?list\b/i.test(text)) frame.seats.output='list';
  if (!frame.seats.output && frame.seats.operation) frame.seats.output=exactOutput(frame.seats.operation);
  if (frame.seats.operation==='find' && verbKey==='report') frame.seats.output='report';

  // Preserve the explicit CSS modifier as input evidence, not a work-domain
  // switch. The selected Tool's declared extension setting owns the binding.
  // Match actual adjacent tokens, not 'css' inside a quoted path or artifact name.
  if(mode==='request'&&frame.seats.operation==='find'&&frame.seats.target_type==='file'){
    const cssFile=active.find(t=>t.key==='css'&&['word','identifier'].includes(t.kind)&&['file','files'].includes(at(t.index+1)?.key));
    if(cssFile)addEvidence(frame,'extension','.css',tokens,[cssFile.index,cssFile.index+1],'explicit CSS file modifier');
  }

  // data_types are capability/request metadata, not one of the 12 core seats.
  if (frame.seats.target_type) frame.data_types.push(frame.seats.target_type);
  if (frame.seats.predicate==='state') frame.data_types.push('state-hook');
  if (frame.seats.predicate==='effect') frame.data_types.push('effect-hook');
  if (frame.seats.predicate==='orphaned' && frame.seats.target_type) frame.data_types.push(`orphan-${frame.seats.target_type}`);
  frame.data_types=uniq(frame.data_types);

  // Protect identifiers that were actually assigned. Unassigned identifiers become language gaps.
  const usedTexts=new Set(frame.evidence.flatMap(e=>e.tokenIndexes??[]));
  const typedUnknownIndexes=new Set(frame.typedUnknowns.map(x=>x.index));
  for (const t of active) {
    if (t.kind==='identifier' || t.kind==='identifier-hyphen') {
      if (usedTexts.has(t.index) || typedUnknownIndexes.has(t.index) || t.kind==='entity') continue;
      // capability descriptions can contain code-ish terms; request mode stays strict.
      if (mode==='capability') continue;
      frame.unknownTokens.push({ token:t.raw,index:t.index,reason:'unresolved-identifier' });
    }
  }

  // De-duplicate unknowns and remove names that earned a semantic role.
  frame.unknownTokens=[...new Map(frame.unknownTokens.filter(g=>!usedTexts.has(g.index)&&!typedUnknownIndexes.has(g.index)).map(g=>[`${g.index}:${g.token}`,g])).values()];
  frame.lexical.unknown=uniq(frame.unknownTokens.map(x=>x.token));

  // Filled seat conflicts: explicit request values beat inherited context; parser reports only impossible double binds here.
  if (frame.seats.reference==='current' && !context.currentTarget && mode==='request') frame.ambiguousSeats.push({ seat:'reference', candidates:[], evidence:'it/this/that', reason:'current reference requested but Bag has no current target' });

  const occupied=Object.entries(frame.seats).filter(([,v])=>v!==null && v!==undefined && !(Array.isArray(v)&&!v.length)).map(([k])=>k);
  frame.unconsumed=active.filter(t=>!usedTexts.has(t.index) && !['punct'].includes(t.kind)).map(t=>t.raw);
  frame.completeLanguage=frame.unknownTokens.length===0 && frame.typedUnknowns.length===0 && frame.ambiguousSeats.length===0 && frame.conflicts.length===0 && !frame.negated;
  frame.occupiedSeats=occupied;
  return frame;
};

export const createSeatParser = async ({ languageRoot, projectOverrideFile = null }) => {
  const [base,overrides,projectOverrides] = await Promise.all([
    readFile(path.join(languageRoot,'type-mapper.json'),'utf8').then(JSON.parse),
    readFile(path.join(languageRoot,'user/type-overrides.json'),'utf8').then(JSON.parse).catch(()=>({entries:[],phrases:[]})),
    projectOverrideFile ? readFile(projectOverrideFile,'utf8').then(JSON.parse).catch(()=>({entries:[],phrases:[]})) : Promise.resolve({entries:[],phrases:[]})
  ]);
  const phraseDir=path.join(languageRoot,'user','key-phrases');
  const reviewed=[];
  try {
    for (const entry of await readdir(phraseDir,{withFileTypes:true})) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try { const item=JSON.parse(await readFile(path.join(phraseDir,entry.name),'utf8')); if(item.reviewed===true&&item.text) reviewed.push({text:item.text,types:item.types??[],senses:item.senses??[]}); } catch {}
    }
  } catch {}
  const lexicon=mergeLexicons(base,{entries:[...(overrides.entries??[]),...(projectOverrides.entries??[])],phrases:[...(overrides.phrases??[]),...(projectOverrides.phrases??[]),...reviewed]});
  const shape1 = (text,{knownEntities=[]}={}) => {
    const known=new Map();
    for (const entity of knownEntities ?? []) if (entity?.name) known.set(low(entity.name),entity);
    const normalized=normalize(text);
    const tokens=classifyTokens(normalized,lexicon,known);
    const words=tokens.filter(t=>t.kind!=='punct').map(t=>({
      index:t.index,
      text:t.raw,
      kind:t.kind,
      ...(t.kind==='word'?{candidates:(t.candidates??[]).map(c=>({lemma:c.lemma,types:c.types??[],senses:c.senses??[],source:c.source??'base'}))}:{}),
      ...(t.kind==='entity'?{entity:t.entity}:{}),
      ...(['literal','path','number','identifier','identifier-hyphen'].includes(t.kind)?{value:t.value??t.raw}:{}),
      ...(t.kind==='unknown'?{unknown:true}:{}),
    }));
    const phrases=findPhraseMatches(normalized,lexicon,tokens);
    const phraseCovered=new Set(phrases.flatMap(p=>p.tokenIndexes));
    return {
      version:'shape1/v0.8.1',
      input:text,
      normalized,
      words,
      phrases,
      unknown:words.filter(w=>w.unknown&&!phraseCovered.has(w.index)).map(w=>({index:w.index,text:w.text}))
    };
  };

  const parse = (text,{context={},knownEntities=[],mode='request'}={}) => {
    const known=new Map();
    for (const entity of knownEntities ?? []) if (entity?.name) known.set(low(entity.name),entity);
    const clauses=splitClauses(text);
    const frames=clauses.map((clause,i)=>{
      const tokens=classifyTokens(clause,lexicon,known);
      const frame={ id:`frame-${i+1}`, index:i, ...inferFrame({text:clause,tokens,context,lexicon,mode}), tokens };
      const inventory=mode==='request'?inventoryRequest(clause,context.projectSettings?.paths??context.paths):null;
      if(inventory){
        frame.inventory=inventory;
        frame.seats={...frame.seats,domain:'base',operation:'find',target_type:'inventory',name:inventory.key,output:'list',predicate:null,relation:null};
        frame.unknownTokens=[];frame.typedUnknowns=[];frame.ambiguousSeats=[];frame.conflicts=[];frame.completeLanguage=true;
        frame.evidence=[{seat:'target_type',value:'inventory',text:clause,reason:'project path inventory request'}];
      }
      return frame;
    });
    return {
      version:'seat-parse/v0.8.5',
      input:text,
      mode,
      frames,
      complete:frames.every(f=>f.completeLanguage),
      gaps:{
        unknownWords:frames.flatMap(f=>f.unknownTokens.map(g=>({frameId:f.id,...g}))),
        ambiguousSeats:frames.flatMap(f=>f.ambiguousSeats.map(g=>({frameId:f.id,...g}))),
        conflicts:frames.flatMap(f=>f.conflicts.map(g=>({frameId:f.id,...g}))),
        typedUnknowns:frames.flatMap(f=>f.typedUnknowns.map(g=>({frameId:f.id,...g}))),
        negation:frames.filter(f=>f.negated).map(f=>({frameId:f.id,text:f.text,type:'negation'}))
      }
    };
  };
  const compileCapability = (description,opts={}) => parse(description,{...opts,mode:'capability'});
  const operationalTypes=Object.freeze(['Operation','TargetType','TargetExpr','Predicate','Relation','Quantifier','Name','Value','Reference','Path','File','Scope','Output','Command','Question','Statement']);
  return Object.freeze({shape1,parse,compileCapability,split:text=>splitClauses(text),coreSeats:CORE_SEATS,operationalTypes,lexiconStats:{forms:lexicon.forms.size,phrases:lexicon.phrases.length}});
};
import { inventoryRequest } from './inventory-request.mjs';
