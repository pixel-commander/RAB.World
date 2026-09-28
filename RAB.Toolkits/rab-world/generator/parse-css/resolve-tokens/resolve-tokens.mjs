import valueParser from 'postcss-value-parser';
export const run=async({options={}}={})=>{
 const sources=options.tokens?.sources??[];const input=options.classes;if(!input?.rules)throw new Error('classes result is required');
 const definitions=new Map();const missing=new Set(),cycles=new Set();
 for(const source of [...sources,input])for(const rule of source.rules){if(rule.conditions.length||![':root','html','*'].includes(rule.selector.trim()))continue;for(const d of rule.declarations)if(d.name.startsWith('--')){const old=definitions.get(d.name);if(!old?.important||d.important)definitions.set(d.name,d);}}
 const resolve=(text,stack=[])=>{let ok=true;const ast=valueParser(text);ast.walk(node=>{if(node.type!=='function'||node.value!=='var')return;const comma=node.nodes.findIndex(n=>n.type==='div'&&n.value===',');const key=valueParser.stringify(comma<0?node.nodes:node.nodes.slice(0,comma)).trim();let result;
 if(stack.includes(key)){cycles.add(key);result={ok:false,text:''};}else if(definitions.has(key))result=resolve(definitions.get(key).value,[...stack,key]);else{missing.add(key);result={ok:false,text:''};}
 if(!result.ok&&comma>=0)result=resolve(valueParser.stringify(node.nodes.slice(comma+1)),stack);
 if(result.ok){node.type='word';node.value=result.text;delete node.nodes;}else ok=false;return false;});return {text:ast.toString(),ok};};
 const rules=input.rules.map(rule=>({...rule,declarations:rule.declarations.map(d=>({...d,resolved:resolve(d.value).text}))}));
 return {...input,rules,tokens:sources,css:[...sources.map(s=>s.css),input.css].join('\n'),missing:[...missing],cycles:[...cycles],notes:['Static resolution uses unconditional root tokens. Scoped and conditional rules are preserved for browser evaluation.']};
};
