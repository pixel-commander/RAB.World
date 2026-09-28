import {useState} from 'react';
import type { FloatPanelProps, FloatPanelStylers } from './FloatPanel.types';
import { useFloatPanel } from './hooks/useFloatPanel';
import { EDGES } from './js/float-panel';
import './css/float-panel.css';

export type { FloatPanelProps, FloatPanelStylers } from './FloatPanel.types';

export const FLOAT_PANEL_STYLERS: Record<'main', FloatPanelStylers> = {
  main: { container: 'container-main' },
};

export const FloatPanel = ({ styler: stylerName = 'main', stylers = {}, title = '', children, hidden = false, collapsed: suppliedCollapsed, resizable = true, docked = false, onCollapsedChange, handleClose, data, className, style, ...domProps }: FloatPanelProps) => {
  const [localCollapsed,setLocalCollapsed]=useState(false);
  const collapsed=suppliedCollapsed??localCollapsed;
  const toggle=()=>{setLocalCollapsed(!collapsed);onCollapsedChange?.(!collapsed);};
  const { rootRef, startDrag, moveDrag, endDrag, startResize, moveResize, endResize } = useFloatPanel({ collapsed, docked });
  const styler = { ...FLOAT_PANEL_STYLERS[stylerName], ...(stylers || {}) };
  return (
    <section {...domProps} style={collapsed?{...style,height:'auto',blockSize:'max-content'}:style} data-component="FloatPanel" ref={rootRef} hidden={hidden} className={`float-panel ${styler?.container || ''}${collapsed ? ' float-panel--collapsed' : ''}${docked ? ' float-panel--docked' : ''}${resizable && !docked ? ' resizable' : ''}${className ? ` ${className}` : ''}`}>
      <header className="float-panel__header" title={docked ? undefined : 'Drag to move'} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        <span className="float-panel__title">{title}</span>
        <span className="float-panel__actions" onPointerDown={event=>event.stopPropagation()}>
        <button type="button" data-id="float-panel-toggle" aria-expanded={!collapsed} className="float-panel__toggle" aria-label={collapsed ? 'Expand panel' : 'Collapse panel'} onClick={toggle}>{collapsed ? '+' : 'â€“'}</button>
        {handleClose&&<button type="button" className="float-panel__toggle" aria-label="Close panel" onClick={()=>handleClose?.(data,'float-panel')}>×</button>}
        </span>
      </header>
      <div className="float-panel__body" hidden={collapsed}>{children}</div>
      {resizable && !docked && EDGES.map((edge) => (
        <span key={edge} className={`resizable__handle resizable__handle--${edge}`} aria-hidden="true" onPointerDown={(event) => startResize(edge, event)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />
      ))}
    </section>
  );
};
