"use server";

import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/locale";

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
