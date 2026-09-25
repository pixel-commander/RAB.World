// store.ts — json stores over the api (GET/POST /api/<name>)

export const fetchStore = async <T = Record<string, unknown>>(name: string): Promise<T> => {
  const response = await fetch(`/api/${name}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`store ${name}: ${response.status}`);
  return response.json() as Promise<T>;
};

export const saveStore = async (name: string, value: unknown): Promise<unknown> => {
  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`store ${name}: ${response.status}`);
  return response.json();
};
