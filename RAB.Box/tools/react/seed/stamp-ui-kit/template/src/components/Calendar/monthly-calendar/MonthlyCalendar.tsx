import type { CalendarProps } from '../Calendar.types.ts';
import { CalendarDay } from '../CalendarDay.tsx';
import { useCalendar } from '../hooks/useCalendar.ts';
import { FormAddEvent as DefaultFormAddEvent } from '../form-add-event/FormAddEvent.tsx';
import { monthDays, weekdays } from '../js/calendar.ts';
import '../css/calendar.css';
import './css/monthly-calendar.css';
export const MonthlyCalendar = (props: CalendarProps = {}) => {
  const { root, FormAddEvent = DefaultFormAddEvent, ...bag } = useCalendar(props);
  return (
    <section ref={root} className="monthly-calendar" data-cols="7">
      {weekdays.map(day => <strong key={day}>{day.slice(0, 3)}</strong>)}
      {monthDays(bag.date).map(date => <CalendarDay key={date} {...bag} date={date} />)}
      <FormAddEvent {...bag} handleSubmit={bag.handleSubmit} handleCancel={bag.handleCancel} />
    </section>
  );
};
