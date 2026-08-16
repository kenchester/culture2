import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateNotificationPrefs } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select(
      "events_upcoming, network_activity, product_updates, replies_to_your_posts, likes_on_your_posts",
    )
    .eq("user_id", user.id)
    .single();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-center font-display text-2xl text-ink">Notification settings</h1>
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        {saved && (
          <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">Saved.</p>
        )}
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form action={updateNotificationPrefs} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="events_upcoming"
              defaultChecked={prefs?.events_upcoming ?? true}
            />
            Events
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="network_activity"
              defaultChecked={prefs?.network_activity ?? true}
            />
            Network activity
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="replies_to_your_posts"
              defaultChecked={prefs?.replies_to_your_posts ?? true}
            />
            Replies to your posts
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="likes_on_your_posts"
              defaultChecked={prefs?.likes_on_your_posts ?? true}
            />
            Likes on your posts
          </label>
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              name="product_updates"
              defaultChecked={prefs?.product_updates ?? true}
            />
            Product updates
          </label>
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </div>
    </div>
  );
}
