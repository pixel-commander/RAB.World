import { InputGroup } from '../InputGroup.tsx';
import { StatelessForm } from '../../StatelessForm.tsx';
import { useRef } from 'react';
export const Demo = () => { const output = useRef<HTMLOutputElement>(null); return <>
 <StatelessForm handleChange={data => { if (output.current) output.current.textContent = JSON.stringify(data ?? {}); }}><InputGroup name="callsign" label="Callsign" /></StatelessForm>
 <output ref={output} aria-live="polite" />
 </>; };
export default Demo;
