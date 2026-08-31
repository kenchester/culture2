import type { Metadata } from "next";
import { Suspense } from "react";
import { Archivo_Black, Geist, Geist_Mono, Newsreader, Space_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

  return (
    <html
      lang={locale}
      dir={RTL_LOCALES.has(locale as Locale) ? "rtl" : "ltr"}
      data-theme={onLearnHost ? "zine" : undefined}
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense fallback={null}>
            <Nav isLearnHost={onLearnHost} />
          </Suspense>
          {children}
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
