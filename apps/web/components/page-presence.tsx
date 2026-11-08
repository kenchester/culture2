"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

/**
 * "Someone else is looking at this right now."
 *
 * Every reference page here (city, corridor, language) has had the exact
 * same problem: the traffic is real - page_views shows 14-28 visits a
 * month on the busiest ones - but every single one of those visits is
 * invisible to every other visitor. A page that is quietly getting
 * looked at reads identically to one nobody has ever opened, and the fear
 * of being the only person who ever cared about this corridor is itself
 * part of what keeps a network at one member.
 *
 * Built on Supabase Realtime presence rather than a database table on
 * purpose. Presence state lives in the Realtime server's memory and
 * disappears the moment a tab closes - there is no row anywhere that
 * says who was on this page or when, which matters for the same reason
 * page_views (00000000000098) stores a path and a day and nothing else:
 * a diaspora platform has no business holding a log of who read which
 * origin's page. The tracked payload below is a timestamp under a random
 * per-tab key, never a user id, never a session - counted, not watched.
 *
 * channelPath should be the exact same string passed to recordPageView's
 * viewPath() on the same page, so presence and the view counter are
 * scoped identically - the same corridor, counted the same way, by two
 * different mechanisms measuring two different things (who came this
 * month vs who is here this second).
 */
export function PagePresence({ channelPath }: { channelPath: string }) {
  const t = useTranslations("presence");
  // null while still connecting, so nothing renders (and nothing flashes
  // "0 others" for the half-second before the first sync) until a real
  // count is known.
  const [otherCount, setOtherCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    // A fresh random key per mount, matching page_views' own refusal to
    // identify anyone - this key identifies a BROWSER TAB for the
    // duration it has this page open, nothing more, and is never
    // written anywhere durable.
    const selfKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const channel = supabase.channel(`presence:${channelPath}`, {
      config: { presence: { key: selfKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        // Room size minus self. Supabase's own presence_ref de-dupes a
        // single tab that re-renders, so this is never inflated by
        // React re-subscribing - only by actual other tabs.
        setOtherCount(Math.max(0, Object.keys(state).length - 1));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelPath]);

  if (!otherCount) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-success"
        aria-hidden="true"
      />
      {t("label")} <span className="tabular-nums text-ink">{otherCount}</span>
    </p>
  );
}
