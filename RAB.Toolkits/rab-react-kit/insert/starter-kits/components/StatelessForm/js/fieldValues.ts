export const textValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : fallback;
export const optionValues = (value: unknown): string[] => {
  const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : typeof value === 'number' || typeof value === 'boolean' ? [value] : [];
  return [...new Set(entries.filter(x => ['string', 'number', 'boolean'].includes(typeof x)).map(x => String(x).trim()).filter(Boolean))];
};
export const callHandler = (handler: unknown, data?: unknown, type?: string): unknown => {
  if (typeof handler === 'function') return handler(data, type);
};
