import '../../css/resizable.css';
import { forwardRef, useRef, type CSSProperties } from 'react';
import { RESIZE_EDGES, DEVICES, GRID_ATOM_TYPES, boxGridArea, type GridBox } from './geometry.ts';
import { useGridDesigner } from './hooks/useGridDesigner.ts';
import type { GridDesignerHandle, GridDesignerProps } from './GridDesigner.types.ts';
import './css/grid-designer.css';
 
type BoxStyle = CSSProperties & { '--box-area': string };
type CellStyle = CSSProperties & { '--cell-area': string };

export const GridDesigner = forwardRef<GridDesignerHandle, GridDesignerProps>(function GridDesigner(
  {
    rows: initialRows = 6,
    cols: initialCols = 6,
    boxes: initialBoxes = [],
    rowTracks: initialRowTracks,
    colTracks: initialColTracks,
    handleChange,
    handleDraw,
    handleSave,
    validate,
    cssProvider,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bag = useGridDesigner({
    rootRef,
    handleRef: ref,
    rows: initialRows,
    cols: initialCols,
    boxes: initialBoxes,
    rowTracks: initialRowTracks,
    colTracks: initialColTracks,
    handleChange,
    handleDraw,
    handleSave,
    validate,
    cssProvider,
  });
  const { rows, cols, boxes, rowTracks, colTracks } = bag.snapshot();

  return (
    <div className="grid-designer" data-id="grid-designer" ref={bag.bindRoot} onClick={bag.handleClick} onChange={bag.handleChange}>
      <div className="row-apart row-compact grid-designer__toolbar">
        <div className="row-compact">
          <label className="grid-designer__number">Rows <input data-id="rows" type="number" min="1" value={rows} /></label>
          <label className="grid-designer__number">Cols <input data-id="cols" type="number" min="1" value={cols} /></label>
        </div>
        <div className="row-compact">
          <label className="grid-designer__device">View <select data-id="device" defaultValue=""><option value="">Fluid</option>{Object.entries(DEVICES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
          <button className="action-muted" data-id="reset" type="button">Reset</button>
          <button className="action-main" data-id="open-save" type="button">Save grid</button>
        </div>
      </div>

      <div className="grid-designer__viewport" data-id="viewport">
        <div className="grid-designer__device-frame" data-id="device-frame">
          <div className="grid-designer__corner" aria-hidden="true" />
          <div className="grid-designer__rail grid-designer__rail--columns" style={bag.gridStyle}>
            {colTracks.map((track, index) => <div className="grid-designer__track grid-designer__track--column" data-id={'col-' + index} key={'c' + index}>
              <select aria-label={'Column ' + (index + 1)} value={track.mode} data-id={'track-col-' + index + '-mode'}><option value="1fr">1fr</option><option value="auto">auto</option><option value="manual">manual</option></select>
              <input aria-label={'Column ' + (index + 1) + ' size'} value={track.manual} data-id={'track-col-' + index + '-manual'} />
            </div>)}
          </div>
          <div className="grid-designer__rail grid-designer__rail--rows" style={bag.gridStyle}>
            {rowTracks.map((track, index) => <div className="grid-designer__track grid-designer__track--row" data-id={'row-' + index} key={'r' + index}>
              <select aria-label={'Row ' + (index + 1)} value={track.mode} data-id={'track-row-' + index + '-mode'}><option value="1fr">1fr</option><option value="auto">auto</option><option value="manual">manual</option></select>
              <input aria-label={'Row ' + (index + 1) + ' size'} value={track.manual} data-id={'track-row-' + index + '-manual'} />
            </div>)}
          </div>
          <div className="grid-designer__canvas" data-id="canvas" data-grid style={bag.gridStyle} onPointerDown={bag.handlePointerDown} onPointerMove={bag.handlePointerMove} onPointerUp={bag.handlePointerUp} onPointerCancel={bag.handlePointerCancel}>
            {Array.from({ length: rows * cols }, (_, index) => {
              const row = Math.floor(index / cols) + 1;
              const col = (index % cols) + 1;
              return <span className="grid-designer__cell" aria-hidden="true" key={'cell-' + index} style={{ '--cell-area': row + ' / ' + col } as CellStyle} />;
            })}
            {boxes.map((box: GridBox) => <article className="grid-designer__box" data-box data-id={'box-' + box.id} key={box.id} style={{ '--box-area': boxGridArea(box) } as BoxStyle}>
              <input className="grid-designer__area" data-id={'area-' + box.id} aria-label={'Box ' + box.id + ' area name'} placeholder="area-name" value={box.area ?? ''} />
              <button className="grid-designer__remove" data-id={'remove-' + box.id} type="button" aria-label={'Remove box ' + box.id}>×</button>
              {RESIZE_EDGES.map((edge) => (
                <span key={edge} className={`resizable__handle resizable__handle--${edge}`}
                  data-id={`resize-${edge}-${box.id}`} aria-hidden="true" />
              ))}
            </article>)}
            <div className="grid-designer__draft" data-id="draft" aria-hidden="true" />
            <div className="grid-designer__blocked" data-id="blocked" aria-hidden="true" />
          </div>
        </div>
      </div>

      <dialog className="grid-designer__dialog container-float" data-id="save-dialog">
        <form method="dialog" onSubmit={bag.handleSubmit}>
          <div className="grid-designer__dialog-head"><h2>Save grid atom</h2><button className="action-muted" data-id="close-save" type="button">Close</button></div>
          <label>Name <input name="name" required pattern="grid-[a-z0-9][a-z0-9-]*" placeholder="grid-dashboard" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); }} /></label>
          <label>Type <select name="type" defaultValue="misc">{GRID_ATOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label>Description <textarea name="description" rows={3} /></label>
          <output className="grid-designer__status" data-id="save-status" />
          <button className="action-main" data-id="save-submit" type="submit">Save</button>
        </form>
      </dialog>
    </div>
  );
});
