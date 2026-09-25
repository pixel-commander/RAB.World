import { SelectList } from '../SelectList/SelectList.tsx';
import { callHandler } from '../js/fieldValues.ts';
import type { RadioGroupProps } from './RadioGroup.types.ts';
import './css/radio-group.css';
export const RadioGroup = ({ handleChange, handleSelect, ...props }: RadioGroupProps = {}) => <SelectList {...props} selection_type="radio" can_multi={false}
 handleChange={(data, type) => { callHandler(handleChange, Array.isArray(data) ? data[0] : data, type); }}
 handleSelect={(data, type) => { callHandler(handleSelect, Array.isArray(data) ? data[0] : data, type); }} />;
