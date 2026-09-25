import { useEffect, useId, useRef } from 'react';
import type { FormAddEventBag, FormAddEventProps } from '../FormAddEvent.types.ts';
import type { FormValues } from '../../../StatelessForm/StatelessForm.types.ts';
import type { HandlerKey } from '../../../../HouseKeys.types.ts';
import { inputDate, collectEvent } from '../js/eventForm.ts';
import { useURL } from '../../../../hooks/useURL/useURL.ts';
import { validDate } from '../../js/calendar.ts';

export const useFormAddEvent = (bag: FormAddEventProps): FormAddEventBag => {
  const container_ref = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const [url] = useURL();
  const newEvent = Number(url.url_vars.new_event);
  const eventDate = validDate(newEvent) ? newEvent : undefined;

  useEffect(() => {
    if (!validDate(eventDate)) return;
    container_ref.current?.reset();
    const field = container_ref.current?.querySelector<HTMLInputElement>('[name="start"]');
    if (field) field.value = inputDate(eventDate);
  }, [eventDate]);

  const handleSubmit: HandlerKey<FormValues> = async (data, type) => {
    const result = collectEvent(data, bag);
    const message = container_ref.current?.querySelector<HTMLElement>('[data-id="form-message"]');
    if (result.error) { if (message) message.textContent = result.error; return; }
    if (typeof bag.handleSubmit !== 'function') {
      if (message) message.textContent = 'No event destination is connected yet.';
      return;
    }
    if (message) message.textContent = '';
    try {
      await bag.handleSubmit(result.event, type);
      container_ref.current?.reset();
    } catch (error) {
      if (message) message.textContent = error instanceof Error ? error.message : 'The event could not be saved.';
    }
  };
  return {
    panel_hidden: eventDate === undefined,
    children: bag.children,
    container_ref, className: 'form-main form-add-event', name: 'form-add-event',
    button_text: { submit: 'Add event', cancel: 'Cancel' }, handleSubmit,
    handleCancel: bag.handleCancel,
    form_fields: [
      { name: 'name', label: 'Name', helper_text: 'One or two words for the calendar cell.', is_required: true, default_value: bag.name },
      { name: 'title', label: 'Title', helper_text: 'A short sentence.', default_value: bag.title },
      { name: 'description', label: 'Description', type: 'textarea', default_value: bag.description },
      { name: 'start', label: 'Start', type: 'datetime-local', is_required: true, default_value: inputDate(eventDate ?? bag.date_start ?? bag.date) },
      { name: 'end', label: 'End', type: 'datetime-local', helper_text: 'Leave empty for an event with one date and time.', default_value: eventDate === undefined ? inputDate(bag.date_end) : '' },
      { name: 'location', label: 'Location', default_value: bag.location },
    ].map(field => ({ ...field, id: prefix + '-' + field.name })),
  };
};
