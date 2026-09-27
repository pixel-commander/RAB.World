import type { HTMLAttributes } from 'react';
import type { ShellViewProps } from '../../shell/components/SiteShell';
import project from '../../../settings.json';
export type DefaultProps = HTMLAttributes<HTMLElement> & Partial<ShellViewProps>;
export const Default = ({ children = "", className, url: _url, handleURL: _handleURL, selected: _selected, ...domProps }: DefaultProps) => {
  return <main {...domProps} className={['default-page', 'container-cell', className].filter(Boolean).join(' ')} data-page="Default" data-rab-seat="page-default:p1">
    {/* [rab-seat:page-default:p1] */}
    <h1>{project.title}</h1>
    <p>{project.description}</p>
    {children}
  </main>;
};
