import { useState, useEffect } from 'react';
import type { WorldAuditProps, AuditTool, FolderMap } from '../WorldAudit.types';
export const useDashboard = (props: WorldAuditProps) => {
  const [state, setState] = useState<{ items?: AuditTool[]; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController(); setState({});
    fetch(`/api/audit-tools?path=${encodeURIComponent(props.path ?? '')}`, { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!controller.signal.aborted) setState({ items: data.items }); })
      .catch(error => { if (!controller.signal.aborted) setState({ error: error.message }); });
    return () => controller.abort();
  }, [props.path]);
  return { ...props, ...state };
};

export const useFolderMap = () => {
  const [data, setData] = useState<FolderMap>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller=new AbortController();
    fetch('/api/audit-map',{signal:controller.signal}).then(async response=>{
      const result=await response.json(); if(!response.ok)throw new Error(result.error);
      if(!controller.signal.aborted)setData(result);
    }).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
    return ()=>controller.abort();
  },[]);
  const [busy,setBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const handleAction=async(paths:string[],action:'ignore'|'details'|'learn-all')=>{
    setBusy(true);setActionError('');
    try{const response=await fetch('/api/audit-map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths,action})});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result);return true;}
    catch(error){setActionError(error instanceof Error?error.message:String(error));return false;}
    finally{setBusy(false);}
  };
  const [queue,setQueue]=useState<{running:boolean;summary?:{date_start:number;date_end:number|null;duration_ms:number|null;success_count:number;fail_count:number;partial_count:number;tools:string[];error?:string};jobs:Array<{id:string;path:string;action:string;status:string;missing?:Array<{name:string;title?:string;type?:string}>;duration_ms:number;date_start?:number;date_end?:number;error_count:number;stats:{folders?:number;files?:number;size?:number;path?:string};errors?:Array<{message?:string;code?:string}>}>}>({running:false,jobs:[]});
  useEffect(()=>{
    let stopped=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{
      const response=await fetch('/api/audit-jobs');if(!response.ok)throw new Error('Could not load jobs');const next=await response.json();
      if(!stopped){setQueue(next);const map=await fetch('/api/audit-map');if(map.ok){const value=await map.json();if(!stopped)setData(value);}}
    }catch(error){if(!stopped)setActionError(String(error));}finally{if(!stopped)timer=setTimeout(poll,1000);}};
    void poll();return()=>{stopped=true;clearTimeout(timer);};
  },[]);
  const handleJob=async(action:string,paths?:string[],id?:string,inputs?:Record<string,unknown>)=>{
    setBusy(true);setActionError('');
    try{const response=await fetch('/api/audit-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,paths,id,inputs})});const result=await response.json();if(!response.ok)throw new Error(result.error);setQueue(result);return true;}
    catch(error){setActionError(String(error));return false;}finally{setBusy(false);}
  };
  return {data,error,busy,actionError,handleAction,queue,handleJob};
};

export interface AuditStep {id:string;path:string;name:string;status:string;date_start:number|null;date_end:number|null;duration_ms:number;error_count:number;stats:Record<string,unknown>;errors:unknown[];tools:Array<{id:string;name:string;status:string;duration_ms:number;date_start:number;date_end:number;options:unknown;errors:unknown[]}>;}
export interface AuditRun { steps?:AuditStep[]; id:string;name:string;status:string;date_start:number;date_end?:number;duration_ms?:number;success_count?:number;fail_count?:number;partial_count?:number;error_count?:number;tools?:string[];options?:unknown;errors?:unknown[]; }
export const useAuditHistory=()=>{
 const [history,setHistory]=useState<AuditRun[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;
 const poll=async()=>{try{const response=await fetch('/api/audit-history');const data=await response.json();if(!response.ok)throw new Error(data.error);if(!stopped){setHistory(data.items.filter((run:AuditRun)=>run.name==='audit-jobs'));setError(data.invalid?`${data.invalid} unreadable history entries`: '');}}catch(error){if(!stopped)setError(String(error));}finally{if(!stopped)timer=setTimeout(poll,2000);}};
 void poll();return()=>{stopped=true;clearTimeout(timer);};},[]);
 return {history,error};
};
