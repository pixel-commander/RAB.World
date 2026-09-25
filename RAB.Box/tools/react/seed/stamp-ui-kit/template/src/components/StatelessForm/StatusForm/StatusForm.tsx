import { useRef } from "react";
import type { StatusFormProps } from "./StatusForm.types.ts";
import "./css/status-form.css";


export const StatusForm = ({
  area,
  container_ref,
  container_class,
  className,
  children,
  Header,
  Footer,
  error,
  is_saving,
  is_saved,
  has_error,
  is_visible,
  SavingMessage,
  SavedMessage,
  ErrorMessage,
}: StatusFormProps) => {
  const ownRef = useRef<HTMLDivElement>(null);
  const formRef = container_ref ?? ownRef;

  if (is_visible === false) return null;

  const shown = has_error || is_saved || is_saving;
  const one_class = ("status-form " + (container_class || "")
    + (shown ? " is-sent" : "")
    + (is_saving ? " is-saving" : "")
    + (is_saved ? " is-saved" : "")
    + (has_error ? " has-error" : "")
    + " " + (className || "")).trim();

  return (
    <div ref={formRef} className={one_class} data-grid="shell" data-area={area ?? undefined} aria-busy={!!is_saving}>
      <header data-area="header"><div className="status-form__header">{Header}</div></header>
      <div data-area="main">
        <div className="status-form__main">
          <div className="status-form-cell" hidden={!!shown}>{children}</div>
          <div className="status-cell" role="status" aria-live="polite" aria-atomic="true">
            {has_error ? (ErrorMessage ?? error) : is_saving ? SavingMessage : is_saved ? SavedMessage : null}
          </div>
        </div>
      </div>
      <footer data-area="footer"><div className="status-form__footer">{Footer}</div></footer>
    </div>
  );
};

export default StatusForm;
