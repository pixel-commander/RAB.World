import type { MouseEvent } from 'react';
import type { CalendarKeyData, CalendarKeyAction } from '../Calendar.types.ts';
export const selectTab = (root: HTMLElement | null, name: string, focus = false) => { if(!root || !['monthly','weekly','daily'].includes(name)) return; root.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab=>{const selected=tab.dataset.id===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();});root.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach(panel=>{panel.hidden=panel.dataset.id!==name;}); };
export const clickTab = (root: HTMLElement|null,event?: MouseEvent<HTMLButtonElement>) => {if(event)selectTab(root,event.currentTarget.dataset.id??'');};
export const keyTab = (root: HTMLElement | null, data?: CalendarKeyData, type?: CalendarKeyAction) => {
  if (!root) return;
  const action = type ?? ({ ArrowLeft: 'left', ArrowRight: 'right', Home: 'first', End: 'last' } as const)[data?.key as 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'];
  if (!action || !['left', 'right', 'first', 'last'].includes(action)) return;
  const names = ['monthly', 'weekly', 'daily'];
  const current = data?.currentTarget?.dataset?.id
    ?? root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.dataset.id;
  const index = names.indexOf(current ?? '');
  if (index < 0) return;
  const next = action === 'first' ? 0 : action === 'last' ? 2
    : action === 'right' ? (index + 1) % 3 : (index + 2) % 3;
  if (typeof data?.preventDefault === 'function') data.preventDefault();
  selectTab(root, names[next], true);
};
