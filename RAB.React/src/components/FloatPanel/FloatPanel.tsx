import type { FloatPanelProps, FloatPanelStylers } from './FloatPanel.types';
import { useFloatPanel } from './hooks/useFloatPanel';
import { EDGES } from './js/float-panel';
import './css/float-panel.css';

export type { FloatPanelProps, FloatPanelStylers } from './FloatPanel.types';

export const FLOAT_PANEL_STYLERS: Record<'main', FloatPanelStylers> = {
  main: { container: 'container-main' },
};

export const FloatPanel = ({ styler: stylerName = 'main', stylers = {}, title = '', children, hidden = false, collapsed = false, resizable = true, docked = false, onCollapsedChange, className, ...domProps }: FloatPanelProps) => {
  const { rootRef, startDrag, moveDrag, endDrag, startResize, moveResize, endResize } = useFloatPanel({ collapsed, docked });
  const styler = { ...FLOAT_PANEL_STYLERS[stylerName], ...(stylers || {}) };
  return (
    <section {...domProps} data-component="FloatPanel" ref={rootRef} hidden={hidden} className={`float-panel ${styler?.container || ''}${collapsed ? ' float-panel--collapsed' : ''}${docked ? ' float-panel--docked' : ''}${resizable && !docked ? ' resizable' : ''}${className ? ` ${className}` : ''}`}>
      <header className="float-panel__header" title={docked ? undefined : 'Drag to move'} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <span className="float-panel__title">{title}</span>
        <button type="button" data-id="float-panel-toggle" aria-expanded={!collapsed} className="float-panel__toggle" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} onClick={() => onCollapsedChange?.(!collapsed)}>{collapsed ? '+' : '–'}</button>
      </header>
      <div className="float-panel__body" hidden={collapsed}>{children}</div>
      {resizable && !docked && EDGES.map((edge) => (
        <span key={edge} className={`resizable__handle resizable__handle--${edge}`} aria-hidden="true" onPointerDown={(event) => startResize(edge, event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
      ))}
    </section>
  );
};
