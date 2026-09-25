import { useId } from 'react';
import type { InputGroupProps } from './InputGroup.types.ts';
import { callHandler, textValue } from '../js/fieldValues.ts';
import './css/input-group.css';
export const InputGroup = ({ name, id, label, description, error, value, default_value, placeholder, input_type = 'text', className = '', children, is_required, is_disabled, is_visible, handleChange, handleFocus }: InputGroupProps = {}) => {
  const ownId = useId();
  const controlId = id ?? ownId;
  if (is_visible === false) return null;
  const settings = { id: controlId, name: textValue(name) || undefined, className: 'input-group__input container-inset', defaultValue: textValue(default_value ?? value), placeholder, required: !!is_required, disabled: !!is_disabled, 'aria-describedby': description || error ? controlId + '-note' : undefined, 'aria-invalid': !!error,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { callHandler(handleChange, e.currentTarget.value, input_type); },
    onFocus: () => { callHandler(handleFocus, true, input_type); }, onBlur: () => { callHandler(handleFocus, false, input_type); } };
  return <div className={('input-group ' + className).trim()}>
    {label != null && <label className="input-group-label" htmlFor={controlId}>{label}{is_required && ' *'}</label>}
    <div className="input-group-control">{children ?? (input_type === 'textarea' ? <textarea {...settings} rows={5} /> : <input {...settings} type={input_type} />)}</div>
    {(description || error) && <div id={controlId + '-note'} className="input-group-note">{error ?? description}</div>}
  </div>;
};
