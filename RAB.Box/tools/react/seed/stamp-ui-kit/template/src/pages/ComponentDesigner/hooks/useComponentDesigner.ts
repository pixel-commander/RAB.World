import { handleChange as handleCodeChange } from '../js/buildHTML.ts';
import { makeDropZone, handleRemove as handleRemoveDropZone } from '../../../js/makeDropZone/makeDropZone.js';
import { gridSpecs } from '../../../components/grid-selector/GridSelector.tsx';
import gridCss from '../../../themes/layout/grid.css?raw';
import { attachWorkspace, resizeEdges } from '../js/workspace.ts';
import { useEffect, useRef, useState, type MouseEvent, type DragEvent, type CSSProperties } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';
import { makeDragScrollable, handleRemove } from '../../../js/makeDragScrollable/makeDragScrollable.js';
import { demoIndex } from '../../../demoRegistry.ts';
const components = demoIndex;
const gridFiles = import.meta.glob('../../../atoms/grids/**/*.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const specs = [...new Map([gridCss, ...Object.values(gridFiles)].flatMap(gridSpecs).filter(spec => spec.areas).map(spec => [spec.name, spec])).values()];
const COMPONENT_MIME = 'application/x-rab-component';
export const useComponentDesigner = () => {
  const rootRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(specs.find(spec => spec.name === 'header-main')?.name ?? specs[0]?.name ?? '');
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const spec = specs.find(item => item.name === selected);
  const areas = [...new Set(spec?.areas?.flat() ?? [])].filter(area => area !== '.');
  const gridStyle: CSSProperties = spec ? {
    gridTemplateColumns: spec.cols.join(' '), gridTemplateRows: spec.rows.join(' '),
    gridTemplateAreas: spec.areas?.map(row => `'${row.join(' ')}'`).join(' '),
  } : {};
  const handleSelect: HandlerKey<{ name: string }> = data => {
    if (!data || !specs.some(item => item.name === data.name)) return;
    setSelected(data.name); setPlacements({});
  };
  const handleDragStart: HandlerKey<DragEvent<HTMLElement>> = data => {
    const item = data?.target instanceof Element ? data.target.closest<HTMLElement>('[data-id="component-item"]') : null;
    const path = item?.dataset.path;
    if (!data || !path || !components.some(item => item.path === path)) return;
    data.dataTransfer.setData(COMPONENT_MIME, JSON.stringify({ path }));
    data.dataTransfer.effectAllowed = 'copy';
  };
  useEffect(() => attachWorkspace(rootRef.current), []);
  useEffect(() => {
    const zones = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-id="grid-drop-area"]') ?? []);
    zones.forEach(zone => {
      const handleDrag: HandlerKey<globalThis.DragEvent, string, boolean> = data => Boolean(data?.dataTransfer?.types.includes(COMPONENT_MIME));
      const handleDrop: HandlerKey<globalThis.DragEvent> = data => {
        if (!handleDrag(data)) return;
        try {
          const value: unknown = JSON.parse(data!.dataTransfer!.getData(COMPONENT_MIME));
          if (!value || typeof value !== 'object' || !('path' in value) || typeof value.path !== 'string' || !components.some(item => item.path === value.path)) return;
          const area = zone.dataset.area;
          if (area) setPlacements(current => ({ ...current, [area]: value.path as string }));
        } catch { /* Foreign or malformed drops do not mutate the workspace. */ }
      };
      makeDropZone(zone, { handleDrag, handleDrop });
    });
    return () => zones.forEach(zone => handleRemoveDropZone(zone));
  }, [selected]);
  useEffect(() => {
    const element = rootRef.current?.querySelector<HTMLElement>('[data-id="library-scroll"]');
    const handleDragStart: HandlerKey<PointerEvent, 'scroll', boolean> = (data) =>
      data?.target instanceof Element && !data.target.closest('[draggable="true"], [data-scroll-drag="off"]');
    makeDragScrollable(element, { label: 'Designer library', size: 4, handleDragStart });
    return () => handleRemove(element);
  }, []);
  const handleClick: HandlerKey<MouseEvent<HTMLElement>> = (data) => {
    const root = rootRef.current;
    if (!root || !(data?.target instanceof Element)) return;
    const editorTab = data.target.closest<HTMLButtonElement>('[data-id="editor-tab"]');
    if (editorTab && ['preview', 'code'].includes(editorTab.dataset.type ?? '')) {
      root.querySelectorAll<HTMLButtonElement>('[data-id="editor-tab"]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === editorTab)));
      root.querySelectorAll<HTMLElement>('[data-id="editor-panel"]').forEach(panel => { panel.hidden = panel.dataset.type !== editorTab.dataset.type; });
      return;
    }
    const button = data.target.closest<HTMLButtonElement>('[data-id="library-tab"]');
    const name = button?.dataset.type;
    if (!button || !name || !['grid', 'components', 'layout'].includes(name)) return;
    root.querySelectorAll<HTMLButtonElement>('[data-id="library-tab"]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    root.querySelectorAll<HTMLElement>('[data-id="library-panel"]').forEach(panel => { panel.hidden = panel.dataset.type !== name; });
    const viewport = root.querySelector<HTMLElement>('[data-id="library-scroll"]');
    if (viewport) viewport.scrollTop = 0;
  };
  return { codePreview: { sourceRef: rootRef, sourceId: 'draw-grid', handleChange: handleCodeChange }, rootRef, components, specs, selected, areas, placements, gridStyle, resizeEdges, handleClick, handleSelect, handleDragStart };
};
