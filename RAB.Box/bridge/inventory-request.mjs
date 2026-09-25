const aliases = {component:'components',components:'components',page:'pages',pages:'pages',atom:'atoms',atoms:'atoms'};
// Only whole, unqualified inventory requests: do not intercept other language flows.
export const inventoryRequest = (text, paths = {}) => {
  const match = /^\s*(?:list|find|scan(?:\s+for)?)\s+(?:all\s+)?([a-z][a-z0-9_-]*(?:\s+atoms)?)\s*[.!?]?\s*$/i.exec(text);
  if (!match || /^(projects?|tools?|stamps?|sessions?|requests?)$/i.test(match[1])) return null;
  const word = match[1].toLowerCase();
  const candidates = Object.keys(paths).filter(key => key.toLowerCase().replaceAll('_',' ').replaceAll('-',' ') === word);
  const key = candidates.length === 1 ? candidates[0] : Object.hasOwn(aliases,word) ? aliases[word] : null;
  return {key:key ?? word, known:Boolean(key)};
};
