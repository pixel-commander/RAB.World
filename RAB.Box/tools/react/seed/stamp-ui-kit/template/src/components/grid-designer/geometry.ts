export const RESIZE_EDGES = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'] as const;
export type ResizeEdge = (typeof RESIZE_EDGES)[number];

export type TrackMode = '1fr' | 'auto' | 'manual';

export interface Track { mode: TrackMode; manual: string; }
export interface GridBox { id: number; r1: number; c1: number; r2: number; c2: number; area?: string; }
export interface GridState { rows: number; cols: number; rowTracks: Track[]; colTracks: Track[]; boxes: GridBox[]; }

export const GRID_ATOM_TYPES = ['dashboard', 'page', 'row', 'misc'] as const;
export type GridAtomType = (typeof GRID_ATOM_TYPES)[number];

export const DEVICES = {
  phone: { inline: 390, block: 844, label: 'Phone' },
  tablet: { inline: 768, block: 1024, label: 'Tablet' },
  laptop: { inline: 1366, block: 768, label: 'Laptop' },
  desktop: { inline: 1920, block: 1080, label: 'Desktop' },
} as const;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeCount(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
}

function isGridBox(value: unknown): value is GridBox {
  if (!value || typeof value !== 'object') return false;
  const box = value as Partial<GridBox>;
  return [box.id, box.r1, box.c1, box.r2, box.c2].every(Number.isFinite);
}

export function normalizeBoxes(value: unknown, rows: number, cols: number): GridBox[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isGridBox).map((box) => clampBox({ ...box }, rows, cols));
}

export function normalizeBox(box: GridBox): GridBox {
  return { ...box, r1: Math.min(box.r1, box.r2), c1: Math.min(box.c1, box.c2), r2: Math.max(box.r1, box.r2), c2: Math.max(box.c1, box.c2) };
}

export function clampBox(box: GridBox, rows: number, cols: number): GridBox {
  return normalizeBox({ ...box, r1: clamp(box.r1, 1, rows), r2: clamp(box.r2, 1, rows), c1: clamp(box.c1, 1, cols), c2: clamp(box.c2, 1, cols) });
}

export function boxGridArea(box: GridBox) {
  const value = normalizeBox(box);
  return value.r1 + ' / ' + value.c1 + ' / ' + (value.r2 + 1) + ' / ' + (value.c2 + 1);
}

export function overlaps(a: GridBox, b: GridBox) {
  const x = normalizeBox(a);
  const y = normalizeBox(b);
  return !(x.r2 < y.r1 || y.r2 < x.r1 || x.c2 < y.c1 || y.c2 < x.c1);
}

export function placed(box: GridBox, boxes: GridBox[], rows: number, cols: number, ignoreId?: number) {
  const candidate = clampBox(box, rows, cols);
  return boxes.some((other) => other.id !== ignoreId && overlaps(candidate, other)) ? null : candidate;
}

export function trackListCss(tracks: Track[], count: number) {
  return Array.from({ length: count }, (_, index) => {
    const track = tracks[index] ?? { mode: '1fr', manual: 'minmax(0, 1fr)' };
    if (track.mode === 'manual') return track.manual.trim() || 'minmax(0, 1fr)';
    return track.mode;
  }).join(' ');
}

export function normalizeTracks(tracks: Track[] | undefined, count: number): Track[] {
  const sourceTracks = Array.isArray(tracks) ? tracks : [];
  return Array.from({ length: count }, (_, index) => {
    const source = sourceTracks[index];
    const mode: TrackMode = source?.mode === 'auto' || source?.mode === 'manual' ? source.mode : '1fr';
    const manual = typeof source?.manual === 'string' && source.manual.trim() ? source.manual : 'minmax(0, 1fr)';
    return { mode, manual };
  });
}

export function gridAtomName(name: string) {
  const value = name.trim();
  if (!/^grid-[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error('Grid atom name must be grid-<variant> in kebab-case.');
  }
  return value;
}

export function atomCss(name: string, state: GridState) {
  const safe = gridAtomName(name);
  const lines = [
    "@layer grid {",
    "[data-grid='" + safe + "'] {",
    '  display: grid;',
    '  grid-template-columns: ' + trackListCss(state.colTracks, state.cols) + ';',
    '  grid-template-rows: ' + trackListCss(state.rowTracks, state.rows) + ';',
    '}',
  ];
  const areas = state.boxes.filter((box) => box.area?.trim());
  if (areas.length) {
    lines.push('');
    areas.forEach((box) => {
      const area = box.area!.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
      lines.push("[data-grid='" + safe + "'] > [data-area='" + area + "'] { grid-area: " + boxGridArea(box) + '; }');
    });
  }
  lines.push('}');
  return lines.join('\n');
}

export function validateGridState(state: GridState) {
  if (!Number.isInteger(state.rows) || state.rows < 1) return 'Rows must be a positive integer.';
  if (!Number.isInteger(state.cols) || state.cols < 1) return 'Columns must be a positive integer.';
  for (const box of state.boxes) {
    const value = normalizeBox(box);
    if (value.r1 < 1 || value.c1 < 1 || value.r2 > state.rows || value.c2 > state.cols) return 'Box ' + box.id + ' is outside the grid.';
    if (state.boxes.some((other) => other.id !== box.id && overlaps(box, other))) return 'Box ' + box.id + ' overlaps another box.';
  }
  return '';
}

export function resizeBox(box: GridBox, edge: ResizeEdge, row: number, col: number): GridBox {
  return {
    ...box,
    r1: edge.includes('t') ? Math.min(row, box.r2) : box.r1,
    r2: edge.includes('b') ? Math.max(row, box.r1) : box.r2,
    c1: edge.includes('l') ? Math.min(col, box.c2) : box.c1,
    c2: edge.includes('r') ? Math.max(col, box.c1) : box.c2,
  };
}
