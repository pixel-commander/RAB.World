import { SelectField } from '../SelectField.tsx';

/* RULES F1: a control lives in a <form>, even in an exemplar */
export default () => (
  <form className="form" noValidate>
    <SelectField name="category" label="Category" options={['Services', 'Equipment', 'Utilities']} />
  </form>
);
