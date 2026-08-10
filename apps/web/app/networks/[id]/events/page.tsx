import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEvent } from "@/app/networks/[id]/events/actions";
import { EventDateField } from "@/app/networks/[id]/events/event-date-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; embed?: string }>;
}) {
  const { id } = await params;
  const { error, embed } = await searchParams;
  const isEmbedded = embed === "1";
  const embedSuffix = isEmbedded ? "?embed=1" : "";
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
        <Link href={`/networks/${network.id}${embedSuffix}`} className="text-sm text-muted underline">
          Back to network
        </Link>
        <h1 className="font-display text-3xl text-ink">{network.title} events</h1>
      </div>

      {isMember && (
        <form action={createEvent} className="flex flex-col gap-2 border-b border-border pb-6">
          <input type="hidden" name="networkId" value={network.id} />
          {isEmbedded && <input type="hidden" name="embed" value="1" />}
          {error && (
            <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
          )}
          <Field>
            <Label htmlFor="event-title">Event title</Label>
            <Input id="event-title" name="title" required />
          </Field>
          <Field>
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea id="event-description" name="description" />
          </Field>
          <EventDateField />
          <Field>
            <Label htmlFor="event-location">Location (optional)</Label>
            <Input id="event-location" name="location" />
          </Field>
          <Button type="submit" className="self-start">
            Host event
          </Button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {events?.map((event) => (
          <Link
            key={event.id}
            href={`/networks/${network.id}/events/${event.id}${embedSuffix}`}
            className="flex flex-col gap-1 border-b border-border pb-3"
          >
            <span className="font-medium text-ink underline hover:text-primary">
              {event.title}
            </span>
            <span className="text-sm text-muted">
              {new Date(event.event_date).toLocaleString()}
              {event.location ? ` · ${event.location}` : ""}
            </span>
          </Link>
        ))}
        {events?.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
      </div>
    </div>
  );
}
