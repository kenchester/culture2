import "server-only";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Link previews, which is what "shareable" actually means.
 *
 * This site had no Open Graph metadata at all, so a link pasted into
 * WhatsApp - the way a diaspora community actually passes something
 * around - rendered as a bare URL with no title and no description. In a
 * group chat that reads as spam. The page being well built is invisible
 * at that moment; only these tags are.
 *
 * Every page that is worth forwarding builds its tags through here so the
 * shape stays consistent and a new page can't quietly ship without them.
 */

const SITE_NAME = "CultureMesh";

// Next.js attaches app/opengraph-image.tsx to a route's metadata
// automatically - but only while that route leaves openGraph alone. Every
// page built here sets openGraph, which replaces the parent object
// wholesale and drops the image with it, so the reference has to be
// explicit. Resolved against metadataBase into the absolute URL a chat
// client needs.
const OG_IMAGE = "/opengraph-image";

// og:locale wants a POSIX-style tag, not a bare language code.
const OG_LOCALE: Record<string, string> = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  it: "it_IT",
  pt: "pt_BR",
  ru: "ru_RU",
  ar: "ar_AR",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
};

export async function shareMetadata({
  title,
  description,
  path,
  noIndex = false,
  image,
}: {
  title: string;
  description: string;
  path: string;
  /** For gated or personal pages: shareable by link, but not crawled. */
  noIndex?: boolean;
  /**
   * Overrides the generic brand card with a per-page dynamic image, e.g.
   * a network's own opengraph-image.tsx route. Defaults to OG_IMAGE, same
   * as every page that doesn't pass this - so existing callers are
   * unaffected. The text itself stays off the generic card for a reason
   * (see app/opengraph-image.tsx: network/place names routinely contain
   * CJK, Arabic or Cyrillic, and next/og renders glyphs the supplied font
   * doesn't cover as empty boxes) - a page that opts into a custom image
   * has to keep that same discipline itself rather than relying on this
   * function to enforce it.
   */
  image?: string;
}): Promise<Metadata> {
  const [siteUrl, locale] = await Promise.all([getSiteUrl(), getLocale()]);
  const url = new URL(path, siteUrl).toString();
  const ogImage = image ?? OG_IMAGE;

  return {
    // metadataBase comes from the request's own host, so a preview
    // deployment previews itself and a learn. link stays on learn.
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale] ?? "en_US",
      title,
      description,
      url,
      images: [ogImage],
    },
    twitter: {
      // The large card is the difference between a thumbnail and
      // something that looks worth opening.
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Trims text to fit a link preview without cutting a word in half.
 * Descriptions are clipped around 160-200 characters by most clients, so
 * anything longer is invisible and a mid-word cut just looks broken.
 */
export function previewText(text: string, max = 180): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  const cut = collapsed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
