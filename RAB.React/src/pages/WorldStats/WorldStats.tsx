import {CSSMockup} from '../../components/CSSMockup/CSSMockup';
import {WorldPaths} from '../WorldView/WorldView';
import {Tabs} from '../../components/Tabs/Tabs';
import {TotalsTable} from '../../components/TotalsTable/TotalsTable';
import {FloatPanel} from '../../components/FloatPanel/FloatPanel';
import {CodeEditor} from '../../components/CodeEditor/CodeEditor';
import {StatCells} from '../../components/StatCells/StatCells';
import {PieChart} from '../../components/PieChart/PieChart';
import {useState,useEffect} from 'react';
import {useURL} from '../../hooks/useURL/useURL';
import {useFolderMap} from '../WorldAudit/hooks/useDashboard';
import {FolderTreeNode} from '../WorldAudit/WorldAudit';
import type {MapFolder} from '../WorldAudit/WorldAudit.types';
import '../WorldAudit/css/world-audit.css';
export const WorldStats=()=>{
 const folderMap=useFolderMap();
 const [search,setSearch]=useState('');
 const [url,handleURL]=useURL();
 const [checked,setChecked]=useState<string[]>([]);
 const {data,error}=folderMap;
 const children=new Map<string,MapFolder[]>();
 for(const item of data?.items??[]){if(item.parent){const key=item.parent.toLowerCase();if(!children.has(key))children.set(key,[]);children.get(key)!.push(item);}}
 const query=search.trim().toLowerCase();
 const roots=(data?.items??[]).filter(item=>!item.ignored&&(query?JSON.stringify(item).toLowerCase().includes(query):item.parent===null));
 const selected=data?.items.find(item=>item.path.toLowerCase()===(url.url_vars.folder??'').toLowerCase());
 return <section className="world-stats" data-grid="header-main" data-gap="content">
  <header data-area="header"><h2>World stats</h2><label>Search folders <input type="search" value={search} placeholder="Search any field, filename, or extension" onChange={event=>setSearch(event.target.value)}/></label>{search.trim()&&<span role="status"> {roots.length} matching folders</span>}</header>
  <div data-area="main" data-grid="side-left" data-gap="content">
   <aside data-area="side" className="container-metal"><Tabs use_url tabs={[
    {id:'folders',name:'Folders',View:()=><div className="scroll-y folder-tree"><h3>Folders</h3>
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p role="status">Loading folders...</p>}{data&&!roots.length&&<p>{query?'No matching folders.':'No folder map yet.'}</p>}
    {roots.map(folder=><FolderTreeNode key={folder.path} folder={folder} childrenByPath={children} selected={url.url_vars.folder??''} checked={checked} handleClick={path=>handleURL({folder:path},'update-var')} handleCheck={(path,value)=>setChecked(previous=>value?[...new Set([...previous,path])]:previous.filter(item=>item!==path))} ancestors={[]} flat={Boolean(query)} showStats />)}
   </div>},
    {id:'beacons',name:'Beacons',View:()=> <WorldPaths path={String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab\worlds\server`} collection="beacons"/>}
   ]}/></aside>
   <section data-area="main" className="container-cell"><div className="scroll-y folder-inspector">{url.url_vars.tab==='Beacons' ? (url.url_vars.entry ? <WorldPaths path={String.raw`\\Desktop-t72isdi\c\Users\gauge\.rab\worlds\server`} collection="beacons" entry={url.url_vars.entry}/> : <p>Select a beacon to view its contents.</p>) : selected ? <FolderStats key={selected.path} folder={selected} folders={data?.items??[]} /> : <><h3>Statistics</h3><p>Select a folder on the left to see its stats.</p></>}</div></section>
  </div>
 </section>;
};

const bytes=(value:number)=>{const units=['B','KB','MB','GB','TB'];let i=0;while(value>=1024&&i<units.length-1){value/=1024;i++;}return `${value.toLocaleString(undefined,{maximumFractionDigits:i?1:0})} ${units[i]}`;};
export const FolderStats=({folder,folders}:{folder:MapFolder;folders:MapFolder[]})=>{
 const [url,handleURL]=useURL();
 const fileName=url.url_vars.file;
 const withPaths=(item:MapFolder)=>{return (item.files??[]).map(file=>({...file,folder:item.path,path:item.path.replace(/[\\/]+$/,'')+'\\'+file.name}));};
 const handleFilePath=(item:Record<string,unknown>)=>handleURL({folder:String(item.folder),file:''},'update-var');
 const handleCSS=(item:Record<string,unknown>)=>handleURL({folder:String(item.folder),file:encodeURIComponent(String(item.name)),preview:'css'},'update-var');
 const directFiles=withPaths(folder);
 const byPath=new Map(folders.map(item=>[item.path.toLowerCase(),item]));
 const pending=[folder.path],seen=new Set<string>(),branchFiles:Record<string,unknown>[]=[];
 while(pending.length){const path=pending.pop()!;const key=path.toLowerCase();if(seen.has(key))continue;seen.add(key);const item=byPath.get(key);if(!item||item.ignored)continue;branchFiles.push(...withPaths(item));pending.push(...(item.folders??[]));}

 const size=folder.files?.reduce((total,file)=>total+file.size,0);
 return <section>{fileName&&<FilePopup key={folder.path+fileName} folder={folder.path} encodedName={fileName} previewCSS={url.url_vars.preview==='css'} close={()=>handleURL({file:'',preview:''},'remove-var')}/>}<h2>{folder.name}</h2><p className="folder-path">{folder.path}</p>
 <h3>Direct contents</h3><StatCells items={[{name:'Folders',value:folder.folders?.length??'—'},{name:'Files',value:folder.files?.length??'—'},{name:'Size',value:size===undefined?'—':bytes(size)}]}/>
 <p>Last scan: {folder.date==null?'Not scanned':new Date(folder.date).toLocaleString()}</p>
 {!!folder.errors?.length&&<p role="status">Partial scan Â· {folder.errors.length} errors</p>}
 {folder.description&&<p>{folder.description}</p>}
 {folder.files===undefined?<p>Files have not been scanned.</p>:<>
 <div data-cols="2" data-gap="content"><section><h3>Files by extension</h3><PieChart data={folder.files} grouping_key="type"/></section><section><h3>Size by extension</h3><PieChart data={folder.files} grouping_key="type" value_key="size"/></section></div>
 <TotalsTable data={folder.files} items={directFiles} handlePath={handleFilePath} handleCSS={handleCSS} grouping_key="type" value_key="size"/>
 <h3>Files</h3>{!folder.files.length?<p>No direct files.</p>:<table><thead><tr><th scope="col">Name</th><th scope="col">Extension</th><th scope="col">Size</th></tr></thead><tbody>{folder.files.map(file=><tr key={file.name}><td><button type="button" className="action-ghost" onClick={()=>handleURL({file:encodeURIComponent(file.name),preview:''},'update-var')}>{file.name}</button></td><td>{file.type||'No extension'}</td><td title={`${file.size.toLocaleString()} bytes`}>{bytes(file.size)}</td></tr>)}</tbody></table>}
 </>}
 {folder.totals&&<><h3>Entire branch</h3><div className="folder-facts"><span>{folder.totals.folders.toLocaleString()} folders (including this one)</span><span>{folder.totals.files.toLocaleString()} files</span><span>{bytes(folder.totals.size)}</span></div>{!folder.totals.complete&&<p>Incomplete · {folder.totals.scanned} of {folder.totals.folders} mapped folders have file counts.</p>}
 <div data-cols="2" data-gap="content">
 <section><h3>Branch files by extension</h3><PieChart data={folder.totals.types??[]} grouping_key="type" value_key="count"/></section>
 <section><h3>Branch size by extension</h3><PieChart data={folder.totals.types??[]} grouping_key="type" value_key="size"/></section>
 </div><TotalsTable data={folder.totals.types??[]} items={branchFiles} handlePath={handleFilePath} handleCSS={handleCSS} grouping_key="type" value_key="size" count_key="count"/></>}
 </section>;
};

const FilePopup=({folder,encodedName,close,previewCSS}:{folder:string;encodedName:string;close:()=>void;previewCSS?:boolean})=>{
 const [state,setState]=useState<{value?:string;error?:string}>({});
 const [collapsed,setCollapsed]=useState(false);
 let name=encodedName;try{name=decodeURIComponent(encodedName);}catch{}
 useEffect(()=>{const controller=new AbortController();
 fetch(`/api/audit-file?${new URLSearchParams({folder,name})}`,{signal:controller.signal}).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.error??'Unable to load file.');setState({value:result.value});}).catch(error=>{if(error.name!=='AbortError')setState({error:error.message});});
 return ()=>controller.abort();
 },[folder,name]);
 const extension=name.split('.').pop()?.toLowerCase();
 const language=extension==='css'?'css':['js','jsx','ts','tsx','mjs','json'].includes(extension??'')?'js':['html','svg','xml'].includes(extension??'')?'html':'plain';
 return <FloatPanel handleClose={close} data={{folder,name}} title={name} collapsed={collapsed} onCollapsedChange={setCollapsed} style={{width:'min(52rem,90vw)',height:'min(38rem,80vh)'}}>
 <div style={{display:'flex',flexDirection:'column',minHeight:0}}>
 {state.error?<p role="alert">{state.error}</p>:state.value===undefined?<p role="status">Loading file...</p>:previewCSS?<CSSMockup css={state.value} selector={state.value.match(/\.[a-zA-Z_][\w-]*/)?.[0]}/>:<CodeEditor value={state.value} language={language} viewOnly/>}</div>
 </FloatPanel>;
};
