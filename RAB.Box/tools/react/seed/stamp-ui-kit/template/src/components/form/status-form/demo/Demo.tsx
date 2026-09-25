import { StatusForm } from '../StatusForm.tsx';
import { TextField } from '../../text-field/TextField.tsx';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default () => (
  <StatusForm
    submitLabel="Save"
    cancelLabel="Cancel"
    onSubmit={async () => {
      await wait(600);
    }}
  >
    <TextField name="amount" label="Amount" defaultValue="42.00" />
  </StatusForm>
);
