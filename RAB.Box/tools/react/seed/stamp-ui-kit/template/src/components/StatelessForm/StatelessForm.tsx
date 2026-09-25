import { callHandler } from './js/fieldValues.ts';
import { Children, cloneElement, isValidElement, useRef } from 'react'
import type { FormEventHandler, ReactNode } from 'react'
import { StatelessInputGroup } from './StatelessInputGroup.tsx'
import { getFormData } from './js/getFormData.ts'
import { isValid } from './js/isValid.ts'
import type { StatelessFormProps } from './StatelessForm.types.ts'
import './css/stateless-form.css'
import './css/form-main.css'
import './css/input-group-main.css'

export const StatelessForm = ({
  className = 'form-main',
  view_mode = false,
  container_ref,
  form_class = 'container-main',
  input_group_class = 'input-group-main',
  submit_class = 'action-main',
  cancel_class = 'action-muted',
  tabs_class = 'container-inset',
  tab_nav_class = 'container-inset',
  tab_button_class = 'action-nav',
  tab_class = '',
  ...props
}: StatelessFormProps = {}): React.JSX.Element => {

  className = `stateless-form ${className || ``}`.trim()

  const { button_text, children } = props
  const validFields = (value: unknown) => Array.isArray(value) ? value.filter(field => field && typeof field === 'object' && (typeof field.name === 'string' || typeof field.spacer === 'string')) : []
  const form_fields = validFields(props.form_fields)
  const form_tabs = props.form_tabs && typeof props.form_tabs === 'object' && !Array.isArray(props.form_tabs) ? Object.fromEntries(Object.entries(props.form_tabs).map(([name, fields]) => [name, validFields(fields)])) : {}
  const allFields = [...form_fields, ...Object.values(form_tabs).flat()]

  const ownRef = useRef<HTMLFormElement>(null)
  container_ref = container_ref ?? ownRef

  const changed = (type?: string) => callHandler(props.handleChange, getFormData(container_ref?.current), type)
  // Same handler contract at every level: each owner augments before passing upward.
  const fieldBag = (field: typeof form_fields[number]) => ({
    ...props.inputGroupHandlers,
    ...field,
    handleChange: (data?: string, type?: string) => {
      callHandler(field.handleChange ?? props.inputGroupHandlers?.handleChange, data, type);
      changed(type);
    },
    handleBlur: (data?: string, type?: string) => { callHandler(field.handleBlur ?? props.inputGroupHandlers?.handleBlur, data, type); },
    handleFocus: (data?: string, type?: string) => { callHandler(field.handleFocus ?? props.inputGroupHandlers?.handleFocus, data, type); callHandler(props.handleFocus, data, type); },
  })

  const handleSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    if (!isValid(container_ref?.current, allFields)) return
    return (typeof props?.handleSubmit === 'function' ? props?.handleSubmit : undefined)?.(getFormData(container_ref?.current), props.type)
  }

  const handleBlur: FormEventHandler<HTMLFormElement> = (e) => {
    if (!(e?.target instanceof HTMLInputElement || e?.target instanceof HTMLSelectElement || e?.target instanceof HTMLTextAreaElement)) return
    return (typeof props?.handleBlur === 'function' ? props?.handleBlur : undefined)?.(getFormData(container_ref?.current))
  }

  const handleCancel = () => (typeof props?.handleCancel === 'function' ? props?.handleCancel : undefined)?.()

  const toggleView = (tabName: string) => {
    container_ref?.current?.querySelectorAll('[data-tab]')?.forEach(el => {
      if (el.getAttribute('data-tab') === tabName) {
        (el as HTMLElement).hidden = false
        el.classList.add('active')
        el.classList.remove('hidden')
      }
      else {
        (el as HTMLElement).hidden = true
        el.classList.remove('active')
        el.classList.add('hidden')
      }
    })
  }

  const wireChildren = (nodes: ReactNode): ReactNode => Children.map(nodes, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return child;
    const original = child.props.handleChange;
    if (typeof child.type === 'function' || typeof child.type === 'object') {
      return cloneElement(child, { handleChange: (data?: unknown, type?: string) => { callHandler(original, data, type); changed(type); } });
    }
    return cloneElement(child, { children: wireChildren(child.props.children as ReactNode) });
  });

  const form_settings = {
    noValidate: true,
    name: props.name,
    id: props.id,
    className: `${className}${view_mode ? ' view-mode' : ''} ${form_class || ''}`.trim(),
    ref: container_ref,
    onSubmit: handleSubmit,

    onBlur: handleBlur
  }
  
  return (
    <form {...form_settings}>

      <div role='alert' data-id='form-message' className='stateless-form-message'></div>

      {form_fields.length > 0 &&
        <div className='stateless-form-fields'>
          {form_fields?.map((field, i) => (
            field?.spacer == null
              ? <StatelessInputGroup key={field.name} view_mode={view_mode} className={input_group_class} {...fieldBag(field)} />
              : <div key={`spacer-${i}`} className='stateless-form-spacer'>{field?.spacer ?? ' '}</div>
          ))}
        </div>}

      {Object.keys(form_tabs).length > 0 &&
        <div className={`stateless-form-tabs ${tabs_class || ''}`.trim()}>
          <div className={`stateless-form-tabs-nav ${tab_nav_class || ''}`.trim()}>
            {Object.keys(form_tabs).map((tabName, i) =>
              <button type='button' key={tabName} className={`stateless-form-tab-name ${tab_button_class || ''}${i === 0 ? ' active' : ''}`.trim()} data-tab-button={tabName} aria-selected={i === 0} onClick={(event) => { toggleView(tabName); event.currentTarget.parentElement?.querySelectorAll('button').forEach(button => { const active = button === event.currentTarget; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); }); }}>{tabName}</button>
            )}
          </div>
          {Object.entries(form_tabs).map(([tabName, tabFields], i) => {
            return <div key={tabName} className={`stateless-form-tab ${tab_class || ''}${i === 0 ? ' active' : ' hidden'}`.trim()} data-tab={tabName}>
              <div className='stateless-form-tab-fields'>
                {tabFields?.map((field, i) => (
                  field?.spacer == null
                    ? <StatelessInputGroup view_mode={view_mode} key={field.name} className={input_group_class} {...fieldBag(field)} />
                    : <div key={`spacer-${i}`} className='stateless-form-spacer'>{field?.spacer ?? ' '}</div>
                ))}
              </div>
            </div>
          })}
        </div>}

      {children &&
        <div className='stateless-form-children'>
          {wireChildren(children)}
        </div>}

      <div className='stateless-form-buttons'>
        {!view_mode ? <>
          {!className.includes('hide-cancel') &&
            <button type='button' className={`cancel ${cancel_class || ''}`.trim()} onClick={() => (typeof handleCancel === 'function' ? handleCancel : undefined)?.()}>{button_text?.cancel ?? `Cancel`}</button>}
          {!className.includes('hide-submit') &&
            <input type='submit' className={`submit ${submit_class || ''}`.trim()} value={button_text?.submit ?? `Submit`} />}
        </> : <></>}
      </div>

    </form>
  )
}
