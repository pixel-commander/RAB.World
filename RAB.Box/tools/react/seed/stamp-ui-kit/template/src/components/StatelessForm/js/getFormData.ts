
export const getFormData = (form_el?: HTMLFormElement | null): Record<string, FormDataEntryValue> => {
  if (!form_el) return {}
  return Object.fromEntries(new FormData(form_el))
}

export default getFormData
