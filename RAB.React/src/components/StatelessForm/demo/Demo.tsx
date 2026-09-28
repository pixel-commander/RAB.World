import { StatelessForm } from '../StatelessForm';
 

const CONTACT_FIELDS = [
  { name: 'full_name', label: 'Full Name', placeholder: 'Ada Lovelace', isRequired: true },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'ada@example.com', isRequired: true },
  { name: 'role', label: 'Role', type: 'select', options: ['Owner', 'Editor', 'Viewer'], defaultValue: 'Editor' },
  { name: 'starts_on', label: 'Starts On', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 4, placeholder: 'anything worth keeping' },
];

export const Demo = () => {
  return (
    <div className='grid side-l'>
      <div data-area='side'>
        builder
      </div>
      <div data-area='main'>
    <StatelessForm
      form_fields={CONTACT_FIELDS}
      buttonText={{ submit: "SAVE CONTACT" }}
     handleSubmit={() => alert('ts')}
     />
    </div>
    </div>
  );
};

export default Demo;
