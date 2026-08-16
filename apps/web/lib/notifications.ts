import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type NotificationPrefColumn =
  | "network_activity"
  | "replies_to_your_posts"
  | "likes_on_your_posts"
  | "product_updates";

// Every notification trigger (a reply, a like, a new post, a product
// update) needs to turn "these user ids" into "these opted-in emails" -
// filtering by a column on notification_prefs, then resolving emails from
// auth.users. Both steps need the service-role client: prefs RLS only
// lets a user read their own row, and email lives only in auth.users.
export async function getOptedInRecipients(
  candidateUserIds: string[],
  prefColumn: NotificationPrefColumn,
): Promise<{ userId: string; email: string }[]> {
  if (candidateUserIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();

  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("user_id")
    .in("user_id", candidateUserIds)
    .eq(prefColumn, true);

  const optedInIds = (prefs ?? []).map((p) => p.user_id as string);
  if (optedInIds.length === 0) {
    return [];
  }

  // Single-recipient case (replies, likes) - one direct lookup, cheaper
  // than paginating through every user to find one.
  if (optedInIds.length === 1) {
    const { data } = await admin.auth.admin.getUserById(optedInIds[0]);
    return data.user?.email ? [{ userId: optedInIds[0], email: data.user.email }] : [];
  }

  // Multi-recipient case (network activity, product updates) - the Admin
  // API has no "get many users by id", so paginate listUsers and filter
  // down to the opted-in set.
  const wanted = new Set(optedInIds);
  const results: { userId: string; email: string }[] = [];
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data || data.users.length === 0) break;
    for (const u of data.users) {
      if (wanted.has(u.id) && u.email) {
        results.push({ userId: u.id, email: u.email });
      }
    }
    if (results.length >= wanted.size || data.users.length < perPage) break;
    page += 1;
  }
  return results;
}
