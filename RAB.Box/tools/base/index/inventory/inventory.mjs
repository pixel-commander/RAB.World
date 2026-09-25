import { updateInventory } from '../../_inventory.mjs';
export const run = async ({options,context}) => updateInventory(context,options.type,options);
