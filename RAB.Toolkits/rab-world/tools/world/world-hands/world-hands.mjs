export const run = async ({ helpers, tool }) => {
  const catalog = await helpers.listTools({ fresh: true });
  const hands = catalog.items
    .filter(item => item.toolkit?.id === tool.toolkit?.id && item.domain === 'world' && item.id !== tool.id)
    .map(item => ({
      id: item.id, name: item.name, title: item.title,
      description: item.description, path: item.key,
      settings: item.settings, authority: item.meta.authority,
      call: { key: item.key }
    }));
  return { status: 'ready', name: 'world-hands', hands, unavailable: catalog.unavailable };
};
