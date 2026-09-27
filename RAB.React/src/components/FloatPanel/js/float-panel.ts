import type { Edge } from '../FloatPanel.types';

export const EDGES: readonly Edge[] = ['t', 'r', 'b', 'l', 'tl', 'tr', 'bl', 'br'];

export const clamp = (value: number, low: number, high: number) => { return Math.max(low, Math.min(high, value)); };
