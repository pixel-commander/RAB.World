// Stored metadata stays intact; filesystem callers consume only the path string.
export const pathValue = entry => typeof entry === 'string' ? entry : entry && typeof entry.path === 'string' ? entry.path : null;
export const pathValues = paths => Object.fromEntries(Object.entries(paths ?? {}).map(([key,value])=>[key,pathValue(value)]));
export const withPathValue = (entry,value) => entry && typeof entry === 'object' && !Array.isArray(entry) ? {...entry,path:value} : {path:value,description:''};
