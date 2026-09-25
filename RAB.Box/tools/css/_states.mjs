// Shared vocabulary for the CSS writer, Box binding, and state audit.
export const STATE_SUFFIXES = Object.freeze({
  hover: ':hover', active: ':active', 'is-active': '.is-active', focus: ':focus',
  'focus-visible': ':focus-visible', 'focus-within': ':focus-within',
  disabled: ':disabled', checked: ':checked', visited: ':visited'
});

export const normalizeStates = input => {
  const raw = String(input === undefined || input === null ? '' : input).trim().toLowerCase();
  if (!raw) throw Object.assign(new Error('state is required.'), { code: 'INPUT_REQUIRED' });
  const names = raw.split(/\s*(?:,|\band\b|\s+)\s*/).filter(Boolean).map(value => {
    const name = value.replace(/^[:.]/, '');
    if (!Object.hasOwn(STATE_SUFFIXES, name) || (value[0] === '.' && name !== 'is-active') || (value[0] === ':' && name === 'is-active')) {
      throw Object.assign(new Error(`Unsupported CSS state: ${value}`), { code: 'BAD_REQUEST', allowed: Object.keys(STATE_SUFFIXES) });
    }
    return name;
  });
  if (!names.length) throw Object.assign(new Error('state is required.'), { code: 'INPUT_REQUIRED' });
  return Object.keys(STATE_SUFFIXES).filter(name => names.includes(name));
};

export const hasStateSelector = selector => {
  const plain = selector.replace(/\[[^\]]*\]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
  return Object.values(STATE_SUFFIXES).some(suffix => {
    const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${escaped}(?![\\w-])`).test(plain);
  });
};
