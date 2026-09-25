import type { ReactNode, RefObject } from 'react';

export interface StatusFormProps {
  area?: string;
  container_ref?: RefObject<HTMLDivElement>;
  container_class?: string;
  className?: string;
  children?: ReactNode;
  Header?: ReactNode;
  Footer?: ReactNode;
  error?: ReactNode;
  is_saving?: boolean;
  is_saved?: boolean;
  has_error?: boolean;
  is_visible?: boolean;
  SavingMessage?: ReactNode;
  SavedMessage?: ReactNode;
  ErrorMessage?: ReactNode;
}
