import { SelectList } from '../SelectList.tsx';
import { StatelessForm } from '../../StatelessForm.tsx';
import { useRef } from 'react';
export const Demo = () => { const output = useRef<HTMLOutputElement>(null); return <>
 <StatelessForm handleChange={data => { if (output.current) output.current.textContent = JSON.stringify(data ?? {}); }}><SelectList name="materials" label="Materials" options={["Glass", "Metal", "Wood"]} has_search can_add can_multi /></StatelessForm>
 <output ref={output} aria-live="polite" />
 </>; };
export default Demo;
