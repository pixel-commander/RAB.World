const bad=message=>Object.assign(new Error(message),{code:'BAD_REQUEST'});
export const run = async ({ options, helpers }) => {
  const input=options.rows??options.links;
  if(!Array.isArray(input)||!input.length)throw bad('Navigation needs a nonempty array of {id, name, path} rows.');
  const seenIds=new Set(),seenPaths=new Set();
  const rows=input.map((item,index)=>{
    const legacy=options.rows===undefined;
    const id=legacy?item?.href:item?.id;
    const name=legacy?item?.label:item?.name;
    const path=legacy?item?.href:item?.path;
    if((typeof id!=='string'&&typeof id!=='number')||String(id).trim()===''||typeof name!=='string'||!name.trim()||typeof path!=='string'||!path.trim())throw bad(`Navigation row ${index+1} needs id, name, and path.`);
    if(/[\x00-\x20\\]/.test(path)||path.startsWith('//')||(!/^(?:https?:\/\/|[/?#]|\.{1,2}\/)/i.test(path)))throw bad('Navigation path must be a local path, query, fragment, or HTTP(S) URL.');
    if(seenIds.has(String(id)))throw bad('Navigation row IDs must be unique.');
    if(seenPaths.has(path))throw bad('Navigation paths must be unique.');
    seenIds.add(String(id));seenPaths.add(path);
    return {id,name,path};
  });
  const result=await helpers.runReactComponentStamp({templateUrl:new URL('./template/tmpl.tsx',import.meta.url),parentOption:'location',templateValues:{NAV_ROWS:JSON.stringify(rows,null,2),NAV_LABEL:JSON.stringify(options.label??'Main navigation'),NAV_CLASS:options.name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').toLowerCase()}});
  return {...result,type:'navigation',rows,provided:{seats:{component:options.name,file:result.path}}};
};
