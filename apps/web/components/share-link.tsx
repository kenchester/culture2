"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/lib/copy-to-clipboard";

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

/**
 * Hands a link to whatever the visitor actually shares with.
 *
 * On a phone navigator.share opens the OS share sheet, which is where
 * WhatsApp, SMS and Telegram already are - the channels a diaspora
 * community passes something around on. Deliberately not a wa.me link:
 * that bets the whole feature on one app, and gets it wrong for everyone
 * whose community organises somewhere else.
 *
 * Desktop has no share sheet, so it falls back to copying, which is the
 * same thing the post permalinks already do.
 *
 * The URL is built from window.location.origin rather than a configured
 * site URL, so a link shared from learn.culturemesh.com stays on learn.
 */
export function ShareLink({
  path,
  title,
  className = "",
}: {
  path: string;
  /** Prefilled subject when the share sheet offers one. */
  title: string;
  className?: string;
}) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function confirmCopied() {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    const url = new URL(path, window.location.origin).toString();

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        // No confirmation: the sheet is its own feedback, and the visitor
        // may well have dismissed it.
        return;
      } catch {
        // Dismissing the sheet rejects, and so does a browser that
        // advertises share but refuses this payload. Falling through to
        // copy is right in the second case and harmless in the first.
      }
    }

    if (await copyToClipboard(url)) confirmCopied();
  }

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:border-primary hover:text-primary"
      >
        <ShareIcon />
        {t("share")}
      </button>
      {/* Always mounted, so a screen reader announces the change rather
          than an element appearing from nowhere. */}
      <span aria-live="polite" className="text-xs text-primary">
        {copied ? t("copied") : ""}
      </span>
    </span>
  );
}
