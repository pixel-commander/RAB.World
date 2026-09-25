import { Form } from '../Form.tsx';
import { TextField } from '../text-field/TextField.tsx';
import { SelectField } from '../select-field/SelectField.tsx';
import { Checkbox } from '../checkbox/Checkbox.tsx';

export default () => (
  <Form submitLabel="Save" cancelLabel="Cancel">
    <TextField name="vendor" label="Vendor" placeholder="Who got paid?" />
    <SelectField name="category" label="Category" options={['Services', 'Equipment']} />
    <Checkbox name="recurring" label="Recurring expense" />
  </Form>
);
