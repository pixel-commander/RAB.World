import {Fragment,useState} from 'react';
import {chartColor} from '../PieChart/js/colors';
import type {TotalsTableProps} from './TotalsTable.types';
import {aggregateTotals} from './js/totals';
import './css/totals-table.css';
const percent=(value:number,total:number)=>{return total?`${(value/total*100).toLocaleString(undefined,{maximumFractionDigits:1})}%`:'0%';};
const bytes=(value:number)=>{const units=['B','KB','MB','GB','TB'];let i=0;while(value>=1024&&i<units.length-1){value/=1024;i++;}return `${value.toLocaleString(undefined,{maximumFractionDigits:i?1:0})} ${units[i]}`;};
export const TotalsTable=(props:TotalsTableProps)=>{
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
 const details=props.items??(props.count_key?undefined:props.data);
 const totals=aggregateTotals(props.data,props.grouping_key,props.value_key,props.count_key);
 const colors=new Map([...totals.rows].sort((a,b)=>a.name.localeCompare(b.name)).map((row,index)=>[row.name,chartColor(row.name,index,props.colors)]));
 const isSize=props.value_key==='size';const format=(value:number)=>isSize?bytes(value):value.toLocaleString();
 return <table className={`totals-table ${props.className??''}`}>
 <thead><tr><th scope="col">{props.grouping_key==='type'?'Extension':props.grouping_key}</th><th scope="col">{isSize?'File count':'Count'}</th><th scope="col">Count %</th><th scope="col">{isSize?'File size':props.value_key}</th><th scope="col">{isSize?'Size %':'Value %'}</th><th scope="col">Files</th></tr></thead>
 <tbody>{totals.rows.map(row=><Fragment key={row.name}><tr><th scope="row"><span className="totals-table-key" aria-hidden="true" style={{backgroundColor:colors.get(row.name)}}/>{row.name||'No extension'}</th><td>{row.count.toLocaleString()}</td><td>{percent(row.count,totals.count)}</td><td title={isSize?`${row.value.toLocaleString()} bytes`:undefined}>{format(row.value)}</td><td>{percent(row.value,totals.value)}</td><td><button type="button" className="action-ghost" disabled={!details} aria-expanded={expanded.has(row.name)} onClick={()=>setExpanded(previous=>{const next=new Set(previous);if(next.has(row.name))next.delete(row.name);else next.add(row.name);return next;})}>{expanded.has(row.name)?'Hide':'View'}</button></td></tr>{expanded.has(row.name)&&<tr><td colSpan={6}><table className="totals-table-files"><thead><tr><th scope="col">File</th><th scope="col">Extension</th><th scope="col">Path</th><th scope="col">Size</th></tr></thead><tbody>{details?.filter(item=>String(item[props.grouping_key]??'')===row.name).map((item,index)=><tr key={String(item.path??index)}><td>{String(item.name??'')}</td><td>{String(item.type).toLowerCase()==='.css'&&props.handleCSS?<button type="button" className="action-ghost" aria-label={`Preview CSS ${String(item.name)}`} onClick={()=>props.handleCSS?.(item)}>.css</button>:String(item.type??'')}</td><td>{props.handlePath?<button type="button" className="action-ghost totals-table-path" onClick={()=>props.handlePath?.(item)}>{String(item.path??'')}</button>:String(item.path??'')}</td><td>{typeof item[props.value_key]==='number'?format(item[props.value_key] as number):'—'}</td></tr>)}</tbody></table></td></tr>}</Fragment>)}{!totals.rows.length&&<tr><td colSpan={6}>No data to total.</td></tr>}</tbody>
 <tfoot><tr><th scope="row">Total</th><td>{totals.count.toLocaleString()}</td><td>{percent(totals.count,totals.count)}</td><td>{format(totals.value)}</td><td>{percent(totals.value,totals.value)}</td><td/></tr></tfoot>
 </table>;
};
