import { useId } from 'react';
import { InputGroup } from '../InputGroup/InputGroup.tsx';
import type { DropdownProps } from './Dropdown.types.ts';
import { callHandler, optionValues, textValue } from '../js/fieldValues.ts';
import './css/dropdown.css';
export const Dropdown = ({ name, id, label = 'Select', options, value, default_value, description, error, placeholder = 'Select…', className = '', is_required, is_disabled, is_visible, handleSelect, handleChange }: DropdownProps = {}) => {
  const ownId = useId();
  if (is_visible === false) return null;
  const controlId = id ?? ownId;
  return <InputGroup id={controlId} label={label} description={description} error={error} is_required={is_required} className={('dropdown ' + className).trim()}>
    <select id={controlId} name={textValue(name) || undefined} className="dropdown__select container-inset" defaultValue={textValue(default_value ?? value)} required={!!is_required} disabled={!!is_disabled} aria-invalid={!!error}
      onChange={e => { callHandler(handleSelect, e.currentTarget.value, 'select'); callHandler(handleChange, e.currentTarget.value, 'select'); }}>
      <option value="">{placeholder}</option>
      {optionValues(options).map(word => <option key={word} value={word}>{word}</option>)}
    </select>
  </InputGroup>;
};
