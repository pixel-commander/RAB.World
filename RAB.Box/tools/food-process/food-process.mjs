const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value).split(/[,;\n]+/).map(text).filter(Boolean);

const handlers = {
  'food-process/check/process-authority': async ({ options }) => {
    const scientific = options.has_scientific_support === true || String(options.has_scientific_support).toLowerCase() === 'true';
    const plant = options.has_in_plant_data === true || String(options.has_in_plant_data).toLowerCase() === 'true';
    const changed = options.process_changed === true || String(options.process_changed).toLowerCase() === 'true';
    if (changed) return { status:'blocked', verified:false, reason:'process-change-revalidation-required', required:['reassessment/revalidation'] };
    if (!scientific || !plant) return { status:'unresolved', verified:false, missing:[...(!scientific?['scientific/technical support']:[]),...(!plant?['practical in-plant data']:[])], reason:'Industrial process authority requires both support classes.' };
    return { status:'verified', verified:true, scope:'process-authority-prerequisites', note:'This checks presence of support classes, not the technical adequacy of a specific process schedule.' };
  },
  'food-process/check/critical-parameters': async ({ options }) => {
    const required = list(options.required_parameters);
    const provided = new Set(list(options.provided_parameters).map(x => x.toLowerCase()));
    const missing = required.filter(item => !provided.has(item.toLowerCase()));
    return { status:missing.length ? 'unresolved' : 'completed', required, provided:[...provided], missing, verified:missing.length === 0 };
  },
  'food-process/math/residence-time': async ({ options, helpers }) => {
    const child = await helpers.runTool({ key:'kitchen/math/residence-time', options });
    return { ...child.result, domain:'food-process', delegated_to:'kitchen/math/residence-time' };
  },
  'food-process/math/belt-speed': async ({ options, helpers }) => {
    const child = await helpers.runTool({ key:'kitchen/math/belt-speed', options });
    return { ...child.result, domain:'food-process', delegated_to:'kitchen/math/belt-speed' };
  }
};

export const run = async args => {
  const handler = handlers[args.tool.path];
  if (!handler) throw Object.assign(new Error(`No Food Process executor registered for ${args.tool.path}.`), { code:'BAD_TOOL' });
  return handler(args);
};
