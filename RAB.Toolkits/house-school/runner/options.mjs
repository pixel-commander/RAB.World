import { families, combinations } from '../shared/catalog.mjs';

export const options = (args) => {
  const selected = { families, packaging: ['isolated', 'component'], masks: combinations, variant: 'original' };
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key === '--family') {
      const names = value.split(',');
      selected.families = families.filter((family) => names.includes(family.name));
      if (selected.families.length !== new Set(names).size) throw new Error('Unknown family');
    } else if (key === '--variant' && ['original', 'alternate'].includes(value)) selected.variant = value;
    else if (key === '--packaging' && ['isolated', 'component'].includes(value)) selected.packaging = [value];
    else if (key === '--masks') {
      const masks = value.split(',').map(Number);
      if (!masks.length || masks.some((mask) => !Number.isInteger(mask) || mask < 0 || mask > 7) || new Set(masks).size !== masks.length) throw new Error('Masks must be unique integers 0..7');
      selected.masks = masks;
    } else throw new Error(`Unsupported option: ${arg}`);
  }
  return selected;
};
