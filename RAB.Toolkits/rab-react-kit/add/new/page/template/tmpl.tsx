import type { HTMLAttributes } from 'react';
export type __PAGE_NAME__Props = HTMLAttributes<HTMLElement>;
export const __PAGE_NAME__ = ({ children = __PAGE_CONTENT__, className, ...domProps }: __PAGE_NAME__Props) => {
  return <main {...domProps} className={className} data-page="__PAGE_NAME__" data-rab-seat="page-__PAGE_SLUG__:p1">
    {/* [rab-seat:page-__PAGE_SLUG__:p1] */}
    <h1>{__PAGE_TITLE__}</h1>
    <p>{__PAGE_DESCRIPTION__}</p>
    {children}
  </main>;
};
