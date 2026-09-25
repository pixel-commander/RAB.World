import { TextField } from '../TextField.tsx';

/* RULES F1: a control lives in a <form>, even in an exemplar */
export default () => (
  <form className="form" noValidate>
    <TextField name="vendor" label="Vendor" placeholder="Who got paid?" />
  </form>
);
