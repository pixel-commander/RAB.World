import { ListAtomDesigner } from './ListAtomDesigner/ListAtomDesigner.tsx';
import { FormAtomDesigner } from './FormAtomDesigner/FormAtomDesigner.tsx';
import { CSSCodeView } from './CSSCodeView/CSSCodeView.tsx';
import { useAtomDesigner } from './hooks/useAtomDesigner.ts';
import { innerSelectorOf } from './FormAtomDesigner/skin-text.ts';
import type { AtomDesignerProps } from './AtomDesigner.types.ts';
import './css/atom-designer.css';
export type { AtomDesignerProps } from './AtomDesigner.types.ts';
export const AtomDesigner = (props: AtomDesignerProps = {}) => {
  const { rootRef, list, form, code, selected, draft, rect, draftRect, nested, boxStyle, stageRef,
    handlePointerDown, handlePointerMove, handlePointerUp } = useAtomDesigner(props);
  return <section ref={rootRef} className="atom-designer" data-grid="side-cols" aria-label="AtomDesigner">
    <aside data-area="left"><div className="inner scroll" data-id="atoms-scroll"><ListAtomDesigner {...list} /></div></aside>
    <div data-area="main"><div className="inner"><div ref={stageRef} className="atom-designer__stage-area" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>{!rect && !draftRect && <p className="atom-designer__stage-hint">draw to get started</p>}{rect && selected && <div className={`atom-designer__box ${selected.name}${nested ? '' : ' pad'}`} style={boxStyle}><div className={`atom-designer__box-core${nested ? ` atom-designer__box-core--fill ${innerSelectorOf(selected.name).slice(1)}` : ''}`}><span>{selected.family === 'container' ? 'the quick brown fox' : selected.name}</span></div></div>}{draftRect && <div className="atom-designer__draft" style={{ insetInlineStart: draftRect.x, insetBlockStart: draftRect.y, inlineSize: draftRect.w, blockSize: draftRect.h }} />}</div><div className="atom-designer__stage-bar"><label className="atom-designer__stage-color">stage color<input type="color" title="Contrast ground â€” ephemeral, never saved" onInput={(event) => stageRef.current?.style.setProperty('--atom-designer-stage-ground', event.currentTarget.value)} /></label></div></div></div>
    <aside data-area="right" data-rows="2">
      <div className="atom-designer__settings container-inset pad" data-rows="1">
        <div className="inner scroll" data-id="styles-scroll">{selected && <FormAtomDesigner key={selected.name} {...form} />}</div>
      </div>
      <div className="atom-designer__code container-machine pad" data-rows="1">
        <div className="inner scroll"><CSSCodeView {...code} /></div>
      </div>
    </aside>
    <style>{draft}</style>
  </section>;
};
