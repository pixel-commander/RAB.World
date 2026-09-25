import { useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { HandlerKey } from '../../../HouseKeys.types.ts';
import { useURL } from '../../../hooks/useURL/useURL.ts';
import type { CalendarProps, CalendarKeyDown, CalendarEvent, CalendarSelectType } from '../Calendar.types.ts';
import { normalizeDate, moveDate, validDate, safeEvents } from '../js/calendar.ts';
import { clickTab, keyTab, selectTab } from '../js/tabs.ts';

export const useCalendar = (bag: CalendarProps) => {
  const root = useRef<HTMLElement>(null);
  const id = useId();
  const internal_selector = useURL();
  const [addedEvents, setAddedEvents] = useState<CalendarEvent[]>([]);
  const events = [...safeEvents(bag.events), ...addedEvents].filter((event, index, items) =>
    items.findIndex(item => String(item.id) === String(event.id)) === index,
  );
  const setSelected: HandlerKey<number, CalendarSelectType, void> = bag.handleSelect || ((data, type) => {
    if (!validDate(data)) return;
    internal_selector[1]({ event: data }, 'update-var');
    if (type === 'day') selectTab(root.current, 'daily', true);
  });
  const suppliedSelected = validDate(bag.selected) ? bag.selected : undefined;
  const urlSelected = Number(internal_selector[0].url_vars.event);
  const selected = bag.handleSelect
    ? suppliedSelected
    : (suppliedSelected ?? (validDate(urlSelected) ? urlSelected : undefined));
  const date = normalizeDate(selected ?? bag.date);
  const handleMove = (amount?: number) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return;
    const daily = root.current?.querySelector('[data-id="daily"][role="tab"]')?.getAttribute('aria-selected') === 'true';
    setSelected(moveDate(date, amount, daily ? 'day' : 'month'), 'date');
  };
  const handleKeyDown: CalendarKeyDown = (data, type) => {
    keyTab(root.current, data, type);
  };
  const handleCancel: HandlerKey = () => {
    internal_selector[1]({ new_event: '' }, 'update-var');
  };
  const handleSubmit: HandlerKey<CalendarEvent, string, Promise<void>> = async (data) => {
    const event = safeEvents([data])[0];
    if (!event) throw new Error('The event needs a valid ID and date.');
    if (events.some(existing => String(existing.id) === String(event.id))) {
      throw new Error('Duplicate event ID. Check the repeated trigger.');
    }
    if (typeof bag.handleSave === 'function') await bag.handleSave(event, 'events');
    setAddedEvents(current => current.some(existing => String(existing.id) === String(event.id)) ? current : [...current, event]);
    internal_selector[1]({ new_event: '', event: event.id }, 'update-var');
  };
  const handleInsert: HandlerKey<number> = (data) => {
    if (!validDate(data)) return;
    internal_selector[1]({ event: '', new_event: data }, 'update-var');
  };
  return {
    ...bag, date, events, root, id,
    selected,
    handleSelect: setSelected,
    handleMove,
    handleInsert: typeof bag.handleInsert === 'function' ? bag.handleInsert : handleInsert,
    handleCancel: typeof bag.handleCancel === 'function' ? bag.handleCancel : handleCancel,
    handleSubmit: typeof bag.handleSubmit === 'function' ? bag.handleSubmit : handleSubmit,
    handleToday: () => setSelected(normalizeDate(), 'date'),
    handleClick: (event?: MouseEvent<HTMLButtonElement>) => clickTab(root.current, event),
    handleKeyDown,
  };
};
