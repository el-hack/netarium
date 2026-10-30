import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
};

/** Native button semantics, including an explicit submit opt-in for forms. */
export function Button({
  variant = 'secondary',
  busy = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`button ${variant} ${className}`}
    >
      {busy && <LoaderCircle size={16} className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = '',
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={`icon-button ${className}`}
    />
  );
}
