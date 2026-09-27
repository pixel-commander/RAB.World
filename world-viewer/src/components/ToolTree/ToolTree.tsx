import type { HTMLAttributes } from 'react';

export type ToolTreeProps = HTMLAttributes<HTMLDivElement>;

export const ToolTree = ({ children = "ToolTree", className, ...domProps }: ToolTreeProps) => {
  return <div {...domProps} data-component="ToolTree" className={["", className].filter(Boolean).join(' ')}>{children}</div>;
};
