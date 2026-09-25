import type { ReactNode } from 'react';
import './panel.css';

interface PanelProps {
  title: string;
  flush?: boolean;
  children?: ReactNode;
}

export const Panel = ({ title, flush = false, children }: PanelProps) => (
  <section className="panel container-main">
    <header className="panel__header">
      <h2 className="panel__title">{title}</h2>
    </header>
    <div className={`panel__body${flush ? ' panel__body--flush' : ''}`}>{children}</div>
  </section>
);
