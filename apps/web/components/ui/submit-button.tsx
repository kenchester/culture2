"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

// A submit button that reports the surrounding <form>'s pending state.
//
// Server actions that do real work can sit for seconds with no feedback at
// all - "Send invites" waits on Resend to accept the batch before it
// returns, because a failed send has to surface as a real error rather
// than a false "Invites sent." A plain <Button type="submit"> gives the
// user nothing to distinguish "still working" from "my click didn't
// register", which invites a second click and, for a non-idempotent
// action, a duplicate.
//
// Disabling while pending is the substantive half of this; the label
// change is what makes the wait legible. pendingLabel is optional and
// falls back to a generic translated "Loading…", so this can be dropped in
// anywhere without inventing per-button copy.
//
// useFormStatus must be read from a component *inside* the form, which is
// why this is its own component rather than a prop on Button.
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("common");

  return (
    // props spread FIRST: a caller passing disabled={false} (e.g. a
    // composer enabling its Post button once text is typed) would
    // otherwise overwrite the pending state and leave the button live
    // during submission, which is the double-submit this exists to stop.
    <Button {...props} type="submit" disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? (pendingLabel ?? t("loading")) : children}
    </Button>
  );
}
