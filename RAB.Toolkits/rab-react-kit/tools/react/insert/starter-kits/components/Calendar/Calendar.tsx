import type { CalendarProps } from './Calendar.types.ts';
import { useCalendar } from './hooks/useCalendar.ts';
import { MonthlyCalendar } from './monthly-calendar/MonthlyCalendar.tsx';
import { WeeklyCalendar } from './weekly-calendar/WeeklyCalendar.tsx';
import { DailyCalendar } from './daily-calendar/DailyCalendar.tsx';
import { FormAddEvent as DefaultFormAddEvent } from './form-add-event/FormAddEvent.tsx';
import './css/calendar.css';

export { MonthlyCalendar, WeeklyCalendar, DailyCalendar };
const views = [
  { name: 'monthly', label: 'Month', View: MonthlyCalendar },
  { name: 'weekly', label: 'Week', View: WeeklyCalendar },
  { name: 'daily', label: 'Day', View: DailyCalendar },
];

export const Calendar = (props: CalendarProps = {}) => {
  const { root, id, handleClick, handleKeyDown, handleMove, handleToday, FormAddEvent = DefaultFormAddEvent, ...bag } = useCalendar(props);
  return (
    <section ref={root} className="calendar" data-grid="header-main" aria-label="Calendar">
      <header data-area="header">
        <div className="inner calendar__header">
          <div className="calendar__toolbar">
            <button type="button" className="action-nav" onClick={() => handleMove(-1)}>‹ Previous</button>
            <h2>{new Date(bag.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            <button type="button" className="action-nav" onClick={handleToday}>Today</button>
            <button type="button" className="action-nav" onClick={() => handleMove(1)}>Next ›</button>
          </div>
          <div className="calendar__tabs" role="tablist" aria-label="Calendar view">
            {views.map(({ name, label }, index) => (
              <button type="button" className="action-nav" key={name} data-id={name}
                id={id + '-' + name + '-tab'} role="tab" aria-selected={index === 0}
                aria-controls={id + '-' + name} tabIndex={index === 0 ? 0 : -1}
                onClick={handleClick} onKeyDown={handleKeyDown}>{label}</button>
            ))}
          </div>
        </div>
      </header>
      <div data-area="main">
        <div className="inner scroll calendar__body">
          {views.map(({ name, View }, index) => (
            <div key={name} id={id + '-' + name} data-id={name} role="tabpanel"
              aria-labelledby={id + '-' + name + '-tab'} hidden={index !== 0} tabIndex={0}>
              <View {...bag} FormAddEvent={FormAddEvent} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
