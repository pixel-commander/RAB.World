import { validateField } from './validateField.ts';
import type { InputGroupBaseProps } from '../StatelessForm.types.ts';
export const isValid = (form?: HTMLFormElement | null, fields: InputGroupBaseProps[] = []): boolean => {
 if (!form) return false;
 const data = new FormData(form);
 let valid = true;
 for (const field of fields) {
   if (!field || typeof field.name !== 'string' || field.spacer != null) continue;
   const group = Array.from(form.querySelectorAll<HTMLElement>('[data-inputgroup]')).find(el => el.dataset.inputgroup === field.name);
   if (group?.querySelector('input:disabled, select:disabled, textarea:disabled')) continue;
   const value = data.get(field.name);
   if (!validateField({ container_el: group, value: typeof value === 'string' ? value : '', is_required: field.is_required, validate: field.validate })) valid = false;
 }
 form.querySelectorAll<HTMLFieldSetElement>('[data-selection-required="true"]').forEach(group => {
   const missing = !group.disabled && !group.querySelector('input:checked');
   group.classList.toggle('has-error', missing); group.setAttribute('aria-invalid', String(missing));
   if (missing) valid = false;
 });
 const native = form.checkValidity();
 const bad = form.querySelector<HTMLElement>(':invalid, .has-error, .is-required');
 if (!native || bad) valid = false;
 if (!valid && bad) {
   const tab = bad.closest<HTMLElement>('[data-tab]');
   if (tab) { form.querySelectorAll<HTMLElement>('[data-tab]').forEach(el => { el.hidden = el !== tab; el.classList.toggle('hidden', el !== tab); el.classList.toggle('active', el === tab); });
     form.querySelectorAll<HTMLElement>('[data-tab-button]').forEach(el => { const active = el.dataset.tabButton === tab.dataset.tab; el.classList.toggle('active', active); el.setAttribute('aria-selected', String(active)); }); }
   const control = bad.matches('input,select,textarea') ? bad : bad.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea');
   (control as HTMLElement | null)?.focus();
 }
 form.classList.toggle('has-errors', !valid);
 const message = form.querySelector<HTMLElement>('[data-id="form-message"]');
 if (message) message.textContent = valid ? '' : 'Please check the required fields and errors.';
 return valid;
};
export default isValid;
