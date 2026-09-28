import {chartColor} from './js/colors';
import type {PieChartProps} from './PieChart.types';
import {groupValues} from './js/group';
import './css/pie-chart.css';

const wedge=(start:number,length:number)=>{
 const point=(percent:number)=>{const angle=percent*Math.PI/50-Math.PI/2;return `${60+60*Math.cos(angle)} ${60+60*Math.sin(angle)}`;};
 return `M 60 60 L ${point(start)} A 60 60 0 ${length>50?1:0} 1 ${point(start+length)} Z`;
};
export const PieChart=(props:PieChartProps)=>{
 const groups=groupValues(props.data,props.grouping_key,props.value_key);
 const total=groups.reduce((sum,[,value])=>sum+value,0);
 let offset=0;
 const slices=groups.map(([name,value],index)=>{const start=offset;offset+=total?value/total*100:0;const color=chartColor(name,index,props.colors);return {name,value,start,length:total?value/total*100:0,color};});
 return <div className={`pie-chart ${props.className??''}`}>
 {total>0?<svg viewBox="0 0 120 120" role="img" aria-label={props.value_key?`Distribution by ${props.value_key}`:'Distribution by count'}>
 {slices.filter(item=>item.value>0).map(item=>item.length>=100?<circle key={item.name} cx="60" cy="60" r="60" fill={item.color}><title>{item.name||'No extension'}: {item.value.toLocaleString()} (100%)</title></circle>:<path key={item.name} d={wedge(item.start,item.length)} fill={item.color}><title>{item.name||'No extension'}: {item.value.toLocaleString()} ({item.length.toFixed(1)}%)</title></path>)}
 </svg>:<p>No values to chart.</p>}
 <ul className="pie-chart-legend">{slices.map(item=><li key={item.name}><span className="pie-chart-key" style={{backgroundColor:item.color}}/><span>{item.name||'No extension'}</span><span>{item.value.toLocaleString()}{props.value_key==='size'?' B':''}</span><span>{item.length.toFixed(1)}%</span></li>)}</ul>
 </div>;
};
