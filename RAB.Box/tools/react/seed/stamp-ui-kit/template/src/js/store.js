// store.js — the JSON stores behind serve.js /api endpoints

export const fetchStore = async (name) => {
  const response = await fetch(`/api/${name}`, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`${name} store unavailable`);
  }
  return response.json();
};

export const saveStore = async (name, value) => {
  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    throw new Error(`${name} store rejected the write`);
  }
};
