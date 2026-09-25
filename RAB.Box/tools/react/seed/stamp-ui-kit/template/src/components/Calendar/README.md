# Calendar

Four named exports from Calendar.tsx: Calendar, MonthlyCalendar, WeeklyCalendar, DailyCalendar.

All accept the same bag: date (epoch milliseconds), events, handleSelect(date?, type?). Views are pure renderers; the wrapper owns navigation and mounted tab panels. Omit date for internal date selection; supply date with handleSelect for controlled navigation. Events extend DataKeys with id, numeric date, title, optional location. handleSelect receives epoch milliseconds. Text formatting happens only at display/URL boundaries. Legacy stored YYYY-MM-DD dates are converted at the page file boundary, without rewriting source files on read. No component fetches or saves data.

Weeks begin Monday. WeeklyCalendar transposes the month into weekday rows and 4–6 week columns. Adjacent-month dates fill partial weeks. Selecting a date in the wrapper opens Day. Previous/Next moves one month in Month/Week and one day in Day. Arrow keys, Home, and End navigate tabs.

The existing page owns URL navigation, stores, and pending imports. CSS is structure only; row and container atoms supply skin.

Sizing belongs to the caller. Calendar assumes its available dimensions are resolved before it is rendered; it imposes no minimum/maximum dimensions or automatic compact layouts. Day cells clip overflow.

All four exports accept CalendarProps: DataKeys + EventsKeys<CalendarEvent> + handleSelect. CalendarEvent extends DataKeys locally with required id and optional location/source. The same events key passes through the wrapper and each view; absent events render an empty calendar.

Event date is epoch milliseconds including time. date_start overrides date as the start of a range; date_end is exclusive. Receivers require a valid date or date_start and reject reversed ranges. Display labels and hourly slots derive from these numbers; there is no separate time field.

Compact event cells display name. title and description remain optional inherited DataKeys fields for larger displays.

FormAddEvent is an optional component override. Calendar defaults to its nested FormAddEvent. handleSubmit and handleCancel are independently replaceable: supplied handlers pass through unchanged. Default submit adds an event in memory and closes the dialog; default cancel closes it. Persistence belongs to the caller. The form receives the packed calendar bag, including events and numeric dates.
