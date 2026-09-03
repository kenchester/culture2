import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo_Black, Geist, Geist_Mono, Newsreader, Space_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Nav } from "@/app/nav";
import { Footer } from "@/app/footer";
import { RTL_LOCALES, type Locale } from "@/lib/locale";
import { isLearnHost } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Only ever selected by globals.css's html[data-theme="zine"] block
// (learn.culturemesh.com's "Campus Zine" redesign) - preload: false so
// these bytes are never fetched on an ordinary culturemesh.com pageview.
// next/font still emits the @font-face rule globally, but a browser only
// fetches a font when something on the page actually renders in it, and
// on the plain host nothing does (font-sans/font-display still resolve to
// Geist/Newsreader there).
const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "CultureMesh",
  description: "Find your diaspora network.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const onLearnHost = await isLearnHost();
  const t = await getTranslations("nav");

  return (
    <html
      lang={locale}
      dir={RTL_LOCALES.has(locale as Locale) ? "rtl" : "ltr"}
      data-theme={onLearnHost ? "zine" : undefined}
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* First focusable element on every page (WCAG 2.4.1 Bypass
              Blocks). sr-only until focused, so it's invisible to anyone
              navigating with a mouse and only paints when a keyboard user
              Tabs into the page. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
          >
            {t("skipToContent")}
          </a>
          <Suspense fallback={null}>
            <Nav isLearnHost={onLearnHost} />
          </Suspense>
          {/* The <main> landmark for every page in the app - added here
              rather than in each of the ~38 page files both to avoid that
              churn and so no future page can forget it. "flex flex-1
              flex-col" makes this a transparent pass-through: every page
              root is itself a `flex-1` element that was previously a
              direct flex child of <body>, so it keeps growing exactly as
              before. tabIndex={-1} lets the skip link move focus here
              without adding it to the tab order. */}
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
            {children}
          </main>
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
