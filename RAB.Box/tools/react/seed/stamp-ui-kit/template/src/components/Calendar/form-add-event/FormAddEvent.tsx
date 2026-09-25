import { StatelessForm } from '../../StatelessForm/StatelessForm.tsx';
import { FloatPanel } from '../../float-panel/FloatPanel.tsx';
import type { FormAddEventProps } from './FormAddEvent.types.ts';
import { useFormAddEvent } from './hooks/useFormAddEvent.ts';
import './css/form-add-event.css';

export const FormAddEvent = (props: FormAddEventProps = {}) => {
  const { panel_hidden, ...bag } = useFormAddEvent(props);
  return (
    <FloatPanel title="Add event" hidden={panel_hidden}
      onCollapsedChange={(collapsed) => { if (collapsed && typeof bag.handleCancel === 'function') bag.handleCancel(); }}>
      <StatelessForm {...bag} />
    </FloatPanel>
  );
};
