import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { StatelessInputGroupProps, FormFieldElement } from './StatelessForm.types.ts';
import { textValue, optionValues } from './js/fieldValues.ts';
import { validateField } from './js/validateField.ts';

export const StatelessInputGroup = ({
  type = 'text',
  view_mode = false,
  tab_index,
  className,
  validate,
  Container,
  Components,
  children,
  ...props
}: StatelessInputGroupProps): React.JSX.Element => {

  const { Label, Message } = Components || {}

  const { label, helper_text, error_message, id, name, is_required, default_value } = props || {}
  const { value } = props || {}
  const seed = textValue(default_value ?? value)
  const items = Array.isArray(props.items) ? props.items.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string') : optionValues(props.options).map(word => ({ id: word, name: word }))

  const container_ref = useRef<HTMLDivElement>(null)

  className = `stateless-input-group input-group--${type} input-group--${name || 'undefined'} ${className || ''}`.trim()

  if (helper_text) className += ' has-helper'
  if (error_message) className += ' has-error'

  if (view_mode && value == null && default_value == null) return <></>

  const handleChange = (e?: React.SyntheticEvent<FormFieldElement>) => {
    const container_el = container_ref?.current
    if (!container_el) return

    container_el?.classList.remove('has-error')
    if (type === 'select') (typeof props?.handleSelect === 'function' ? props?.handleSelect : undefined)?.({ [name]: e?.currentTarget?.value }, type)

    return (typeof props?.handleChange === 'function' ? props?.handleChange : undefined)?.(e?.currentTarget?.value, type)
  }

  const handleBlur = (e?: React.SyntheticEvent<FormFieldElement>) => {
    const container_el = container_ref?.current
    if (!container_el) return

    const value = e?.currentTarget?.value

    validateField({ container_el, value, is_required, validate: typeof validate === 'function' ? validate : undefined })

    return (typeof props?.handleBlur === 'function' ? props?.handleBlur : undefined)?.(e?.currentTarget?.value, type)
  }

  const collectChecks = () => {
    const container_el = container_ref?.current
    if (!container_el) return

    const holder_el = container_el.querySelector(`input[type='hidden']`) as HTMLInputElement
    if (!holder_el) return

    const boxes = container_el.querySelectorAll<HTMLInputElement>(`input[type='checkbox']`)
    const checked_ids: string[] = []
    boxes.forEach((box: HTMLInputElement) => { if (box.checked) checked_ids.push(box.value) })
    holder_el.value = checked_ids.join(',')
    if (typeof props.handleChange === 'function') props.handleChange(holder_el.value, 'check_list')
  }

  const input_settings: {
    defaultValue?: string | number;
    placeholder?: string;
    disabled?: boolean;
    tabIndex?: number;
    id?: string;
    name: string;
    type: string;
    required?: boolean;
    value?: string | number;
    onChange?: (e: any) => void;
    onBlur?: (e: any) => void;
    onFocus?: (e: any) => void;
    onKeyDown?: (e: KeyboardEvent<FormFieldElement>) => void;
  } = {
    placeholder: typeof props.placeholder === 'string' ? props.placeholder : undefined,
    disabled: props.is_disabled === true,
    tabIndex: tab_index,
    id: id ?? name,
    name,
    type,
    required: is_required,
    onChange: handleChange,
    onBlur: handleBlur,
    onFocus: (e) => (typeof props?.handleFocus === 'function' ? props.handleFocus : undefined)?.(e?.currentTarget?.value, type),
  }

  const Wrapper = Container || 'div'

  const { type: input_type, ...field_settings } = input_settings

  let InputToUse = <input {...input_settings} defaultValue={seed} />

  if (Components?.Input) InputToUse = <Components.Input {...props} type={type} default_value={seed}
    handleChange={props.handleChange} handleBlur={props.handleBlur} handleFocus={props.handleFocus} handleSelect={props.handleSelect} />

  if (type === 'textarea') InputToUse =
    <textarea {...field_settings} defaultValue={`${seed}`} />

  if (type === 'select') InputToUse =
    <select {...field_settings} defaultValue={seed}>
      <option value=''>Select</option>
      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>

  const list_items = items

  if (type === 'check_list') {
    const checked_ids = `${seed}`.split(',').map(entry => entry.trim()).filter(Boolean)
    InputToUse =
      <div>
        <input type='hidden' id={id ?? name} name={name} disabled={props.is_disabled === true} defaultValue={`${seed}`} />
        {list_items.map((item, i) =>
          <label key={item.id || i}>
            <input type='checkbox' value={item.id} tabIndex={tab_index} defaultChecked={checked_ids.includes(item.id)} disabled={props.is_disabled === true} onChange={collectChecks} />
            {item.name || 'n/a'}
          </label>)}
      </div>
  }

  if (type === 'radio_list') InputToUse =
    <div>
      {list_items.map((item, i) =>
        <label key={item.id || i}>
          <input type='radio' name={name} value={item.id} tabIndex={tab_index} defaultChecked={seed === item.id} required={is_required} disabled={props.is_disabled === true} onChange={handleChange} onBlur={handleBlur} />
          {item.name || 'n/a'}
        </label>)}
    </div>

  const LabelComponent = () => {
    if (Label) return <Label data-id='form-group-label' className='input-group-label' htmlFor={id ?? name} {...props} />
    if (!label) return <></>
    return (
      <label data-id='form-group-label' className='input-group-label' htmlFor={id ?? name}>
        {label}
        {is_required && <span className='red-star'>*</span>}
      </label>
    )
  }

  const MessageComponent = () => {
    if (Message) return <Message data-id='form-group-message' className='input-group-message' {...props} />
    return <div data-id='form-group-message' className='input-group-message'>{helper_text}</div>
  }

  const group_settings = {
    className,
    ref: container_ref,
    'data-id': 'inputgroup',
    'data-inputgroup': name
  }

  if (view_mode) return (
    <Wrapper {...group_settings}>
      <div className='form-group-label'>{label}</div>
      <div className='form-group-input'>{seed}</div>
    </Wrapper>
  )

  return (
    <Wrapper {...group_settings}>
      <LabelComponent />
      {InputToUse}
      {children}
      <MessageComponent />
    </Wrapper>
  )
}

export default StatelessInputGroup
