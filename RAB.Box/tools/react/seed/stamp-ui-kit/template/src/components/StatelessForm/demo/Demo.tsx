import { useRef } from 'react';
import { StatelessForm } from '../StatelessForm.tsx';
import { Dropdown } from '../Dropdown/Dropdown.tsx';
export const Demo = () => {
 const output = useRef<HTMLOutputElement>(null);
 return <><StatelessForm form_tabs={{ Profile: [{ name: 'name', label: 'Name', is_required: true }, { name: 'email', label: 'Email', type: 'email' }], Details: [{ name: 'count', label: 'Count', type: 'number', default_value: 0 }, { name: 'notes', label: 'Notes', type: 'textarea' }] }}
 handleChange={data => { if (output.current) output.current.textContent = JSON.stringify(data ?? {}); }} handleSubmit={data => { if (output.current) output.current.textContent = 'Submitted: ' + JSON.stringify(data ?? {}); }}>
 <Dropdown name="role" label="Role" options={['Owner', 'Editor', 'Viewer']} />
 </StatelessForm><output ref={output} aria-live="polite" /></>;
};
export default Demo;
