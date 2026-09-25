import { CodePreview } from '../../components/CodePreview/CodePreview.tsx';
import { GridSelector } from '../../components/grid-selector/GridSelector.tsx';
import { useComponentDesigner } from './hooks/useComponentDesigner.ts';
import './css/component-designer.css';

export const ComponentDesigner = () => {
  const { codePreview, rootRef, components, specs, selected, areas, placements, gridStyle, resizeEdges, handleClick, handleSelect, handleDragStart } = useComponentDesigner();
  return (
    <section ref={rootRef} className="component-designer-page" data-grid="side-cols" aria-label="ComponentDesigner" onClick={handleClick} onDragStart={handleDragStart}>
      <aside data-area="left" data-grid="header-main" aria-label="Designer library">
        <nav data-area="header" className="component-designer-page__tabs" aria-label="Library sections">
          {['grid', 'components', 'layout'].map(name => <button key={name} type="button" className="action-nav-alt component-designer-page__tab" data-id="library-tab" data-type={name} aria-pressed={name === 'grid'}>{name === 'grid' ? 'Grid' : name === 'components' ? 'Components' : 'Layout'}</button>)}
        </nav>
        <div data-area="main" className="component-designer-page__library inner pad scroll" data-id="library-scroll">
          <div data-id="library-panel" data-type="grid"><GridSelector specs={specs} selected={selected} onSelect={handleSelect} /></div>
          <div data-id="library-panel" data-type="components" className="component-designer-page__components" hidden>
            {components.map(({ path, name, title }) => <button key={path} type="button" draggable data-id="component-item" data-path={path} className="action-ghost component-designer-page__component">
              <span className="component-designer-page__name">{name}</span>
              <span className="component-designer-page__title">{title}</span>
            </button>)}
          </div>
          <div data-id="library-panel" data-type="layout" hidden><p>Layouts</p></div>
        </div>
      </aside>
      <section data-area="main" data-grid="header-main" className="component-designer-page__editor">
        <nav data-area="header" className="component-designer-page__tabs" aria-label="Editor views">
          {['preview', 'code'].map(name => <button key={name} type="button" className="action-nav-alt component-designer-page__tab" data-id="editor-tab" data-type={name} aria-pressed={name === 'preview'}>{name === 'preview' ? 'Preview' : 'Code'}</button>)}
        </nav>
      <div data-area="main" data-id="editor-panel" data-type="preview" className="component-designer-page__preview">
      <div className="component-designer-page__workspace" data-id="workspace">
        <p data-id="draw-hint" className="component-designer-page__hint">Choose a grid, then draw a box.</p>
        <div data-id="draw-grid" className="component-designer-page__draw-grid container-main" hidden>
          <button type="button" data-id="move-grid" className="action-muted component-designer-page__move">Move {selected}</button>
          <div className="component-designer-page__grid" data-id="built-grid" data-grid={selected} style={gridStyle}>
            {areas.map(area => {
              const component = components.find(item => item.path === placements[area]);
              const Demo = component?.Demo;
              return <div key={area} data-id="grid-drop-area" data-area={area} data-component-path={component?.path} data-component-name={component?.name} className="component-designer-page__drop-area container-inset" style={{ gridArea: area }}>
                <span data-id="area-label" className="component-designer-page__area-label">{area}</span>
                {Demo ? <Demo key={component.path} /> : <span data-id="drop-prompt">Drop component</span>}
              </div>;
            })}
          </div>
          {resizeEdges.map(edge => <span key={edge} data-id="resize-grid" data-edge={edge} className={`component-designer-page__resize component-designer-page__resize--${edge}`} aria-hidden="true" />)}
        </div>
      </div>
      </div>
      <div data-area="main" data-id="editor-panel" data-type="code" className="component-designer-page__code" hidden><CodePreview {...codePreview} /></div>
      </section>
      <aside data-area="right" aria-label="Settings"><p>Settings</p></aside>
    </section>
  );
};
