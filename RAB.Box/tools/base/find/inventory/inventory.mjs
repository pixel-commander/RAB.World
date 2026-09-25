import { readInventory } from '../../_inventory.mjs';
import { getProjectWatcher } from '../../watch/watch.mjs';

export const run = async ({options,context}) => {
  const result = await readInventory(context,options.type);
  if(result.status!=='completed')return result;
  const listeners=await getProjectWatcher({rabHome:context.rab_home}).list(context);
  const listener=listeners.items.find(item=>item.type===options.type);
  const status=listener?.status??'not-registered';
  const live=['watching','polling'].includes(status);
  return {...result,count:result.count??result.items.length,index_status:live?'current':'last-saved',listener_status:status,
    ...(!live?{notice:`Showing the last saved manifest; listener status: ${status}.`,listener_error:listener?.error??null}:{})};
};
