import { useRef } from 'react';
import { StatusForm } from '../StatusForm.tsx';
import { StatelessForm } from '../../StatelessForm.tsx';
export const Demo = () => {
 const status = useRef<HTMLParagraphElement>(null);
 return <StatusForm Header={<strong>Save a contact</strong>} Footer={<p ref={status} role="status" />}>
   <StatelessForm form_fields={[{ name: 'name', label: 'Name', is_required: true }, { name: 'email', label: 'Email', type: 'email', is_required: true }]}
     handleSubmit={data => { if (status.current) status.current.textContent = 'Saved: ' + JSON.stringify(data ?? {}); }}
     handleCancel={() => { if (status.current) status.current.textContent = 'Cancelled'; }} />
 </StatusForm>;
};
export default Demo;
