import type { FormEvent } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';

const models = new Set(['rabbit-lo', 'rabbit', 'rabbit-hi', 'skull', 'robot', 'brain']);
export const handleChange: HandlerKey<FormEvent<HTMLElement>, string, void> = (event) => {
  const control = event?.target;
  if (!(control instanceof HTMLSelectElement) || control.dataset.id !== 'rabbit-model' ||
      !models.has(control.value)) return;
  const frame = event?.currentTarget.querySelector<HTMLIFrameElement>('[data-id="rabbit-background"]');
  frame?.contentWindow?.postMessage({ rabbitFx: 'model', args: [control.value] }, window.location.origin);
};
