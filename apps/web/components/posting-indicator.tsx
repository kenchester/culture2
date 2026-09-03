"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

// A media post is slow in a way a text post isn't: the recording uploads
// to storage, then the server action transcribes it before redirecting.
// Measured ~10s end to end for a 10-second video. Until now that window
// showed nothing at all - RecordMedia clears its own staging area the
// instant it submits, so the composer just emptied and the feed sat
// unchanged, which reads as "did that work?".
//
// useFormStatus reports the surrounding <form>'s pending state, so this
// needs no plumbing from the action itself and covers every submit path
// into it (RecordMedia's requestSubmit and the plain text Post button
// alike). Rendered as a skeleton row in the position the new post will
// occupy, so the wait is anchored to where the result appears.
//
// role="status" + aria-live announces it to a screen reader, which
// otherwise gets even less feedback than a sighted user during the wait.
export function PostingIndicator() {
  const { pending, data } = useFormStatus();
  const t = useTranslations("editableEntry");

  if (!pending) {
    return null;
  }

  // useFormStatus hands back the FormData actually being submitted, which
  // is how this tells a recording from a text post without any plumbing
  // from PostComposer (a sibling, not a parent - it couldn't pass a prop
  // here even if we wanted it to). Only a media submit sets mediaPath.
  // Without this the wording was simply wrong for text posts, promising a
  // transcript for something that has no recording.
  const isMedia = Boolean(data?.get("mediaPath"));

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex gap-3 border-b border-border pb-4"
    >
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-border" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-3 w-28 animate-pulse rounded bg-border" />
        {/* The tall block stands in for the player that's about to appear;
            a text post gets a couple of line-height bars instead. */}
        {isMedia ? (
          <div className="h-16 w-full animate-pulse rounded-md bg-border" />
        ) : (
          <div className="h-3 w-3/4 animate-pulse rounded bg-border" />
        )}
        <p className="text-xs text-muted">{isMedia ? t("processingRecording") : t("posting")}</p>
      </div>
    </div>
  );
}
