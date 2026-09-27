import { use__PAGE_NAME__ } from './hooks/use__PAGE_NAME__';
import './css/__PAGE_SLUG__.css';
export const __PAGE_NAME__ = () => {
  use__PAGE_NAME__();
  return <main className="__PAGE_SLUG__" data-page="__PAGE_NAME__" data-rab-seat="page-__PAGE_SLUG__:p1">
    {/* [rab-seat:page-__PAGE_SLUG__:p1] */}
    <h1>{__PAGE_TITLE__}</h1>
    <p>{__PAGE_DESCRIPTION__}</p>
    {__PAGE_CONTENT__}
  </main>;
};
