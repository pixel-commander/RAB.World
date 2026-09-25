import type { CalendarEvent } from '../../../components/Calendar/Calendar.types.ts';
import { parseDateKey, safeEvents, validDate } from '../../../components/Calendar/js/calendar.ts';

export interface Proposal extends CalendarEvent {
  sourceFrom?: string;
  sourceSubject?: string;
}

// Compatibility at the file boundary only. No source files are rewritten on read.
export const readEvents = (value: unknown): CalendarEvent[] => {
  if (!Array.isArray(value)) return [];
  return safeEvents(value.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
    let date = validDate(record.date) ? record.date : parseDateKey(record.date);
    // Preserve old files' separate clock value when converting their date-only text.
    const clock = typeof record.time === 'string' ? /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(record.time) : null;
    if (typeof record.date === 'string' && date !== undefined && clock) {
      const parsed = new Date(date);
      parsed.setHours(Number(clock[1]), Number(clock[2]));
      date = parsed.getTime();
    }
    const { time, ...fields } = record;
    return { ...fields, date };
  }));
};
export const readProposals = (value: unknown): Proposal[] => readEvents(value).filter((record): record is Proposal => {
  const proposal = record as Proposal;
  return (proposal.sourceFrom === undefined || typeof proposal.sourceFrom === 'string')
    && (proposal.sourceSubject === undefined || typeof proposal.sourceSubject === 'string');
});
