import { createSearchUsage } from '../../../../../RAB.Box/bridge/world-search-usage.mjs';
export const run = async ({ options, context = {} }) => createSearchUsage({ rabHome: context.rab_home }).feedback(options);
