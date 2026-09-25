import { LoginBox } from '../LoginBox.tsx';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default () => (
  <LoginBox
    login={async (values) => {
      await wait(900);
      return values.email;
    }}
    create={async (values) => {
      await wait(900);
      return values.email;
    }}
    google={async () => {
      await wait(400);
      return 'google-user';
    }}
  />
);
