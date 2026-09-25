import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadSignalContract } from '../../../bridge/tool-contract.mjs';
import { assertSignalSettings } from '../../../bridge/rab-node.mjs';

export const run = async ({ options, helpers }) => {
  if (options.folder !== undefined) {
    if (options.key !== undefined || typeof options.folder !== 'string' || !path.isAbsolute(options.folder)) throw new Error('Provide either an absolute signal folder or a tool key.');
    const settings = JSON.parse(await readFile(path.join(options.folder, 'settings.json'), 'utf8'));
    assertSignalSettings(settings);
    const contract = await loadSignalContract(options.folder);
    return { status: contract.ready ? 'valid' : 'incomplete', name: settings.name, contract, executable: false };
  }
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
      template_rule: tool.kind === 'stamp' ? Boolean(tool.template) : !tool.template && !tool.name.startsWith('stamp-'),
      contract_present: Boolean(tool.contract.files?.length)
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
