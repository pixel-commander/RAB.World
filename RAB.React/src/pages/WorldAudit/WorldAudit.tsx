import { useFoldersTable } from './hooks/useFoldersTable';
import { useState } from 'react';
import { useURL } from '../../hooks/useURL/useURL';
import type { WorldAuditProps, AuditTool, MapFolder } from './WorldAudit.types';
import { useDashboard, useFolderMap, useAuditHistory } from './hooks/useDashboard';
import type { AuditRun } from './hooks/useDashboard';
import './css/world-audit.css';
export const WorldAudit = (props: WorldAuditProps) => {
  props = { ...props, path: props.path ?? String.raw`\\Desktop-t72isdi\l\RAB.World\RAB.Toolkits\world-audit` };
  const { items, error } = useDashboard(props);
  const folderMap=useFolderMap();
  const {history,error:historyError}=useAuditHistory();
  const [url,handleURL]=useURL();
  const view=url.url_vars.view==='jobs'?'jobs':'folders';
  return <section className="world-audit" data-grid="header-main" data-gap="content">
    <header data-area="header" className="container-machine"><input type="search" placeholder="Search tools (coming soon)" aria-label="Search tools (coming soon)" disabled /></header>
    <div data-area="main" data-grid="side-cols" data-gap="content">
      <aside data-area="left" className="container-metal">
        <div className="scroll-y">
        <nav aria-label="Audit views">{[{name:'View folders',id:'folders'},{name:'View jobs',id:'jobs'}].map(item=><button key={item.id} type="button" className={`action-ghost${view===item.id?' is-active':''}`} aria-current={view===item.id?'page':undefined} onClick={()=>handleURL({view:item.id},'update-var')}>{item.name}</button>)}</nav>
        {view==='jobs' ? <><h2>Saved runs</h2>{historyError && <p role="alert">{historyError}</p>}{!history.length && <p>No saved runs yet.</p>}<ul>{history.map(run=><li key={run.id}><button type="button" className={`action-ghost${url.url_vars.run===run.id?' is-active':''}`} aria-current={url.url_vars.run===run.id?'true':undefined} onClick={()=>handleURL({run:run.id},'update-var')}>Run jobs · {new Date(run.date_start).toLocaleString()} · {run.status}</button></li>)}</ul></> : <>
        <h2>Folder scan</h2>
        <form className="audit-tool-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void folderMap.handleJob('scan',undefined,undefined,{path:String(data.get('path')),depth:String(data.get('depth')),scan_files:data.get('scan_files')==='on'});}}>
          <label>Path<input name="path" required defaultValue={'C:\\'} /></label>
          <label>Depth (0, 1, 2… or all)<input name="depth" required defaultValue="0" pattern="[0-9]+|all" /></label>
          <label><input name="scan_files" type="checkbox" defaultChecked /> Scan files</label>
          <button type="submit" className="action-ghost" disabled={folderMap.busy}>Add scan to jobs</button>
        </form>
        {folderMap.actionError && <p role="alert">{folderMap.actionError}</p>}
        <h2>Audit tools</h2>
        {error && <p role="alert">{error}</p>}
        {!items && !error && <p role="status">Loading tools...</p>}
        {items && <div className="audit-tool-list">{items.map(tool => <AuditToolRow key={tool.id} tool={tool} />)}</div>}
        {items?.length === 0 && <p>No tools found in this folder.</p>}
        </>}
        </div>
      </aside>
      <div data-area="main" className="container-cell"><div className="scroll-y">{view==='jobs' ? <ViewRun run={history.find(run=>run.id===url.url_vars.run)} /> : <FolderExplorer folderMap={folderMap} />}</div></div>
      <aside data-area="right" className="container-metal"><div className="scroll-y"><ViewJobs queue={folderMap.queue} busy={folderMap.busy} handleJob={folderMap.handleJob} actionError={folderMap.actionError} /></div></aside>
    </div>
  </section>;
};
export default WorldAudit;

export const AuditToolRow = ({ tool }: { tool: AuditTool }) => {
  return <details className="audit-tool-row">
    <summary className="action-ghost">{tool.title ?? tool.name}</summary>
    <form className="audit-tool-form" aria-label={`${tool.title ?? tool.name} settings`} onSubmit={event => event.preventDefault()}>
      {tool.description && <p>{tool.description}</p>}
      {tool.settings.map(setting => {
        const id = `audit-${tool.id}-${setting.name}`;
        const descriptionId = `${id}-description`;
        const shared = { id, name: setting.name, required: setting.required, 'aria-describedby': setting.description ? descriptionId : undefined };
        return <div className="audit-tool-field" key={setting.name}>
          <label htmlFor={id}>{setting.title ?? setting.name}{setting.required ? ' *' : ''}</label>
          {setting.type === 'boolean' ? <input {...shared} type="checkbox" defaultChecked={setting.default === true} />
            : setting.type === 'options' ? <select {...shared} defaultValue={String(setting.default ?? '')}><option value="">Select...</option>{setting.options?.map(option => {
              const value = typeof option === 'string' ? option : option.name;
              return <option key={value} value={value}>{typeof option === 'string' ? option : option.title ?? option.name}</option>;
            })}</select>
            : setting.type === 'textarea' || setting.type === 'json' ? <textarea {...shared} defaultValue={String(setting.default ?? '')} />
            : <input {...shared} type={setting.type === 'number' ? 'number' : 'text'} defaultValue={String(setting.default ?? '')} />}
          {setting.description && <small id={descriptionId}>{setting.description}</small>}
        </div>;
      })}
    </form>
  </details>;
};

export const FolderExplorer = ({folderMap}:{folderMap:ReturnType<typeof useFolderMap>}) => {
  const {data,error,busy,actionError,handleAction,queue,handleJob}=folderMap;
  const [url,handleURL]=useURL();
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState<'name'|'path'>('name');
  const [layout,setLayout]=useState<'tree'|'table'>('tree');
  const [checked,setChecked]=useState<string[]>([]);
  const check=(id:string,value:boolean)=>setChecked(previous=>value ? [...new Set([...previous,id])] : previous.filter(item=>item!==id));
  const act=async(action:'ignore'|'details'|'learn-all')=>{if(await (action==='ignore'?handleAction(checked,action):handleJob(action,checked)))setChecked([]);};
  const {root,rows,byId}=useFoldersTable({items:data?.items,search,sort});
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status">Loading folder map...</p>;
  const selected=byId.get((url.url_vars.folder??'').toLowerCase())??root;
  const select=(id:string)=>handleURL({folder:String(id)},'update-var');
  if(!root || !selected)return <p>No folder map imported yet.</p>;

  return <section className="folder-explorer">
    <header className="folder-explorer-header"><h2>Laptop · Folder map</h2><p>Pass 1 · Top-level folders · {data.items.length-1} folders · {((data.run?.duration_ms??0)/1000).toFixed(2)}s</p>
      <label>Find a folder <input type="search" value={search} onChange={event=>setSearch(event.target.value)} /></label>

    </header>
    <label>Sort <select value={sort} onChange={event=>setSort(event.target.value as 'name'|'path')}><option value="name">Name</option><option value="path">Path</option></select></label>
    <div className="folder-table-actions"><span>{checked.length} selected</span><button type="button" className="action-ghost" disabled={busy || queue.running || !queue.jobs.some(job=>job.status==='pending')} onClick={()=>void handleJob('run')}>{queue.running ? 'Running jobs…' : `Run jobs (${queue.jobs.filter(job=>job.status==='pending').length})`}</button><button type="button" className="action-ghost" disabled={busy || !checked.length} onClick={()=>void act('ignore')}>Ignore</button><button type="button" className="action-ghost" disabled={busy || !checked.length} onClick={()=>void act('details')}>Learn more</button><button type="button" className="action-ghost" disabled={busy || !checked.length} onClick={()=>void act('learn-all')}>Learn all</button><button type="button" className="action-ghost" disabled={!checked.length} onClick={()=>setChecked([])}>Clear selection</button></div>
    {busy && <p role="status">Processing selected folders...</p>}
    {actionError && <p role="alert">{actionError}</p>}
    <nav className="folder-table-actions" aria-label="Folder presentation">{(['tree','table'] as const).map(value=><button type="button" key={value} className={`action-ghost${layout===value?' is-active':''}`} aria-pressed={layout===value} onClick={()=>setLayout(value)}>{value==='tree'?'Folder tree':'Table'}</button>)}</nav>
    {layout==='tree' ? <FolderTreeViewer items={data.items} root={root} selected={selected} search={search} checked={checked} handleClick={select} handleCheck={check} /> : <ViewFoldersTable items={rows} selected={selected.path} handleClick={select} checked={checked} handleCheck={check} /> }
    {!rows.length && <p>No matching top-level folders.</p>}
    <details><summary>Excluded, skipped, and unreadable paths ({data.run?.errors.length??0})</summary><ul>{data.run?.errors.map(item=><li key={item.path}>{item.path} — {item.reason??item.code}</li>)}</ul></details>
  </section>;
};
export const ViewFoldersTable = (props: { items: Array<MapFolder & {depth?:number;totals?:{files:number;size:number;scanned:number;folders:number;complete:boolean}}>; selected?: string; handleClick?: (id: string) => void; checked?: string[]; handleCheck?: (id: string, checked: boolean) => void }) => {
  return <table className="view-folders-table">
    <caption>Top-level folders</caption>
    <thead><tr><th scope="col"><input type="checkbox" aria-label="Select all visible folders" checked={props.items.length > 0 && props.items.every(item=>props.checked?.includes(item.path))} ref={input=>{if(input)input.indeterminate=props.items.some(item=>props.checked?.includes(item.path)) && !props.items.every(item=>props.checked?.includes(item.path));}} onChange={event=>props.items.forEach(item=>props.handleCheck?.(item.path,event.target.checked))} /></th>{['Name' , 'Path', 'Depth', 'Folders', 'Files (branch)', 'Size (branch)', 'Last scan', 'Described'].map(name => <th scope="col" key={name}>{name}</th>)}</tr></thead>
    <tbody>{props.items.map(item => {
      const described = Boolean(item.description?.trim());
      const folders = item.folders?.length;
      return <tr key={item.path}>
        <td><input type="checkbox" aria-label={`Select ${item.path}`} checked={props.checked?.includes(item.path) ?? false} onChange={event=>props.handleCheck?.(item.path,event.target.checked)} /></td>
        <td><button type="button" className={`action-ghost${props.selected === item.path ? ' is-active' : ''}`} aria-current={props.selected === item.path ? 'true' : undefined} onClick={() => props.handleClick?.(item.path)}>{item.name}</button></td>
        <td>{item.path}</td><td>{item.depth ?? '—'}</td><td>{folders ?? '—'}</td>
        <td>{item.totals?.scanned ? item.totals.files.toLocaleString() : '—'}{item.totals && !item.totals.complete && <small>Incomplete · {item.totals.scanned}/{item.totals.folders} mapped folders counted</small>}</td><td>{item.totals?.scanned ? `${item.totals.size.toLocaleString()} bytes${item.totals.complete?'':' (incomplete)'}` : '—'}</td><td>{item.date === undefined ? '—' : new Date(item.date).toLocaleString()}{!!item.errors?.length && ' (partial)'}</td><td>{String(described)}</td>
      </tr>;
    })}</tbody>
  </table>;
};

export const ViewJobs = ({queue,busy,handleJob,actionError}:Pick<ReturnType<typeof useFolderMap>,'queue'|'busy'|'handleJob'|'actionError'>) => {
  return <section className="folder-explorer">
    {actionError && <p role="alert">{actionError}</p>}
    <h2>Job runner</h2>{queue.summary && <div><p>{queue.summary.success_count} succeeded · {queue.summary.fail_count} failed · {queue.summary.partial_count} partial</p><p>Tools: {queue.summary.tools.join(', ')}</p><p>Started: {new Date(queue.summary.date_start).toLocaleString()}<br />Ended: {queue.summary.date_end ? new Date(queue.summary.date_end).toLocaleString() : 'Running'}<br />Duration: {queue.summary.duration_ms == null ? 'Running' : `${(queue.summary.duration_ms/1000).toFixed(1)}s`}</p>{queue.summary.error && <p role="alert">History save failed: {queue.summary.error}</p>}</div>}<button type="button" className="action-ghost" disabled={busy || queue.running || !queue.jobs.some(job=>job.status==='pending')} onClick={()=>void handleJob('run')}>Run jobs</button>
    {!queue.jobs.length && <p>Select folders and choose Learn more or Learn all to queue jobs.</p>}
    <ol>{queue.jobs.map(job=><li key={job.id}>
      <strong>{job.action==='scan'?'Folder scan':job.action==='details'?'Learn more':'Learn all'}</strong><p>{job.path}</p>
      <p>{job.status} · {(job.duration_ms/1000).toFixed(1)}s · {job.error_count} errors</p><p>Started: {job.date_start ? new Date(job.date_start).toLocaleString() : '—'}<br />Ended: {job.date_end ? new Date(job.date_end).toLocaleString() : '—'}</p>
      <p>{job.stats.folders === undefined ? '' : `${job.stats.folders} folders visited `}{job.stats.files === undefined ? '' : `${job.stats.files} files `}{job.stats.size === undefined ? '' : `${job.stats.size.toLocaleString()} bytes`}</p>
      {job.stats.path && <small>{job.stats.path}</small>}
      {job.errors?.map((error,index)=><p key={index}>{error.message??error.code}</p>)}
      {job.status==='input-required' && <form onSubmit={event=>{event.preventDefault();const values=new FormData(event.currentTarget);const inputs:Record<string,unknown>={};try{for(const field of job.missing??[]){const value=String(values.get(field.name)??'');inputs[field.name]=field.type==='json'?JSON.parse(value):field.type==='number'?Number(value):field.type==='boolean'?value==='true':value;}}catch{event.currentTarget.reportValidity();return;}void handleJob('supply',undefined,job.id,inputs);}}>
        <p>Missing inputs</p>{job.missing?.map(field=><label key={field.name}>{field.title??field.name}<input name={field.name} required /></label>)}<button className="action-ghost" type="submit">Save inputs</button>
      </form>}
      {job.status==='pending' && <button type="button" className="action-ghost" onClick={()=>void handleJob('remove',undefined,job.id)}>Remove</button>}
    </li>)}</ol>
  </section>;
};

export const ViewRun=({run}:{run?:AuditRun})=>{
 if(!run)return <p>Select a saved run on the left to inspect its stats.</p>;
 return <section className="folder-explorer"><h2>{run.name}</h2><dl>
 <dt>Status</dt><dd>{run.status}</dd><dt>Started</dt><dd>{new Date(run.date_start).toLocaleString()}</dd><dt>Ended</dt><dd>{run.date_end==null?'—':new Date(run.date_end).toLocaleString()}</dd>
 <dt>Duration</dt><dd>{run.duration_ms==null?'—':`${(run.duration_ms/1000).toFixed(2)}s`}</dd>
 <dt>Success / Failed / Partial</dt><dd>{run.success_count??(run.status==='completed'?1:0)} / {run.fail_count??(run.status==='failed'?1:0)} / {run.partial_count??(run.status==='partial'?1:0)}</dd>
 <dt>Errors</dt><dd>{run.error_count??run.errors?.length??0}</dd><dt>Tools</dt><dd>{(run.tools??[run.name]).join(', ')}</dd></dl>
 <h3>Steps</h3>{!run.steps ? <p>This older run did not save step details.</p> : <ol>{run.steps.map(step=><li key={step.id}><details><summary>{step.path} · {step.name} · {step.status} · {(step.duration_ms/1000).toFixed(2)}s · {step.error_count} errors</summary><p>Started: {step.date_start==null?'—':new Date(step.date_start).toLocaleString()}<br/>Ended: {step.date_end==null?'—':new Date(step.date_end).toLocaleString()}</p><pre>{JSON.stringify(step.stats,null,2)}</pre>{step.tools.map(tool=><details key={tool.id}><summary>{tool.name} · {tool.status} · {(tool.duration_ms/1000).toFixed(2)}s</summary><pre>{JSON.stringify(tool,null,2)}</pre></details>)}<pre>{JSON.stringify(step.errors,null,2)}</pre></details></li>)}</ol>}
 <h3>Inputs</h3><pre>{JSON.stringify(run.options??{},null,2)}</pre><h3>Errors</h3><pre>{JSON.stringify(run.errors??[],null,2)}</pre></section>;
};

const FolderIcon=()=>{return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 7V5h6l2 2h10v12H3Z"/><path d="M3 10h18"/></svg>;};
const formatBytes=(value:number)=>{const units=['B','KB','MB','GB','TB'];let index=0;while(value>=1024&&index<units.length-1){value/=1024;index++;}return `${value.toLocaleString(undefined,{maximumFractionDigits:index?1:0})} ${units[index]}`;};
export const FolderTreeViewer=(props:{items:MapFolder[];root:MapFolder;selected:MapFolder;search:string;checked:string[];handleClick:(path:string)=>void;handleCheck:(path:string,value:boolean)=>void})=>{
 const byPath=new Map(props.items.map(item=>[item.path.toLowerCase(),item]));
 const children=new Map<string,MapFolder[]>();for(const item of props.items){if(item.parent){const key=item.parent.toLowerCase();if(!children.has(key))children.set(key,[]);children.get(key)!.push(item);}}
 const ancestors:MapFolder[]=[];const seen=new Set<string>();let current:MapFolder|undefined=props.selected;
 while(current&&!seen.has(current.path.toLowerCase())){seen.add(current.path.toLowerCase());ancestors.unshift(current);current=current.parent?byPath.get(current.parent.toLowerCase()):undefined;}
 const rows=props.search?props.items.filter(item=>!item.ignored&&item.path.toLowerCase().includes(props.search.toLowerCase())):[props.root];
 const selected=props.selected;
 return <div className="folder-browser" data-grid="side-left" data-gap="content">
 <section data-area="side" className="container-metal"><div className="scroll-y folder-tree"><h3>Folders</h3><p>{props.search?`${rows.length} matches`:'Expand a branch to explore'}</p>
 {rows.map(item=><FolderTreeNode key={item.path} folder={item} childrenByPath={children} selected={selected.path} checked={props.checked} handleClick={props.handleClick} handleCheck={props.handleCheck} ancestors={[]} flat={!!props.search} />)}
 </div></section>
 <section data-area="main" className="container-main"><div className="scroll-y folder-inspector">
 <nav className="folder-breadcrumbs" aria-label="Folder location">{ancestors.map(item=><button type="button" className="action-ghost" key={item.path} onClick={()=>props.handleClick(item.path)}>{item.name}</button>)}</nav>
 <h3><FolderIcon/> {selected.name}</h3><p className="folder-path">{selected.path}</p>
 <div className="folder-facts"><span>{selected.folders?.length??'—'} direct folders</span><span>{selected.files?.length??'—'} direct files</span><span>{selected.size==null?'—':formatBytes(selected.size)}</span></div>
 {selected.description && <p>{selected.description}</p>}
 <h4>Files</h4>{selected.files===undefined?<p>Files have not been inventoried. Select this folder and choose Learn more.</p>:!selected.files.length?<p>No direct files recorded.</p>:<table><thead><tr><th>Name</th><th>Type</th><th>Size</th></tr></thead><tbody>{selected.files.map(file=><tr key={file.name}><td>{file.name}</td><td>{file.type||'No extension'}</td><td>{formatBytes(file.size)}</td></tr>)}</tbody></table>}
 {!!selected.errors?.length&&<p role="status">Partial scan · {selected.errors.length} errors</p>}
 </div></section></div>;
};
export const FolderTreeNode=(props:{folder:MapFolder;childrenByPath:Map<string,MapFolder[]>;selected:string;checked:string[];handleClick:(path:string)=>void;handleCheck:(path:string,value:boolean)=>void;ancestors:string[];flat?:boolean;showStats?:boolean})=>{
 const [open,setOpen]=useState(props.folder.parent===null);const item=props.folder;
 const children=(props.childrenByPath.get(item.path.toLowerCase())??[]).filter(child=>!child.ignored&&!props.ancestors.includes(child.path.toLowerCase()));
 return <div className="folder-node"><div className={`folder-node-row${props.showStats?' folder-node-row--stats':''}`}>
 <button type="button" className="action-ghost folder-expand" aria-label={`${open?'Collapse':'Expand'} ${item.name}`} aria-expanded={open} disabled={!children.length||props.flat} onClick={()=>setOpen(!open)}>{children.length&&!props.flat?(open?'▾':'▸'):'·'}</button>
 <input type="checkbox" aria-label={`Select ${item.path}`} checked={props.checked.includes(item.path)} onChange={event=>props.handleCheck(item.path,event.target.checked)} />
 <button type="button" title={item.path} className={`action-ghost folder-node-link${props.selected===item.path?' is-active':''}`} aria-current={props.selected===item.path?'true':undefined} onClick={()=>props.handleClick(item.path)}><FolderIcon/><span>{item.name}</span></button>
 {!props.showStats&&<small>{item.errors?.length?'Partial':item.folders===undefined?'Unscanned':item.folders.length}</small>}
 {props.showStats&&<span className="folder-row-stats" title={item.errors?.length?'Partial inventory':'Direct files in this folder'}>{Array.isArray(item.files)?<><span className="folder-row-count">{item.files.length.toLocaleString()} <span>files</span></span><span className="folder-row-size">{formatBytes(item.files.reduce((sum,file)=>sum+file.size,0))}</span>{!!item.errors?.length&&<span aria-label="Partial scan">*</span>}</>:<span className="folder-row-unscanned">Not scanned</span>}</span>}</div>{open&&!props.flat&&<div className="folder-node-children">{children.map(child=><FolderTreeNode {...props} key={child.path} folder={child} ancestors={[...props.ancestors,item.path.toLowerCase()]} />)}</div>}</div>;
};

