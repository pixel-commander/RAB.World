import { useURL } from '../../../hooks/useURL/useURL';
import { atomCategories } from '../js/atom-catalog';
const themeNav: Array<[string, string]> = [['surfaces', 'Surfaces'], ['borders', 'Borders'], ['typography', 'Typography'], ['spacing', 'Spacing']];
export const useStyleGuidePage = () => {
  const [url, handleURL] = useURL('page/group/section');
  const group = url.group === 'atoms' ? 'atoms' : 'theme';
  const nav: Array<[string, string]> = group === 'theme' ? themeNav : atomCategories.map(item => [item.name, item.title]);
  const section = typeof url.section === 'string' ? url.section : '';
  const name = nav.some(([key]) => key === section) ? section : nav[0]?.[0] ?? '';
  return { group, nav, name, category: atomCategories.find(item => item.name === name), handleURL };
};
