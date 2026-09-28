import type {ReactNode} from 'react';
export type StatCellProps={name?:ReactNode;value?:ReactNode;unit?:ReactNode;color?:string};
export type StatCellsProps={items?:StatCellProps[];className?:string};
