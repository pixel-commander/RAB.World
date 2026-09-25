import { Checkbox } from '../Checkbox.tsx';

/* RULES F1: a control lives in a <form>, even in an exemplar */
export default () => (
  <form className="form" noValidate>
    <Checkbox name="recurring" label="Recurring expense" defaultChecked />
  </form>
);
