"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/locale";
import { setLocale } from "@/app/actions";

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const locale = useLocale() as Locale;
  const t = useTranslations("nav");

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(next: Locale) {
    setOpen(false);
    startTransition(async () => {
      await setLocale(next);
      // A full reload rather than router.refresh(): client components
      // elsewhere on the page (e.g. a post's cached Translate result)
      // hold their own local state that isn't derived from next-intl's
      // context, so a soft refresh leaves it stale - switching locale
      // twice in a row without a full reload in between could otherwise
      // still show content translated into the previous language. A
      // reload resets everything at once instead of chasing down every
      // component that holds locale-sensitive local state.
      window.location.reload();
    });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isPending}
        aria-label={t("changeLanguage")}
        className="flex items-center gap-1 text-body transition-colors hover:text-primary disabled:opacity-50"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.5 3.9a6.51 6.51 0 00-3.9 4.35h2.3c.15-1.62.7-3.09 1.6-4.35zM6.9 9.75H4.1a6.53 6.53 0 000 2.5h2.8a13.1 13.1 0 010-2.5zm.9 4H5.5a6.51 6.51 0 003.9 3.85 10.86 10.86 0 01-1.6-3.85zm2.7 3.85a6.51 6.51 0 003.9-3.85h-2.3a10.86 10.86 0 01-1.6 3.85zm2.1-5.35h2.8a6.53 6.53 0 000-2.5h-2.8a13.1 13.1 0 010 2.5zm-.1-4h2.3a6.51 6.51 0 00-3.9-4.35c.9 1.26 1.45 2.73 1.6 4.35zm-2.5-4.6c-.98 1.16-1.63 2.75-1.8 4.6h3.6c-.17-1.85-.82-3.44-1.8-4.6zM8.3 9.75a11.6 11.6 0 000 2.5h3.4a11.6 11.6 0 000-2.5H8.3zm.1 4c.17 1.85.82 3.44 1.8 4.6.98-1.16 1.63-2.75 1.8-4.6H8.4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm">{LOCALE_LABELS[locale]}</span>
      </button>

      {open && (
        // left-0, not right-0: this button sits mid-nav (Search, language,
        // then sign-in/sign-up or the user menu), nowhere near the right
        // edge of the viewport - anchoring the dropdown's right edge to a
        // button positioned that far left pushed its left edge past the
        // screen's left edge entirely on narrow/mobile widths.
        <div className="absolute left-0 top-full mt-2 max-h-80 w-44 overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm shadow-md">
          {SUPPORTED_LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => handleSelect(code)}
              className={`block w-full px-3 py-2 text-left hover:bg-primary-light hover:text-primary ${
                code === locale ? "font-medium text-primary" : "text-body"
              }`}
            >
              {LOCALE_LABELS[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
