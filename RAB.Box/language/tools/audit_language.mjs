import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createSeatParser } from '../../bridge/seat-parser.mjs';
import { createCapabilityRegistry } from '../../bridge/capabilities.mjs';
import { createToolHouse } from '../../bridge/tool-house.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const mapper=await json(path.join(ROOT,'language','type-mapper.json'));
const coverage=await json(path.join(ROOT,'language','coverage-samples.json'));
const parser=await createSeatParser({languageRoot:path.join(ROOT,'language')});
const registry=await createCapabilityRegistry({projectRoot:path.join(ROOT,'mock-project'),seatParser:parser});
const house=createToolHouse({root:ROOT});
const scan=await house.scan({fresh:true});
const forms=mapper.entries.flatMap(e=>(e.forms??[e.lemma]).map(form=>({form,lemma:e.lemma,types:e.types??[],senses:e.senses??[]})));
const byForm=new Map(); for(const row of forms){const list=byForm.get(row.form)??[];list.push(row);byForm.set(row.form,list)}
const samples=[];
for(const sample of coverage.samples){
  const parsed=parser.parse(sample.text,{context:sample.context??{},knownEntities:sample.known??[]});
  samples.push({text:sample.text,complete:parsed.complete,gaps:parsed.gaps,seats:parsed.frames.map(f=>f.seats),expected_failure:sample.expect_failure??null});
}
const projectStampRows=registry.stamps.map(cap=>({kind:'project-stamp',name:cap.name,complete:cap.descriptionParse?.complete===true,shape:cap.shape,gaps:cap.descriptionParse?.gaps??null}));
const toolRows=scan.items.map(cap=>({kind:cap.kind,id:cap.id,name:cap.name,path:cap.path,authority:cap.authorityClass,meta:cap.meta}));
const report={
  version:'rraabbiitt-language-audit/v0.9',generated_at:new Date().toISOString(),
  mapper:{entries:mapper.entries.length,forms:forms.length,unique_forms:byForm.size,phrases:(mapper.phrases??[]).length,duplicate_forms:[...byForm].filter(([,rows])=>rows.length>1).map(([form,rows])=>({form,candidates:rows}))},
  coverage:{total:samples.length,complete:samples.filter(x=>x.complete).length,expected_failures:samples.filter(x=>x.expected_failure).length,samples},
  capabilities:{project_stamps:registry.stamps.length,tools:scan.items.filter(x=>x.kind==='tool').length,stamps:scan.items.filter(x=>x.kind==='stamp').length,unavailable:scan.unavailable,total:scan.items.length,project_stamp_descriptions_complete:projectStampRows.filter(x=>x.complete).length,rows:[...projectStampRows,...toolRows]}
};
const out=process.argv[2]?path.resolve(process.argv[2]):null;
if(out){await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n','utf8');}
console.log(JSON.stringify(report,null,2));
