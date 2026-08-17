import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { isLocale, type Locale } from "@/lib/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = isLocale(raw) ? raw : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
