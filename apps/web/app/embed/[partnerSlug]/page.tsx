import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmbedLocationForm } from "@/app/embed/[partnerSlug]/embed-location-form";
import { EmbedLaunchForm } from "@/app/embed/[partnerSlug]/embed-launch-form";

type NetworkMatch = {
  match_kind: "exact" | "related_broader" | "related_narrower";
  network_id: number;
  network_title: string;
  location_place_id: number;
  location_name: string;
  location_type: "country" | "region" | "city";
  member_count: number;
  post_count: number;
};

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerSlug: string }>;
  searchParams: Promise<{ locationId?: string }>;
}) {
  const { partnerSlug } = await params;
  const { locationId } = await searchParams;
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("embed_partners")
    .select(
      "id, name, slug, hide_origin_label, locked_language_id, locked_origin_place_id, locked_language:locked_language_id(name), locked_origin_place:locked_origin_place_id(name)",
    )
    .eq("slug", partnerSlug)
    .single();

  if (!partner) {
    notFound();
  }

  const isLanguage = partner.locked_language_id !== null;
  const lockedOrigin = partner.locked_language ?? partner.locked_origin_place;
  const originName = (lockedOrigin as unknown as { name: string } | null)?.name ?? "?";

  if (!locationId) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-semibold text-ink">
          {partner.hide_origin_label ? partner.name : `${partner.name} — ${originName}`}
        </h1>
        <EmbedLocationForm partnerSlug={partnerSlug} />
      </div>
    );
  }

  const [{ data: location }, { data: matches }] = await Promise.all([
    supabase.from("places").select("name").eq("id", locationId).single(),
    supabase.rpc("search_networks", {
      p_language_id: isLanguage ? partner.locked_language_id : null,
      p_origin_place_id: isLanguage ? null : partner.locked_origin_place_id,
      p_location_place_id: Number(locationId),
    }),
  ]);

  const results = (matches ?? []) as NetworkMatch[];
  const exact = results.find((m) => m.match_kind === "exact");
  const broader = results.filter((m) => m.match_kind === "related_broader");
  const narrower = results.filter((m) => m.match_kind === "related_narrower");

  const locationName = location?.name ?? "?";
  const title = partner.hide_origin_label
    ? locationName
    : isLanguage
      ? `${originName} speakers in ${locationName}`
      : `People from ${originName} in ${locationName}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <div>
        <Link href={`/embed/${partnerSlug}`} className="text-sm text-muted underline">
          Back
        </Link>
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      </div>

      {exact ? (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <a
            href={`/networks/${exact.network_id}`}
            target="_top"
            className="text-lg font-medium text-ink underline"
          >
            {exact.network_title}
          </a>
          <p className="text-sm text-muted">
            {exact.member_count} members, {exact.post_count} posts
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-body">No network exists yet for this location.</p>
          <EmbedLaunchForm
            originKind={isLanguage ? "language" : "place"}
            originId={
              (isLanguage ? partner.locked_language_id : partner.locked_origin_place_id) ?? 0
            }
            locationId={locationId}
            title={
              isLanguage
                ? `${originName} speakers in ${locationName}`
                : `People from ${originName} in ${locationName}`
            }
          />
        </section>
      )}

      {broader.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Related (broader)</h2>
          {broader.map((m) => (
            <a
              key={m.network_id}
              href={`/networks/${m.network_id}`}
              target="_top"
              className="text-ink underline"
            >
              {m.network_title}
            </a>
          ))}
        </section>
      )}

      {narrower.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">Related (narrower)</h2>
          {narrower.map((m) => (
            <a
              key={m.network_id}
              href={`/networks/${m.network_id}`}
              target="_top"
              className="text-ink underline"
            >
              {m.network_title}
            </a>
          ))}
        </section>
      )}
    </div>
  );
}
