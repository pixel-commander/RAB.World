import type { CalendarProps } from './Calendar.types.ts';
import { dateLabel, eventsOn, normalizeDate, dateKey, dayStart, eventTimeLabel, eventClass } from './js/calendar.ts';

export const CalendarDay = ({ date, events, handleSelect, event_class, handleInsert }: CalendarProps) => {
  const day = normalizeDate(date);
  const items = eventsOn(events, day);
  return (
    <article className="calendar__day container-inset" data-grid="header-main">
      <header data-area="header" data-grid="side-right">
      <button type="button" className="calendar__date action-nav" data-area="main" data-id={day}
        aria-label={dateLabel(day)} aria-current={dayStart(day) === dayStart(normalizeDate()) ? 'date' : undefined}
        onClick={() => { if (typeof handleSelect === 'function') handleSelect(day, 'day'); }}>
        <time dateTime={dateKey(day)}>{new Date(day).getDate()}</time>
      </button>
        <button type="button" className="calendar__add action-nav" data-area="side" data-id="add-event"
          aria-label={'Add event on ' + dateLabel(day)}
          onClick={() => { if (typeof handleInsert === 'function') handleInsert(day); }}>+</button>
      </header>
      <div data-area="main">
        <div className="calendar__events">
      {items.length ? items.map((event, index) => (
        <p className={['event', eventClass(event_class)].filter(Boolean).join(' ')} key={event.id + '-' + index}>
          {eventTimeLabel(event) && <span>{eventTimeLabel(event)} </span>}{event.name}
          {event.location && <span className="calendar__location">{event.location}</span>}
        </p>
      )) : null}
        </div>
      </div>
    </article>
  );
};
