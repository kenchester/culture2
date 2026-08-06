import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/app/networks/[id]/events/actions";
import { EventDateField } from "@/app/networks/[id]/events/event-date-field";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: network } = await supabase
    .from("networks")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!network) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: membership }, { data: events }] = await Promise.all([
    user
      ? supabase
          .from("network_members")
          .select("user_id")
          .eq("network_id", network.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("events")
      .select("id, title, event_date, location")
      .eq("network_id", network.id)
      .order("event_date", { ascending: true }),
  ]);

  const isMember = Boolean(membership);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <Link href={`/networks/${network.id}`} className="text-sm text-zinc-500 underline">
          Back to network
        </Link>
        <h1 className="text-2xl font-semibold">{network.title} events</h1>
      </div>

      {isMember && (
        <form action={createEvent} className="flex flex-col gap-2 border-b pb-6">
          <input type="hidden" name="networkId" value={network.id} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col gap-1">
            <label htmlFor="event-title" className="text-sm font-medium">
              Event title
            </label>
            <input
              id="event-title"
              name="title"
              required
              className="rounded border px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="event-description" className="text-sm font-medium">
              Description (optional)
            </label>
            <textarea
              id="event-description"
              name="description"
              className="rounded border px-3 py-2"
            />
          </div>
          <EventDateField />
          <div className="flex flex-col gap-1">
            <label htmlFor="event-location" className="text-sm font-medium">
              Location (optional)
            </label>
            <input
              id="event-location"
              name="location"
              className="rounded border px-3 py-2"
            />
          </div>
          <button type="submit" className="self-start rounded bg-black px-3 py-2 text-white">
            Host event
          </button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {events?.map((event) => (
          <Link
            key={event.id}
            href={`/networks/${network.id}/events/${event.id}`}
            className="flex flex-col gap-1 border-b pb-3"
          >
            <span className="font-medium underline">{event.title}</span>
            <span className="text-sm text-zinc-600">
              {new Date(event.event_date).toLocaleString()}
              {event.location ? ` · ${event.location}` : ""}
            </span>
          </Link>
        ))}
        {events?.length === 0 && (
          <p className="text-sm text-zinc-500">No events yet.</p>
        )}
      </div>
    </div>
  );
}
