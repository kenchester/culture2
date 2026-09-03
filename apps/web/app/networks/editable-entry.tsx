"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { deletePost, reportContent, toggleLike, translateEntry, updatePost } from "@/app/networks/actions";
import { deleteReply, updateReply } from "@/app/networks/[id]/posts/[postId]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { LocalDateTime } from "@/components/local-datetime";
import { TranscriptDisclosure } from "@/components/transcript-disclosure";
import { Linkify } from "@/lib/linkify";
import type { Locale } from "@/lib/locale";
import { InlineError } from "@/components/ui/form-error";

// A minimal outline icon (fill toggles solid when liked) rather than an
// emoji - this site is used by embassies and other professional
// organizations, so the like control should read closer to YouTube's
// understated thumbs-up than a colorful 👍.
export function ThumbsUpIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14Z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11Z" />
    </svg>
  );
}

// Shared by both posts and replies (the two "kind"s of editable message in
// a network), since the edit/delete UI is identical - only which server
// action to call differs. redirectAfterDelete is for the one case where
// deleting the item means the page it's on no longer exists (a post's own
// detail page): navigate away instead of refreshing the now-404 page.
export function EditableEntry({
  kind,
  itemId,
  body,
  media,
  createdAt,
  canModify,
  likeCount,
  liked,
  redirectAfterDelete,
  transcript,
  transcriptLanguage,
  hasCaptions,
  summary,
}: {
  kind: "post" | "reply";
  itemId: number;
  body: string;
  media?: { type: "audio" | "video"; url: string } | null;
  createdAt: string;
  canModify: boolean;
  likeCount: number;
  liked: boolean;
  redirectAfterDelete?: string;
  transcript?: string | null;
  transcriptLanguage?: string | null;
  /** Whether transcript_segments exist, i.e. whether the captions route will 200. */
  hasCaptions?: boolean;
  /** Signed-language posts only: an author-written summary and its language. */
  summary?: { text: string; language: string | null } | null;
}) {
  const t = useTranslations("editableEntry");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [draft, setDraft] = useState(body);
  const [isPending, setIsPending] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [reported, setReported] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  async function handleReport() {
    setIsReporting(true);
    const result = await reportContent(kind, itemId);
    setIsReporting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setReported(true);
  }

  async function handleTranslate() {
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

  async function handleToggleLike() {
    setIsLiking(true);
    const result = await toggleLike(kind, itemId);
    setIsLiking(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleSave() {
    setIsPending(true);
    setError(null);
    const result = kind === "post" ? await updatePost(itemId, draft) : await updateReply(itemId, draft);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setMode("view");
    router.refresh();
  }

  async function handleDelete() {
    setIsPending(true);
    setError(null);
    const result = kind === "post" ? await deletePost(itemId) : await deleteReply(itemId);
    setIsPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (redirectAfterDelete) {
      router.push(redirectAfterDelete);
    } else {
      router.refresh();
    }
  }

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        {error && <InlineError>{error}</InlineError>}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !draft.trim()}
            className="self-start px-3 py-1.5 text-xs"
          >
            {isPending ? t("saving") : t("save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(body);
              setMode("view");
              setError(null);
            }}
            disabled={isPending}
            className="self-start px-3 py-1.5 text-xs"
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        {media ? (
          media.type === "video" ? (
            // #t=1 (Media Fragments URI): shows the frame at 1s as the
            // poster instead of frame 0 - camera warm-up means the very
            // first frame is often just black.
            <video
              src={`${media.url}#t=1`}
              controls
              playsInline
              // crossOrigin is required for <track> to load: the media
              // itself comes from a signed Supabase Storage URL (a
              // different origin), and without this the browser refuses to
              // apply a same-origin text track to a cross-origin video.
              crossOrigin="anonymous"
              className="max-h-64 w-full min-w-0 rounded-md"
            >
              {hasCaptions && (
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
          // break-words: post content is free-typed and Linkify can turn a
          // long pasted URL into an anchor - neither wraps at whitespace
          // on its own, so an unbroken run of characters would otherwise
          // push this narrower than the viewport on mobile.
          <p className="min-w-0 break-words text-body">
            <Linkify text={showTranslated && translated ? translated : body} />
          </p>
        )}
        <div className="flex shrink-0 items-center gap-3 text-sm text-muted">
          {!media && (
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
            onClick={handleToggleLike}
            disabled={isLiking}
            aria-label={liked ? t(`unlike.${kind}`) : t(`like.${kind}`)}
            className={`flex items-center gap-1 disabled:opacity-50 ${liked ? "text-primary" : "hover:text-primary"}`}
          >
            <ThumbsUpIcon filled={liked} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          {!reported ? (
            <button
              type="button"
              onClick={handleReport}
              disabled={isReporting}
              className="hover:text-error disabled:opacity-50"
            >
              {isReporting ? t("reporting") : t("report")}
            </button>
          ) : (
            <span>{t("reported")}</span>
          )}
          {canModify && mode === "view" && (
            <div className="flex gap-2">
              {!media && (
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  aria-label={t(`edit.${kind}`)}
                  className="hover:text-primary"
                >
                  ✎
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("confirmDelete")}
                aria-label={t(`delete.${kind}`)}
                className="hover:text-error"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Text alternatives for media, both collapsed by default. A signed
          video has no transcript (nothing to transcribe) and instead may
          carry an author-written summary, which is really a translation
          into whichever written language they chose - hence its own lang. */}
      {media && transcript && (
        <TranscriptDisclosure
          kind={kind}
          itemId={itemId}
          field="transcript"
          transcript={transcript}
          language={transcriptLanguage}
        />
      )}
      {media && summary?.text && (
        <TranscriptDisclosure
          kind={kind}
          itemId={itemId}
          field="summary"
          transcript={summary.text}
          language={summary.language}
          label={{ show: t("summaryLabel"), hide: t("hideTranscript") }}
        />
      )}
      <p className="text-xs text-muted">
        <LocalDateTime iso={createdAt} />
      </p>
      {mode === "confirmDelete" && (
        <div className="flex items-center gap-2 text-sm text-body">
          <span>{t(`deleteConfirm.${kind}`)}</span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="font-medium text-error underline"
          >
            {isPending ? t("deleting") : t("yes")}
          </button>
          <button
            type="button"
            onClick={() => setMode("view")}
            disabled={isPending}
            className="text-muted underline"
          >
            {t("no")}
          </button>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </div>
  );
}
