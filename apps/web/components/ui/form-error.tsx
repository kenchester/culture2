import type { ReactNode } from "react";

// Every error/success message in this app was previously a bare <p> that
// appeared silently - visible to anyone watching the screen, completely
// unannounced to a screen reader, so a blind user submitting a form got
// no feedback at all about why nothing happened.
//
// role="alert" (which implies aria-live="assertive") makes the message
// announced the moment it renders. Pair the `id` with aria-describedby +
// aria-invalid on the input it describes, so the error is also reachable
// when tabbing back to the field rather than only at the moment it
// appears.
//
// Purely additive: the rendered markup and classes are identical to the
// <p> elements these replace, so nothing changes visually for anyone.
export function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">
      {children}
    </p>
  );
}

// The inline (unboxed) variant, for errors rendered tight under a control
// rather than as a banner.
export function InlineError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm text-error">
      {children}
    </p>
  );
}

// role="status" (implying aria-live="polite") rather than "alert":
// success confirmations shouldn't interrupt whatever a screen reader is
// mid-sentence on, unlike an error that blocks the user from continuing.
export function FormSuccess({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
      {children}
    </p>
  );
}
