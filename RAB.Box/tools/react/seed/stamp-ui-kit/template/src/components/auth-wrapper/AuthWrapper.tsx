import type { AuthWrapperProps } from './AuthWrapper.types.ts';
import { SiteChrome } from '../site-chrome/SiteChrome.tsx';
import { LoginPage } from '../../pages/login-page/LoginPage.tsx';

// The auth provider supplies its verified session. This is a UI gate;
// protected API requests must separately enforce server-side authentication.
export const AuthWrapper = ({ session, preview = false, header, children, login, google, onDone }: AuthWrapperProps) => {
  const id = session?.user?.id;
  const authenticated = (import.meta.env.DEV && preview) || (typeof id === 'string' && id.trim().length > 0) ||
    (typeof id === 'number' && Number.isFinite(id));
  return (
    <SiteChrome header={authenticated ? header : undefined} can_move={authenticated}>
      {authenticated ? children : <LoginPage login={login} google={google} onDone={onDone} />}
    </SiteChrome>
  );
};
