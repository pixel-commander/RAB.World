import type { CalendarEvent } from '../../Calendar.types.ts';
import { eventsOn, normalizeDate, dayStart, eventOverlaps, timeLabel } from '../../js/calendar.ts';

export const dailyHours = (date?: number, events?: CalendarEvent[]) => {
  const day = dayStart(normalizeDate(date));
  const items = eventsOn(events, day);
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0');
    const start = new Date(day);
    const end = new Date(day);
    start.setHours(hour);
    end.setHours(hour + 1);
    return { hour, key, label: timeLabel(start.getTime()), events: items.filter(event => eventOverlaps(event, start.getTime(), end.getTime())) };
  });
};
