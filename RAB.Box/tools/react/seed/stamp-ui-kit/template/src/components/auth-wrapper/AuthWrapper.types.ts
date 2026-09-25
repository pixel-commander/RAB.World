import type { ReactNode } from 'react';
import type { DataKeys } from '../../HouseKeys.types.ts';
import type { LoginBoxProps } from '../login-box/LoginBox.tsx';

export interface AuthWrapperProps {
  /** Show the signed-in layout in development without an auth session. */
  preview?: boolean;
  session?: { user?: DataKeys } | null;
  header?: ReactNode;
  children?: ReactNode;
  login?: LoginBoxProps['login'];
  google?: LoginBoxProps['google'];
  onDone?: LoginBoxProps['onDone'];
}
