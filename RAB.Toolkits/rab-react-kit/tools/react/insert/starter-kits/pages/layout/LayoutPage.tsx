import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './layout.css';
import {
  LayoutDesigner,
  boxGridArea,
  DROP_TYPE,
} from '../../components/layout-designer/LayoutDesigner.tsx';
import type { Box, ContentSpec } from '../../components/layout-designer/LayoutDesigner.tsx';
import { demoIndex, demoByName } from '../../demoRegistry.ts';

const ROWS = 8;
const COLS = 4;

const renderContent = (spec: ContentSpec): ReactNode => {
  const entry = demoByName(spec.name);
  return entry ? <entry.Demo /> : null;
};

/* view mode: the drawn boxes as the page they would be — full screen,
   loaded content, container skins, no designer chrome; esc or Close returns */
const Preview = ({ boxes, onClose }: { boxes: Box[]; onClose: () => void }) => (
  <div
    className="layout-preview"
    onKeyDown={(event) => {
      if (event.key === 'Escape') onClose();
    }}
  >
    <div className="layout-preview__bar">
      <span className="layout-preview__title">Preview</span>
      <button type="button" className="action-muted layout-preview__close" onClick={onClose}>
        Close · esc
      </button>
    </div>
    <div
      className="layout-preview__stage"
      style={{ '--layout-preview-rows': ROWS, '--layout-preview-cols': COLS } as React.CSSProperties}
    >
      {boxes.map((box) => (
        <div key={box.id} className="layout-preview__box container-main pad" style={{ gridArea: boxGridArea(box) }}>
          {box.content ? renderContent(box.content) : null}
        </div>
      ))}
    </div>
  </div>
);

export const LayoutPage = () => {
  const boxesRef = useRef<Box[]>([]);
  const [preview, setPreview] = useState(false);

  return (
    <section className="layout-page" data-grid="side-left">
      <aside data-area="side">
        <div className="inner pad scroll">
          <div className="layout__brand">
            <span className="layout__name">Layout</span>
            <span>draw · move · resize — boxes push, never overlap</span>
            <span>drag a component onto the board to load it</span>
          </div>
          <nav className="layout__list">
            {demoIndex.map((entry) => (
              <div
                key={entry.path}
                className="action-nav"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(DROP_TYPE, JSON.stringify({ name: entry.name }));
                  event.dataTransfer.effectAllowed = 'copy';
                }}
              >
                {entry.path}
              </div>
            ))}
          </nav>
          <button type="button" className="action-main layout__view" onClick={() => setPreview(true)}>
            View
          </button>
        </div>
      </aside>
      <div data-area="main">
        <div className="inner pad">
          <LayoutDesigner
            rows={ROWS}
            cols={COLS}
            renderContent={renderContent}
            onChange={(boxes) => {
              boxesRef.current = boxes;
            }}
          />
        </div>
      </div>
      {preview && <Preview boxes={boxesRef.current} onClose={() => setPreview(false)} />}
    </section>
  );
};
