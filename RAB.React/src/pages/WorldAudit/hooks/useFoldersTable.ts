import {useMemo} from 'react';
import type {MapFolder} from '../WorldAudit.types';
export const useFoldersTable=(props:{items?:MapFolder[];search:string;sort:'name'|'path'})=>useMemo(()=>{
 const items=props.items??[];const byId=new Map(items.map(item=>[item.path.toLowerCase(),item]));const root=items.find(item=>item.parent===null);
 const rows=root?items.filter(item=>!item.ignored&&item.parent?.toLowerCase()===root.path.toLowerCase()&&`${item.name} ${item.path} ${item.description??''}`.toLowerCase().includes(props.search.toLowerCase())).sort((a,b)=>a[props.sort].localeCompare(b[props.sort])):[];
 return {...props,byId,root,rows};
},[props.items,props.search,props.sort]);
