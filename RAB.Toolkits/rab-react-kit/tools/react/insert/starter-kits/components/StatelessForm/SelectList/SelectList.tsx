import { useRef } from 'react';
import type { SelectListProps } from './SelectList.types.ts';
import { callHandler, optionValues, textValue } from '../js/fieldValues.ts';
import './css/select-list.css';
export const SelectList = ({ name, id, label = 'Select items', options, value, default_value, mode = 'list', has_search, can_add, can_multi, is_required, is_disabled, is_visible, className = '', description, error, handleSelect, handleChange, handleInsert, ...rest }: SelectListProps = {}) => {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  if (is_visible === false) return null;
  const radio = rest.selection_type === 'radio';
  const prefix = radio ? 'radio-group' : 'select-list';
  const fieldName = textValue(name);
  const rows = optionValues(options);
  const selected = optionValues(default_value ?? value);
  const many = !!can_multi && !radio;
  const notify = (event?: { target: EventTarget | null }) => {
    const target = event?.target;
    if (!many && target instanceof HTMLInputElement && !fieldName) listRef.current?.querySelectorAll<HTMLInputElement>('input').forEach(el => { el.checked = el === target; });
    const picked = Array.from(listRef.current?.querySelectorAll<HTMLInputElement>('input:checked') ?? []).map(el => el.value);
    if (holderRef.current) holderRef.current.value = picked.join(',');
    const controls = listRef.current?.querySelectorAll<HTMLInputElement>('input') ?? [];
    controls.forEach(el => el.required = !!is_required && picked.length === 0);
    const data = many ? picked : picked[0] ?? '';
    callHandler(handleSelect, data, radio ? 'radio' : 'select'); callHandler(handleChange, data, radio ? 'radio' : 'select');
  };
  const add = () => {
    const word = draftRef.current?.value.trim();
    if (!word || !listRef.current) return;
    if (Array.from(listRef.current.querySelectorAll<HTMLInputElement>('input')).some(el => el.value === word)) return;
    const row = document.createElement('label'); row.className = prefix + '__option action-nav'; row.dataset.option = word;
    const input = document.createElement('input'); input.type = many ? 'checkbox' : 'radio'; input.value = word;
    if (!many && fieldName) input.name = fieldName;
    input.required = !!is_required && !listRef.current.querySelector('input:checked');
    input.addEventListener('change', event => { event.stopPropagation(); notify(event); });
    row.append(input, document.createTextNode(word)); listRef.current.append(row);
    if (draftRef.current) draftRef.current.value = '';
    callHandler(handleInsert, word, radio ? 'radio' : 'select');
  };
  return <fieldset ref={rootRef} id={id} data-selection-required={is_required ? "true" : undefined} className={[prefix, mode === 'chip' || mode === 'chips' ? prefix + '--chips' : '', mode === 'scroll' ? prefix + '--scroll' : '', className].filter(Boolean).join(' ')} disabled={!!is_disabled}>
    <legend>{label}{is_required && ' *'}</legend>
    {has_search && <input type="search" className={prefix + '__search container-inset'} aria-label="Filter options" placeholder="Search…" onChange={e => {
      const query = e.currentTarget.value.toLowerCase(); listRef.current?.querySelectorAll<HTMLElement>('[data-option]').forEach(row => row.hidden = !(row.dataset.option ?? '').toLowerCase().includes(query));
    }} />}
    {many && <input ref={holderRef} type="hidden" name={fieldName || undefined} defaultValue={selected.filter(x => rows.includes(x)).join(',')} />}
    <div ref={listRef} className={prefix + '__options'} onChange={notify}>
      {rows.map(word => <label key={word} data-option={word} className={prefix + '__option action-nav'}>
        <input type={many ? 'checkbox' : 'radio'} name={many ? undefined : fieldName || undefined} value={word} defaultChecked={many ? selected.includes(word) : selected[0] === word} required={!!is_required && !selected.some(x => rows.includes(x))} />{word}
      </label>)}
    </div>
    {can_add && <div className={prefix + '__add'}><input ref={draftRef} className="container-inset" aria-label="New option" placeholder="New option" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><button type="button" className="action-muted" onClick={add}>Add</button></div>}
    {(error || description) && <p>{error ?? description}</p>}
  </fieldset>;
};
