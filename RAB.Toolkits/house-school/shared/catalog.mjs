import { family as handlers } from '../curricula/handlers/index.mjs';
import { family as wrapping } from '../curricula/handlers/wrapping.mjs';
import { family as bags } from '../curricula/bags/index.mjs';
import { family as collections } from '../curricula/collections/index.mjs';
import { family as ownership } from '../curricula/selection-ownership/index.mjs';

export const families = [handlers, wrapping, bags, collections, ownership];
export const combinations = [0, 1, 2, 4, 7];
export const switches = (mask) => [0, 1, 2].map((bit) => Boolean(mask & (1 << bit)));
