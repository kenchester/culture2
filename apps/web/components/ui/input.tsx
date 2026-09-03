import {
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

// focus:outline-none was deliberately dropped here: it suppressed the
// global :focus-visible outline in app/globals.css, leaving only a 1px
// ring as the keyboard indicator. The border+ring on :focus is kept
// exactly as it was, so clicking into a field with a mouse looks
// identical to before - keyboard focus now just additionally gets the
// same outline every other control has.
export const fieldClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} ${className}`} {...props} />;
}

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-ink ${className}`} {...props} />;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>;
}
