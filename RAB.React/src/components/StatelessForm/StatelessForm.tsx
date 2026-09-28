import type { JSX } from 'react';
import React, { type FormEvent, type FormEventHandler, useRef, type ReactNode } from 'react'
import { StatelessInputGroup } from './StatelessInputGroup'
import type { StatelessFormProps } from './StatelessForm.types'
import './css/stateless-form.css'

interface Props extends StatelessFormProps {
  children?: ReactNode
}

export const StatelessForm = ({
  className,
  viewMode = false,
  ...props
}: Props): JSX.Element => {

  className = `stateless-form ${className || ``}`.trim()

  const { buttonText, form_fields, formTabs, handleSelect, handleSubmit, handleBlur, handleCancel, inputGroupHandlers, children, FormContainer } = props

  const formRef = useRef<HTMLFormElement>(null)

  const getFD = (e: FormEvent<HTMLFormElement>) => {
    const formEl = formRef?.current
    if (!formEl) return

    const messageEl = formEl.querySelector('[data-id="form-message"]') as HTMLElement

    if (formEl.querySelectorAll('.is-required')?.length) {
      formEl.classList.add('has-errors')
      if (messageEl) messageEl.textContent = 'Please fill out all required fields'
      return
    }

    if (formEl.querySelectorAll('.has-errors')?.length) {
      formEl.classList.add('has-errors')
      if (messageEl) messageEl.textContent = 'Please check the form for errors'
      return
    }

    const fd = Object.fromEntries(new FormData(e.currentTarget))
    return fd;
  }

  const submitHandler: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    const fd = getFD(e)
    if (fd) return handleSubmit?.(fd);
  }

  const blurHandler: FormEventHandler<HTMLFormElement> = (e) => {
    if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)) return
    const fd = getFD(e)
    if (fd) return handleBlur?.(fd);
  }

  const FormComponent = (x?: Record<string, unknown>) => {
    const { children, ...props } = x || {}
    if (FormContainer) return <FormContainer className={`stateless-form${viewMode ? ' view-mode' : ''} ${className}`} ref={formRef} onSubmit={submitHandler} {...props}>{children as JSX.Element}</FormContainer>
    return <form className={`stateless-form${viewMode ? ' view-mode' : ''} ${className}`} ref={formRef} onSubmit={submitHandler} onBlur={blurHandler} {...props}>{children as JSX.Element}</form>
  }

  const toggleView = (tabName: string) => {
    formRef.current?.querySelectorAll('[data-tab]')?.forEach(el => {
      if (el.getAttribute('data-tab') === tabName) {
        el.classList.add('active')
        el.classList.remove('hidden')
      }
      else {
        el.classList.remove('active')
        el.classList.add('hidden')
      }
    })
  }

  return (
    <FormComponent>

      <div data-id='form-message' className='stateless-form-message'></div>

      {form_fields &&
        <div className='stateless-form-fields'>
          {form_fields?.map((field, i) => (
            !field?.spacer
              ? <StatelessInputGroup key={field.name} viewMode={viewMode} {...{ handleSelect, ...field }} {...inputGroupHandlers} />
              : <div key={`spacer-${i}`} className='stateless-form-spacer'>{field?.spacer || ' '}</div>
          ))}
        </div>}

      {formTabs &&
        <div className='stateless-form-tabs'>
          <div className='stateless-form-tabs-nav'>
            {Object.keys(formTabs).map((tabName, i) =>
              <button type='button' key={tabName} className={`stateless-form-tab-name${i === 0 ? ' active' : ''}`} onClick={() => toggleView(tabName)}>{tabName}</button>
            )}
          </div>
          {Object.entries(formTabs).map(([tabName, tabFields], i) => {
            return <div key={tabName} className={`stateless-form-tab${i === 0 ? ' active' : ' hidden'}`} data-tab={tabName}>
              <div className='stateless-form-tab-fields'>
                {tabFields?.map((field, i) => (
                  !field?.spacer
                    ? <StatelessInputGroup viewMode={viewMode} key={field.name} {...{ handleSelect, ...field }} {...inputGroupHandlers} />
                    : <div key={`spacer-${i}`} className='stateless-form-spacer'>{field?.spacer || ' '}</div>
                ))}
              </div>
            </div>
          })}
        </div>}

      {children &&
        <div className='stateless-form-children'>
          {children}
        </div>}

      <div className='stateless-form-buttons'>
        {!viewMode ? <>
          {!className.includes('hide-cancel') &&
            <button type='button' className='cancel' onClick={() => handleCancel?.()}>{buttonText?.cancel || `Cancel`}</button>}
          {!className.includes('hide-submit') &&
            <input type='submit' className='submit' value={buttonText?.submit || `Submit`} />}
        </> : <></>}
      </div>

    </FormComponent>
  )
}


