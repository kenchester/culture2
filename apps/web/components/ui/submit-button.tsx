"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

// A submit button that reports the surrounding <form>'s pending state.
//
// Server actions that do real work (several database round trips, an email
// send, a transcription) can sit for seconds with no feedback at all, and a
// plain <Button type="submit"> gives the user nothing to distinguish "still
// working" from "my click didn't register" - which invites a second click
// and, for a non-idempotent action, a duplicate.
//
// Disabling while pending is the substantive half of this; the label change
// is what makes the wait legible. useFormStatus must be read from a
// component *inside* the form, which is exactly why this is its own
// component rather than a prop on Button.
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
