"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/lib/copy-to-clipboard";

/**
 * Copies a literal string rather than a path relative to the current
 * origin, which is what CopyLinkButton and ShareLink both do. A referral
 * link is read off this screen and handed to someone else, so the URL is
 * built server-side and copied exactly as shown.
 */
export function CopyTextButton({ text }: { text: string }) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    if (!(await copyToClipboard(text))) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-ink hover:border-primary hover:text-primary"
      >
        {t("copy")}
      </button>
      <span aria-live="polite" className="text-xs text-primary">
        {copied ? t("copied") : ""}
      </span>
    </span>
  );
}
