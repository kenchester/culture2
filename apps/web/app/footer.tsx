"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations("footer");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Embed pages, and any page reached while staying inside a partner's
  // iframe (?embed=1), must render with no CultureMesh chrome - they're
  // meant to be indistinguishable from the partner's own site.
  if (
    pathname?.startsWith("/embed/") ||
    pathname?.startsWith("/embed-partners/demo/") ||
    pathname?.startsWith("/embed-partners/travel-demo/") ||
    pathname?.startsWith("/embed-partners/remittance-demo/") ||
    searchParams.get("embed") === "1"
  ) {
    return null;
  }

  return (
    <footer className="border-t border-border bg-surface px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 text-sm text-muted sm:flex-row">
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <div className="flex items-center gap-5">
          <Link href="/about" className="hover:text-primary">
            {t("about")}
          </Link>
          <Link href="/privacy" className="hover:text-primary">
            {t("privacy")}
          </Link>
          <Link href="/terms" className="hover:text-primary">
            {t("terms")}
          </Link>
          <Link href="/contact" className="hover:text-primary">
            {t("contact")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
