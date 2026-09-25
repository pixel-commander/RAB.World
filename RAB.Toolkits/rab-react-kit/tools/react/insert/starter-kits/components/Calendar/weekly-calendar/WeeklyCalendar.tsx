import { Fragment } from 'react';
import type { CalendarProps } from '../Calendar.types.ts';
import { CalendarDay } from '../CalendarDay.tsx';
import { useCalendar } from '../hooks/useCalendar.ts';
import { FormAddEvent as DefaultFormAddEvent } from '../form-add-event/FormAddEvent.tsx';
import { monthDays, weekdays } from '../js/calendar.ts';
import '../css/calendar.css';
import './css/weekly-calendar.css';

export const WeeklyCalendar = (props: CalendarProps = {}) => {
  const { root, FormAddEvent = DefaultFormAddEvent, ...bag } = useCalendar(props);
  const days = monthDays(bag.date);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => index);
  return (
    <section ref={root} className="weekly-calendar" data-cols={weeks.length + 1}>
      <span>Day</span>
      {weeks.map(week => <strong key={week}>Week {week + 1}</strong>)}
      {weekdays.map((day, index) => (
        <Fragment key={day}>
          <strong>{day}</strong>
          {weeks.map(week => <CalendarDay key={week} {...bag} date={days[week * 7 + index]} />)}
        </Fragment>
      ))}
      <FormAddEvent {...bag} handleSubmit={bag.handleSubmit} handleCancel={bag.handleCancel} />
    </section>
  );
};
