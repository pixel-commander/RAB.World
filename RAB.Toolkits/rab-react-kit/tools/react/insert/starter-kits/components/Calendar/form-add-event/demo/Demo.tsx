import { useRef } from 'react';
import { FormAddEvent } from '../FormAddEvent.tsx';

export const Demo = () => {
  const root = useRef<HTMLDivElement>(null);
  return <div ref={root}>
    <FormAddEvent date={new Date(2026, 8, 10, 9).getTime()}
      handleSubmit={data => {
        const output = root.current?.querySelector<HTMLOutputElement>('[data-id="event-preview"]');
        if (output) output.textContent = JSON.stringify(data, null, 2);
      }} />
    <output data-id="event-preview" aria-live="polite" />
  </div>;
};
export default Demo;
