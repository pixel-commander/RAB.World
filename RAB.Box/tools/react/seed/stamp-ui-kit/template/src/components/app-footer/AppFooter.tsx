import './app-footer.css';
import { data } from '../../data.ts';

export const AppFooter = () => (
  <>
    <span className="app-footer__meta">{data.footer.left}</span>
    <span className="app-footer__meta">{data.footer.right}</span>
  </>
);
