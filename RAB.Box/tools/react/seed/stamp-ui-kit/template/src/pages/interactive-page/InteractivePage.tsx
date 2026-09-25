import type { InteractivePageProps } from './InteractivePage.types.ts';
import './css/interactive-page.css';

export const InteractivePage = ({ name, title }: InteractivePageProps) => (
  <iframe className="interactive-page" title={title} src={`/interactive/${name}/index.html`} />
);
