import { WeeklyCalendar } from '../WeeklyCalendar.tsx';
export const Demo = () => <WeeklyCalendar date={new Date(2026, 8, 10).getTime()} events={[{id:'demo',date:new Date(2026, 8, 10, 9).getTime(),name:'Planning',title:'Planning session',location:'Studio'}]}/>;
export default Demo;
