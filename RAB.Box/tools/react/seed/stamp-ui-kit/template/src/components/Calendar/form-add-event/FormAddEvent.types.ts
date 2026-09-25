import type { CalendarProps } from '../Calendar.types.ts';
import type { StatelessFormProps } from '../../StatelessForm/StatelessForm.types.ts';

export interface FormAddEventProps extends CalendarProps {
  location?: string;
}

export interface FormAddEventBag extends StatelessFormProps {
  panel_hidden: boolean;
}
