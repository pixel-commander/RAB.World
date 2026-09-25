import { LoginBox } from '../../components/login-box/LoginBox.tsx';
import type { LoginPageProps } from './LoginPage.types.ts';
import './css/login-page.css';

export const LoginPage = ({ login, google, onDone }: LoginPageProps) => (
  <section className="login-page" data-rows="1" aria-label="Sign in">
    <div className="login-page__body inner pad scroll">
      <LoginBox login={login} google={google} onDone={onDone} has_create_account={false} />
    </div>
  </section>
);
