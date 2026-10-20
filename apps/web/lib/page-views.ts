import "server-only";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Counts a pageview, without ever learning who.
 *
 * The site had no measurement at all, which made every experiment built
 * this month unreadable: "nobody came" and "we cannot tell" were the same
 * observation. This records a path and a day and nothing else - no IP, no
 * cookie, no session, no referrer. A platform organised by where people
 * came from has no business keeping a log of who read which origin's
 * page, and none of that is needed to answer whether corridor pages
 * attract anybody.
 *
 * Runs in after(), so a slow or failing write never delays or breaks the
 * page - the counter is the least important thing on any request.
 */
export function recordPageView(path: string): void {
  after(async () => {
    try {
      // A bare client, not the cookie-backed server one: after() runs
      // once the response is finished, where the request's cookies are no
      // longer readable - and a counter that identifies nobody has no
      // business reading a session in the first place.
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false } },
      );
      const { error } = await supabase.rpc("record_page_view", { p_path: path });
      if (error && process.env.NODE_ENV !== "production") {
        console.warn("[page-views]", error.message);
      }
    } catch (error) {
      // A missing count is never worth an error page, but silence while
      // developing is how this went unnoticed the first time.
      if (process.env.NODE_ENV !== "production") console.warn("[page-views]", error);
    }
  });
}

/**
 * The route shape rather than the specific page.
 *
 * /corridors/fujian-and-new-york-city-841-25760 becomes /corridors/[pair]
 * unless `keepId` is set. Most questions are about which KIND of page
 * works; the per-page detail is only interesting for the reference pages
 * whose whole purpose is to be landed on individually.
 */
export function viewPath(template: string, slug?: string): string {
  return slug ? `${template}:${slug}` : template;
}
