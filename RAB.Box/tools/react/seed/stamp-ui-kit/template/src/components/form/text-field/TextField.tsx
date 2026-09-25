import './text-field.css';

interface TextFieldProps {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  area?: boolean;
}

export const TextField = ({
  name,
  label,
  type = 'text',
  placeholder,
  defaultValue,
  required,
  area = false,
}: TextFieldProps) => (
  <label className="text-field">
    <span className="text-field__label">{label}</span>
    {area ? (
      <textarea
        className="text-field__control text-field__control--area container-inset"
        name={name}
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
      />
    ) : (
      <input
        className="text-field__control container-inset"
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
      />
    )}
  </label>
);
