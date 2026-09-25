import { Calendar } from '../Calendar.tsx';
export const Demo = () => <Calendar events={[{id:'demo',date:new Date(2026, 8, 10, 9).getTime(),name:'Planning',title:'Planning session',location:'Studio'}]}/>;
export default Demo;
