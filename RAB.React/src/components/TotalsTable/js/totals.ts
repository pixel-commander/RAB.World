export const aggregateTotals=(data:Record<string,unknown>[],grouping_key:string,value_key:string,count_key?:string)=>{
 const groups=new Map<string,{name:string;count:number;value:number}>();
 for(const item of data){const name=String(item[grouping_key]??'');const row=groups.get(name)??{name,count:0,value:0};
 const count=count_key===undefined?1:item[count_key];const value=item[value_key];
 if(typeof count==='number'&&Number.isFinite(count)&&count>=0)row.count+=count;
 if(typeof value==='number'&&Number.isFinite(value)&&value>=0)row.value+=value;
 groups.set(name,row);}
 const rows=[...groups.values()].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
 return {rows,count:rows.reduce((sum,row)=>sum+row.count,0),value:rows.reduce((sum,row)=>sum+row.value,0)};
};
