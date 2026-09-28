import type { HTMLAttributes } from 'react';

export type __COMPONENT_NAME__Props = HTMLAttributes<HTMLDivElement>;

export const __COMPONENT_NAME__ = ({ children = __DEFAULT_CHILDREN__, className, ...domProps }: __COMPONENT_NAME__Props) => {
  return <div {...domProps} data-component="__COMPONENT_NAME__"__GRID_ATTRIBUTE__ className={[__DEFAULT_CLASS__, className].filter(Boolean).join(' ')}>{children}</div>;
};
