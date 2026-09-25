import type { LoginBoxProps } from '../../components/login-box/LoginBox.tsx';
export type LoginPageProps = Pick<LoginBoxProps, 'login' | 'google' | 'onDone'>;
