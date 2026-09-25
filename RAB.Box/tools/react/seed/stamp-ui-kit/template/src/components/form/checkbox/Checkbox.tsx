import './checkbox.css';

interface CheckboxProps {
  name: string;
  label: string;
  defaultChecked?: boolean;
}

export const Checkbox = ({ name, label, defaultChecked }: CheckboxProps) => (
  <label className="checkbox action-nav">
    <input type="checkbox" className="checkbox__control" name={name} defaultChecked={defaultChecked} />
    <span className="checkbox__label">{label}</span>
  </label>
);
