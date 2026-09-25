import type { FormValues } from '../../../StatelessForm/StatelessForm.types.ts';
import type { CalendarEvent } from '../../Calendar.types.ts';
import type { FormAddEventProps } from '../FormAddEvent.types.ts';
import { dateKey, validDate } from '../../js/calendar.ts';

export const inputDate = (value?: number): string => {
  if (!validDate(value)) return '';
  const date = new Date(value);
  return dateKey(value) + 'T' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
};
export const readInputDate = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const timestamp = new Date(value).getTime();
  return validDate(timestamp) && inputDate(timestamp) === value ? timestamp : undefined;
};
export const collectEvent = (data: FormValues | undefined, bag: FormAddEventProps, now = Date.now()): { event?: CalendarEvent; error?: string } => {
  if (!data || typeof data !== 'object') return { error: 'Enter the event details.' };
  const text = (key: string) => typeof data[key] === 'string' ? data[key] as string : '';
  const name = text('name').trim();
  if (!name) return { error: 'Enter a short event name.' };
  const start = readInputDate(text('start'));
  const endValue = text('end');
  const end = endValue ? readInputDate(endValue) : undefined;
  if (start === undefined) return { error: 'Enter a valid start date and time.' };
  if (endValue && end === undefined) return { error: 'Enter a valid end date and time.' };
  const dates: Pick<CalendarEvent, 'date' | 'date_start' | 'date_end'> = {};
  if (end !== undefined) {
    dates.date_start = start;
    dates.date_end = end;
  } else {
    dates.date = start;
  }
  if (dates.date_end !== undefined && dates.date_end < start) return { error: 'End must not be before the start.' };
  if (Array.isArray(bag.events) && bag.events.some(event => event && String(event.id) === String(now))) {
    return { error: 'Duplicate event ID. Check the repeated trigger before trying again.' };
  }
  const formOnly = new Set(['name', 'title', 'description', 'start', 'end', 'location']);
  const custom = Object.fromEntries(Object.entries(data).filter(([key]) => !formOnly.has(key)));
  return { event: {
    ...custom, id: now, date_added: now, name, title: text('title'), description: text('description'),
    location: text('location'), ...dates,
    ...(bag.added_by !== undefined ? { added_by: bag.added_by } : {}),
    ...(bag.count !== undefined ? { count: bag.count } : {}),
  } };
};
