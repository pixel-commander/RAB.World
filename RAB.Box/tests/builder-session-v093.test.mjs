import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import os from 'node:os';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {createToolHouse} from '../bridge/tool-house.mjs';import {createSessionPlanner} from '../bridge/session-planner.mjs';import {loadProject} from '../engine/src/project.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('explicit component target overrides a previous page address and known names answer input questions',async t=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'rab-builder-turn-'));t.after(()=>rm(temp,{recursive:true,force:true}));const rabHome=path.join(temp,'.rab'),house=createToolHouse({root});
 const made=await house.runTool({key:'react/stamp-new-project',options:{name:'Fresh',folder:temp},context:{rab_home:rabHome}}),meta=made.result.project;
 const planner=await createSessionPlanner({root,projectRoot:meta.root,project:await loadProject(meta.root),languageRoot:path.join(root,'language'),rabHome});
 const session=await planner.newSession(),sessionId=session.session_id;
 const send=async text=>{const p=await planner.turn({sessionId,text});if(p.ready_to_confirm)return planner.execute({sessionId,confirm:true});return p;};
 for(const text of ['create react component called TargetCard','create react page called Canvas','apply grid layout "header-main" to component "Canvas"']){const r=await send(text);assert.ok(r.current_steps.every(s=>s.status==='completed'),text);}
 const page=path.join(meta.root,'src/pages/Canvas/Canvas.tsx'),before=await readFile(page,'utf8');
 await send('add a div to component "TargetCard"');await send('add class "skin-main" to component "TargetCard"');
 const component=await readFile(path.join(meta.root,'src/components/TargetCard/TargetCard.tsx'),'utf8');assert.match(component,/<div data-rab-seat="element-[^"]+"><\/div>/);assert.match(component,/skin-main/);assert.equal(await readFile(page,'utf8'),before);
 // A fresh session asks for the owner rather than borrowing an unrelated address.
 const second=await planner.newSession();let response=await planner.turn({sessionId:second.session_id,text:'add class "area-skin" to data-area=main'});
 assert.equal(response.current_steps[0].gaps.requiredInputs[0].field,'component');
 response=await planner.turn({sessionId:second.session_id,text:'Canvas'});assert.equal(response.last_turn.mode,'answer');assert.equal(response.ready_to_confirm,true);
 await planner.execute({sessionId:second.session_id,confirm:true});assert.match(await readFile(page,'utf8'),/area-skin/);
});
