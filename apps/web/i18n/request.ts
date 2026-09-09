import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import {
  CHOSEN_LOCALE_COOKIE,
  DEFAULT_LOCALE,
  DETECTED_LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();

  // Precedence, and the two values are deliberately kept distinct:
  //   1. what this person chose in the switcher (persisted, wins always)
  //   2. what we detected for this request (never persisted - the proxy
  //      re-derives it per request and puts it on the inbound request only)
  //   3. the default
  const chosen = cookieStore.get(CHOSEN_LOCALE_COOKIE)?.value;
  const detected = cookieStore.get(DETECTED_LOCALE_COOKIE)?.value;

  const locale: Locale = isLocale(chosen)
    ? chosen
    : isLocale(detected)
      ? detected
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
