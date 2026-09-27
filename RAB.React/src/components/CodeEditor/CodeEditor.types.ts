import type { HTMLAttributes } from 'react';

export type CodeLanguage = 'css' | 'js' | 'html' | 'plain';
export interface Token { cls: string; text: string; }
export interface DiffRow { kind: 'ctx' | 'add' | 'del'; text: string; }
export interface TokenRule { cls: string; re: RegExp; }

export interface CodeEditorStylers {
  container: string;
}

export interface CodeEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  styler?: 'main';
  stylers?: Partial<CodeEditorStylers>;
  value?: string;
  language?: CodeLanguage;
  viewOnly?: boolean; 
  diff?: { original: string } | null;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void | Promise<void>;
}
export interface CodeEditorHandle {
  getValue: () => string;
  setValue: (value: string, options?: { dirty?: boolean }) => void;
  markSaved: () => void;
  focus: () => void;
}

