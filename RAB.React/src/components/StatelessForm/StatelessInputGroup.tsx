import type { JSX } from 'react';
import React, { type ReactNode, useRef } from 'react';
import type { StatelessInputGroupProps, StatelessInputGroupHandlerProps } from './StatelessForm.types';

interface Props extends StatelessInputGroupProps {
  children?: ReactNode
}

export const StatelessInputGroup = ({
  type = 'text',
  viewMode = false,
  tabIndex,
  handleBlur,
  handleChange,
  handleFocus,
  handleSelect,
  className,
  validate,
  Container,
  Components,
  children,
  ...props
}: Props): JSX.Element => {

  const { Label, Message } = Components || {}

  const { label, helperText, errorMessage, id, name, isRequired, defaultValue } = props;
  let { value } = props
  if (type === 'select') value = value ?? defaultValue

  const containerRef = useRef<HTMLDivElement>(null)

  className = `input-group input-group--${type} input-group--${name || 'undefined'} ${className || ''}`.trim()

  if (helperText) className += ' has-helper';
  if (errorMessage) className += ' has-error';

  if (viewMode && value == null && defaultValue == null) return <></>

  const changeHandler: StatelessInputGroupHandlerProps = (e) => {
    const containerEl = containerRef?.current
    if (!containerEl) return
    containerEl?.classList.remove('has-error')
    if (type === 'select') handleSelect?.({ [name]: e?.target?.value }, props)

    return handleChange?.(e, props)
  }

  const blurHandler: StatelessInputGroupHandlerProps = (e) => {
    const containerEl = containerRef?.current
    if (!containerEl) return

    const messageEl = containerEl?.querySelector(`[data-id='form-group-message']`) as HTMLElement
    const value = e?.target?.value

    if (isRequired) {

      if (value === '' || !value) containerEl?.classList.add('is-required')
      else containerEl?.classList.remove('is-required')

    } else {

      if (value && validate) {

        let hasMessage: ReactNode = validate(value)
        if (hasMessage === true) hasMessage = 'Invalid value'
        if (hasMessage) {
          if (messageEl) messageEl.textContent = `${hasMessage}`
          containerEl?.classList.add('has-error')
        }
        else containerEl?.classList.remove('has-error')
      }
    }

    return handleBlur?.(e, { [name]: value }, props)

  }

  const textInputSettings: {
    defaultValue?: string | number;
    tabIndex?: number;
    id?: string;
    name: string;
    type: string;
    required?: boolean;
    value?: string | number;
    onChange?: StatelessInputGroupHandlerProps;
    onBlur?: StatelessInputGroupHandlerProps;
    onFocus?: StatelessInputGroupHandlerProps;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  } = {

    tabIndex,
    id: id || name,
    name,
    type,
    required: isRequired,
    onChange: changeHandler,
    onBlur: blurHandler,
    onFocus: handleFocus,
  }

  const Wrapper = Container || 'div'
  const Input = Components?.Input || (type === 'textarea' ? 'textarea' : 'input')
  let InputToUse = <Input {...textInputSettings} defaultValue={(defaultValue ?? value) == null ? undefined : String(defaultValue ?? value)} />

  if (type === 'select') InputToUse =
    <select {...textInputSettings} defaultValue={typeof value === 'boolean' ? String(value) : value} >
      <option value=''>Select</option>
      {props.options?.map((option: string, i: number) => <option key={i} value={option}>{option}</option>)}
    </select>

  const LabelComomponent = () => {
    if (Label) return <Label data-id='form-group-label' className='input-group-label' htmlFor={name} {...props} />
    if (!label) return <></>
    return (
      <label data-id='form-group-label' className='input-group-label' htmlFor={name}>
        {label}
        {isRequired && <span className='red-star'>*</span>}
      </label>
    )
  }

  const MessageComponent = () => {
    if (Message) return <Message data-id='form-group-message' className='input-group-message' {...props} />
    return <div data-id='form-group-message' className='input-group-message'>{helperText}</div>
  }

  if (viewMode) return (
    <Wrapper className={className} ref={containerRef} data-id='inputgroup' data-inputgroup={name}>
      <div className='form-group-label'>{label}</div>
      <div className='form-group-input'>{String(value ?? defaultValue ?? '-')}</div>
    </Wrapper>
  )

  return (
    <Wrapper className={className} ref={containerRef} data-id='inputgroup' data-inputgroup={name} >
      <LabelComomponent />
      {InputToUse}
      {children}
      <MessageComponent />
    </Wrapper>
  )
}


