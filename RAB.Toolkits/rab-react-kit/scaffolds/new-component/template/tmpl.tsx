import type { __COMPONENT_NAME__Props } from './__COMPONENT_NAME__.types';
import { use__COMPONENT_NAME__ } from './hooks/use__COMPONENT_NAME__';
import './css/__COMPONENT_SLUG__.css';

export const __COMPONENT_NAME__ = ({ children = __DEFAULT_CHILDREN__, className, ...domProps }: __COMPONENT_NAME__Props) => {
  use__COMPONENT_NAME__();
  return <div {...domProps} data-component="__COMPONENT_NAME__"__GRID_ATTRIBUTE__ className={['__COMPONENT_SLUG__', __DEFAULT_CLASS__, className].filter(Boolean).join(' ')}>{children}</div>;
};
