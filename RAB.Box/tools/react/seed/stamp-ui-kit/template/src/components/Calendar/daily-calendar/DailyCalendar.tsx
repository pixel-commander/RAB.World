import { Fragment } from 'react';
import type { CalendarProps } from '../Calendar.types.ts';
import { normalizeDate, dateLabel, eventTimeLabel, eventClass } from '../js/calendar.ts';
import { dailyHours } from './js/hours.ts';
import { useCalendar } from '../hooks/useCalendar.ts';
import { FormAddEvent as DefaultFormAddEvent } from '../form-add-event/FormAddEvent.tsx';
import '../css/calendar.css';
import './css/daily-calendar.css';

export const DailyCalendar = (props: CalendarProps = {}) => {
  const { root, FormAddEvent = DefaultFormAddEvent, ...bag } = useCalendar(props);
  return <section ref={root} className="daily-calendar scroll">
    <h3>{dateLabel(normalizeDate(bag.date))}</h3>
    <div data-grid="daily-schedule" aria-label="Hourly schedule">
      {dailyHours(bag.date, bag.events).map(({ key, label, events }) => (
        <Fragment key={key}>
          <div data-area={'time-' + key}>
            <time className="daily-calendar__hour">{label}</time>
          </div>
          <div data-area={'slot-' + key} className="container-inset">
            <div className="calendar__events">
              {events.map((event, index) => (
                <p className={['event', eventClass(bag.event_class)].filter(Boolean).join(' ')} key={event.id + '-' + index}>
                  {eventTimeLabel(event) && <span>{eventTimeLabel(event)} </span>}{event.name}
                  {event.location && <span className="calendar__location">{event.location}</span>}
                </p>
              ))}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
    <FormAddEvent {...bag} handleSubmit={bag.handleSubmit} handleCancel={bag.handleCancel} />
  </section>
};
