import type {StatCellProps,StatCellsProps} from './StatCells.types';
import './css/stat-cells.css';
export const StatCell=(props:StatCellProps)=>{
 return <div className="stat-cell container-main" style={{color:props.color}}>
 {props?.name&&<div className="stat-cell-nam">{props.name}</div>}
 <div className="stat-cell-value">{props.value}{props.unit&&<small>{props.unit}</small>}</div>
 </div>;
};
export const StatCells=(props:StatCellsProps)=>{
 return <div className={`stat-cells ${props.className??''}`}>{props.items?.map((item,index)=><StatCell key={index} {...item}/>)}</div>;
};
