"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

// The text alternative for an audio/video post (WCAG 1.2.1 for audio-only,
// 1.2.3 for video). Collapsed by default: conformance requires the
// alternative be *available*, not permanently visible, and a feed of
// expanded 60-second transcripts would bury the posts themselves.
//
// A plain <button aria-expanded> disclosure rather than <details>/<summary>
// - the styling of the native marker varies across browsers and fights the
// Zine theme's borders, and this needs no browser-native behavior that a
// button doesn't already give.
//
// Independent of captions: collapsing this never affects the <track> on the
// video element, which stays reachable from the player's own CC control.
export function TranscriptDisclosure({
  transcript,
  language,
  label,
}: {
  transcript: string;
  /** Whisper's detected language, ISO-639-1. */
  language?: string | null;
  /** Overrides the default "Show/Hide transcript" wording (used for summaries). */
  label?: { show: string; hide: string };
}) {
  const t = useTranslations("editableEntry");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="self-start text-xs text-muted underline hover:text-primary"
      >
        {open ? (label?.hide ?? t("hideTranscript")) : (label?.show ?? t("showTranscript"))}
      </button>
      {open && (
        <p
          id={panelId}
          // lang so a screen reader reads the transcript with the right
          // pronunciation rules rather than the interface language's -
          // the same class of bug fixed for the language switcher, and it
          // matters more here since a transcript is by definition in the
          // language being practiced, not the one the UI is in.
          lang={language || undefined}
          className="whitespace-pre-wrap rounded-md bg-background px-3 py-2 text-sm text-body"
        >
          {transcript}
        </p>
      )}
    </div>
  );
}
