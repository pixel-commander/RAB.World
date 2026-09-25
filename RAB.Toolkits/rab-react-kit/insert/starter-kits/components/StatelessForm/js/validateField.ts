export const REQUIRED_CLASS = 'is-required';
export const ERROR_CLASS = 'has-error';
export const DEFAULT_ERROR = 'Invalid value';
interface ValidateFieldProps { container_el?: HTMLElement | null; value?: string | number; is_required?: boolean; validate?: (value?: string | number) => React.ReactNode; }
export const validateField = ({ container_el, value, is_required, validate }: ValidateFieldProps = {}): boolean => {
 if (!container_el) return true;
 const message = container_el.querySelector<HTMLElement>('[data-id="form-group-message"]');
 const missing = !!is_required && (value == null || value === '');
 let problem = missing ? 'This field is required' : '';
 if (!missing && typeof validate === 'function') {
   try { const result = validate(value); if (result) problem = typeof result === 'string' ? result : DEFAULT_ERROR; }
   catch { problem = DEFAULT_ERROR; }
 }
 container_el.classList.toggle(REQUIRED_CLASS, missing);
 container_el.classList.toggle(ERROR_CLASS, !!problem);
 if (message) {
   if (!message.hasAttribute('data-helper')) message.dataset.helper = message.textContent ?? '';
   message.textContent = problem || message.dataset.helper || '';
 }
 container_el.querySelectorAll('input,select,textarea').forEach(el => el.setAttribute('aria-invalid', String(!!problem)));
 return !problem;
};
export default validateField;
