"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * Copies a permalink to the clipboard and says so, in the reader's language.
 *
 * The absolute URL is built from window.location.origin rather than a
 * configured site URL, so a link copied on learn.culturemesh.com stays on
 * learn., and anything copied on a future subdomain (ai.) comes out on that
 * host too. Copying a learn. link and handing someone a www. one would send
 * them to a page that redirects, or that they can't read at all.
 */
export function CopyLinkButton({ path, kind }: { path: string; kind: "post" | "reply" }) {
  const t = useTranslations("editableEntry");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, navigating away mid-countdown leaves a timer holding a
  // setState on an unmounted component.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    const url = new URL(path, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // navigator.clipboard is undefined outside a secure context and is
      // still refused by some mobile browsers even inside one. The
      // textarea/execCommand route is deprecated but remains the only
      // thing that works there, and iOS additionally needs the explicit
      // selection range - select() alone does nothing on it.
      const scratch = document.createElement("textarea");
      scratch.value = url;
      scratch.setAttribute("readonly", "");
      scratch.style.position = "fixed";
      scratch.style.top = "0";
      scratch.style.opacity = "0";
      document.body.appendChild(scratch);
      scratch.select();
      scratch.setSelectionRange(0, url.length);
      try {
        document.execCommand("copy");
      } catch {
        // Nothing left to try; the confirmation below would be a lie, so
        // bail out without showing it.
        document.body.removeChild(scratch);
        return;
      }
      document.body.removeChild(scratch);
    }

    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t(`copyLink.${kind}`)}
        className="hover:text-primary"
      >
        <LinkIcon />
      </button>
      {/* Always mounted, so a screen reader announces the change rather
          than an element appearing from nowhere. */}
      <span aria-live="polite" className="text-xs text-primary">
        {copied ? t("linkCopied") : ""}
      </span>
    </span>
  );
}
