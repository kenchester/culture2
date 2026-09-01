"use client";

import { useEffect, useState } from "react";

// Formats a timestamp in the *viewer's* own locale and timezone -
// MM/DD/YYYY with a 12-hour clock for a US visitor, DD/MM/YYYY for most of
// Europe, and so on - rather than the server's. A server component has no
// reliable way to know a visitor's timezone (only their country, from the
// locale-detection cookie logic already in proxy.ts, which isn't precise
// enough for a real clock time); Intl.DateTimeFormat's own default locale/
// timeZone already resolves to whatever the browser/OS is set to, with no
// IP lookup needed. Rendered only after mount, not during SSR - the
// server can't know this in advance, and guessing would flash a
// mismatched value before hydration corrected it.
export function LocalDateTime({ iso }: { iso: string }) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    // Deliberately not computed during render: Intl.DateTimeFormat's
    // locale/timeZone defaults differ between the server (Node's own ICU
    // data) and the browser, so formatting during the initial render would
    // hydrate-mismatch. This has to run only after mount, once "the
    // browser's own settings" actually means the visitor's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormatted(
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso)),
    );
  }, [iso]);

  // A non-empty placeholder (rather than null) keeps layout stable instead
  // of the line popping in a moment after everything else.
  return <>{formatted ?? " "}</>;
}
