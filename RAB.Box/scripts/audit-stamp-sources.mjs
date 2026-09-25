import { readFile, readdir, realpath, lstat, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { createToolHouse } from '../bridge/tool-house.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const slash = value => value.split(path.sep).join('/');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const fail = (code, message) => Object.assign(new Error(message), { code });
const visible = catalog => ({
  items: catalog.items.filter(tool => tool.domain !== 'kitchen'),
  unavailable: catalog.unavailable.filter(tool => !tool.key.startsWith('kitchen/'))
});
const catalogIdentity = catalog => JSON.stringify(visible(catalog));

// Discovery belongs to Tool House. This script only records its current results
// and file evidence; it never imports or executes a discovered tool module.
export async function inspectStampSources({ root = projectRoot } = {}) {
  root = await realpath(root);
  const house = createToolHouse({ root });
  const initial = await house.listTools({ fresh: true });
  const catalog = visible(initial);
  const sourceFiles = new Map();
  const skipped = [];
  const relative = file => slash(path.relative(root, file));
  const readSource = async file => {
    const resolved = await realpath(file);
    if (!inside(root, resolved)) throw fail('SOURCE_OUTSIDE_PROJECT', `Source resolves outside the project: ${relative(file)}`);
    const bytes = await readFile(file);
    const hash = digest(bytes);
    const prior = sourceFiles.get(file);
    if (prior && prior.sha256 !== hash) throw fail('SOURCE_CHANGED', `Source changed during inspection: ${relative(file)}`);
    sourceFiles.set(file, { path: relative(file), sha256: hash, bytes: bytes.length });
    return bytes;
  };
  const templateFiles = async directory => {
    const files = [];
    const walk = async folder => {
      for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const file = path.join(folder, entry.name);
        if (entry.isSymbolicLink()) { skipped.push({ path: relative(file), reason: 'symbolic-link' }); continue; }
        if (entry.isDirectory()) await walk(file);
        else if (entry.isFile()) {
          const bytes = await readSource(file);
          files.push({ path: relative(file), bytes: bytes.length,
            placeholders: [...new Set(bytes.toString('utf8').match(/__[A-Z][A-Z0-9_]*__/g) ?? [])] });
        }
      }
    };
    const details = await lstat(directory);
    if (details.isSymbolicLink()) skipped.push({ path: relative(directory), reason: 'symbolic-link' });
    else if (details.isDirectory()) await walk(directory);
    else skipped.push({ path: relative(directory), reason: 'template-path-is-not-directory' });
    return files;
  };

  const writers = [];
  for (const tool of catalog.items.filter(tool => tool.authorityClass === 'write')) {
    await readSource(tool.settingsFile);
    await readSource(tool.scriptFile);
    for (const file of tool.contract.files ?? []) await readSource(file);
    writers.push({
      id: tool.id, key: tool.key, title: tool.title, authority: tool.authorityClass,
      settings_file: relative(tool.settingsFile), executor: relative(tool.scriptFile),
      executor_owner: tool.scriptOwner, inherited_executor: tool.inheritedExecutor,
      inputs: tool.settings, declared_metadata: tool.meta,
      template: tool.template ? { path: relative(tool.template), files: await templateFiles(tool.template) } : null,
      implementation_classification: tool.contract.source?.kind ?? 'unclassified',
      classification_owner: tool.contract.owners?.source ? relative(tool.contract.owners.source) : null,
      classification_reason: tool.contract.source?.description ?? 'Template presence is observed; generation, editing, delegation, and file-operation behavior require an owning contract or a separate source review.'
    });
  }

  // A report is a snapshot, not an alternative registry. Reject a mixed snapshot
  // if another session changes inspected sources or discovery while we read.
  if (catalogIdentity(initial) !== catalogIdentity(await house.listTools({ fresh: true })))
    throw fail('SOURCE_CHANGED', 'Tool discovery changed during inspection; retry after the edits settle.');
  for (const [file, before] of sourceFiles) {
    if (digest(await readFile(file)) !== before.sha256)
      throw fail('SOURCE_CHANGED', `Source changed during inspection: ${relative(file)}`);
  }
  return {
    version: 'stamp-source-audit/v2', audited_at: new Date().toISOString(), root,
    scope: { catalog: 'Current shared Tool House discovery', excluded_domains: ['kitchen'],
      inspected: ['writer settings', 'resolved writer executors', 'owner contracts', 'local template files'],
      excluded: ['legacy project registries', 'packaged engine examples', 'transitive implementation dependencies', 'audit project contents'],
      tool_execution: false },
    totals: { discovered: catalog.items.length, unavailable: catalog.unavailable.length,
      writers: writers.length, with_template_path: writers.filter(tool => tool.template).length,
      without_template_path: writers.filter(tool => !tool.template).length,
      unclassified: writers.filter(tool => tool.implementation_classification === 'unclassified').length },
    writers, unavailable: catalog.unavailable, skipped,
    notices: [
      ...(catalog.items.length ? [] : ['No available tools were discovered. Check scope and unavailable diagnostics.']),
      'Classifications come from discovered owner contracts. Undeclared behavior stays unclassified; a template path does not establish the complete implementation behavior.',
      'Counts are calculated from this snapshot and are not requirements on the installed inventory.'
    ],
    source_files: [...sourceFiles.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
}

const cell = value => String(value ?? '').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ');
export function renderStampSourceReport(report) {
  const rows = tools => tools.length
    ? ['| Tool | Executor | Template files | Implementation |', '|---|---|---|---|',
      ...tools.map(tool => `| ${cell(tool.key)} | ${cell(tool.executor)} | ${tool.template?.files.length ?? 0} | ${cell(tool.implementation_classification)} |`)]
    : ['None discovered in this snapshot.'];
  return [
    '# Stamp source inventory', '', `Inspected: ${report.audited_at}`, '', `Project: ${report.root}`, '',
    'Scope: current shared Tool House discovery, excluding kitchen. No discovered tool was executed.', '',
    `Discovered: ${report.totals.discovered}. Unavailable: ${report.totals.unavailable}. Writers: ${report.totals.writers}.`, '',
    `With a template path: ${report.totals.with_template_path}. Without one: ${report.totals.without_template_path}. Implementation unclassified: ${report.totals.unclassified}.`, '',
    '## Writers with a template path', '', ...rows(report.writers.filter(tool => tool.template)), '',
    '## Writers without a template path', '', ...rows(report.writers.filter(tool => !tool.template)), '',
    'Template presence is a file observation. Implementation classifications are owner declarations; behavior without a declaration stays unclassified. Consult the JSON companion for each classification owner and explanation.', '',
    '## Discovery diagnostics', '',
    ...(report.unavailable.length ? report.unavailable.map(item => `- ${cell(item.key)}: ${cell(item.code)} — ${cell(item.message)}`) : ['No unavailable entries in this snapshot.']), '',
    '## Limits', '', ...report.notices.map(note => `- ${note}`),
    '- Legacy project registries and packaged examples are outside this report; no obsolete route is assumed to exist.',
    '- Writer settings, resolved executors, owner contracts, and template files are fingerprinted. Imported implementation dependencies are not exhaustively traced.',
    ...report.skipped.map(item => `- Skipped ${cell(item.path)}: ${cell(item.reason)}.`), '',
    'The JSON companion contains identities, input declarations, metadata, template paths and placeholders, discovery diagnostics, and inspected source hashes.', ''
  ].join('\n');
}

export async function saveStampSourceReport(report, { output = path.join(report.root, 'docs', 'session-audits') } = {}) {
  output = path.resolve(output);
  await mkdir(output, { recursive: true });
  const name = `stamp-source-inventory-${report.audited_at.replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const json = path.join(output, `${name}.json`), markdown = path.join(output, `${name}.md`);
  await writeFile(json, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(markdown, renderStampSourceReport(report), { flag: 'wx' });
  return { json, markdown };
}

export async function runSourceAudit(args = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({ args, options: { root: { type: 'string' }, output: { type: 'string' } } });
    const report = await inspectStampSources({ root: values.root });
    const files = await saveStampSourceReport(report, { output: values.output });
    console.log(JSON.stringify({ ...files, totals: report.totals, tool_execution: false }, null, 2));
  } catch (error) {
    console.error(`${error.code ?? 'REPORT_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runSourceAudit();
