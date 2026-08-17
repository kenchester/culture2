import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profiles";
import { cancelRsvp, rsvp } from "@/app/networks/[id]/events/[eventId]/actions";
import { Button } from "@/components/ui/button";

const STATUSES = ["going", "interested", "declined"] as const;

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams: Promise<{ error?: string; embed?: string }>;
}) {
  const { id, eventId } = await params;
  const { error, embed } = await searchParams;
  const isEmbedded = embed === "1";
  const embedSuffix = isEmbedded ? "?embed=1" : "";
  const supabase = await createClient();
  const t = await getTranslations("eventDetail");

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, event_date, location, host:host_id(id, username, first_name, last_name)",
    )
    .eq("id", eventId)
    .single();

  if (!event) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rsvps }, { data: myRsvp }] = await Promise.all([
    supabase.from("event_rsvps").select("status").eq("event_id", event.id),
    user
      ? supabase
          .from("event_rsvps")
          .select("status")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const counts = { going: 0, interested: 0, declined: 0 };
  for (const r of rsvps ?? []) {
    if (r.status in counts) counts[r.status as keyof typeof counts] += 1;
  }

  const host = event.host as unknown as {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;

  const returnTo = `/networks/${id}/events/${eventId}${embedSuffix}`;
  const signInParams = new URLSearchParams({ returnTo });
  if (isEmbedded) signInParams.set("embed", "1");
  const signInHref = `/sign-in?${signInParams.toString()}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <Link href={`/networks/${id}/events${embedSuffix}`} className="text-sm text-muted underline">
        {t("backToEvents")}
      </Link>

      <div>
        <h1 className="font-display text-3xl text-ink">{event.title}</h1>
        <p className="text-sm text-muted">
          {new Date(event.event_date).toLocaleString()}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        {host && (
          <p className="text-sm text-muted">
            {t.rich("hostedBy", {
              name: getDisplayName(host),
              link: (chunks) => (
                <Link
                  href={`/profile/${host.id}`}
                  className="text-ink underline hover:text-primary"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </div>

      {event.description && <p className="text-body">{event.description}</p>}

      <p className="text-sm text-muted">
        {t("rsvpCounts", {
          going: counts.going,
          interested: counts.interested,
          declined: counts.declined,
        })}
      </p>

      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}

      {user ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {STATUSES.map((status) => (
              <form key={status} action={rsvp}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="networkId" value={id} />
                <input type="hidden" name="status" value={status} />
                {isEmbedded && <input type="hidden" name="embed" value="1" />}
                <Button
                  type="submit"
                  variant={myRsvp?.status === status ? "primary" : "secondary"}
                >
                  {t(`statuses.${status}`)}
                </Button>
              </form>
            ))}
          </div>
          {myRsvp && (
            <form action={cancelRsvp}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="networkId" value={id} />
              {isEmbedded && <input type="hidden" name="embed" value="1" />}
              <button type="submit" className="text-sm text-muted underline hover:text-primary">
                {t("removeRsvp")}
              </button>
            </form>
          )}
        </div>
      ) : (
        <Link href={signInHref} className="text-sm font-medium text-primary hover:underline">
          {t("signInToRsvp")}
        </Link>
      )}
    </div>
  );
}
