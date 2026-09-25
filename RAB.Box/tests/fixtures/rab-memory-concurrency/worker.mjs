import { createRabMemory } from '../../../bridge/rab-memory.mjs';
import { newExecution } from '../../../bridge/tool-tracking.mjs';
import { withMemoryLock } from '../../../bridge/rab-memory-lock.mjs';

process.send({ ready: true });
process.once('message', async config => {
  try {
    if(config.holdLock){
      await withMemoryLock(config.holdLock,async()=>{
        process.send({ locked:true });
        await new Promise(()=>{});
      });
      return;
    }
    const memory=createRabMemory({rabHome:config.rabHome});
    const records=[];
    for(let i=0;i<config.count;i++){
      const name=`worker-${config.worker}-${i}`,value=[false,0,''][i%3];
      await memory.setProjectPath(config.project,name,value);
      await memory.setFact(config.project,name,value);
      await memory.addResource(config.project,{type:'component',name,path:name,value});
      const session=await memory.createSession(config.project);
      const execution=newExecution({id:await memory.allocateId(),key:'probe/read'});
      execution.session_id=session.id;
      execution.status='completed';
      const childExecution=newExecution({id:await memory.allocateId(),key:'probe/child',parentExecutionId:execution.execution_id});
      childExecution.session_id=session.id;childExecution.status='completed';
      const child={name,value};const result={nested:{child},name};
      execution.result_bytes=JSON.stringify(result).length;
      childExecution.result_bytes=JSON.stringify(child).length;
      const output={tool:{key:'probe/read'},options:{name},result,seats:{child},authority:'read',execution,tasks:[
        {parentTaskId:null,result,execution},
        {parentTaskId:execution.execution_id,result:child,execution:childExecution}
      ]};
      const file=await memory.saveToolResult(config.project,output,{sessionId:session.id});
      await memory.saveToolExecution(config.project,execution);
      await memory.saveToolExecution(config.project,childExecution);
      session.bag.seats=output.stored_seats;
      await memory.saveSession(config.project,session);
      records.push({name,value,sessionId:session.id,file,execution,childExecution});
    }
    process.send({records});process.disconnect();
  }catch(error){process.send({error:{code:error.code,message:error.message,stack:error.stack}});process.disconnect();process.exitCode=1;}
});
