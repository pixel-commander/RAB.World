import type { KeyboardEvent, ComponentType, ReactNode } from 'react';
import type { FormAddEventProps } from './form-add-event/FormAddEvent.types.ts';
import type { DataKeys, EventsKeys, HandlerKey } from '../../HouseKeys.types.ts';

export interface CalendarEvent extends DataKeys {
  id: string | number;
  location?: string;
  source?: string;
  [key: string]: unknown;
}

export interface CalendarProps extends DataKeys, EventsKeys<CalendarEvent> {
  children?: ReactNode;
  selected?: number;
  event_class?: string;
  FormAddEvent?: ComponentType<FormAddEventProps>;
  handleSubmit?: HandlerKey<CalendarEvent, string>;
  handleSave?: HandlerKey<CalendarEvent, string>;
  handleCancel?: HandlerKey;
  handleInsert?: HandlerKey<number>;
  handleSelect?: HandlerKey<number, CalendarSelectType>;
}

export type CalendarSelectType = 'day' | 'date';

export type CalendarKeyData = Partial<KeyboardEvent<HTMLButtonElement>>;
export type CalendarKeyAction = 'left' | 'right' | 'first' | 'last';
export type CalendarKeyDown = HandlerKey<CalendarKeyData, CalendarKeyAction, void>;
