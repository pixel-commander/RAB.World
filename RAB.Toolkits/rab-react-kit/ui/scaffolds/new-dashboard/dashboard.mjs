import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareShellNavigation } from './_shell-navigation.mjs';

export const run = async ({ options, helpers, context }) => {
  const catalog = JSON.parse(await readFile(new URL('../../../../../RAB.Box/tools/html/add/grid/grids.json', import.meta.url), 'utf8'));
  const layout = options.layout;
  if (typeof layout !== 'string' || !Object.hasOwn(catalog.layouts, layout)) throw Object.assign(new Error(`Choose a grid type: ${Object.keys(catalog.layouts).join(', ')}`), { code: 'BAD_REQUEST' });
  const addToNavigation = options.add_to_navigation ?? true;
  if (typeof addToNavigation !== 'boolean') throw Object.assign(new Error('Add to navigation must be a boolean.'), { code: 'BAD_REQUEST' });
  const pageLocation = await helpers.resolveProjectFolder({ explicit: options.page_location, key: 'pages', fallback: 'src/pages' });
  const projectRoot = context?.project?.root ?? path.resolve(pageLocation, '../..');
  const navigation = addToNavigation ? await prepareShellNavigation({
    root: projectRoot,
    file: path.resolve(projectRoot, options.path ?? 'src', options.file ?? 'App.tsx'),
    pageFile: path.join(pageLocation, options.name, `${options.name}.tsx`),
    name: options.name,
  }) : null;
  const page = await helpers.runTool({ key: 'new-page', options: { name: options.name, location: pageLocation, dashboard_template: true } });
  try {
    const grid = await helpers.runTool({ key: 'react/apply/grid-layout', options: { file: page.result.file, layout } });
    const nav = navigation ? await navigation.commit() : { added: false };
    return { status: 'created', type: 'dashboard', name: options.name, page: { name: options.name, file: page.result.file }, layout: grid.result.layout, nav, construction_seats: grid.result.construction_seats, provided: { seats: { file: page.result.file, page: options.name, dashboard: options.name } } };
  } catch (error) {
    error.details = { ...error.details, page_created: true, file: page.result.file };
    throw error;
  }
};
