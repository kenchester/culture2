"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translateEntry } from "@/app/networks/actions";
import { ThumbsUpIcon } from "@/app/networks/editable-entry";
import { LocalDateTime } from "@/components/local-datetime";
import { TranscriptDisclosure } from "@/components/transcript-disclosure";
import { Linkify } from "@/lib/linkify";
import type { Locale } from "@/lib/locale";

// The Acme demo's stand-in for EditableEntry - same visual output, but
// every interaction is either a real, already-side-effect-free read
// (Translate, unchanged) or fully local state, never a real write. Used for
// BOTH the network's real seeded posts AND locally-created ephemeral ones,
// so a demo visitor gets one consistent, frictionless set of controls
// regardless of which kind of item they're looking at:
//  - Like/Report: real posts require sign-in via toggleLike/reportContent
//    today, which would surface as a broken-looking "Not signed in." error
//    for an anonymous demo visitor - simulated here as local-only state
//    instead, for every item.
//  - Translate: translateEntry has no auth check at all and only reads
//    real content, so it's left wired to the real action unchanged, for
//    real items only - an ephemeral item is whatever the current visitor
//    just typed, nothing to usefully translate.
//  - Remove: ephemeral items only, drops the item from the parent's local
//    list. Real items are never editable/removable here, matching how
//    EditableEntry already hides those controls for anyone but the author.
export function DemoEntry({
  kind,
  itemId,
  body,
  media,
  createdAt,
  isEphemeral,
  onRemove,
  transcript,
  transcriptLanguage,
  hasCaptions,
  summary,
}: {
  kind: "post" | "reply";
  itemId: number | null;
  body: string;
  media?: { type: "audio" | "video"; url: string } | null;
  createdAt: string;
  isEphemeral: boolean;
  onRemove?: () => void;
  transcript?: string | null;
  transcriptLanguage?: string | null;
  hasCaptions?: boolean;
  summary?: { text: string; language: string | null } | null;
}) {
  const t = useTranslations("editableEntry");
  const tDemo = useTranslations("demoNetwork");
  const locale = useLocale() as Locale;
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [reported, setReported] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const result = await translateEntry(kind, itemId, locale);
    setIsTranslating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setTranslated(result.text);
    setShowTranslated(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        {media ? (
          media.type === "video" ? (
            <video
              src={`${media.url}#t=1`}
              controls
              playsInline
              crossOrigin="anonymous"
              className="max-h-64 w-full min-w-0 rounded-md"
            >
              {hasCaptions && itemId !== null && (
                <track
                  kind="captions"
                  src={`/api/captions/${kind}/${itemId}`}
                  srcLang={transcriptLanguage || "und"}
                  label={t("showTranscript")}
                  default
                />
              )}
            </video>
          ) : (
            <audio src={media.url} controls className="w-full min-w-0" />
          )
        ) : (
          <p className="min-w-0 break-words text-body">
            <Linkify text={showTranslated && translated ? translated : body} />
          </p>
        )}
        <div className="flex shrink-0 items-center gap-3 text-sm text-muted">
          {!media && !isEphemeral && (
            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="hover:text-primary disabled:opacity-50"
            >
              {isTranslating ? t("translating") : showTranslated ? t("showOriginal") : t("translate")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setLiked((prev) => !prev);
              setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
            }}
            aria-label={liked ? t(`unlike.${kind}`) : t(`like.${kind}`)}
            className={`flex items-center gap-1 ${liked ? "text-primary" : "hover:text-primary"}`}
          >
            <ThumbsUpIcon filled={liked} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          {!reported ? (
            <button type="button" onClick={() => setReported(true)} className="hover:text-error">
              {t("report")}
            </button>
          ) : (
            <span>{t("reported")}</span>
          )}
          {isEphemeral && onRemove && (
            <button type="button" onClick={onRemove} className="hover:text-error">
              {tDemo("remove")}
            </button>
          )}
        </div>
      </div>
      {/* Ephemeral demo posts never have a transcript - nothing is
          uploaded or transcribed for them - so this only ever renders for
          the network's real seeded recordings. */}
      {media && transcript && (
        <TranscriptDisclosure transcript={transcript} language={transcriptLanguage} />
      )}
      {media && summary?.text && (
        <TranscriptDisclosure
          transcript={summary.text}
          language={summary.language}
          label={{ show: t("summaryLabel"), hide: t("hideTranscript") }}
        />
      )}
      <p className="flex items-center gap-2 text-xs text-muted">
        <LocalDateTime iso={createdAt} />
        {isEphemeral && (
          <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">
            {tDemo("previewBadge")}
          </span>
        )}
      </p>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
