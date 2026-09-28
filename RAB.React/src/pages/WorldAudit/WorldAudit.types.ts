import type { ShellViewProps } from '../../shell/components/SiteShell';
export interface WorldAuditProps extends Partial<ShellViewProps> { path?: string; }
export interface AuditTool { id: number; name: string; title?: string; description?: string; path: string; settings: AuditToolSetting[]; }

export interface AuditToolSetting { name: string; type: string; title?: string; description?: string; required?: boolean; default?: string | number | boolean; options?: Array<string | { name: string; title?: string }>; }

export interface MapFolder { path: string; parent: string | null; name: string; title?: string; description?: string; folders?: string[]; totals?: {files:number;size:number;scanned:number;folders:number;complete:boolean;types?:Array<{type:string;count:number;size:number}>;types_complete?:boolean}; depth?:number; coverage: string; ignored?: boolean; files?: Array<{id:string;name:string;type:string;size:number}>; size?: number; date?: number; errors?: Array<{path: string; code?: string}>; }
export interface FolderMap { items: MapFolder[]; run: null | { date_start: number; duration_ms: number; errors: Array<{path: string; reason?: string; code?: string}> }; }
