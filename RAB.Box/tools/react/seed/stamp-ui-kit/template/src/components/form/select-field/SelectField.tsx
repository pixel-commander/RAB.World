import './select-field.css';

interface SelectFieldProps {
  name: string;
  label: string;
  options?: string[];
  defaultValue?: string;
}

export const SelectField = ({ name, label, options = [], defaultValue }: SelectFieldProps) => (
  <label className="select-field">
    <span className="select-field__label">{label}</span>
    <select className="select-field__control container-inset" name={name} defaultValue={defaultValue}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </label>
);
