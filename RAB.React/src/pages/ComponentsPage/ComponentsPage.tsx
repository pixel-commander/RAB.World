import { useComponentsPage } from './hooks/useComponentsPage';
import './css/components-page.css';
export const ComponentsPage = () => {
  const { entries, selected, handleURL } = useComponentsPage();
  const Demo = selected?.Demo;
  return <section data-grid="side-left" data-rows="1" className="components-page">
    <aside data-area="side"><nav aria-label="Component demos" className="components-page__nav">
      {entries.map(item => <a key={item.id} className="action-nav-alt" href={`/components/${encodeURIComponent(item.name)}`}
        aria-current={item === selected ? 'page' : undefined}
        onClick={event => {
          if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); handleURL({page:'components', section:item.name}, 'update-path');
        }}>{item.title}</a>)}
    </nav></aside>
    <div data-area="main" className="components-page__content">
      {selected ? <><h1>{selected.title}</h1><p>{selected.description}</p>
        <div className="components-page__demo">{Demo ? <Demo /> : <p>Demo not available.</p>}</div></> : <p>No components are listed.</p>}
    </div>
  </section>;
};
