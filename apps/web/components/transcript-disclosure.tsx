"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translateEntry } from "@/app/networks/actions";
import type { Locale } from "@/lib/locale";

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
  kind,
  itemId,
  field,
  transcript,
  language,
  label,
}: {
  kind: "post" | "reply";
  /** Null for ephemeral demo items, which have nothing server-side to translate. */
  itemId: number | null;
  /** Which column this text came from, so translations cache separately. */
  field: "transcript" | "summary";
  transcript: string;
  /** ISO-639-1 for the source text. */
  language?: string | null;
  /** Overrides the default "Show/Hide transcript" wording (used for summaries). */
  label?: { show: string; hide: string };
}) {
  const t = useTranslations("editableEntry");
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelId = useId();

  // A transcript is by definition in the language being practiced, which
  // is often not one the reader knows - so it needs the same Translate
  // affordance a text post has. Reuses translateEntry with field, whose
  // post_translations cache is keyed on it (00000000000073) so a post's
  // body and its transcript can both be cached for the same locale.
  async function handleTranslate() {
    if (itemId === null) return;
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translated) {
      setShowTranslated(true);
      return;
    }
    setIsTranslating(true);
    setError(null);
    const result = await translateEntry(kind, itemId, locale, field);
    setIsTranslating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setTranslated(result.text);
    setShowTranslated(true);
  }

  const showingTranslation = showTranslated && translated;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className="text-xs text-muted underline hover:text-primary"
        >
          {open ? (label?.hide ?? t("hideTranscript")) : (label?.show ?? t("showTranscript"))}
        </button>
        {open && itemId !== null && (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={isTranslating}
            className="text-xs text-muted underline hover:text-primary disabled:opacity-50"
          >
            {isTranslating ? t("translating") : showingTranslation ? t("showOriginal") : t("translate")}
          </button>
        )}
      </div>
      {open && (
        <p
          id={panelId}
          // lang so a screen reader reads the text with the right
          // pronunciation rules rather than the interface language's -
          // the same class of bug fixed for the language switcher, and it
          // matters more here since a transcript is by definition in the
          // language being practiced. Once translated, the text is in the
          // reader's own locale, so the tag has to follow it.
          lang={showingTranslation ? locale : language || undefined}
          className="whitespace-pre-wrap rounded-md bg-background px-3 py-2 text-sm text-body"
        >
          {showingTranslation ? translated : transcript}
        </p>
      )}
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
