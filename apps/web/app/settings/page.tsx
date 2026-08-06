import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateNotificationPrefs } from "@/app/settings/actions";

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
    .select("events_upcoming, events_interested_in, network_activity, product_updates")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Notification settings</h1>
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form action={updateNotificationPrefs} className="flex flex-col gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="events_upcoming"
            defaultChecked={prefs?.events_upcoming ?? true}
          />
          Upcoming events
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="events_interested_in"
            defaultChecked={prefs?.events_interested_in ?? true}
          />
          Events I&apos;m interested in
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="network_activity"
            defaultChecked={prefs?.network_activity ?? true}
          />
          Network activity
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="product_updates"
            defaultChecked={prefs?.product_updates ?? true}
          />
          Product updates
        </label>
        <button type="submit" className="rounded bg-black px-3 py-2 text-white">
          Save
        </button>
      </form>
    </div>
  );
}
