export const run = async ({ options, helpers }) => {
  const tool = await helpers.getTool(options.key);
  const found = await helpers.findTools({
    query: tool.description,
    domain: tool.domain,
    includeStamps: true
  });
  const rank = found.items.findIndex(item => item.key === tool.key);
  const self = rank >= 0 ? found.items[rank] : null;
  return {
    status: self ? 'visible' : 'not-visible',
    key: tool.key,
    kind: tool.kind,
    structural: {
      settings_file: true,
      script_file: true,
      template_rule: tool.kind === 'stamp' ? Boolean(tool.template) && tool.name.startsWith('stamp-') : !tool.template && !tool.name.startsWith('stamp-')
    },
    description_check: {
      request_shape: found.request_shape,
      rank: rank >= 0 ? rank + 1 : null,
      score: self?.score ?? null,
      shape_score: self?.shape_score ?? null,
      seat_matches: self?.seat_matches ?? [],
      seat_conflicts: self?.seat_conflicts ?? []
    }
  };
};
