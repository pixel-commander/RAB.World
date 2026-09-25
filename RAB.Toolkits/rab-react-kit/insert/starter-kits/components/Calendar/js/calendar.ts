import type { CalendarEvent } from '../Calendar.types.ts';

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const validDate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
export const normalizeDate = (value?: number): number => validDate(value) ? value : Date.now();

// Local calendar days are compared as numeric timestamps, including across DST.
export const dayStart = (value: number): number => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Text is restricted to presentation and serialization boundaries.
export const dateKey = (value: number): string => {
  const date = new Date(value);
  return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
export const parseDateKey = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + 'T00:00:00').getTime();
  return validDate(date) && dateKey(date) === value ? date : undefined;
};
export const moveDate = (value: number, amount: number, unit: 'day' | 'month'): number => {
  const date = new Date(value);
  if (unit === 'day') date.setDate(date.getDate() + amount);
  else {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  return date.getTime();
};
export const monthDays = (value?: number): number[] => {
  const date = new Date(dayStart(normalizeDate(value)));
  date.setDate(1);
  const offset = (date.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7) * 7;
  date.setDate(1 - offset);
  return Array.from({ length: count }, (_, index) => moveDate(date.getTime(), index, 'day'));
};
// date_start overrides date for ranged events; the end is exclusive.
export const eventStart = (event: CalendarEvent): number | undefined => event.date_start ?? event.date;
export const eventOverlaps = (event: CalendarEvent, start: number, end: number): boolean => {
  const from = eventStart(event);
  if (!validDate(from)) return false;
  const to = event.date_end;
  return validDate(to) && to > from ? from < end && to > start : from >= start && from < end;
};
export const safeEvents = (events: unknown): CalendarEvent[] => Array.isArray(events)
  ? events.filter((event): event is CalendarEvent => !!event
    && (typeof event.id === 'string' || (typeof event.id === 'number' && Number.isFinite(event.id)))
    && ['name', 'title', 'description'].every(key => event[key] === undefined || typeof event[key] === 'string')
    && ['date', 'date_start', 'date_end'].every(key => event[key] === undefined || validDate(event[key]))
    && validDate(eventStart(event))
    && (event.date_end === undefined || event.date_end >= eventStart(event)!)
    && (event.location === undefined || typeof event.location === 'string')
    && (event.source === undefined || typeof event.source === 'string'))
  : [];
export const eventsOn = (events: unknown, date: number): CalendarEvent[] => {
  const start = dayStart(date);
  return safeEvents(events).filter(event => eventOverlaps(event, start, moveDate(start, 1, 'day')))
    .sort((a, b) => eventStart(a)! - eventStart(b)!);
};
export const timeLabel = (value: number): string => {
  const date = new Date(value);
  return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
};
export const eventTimeLabel = (event: CalendarEvent): string => {
  const start = eventStart(event);
  if (!validDate(start)) return '';
  if (!validDate(event.date_end) && dayStart(start) === start) return '';
  return validDate(event.date_end) ? timeLabel(start) + ' – ' + timeLabel(event.date_end) : timeLabel(start);
};
export const dateLabel = (date: number): string => new Date(date).toLocaleDateString(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

export const eventClass = (value?: string): string => typeof value === 'string' ? value : 'action-rail-left';
