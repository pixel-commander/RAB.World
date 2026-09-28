export const groupValues=(data:Record<string,unknown>[],grouping_key:string,value_key?:string)=>{
 const groups=new Map<string,number>();
 for(const item of data){const key=String(item[grouping_key]??'');const value=value_key===undefined?1:item[value_key];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)groups.set(key,(groups.get(key)??0)+value);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b));
};
