export const run = async ({ options, helpers }) => helpers.findTools({
  query: options.query,
  domain: options.domain || undefined,
  includeStamps: options.include_stamps !== false,
  functionPrefix: options.function_prefix || undefined
});
