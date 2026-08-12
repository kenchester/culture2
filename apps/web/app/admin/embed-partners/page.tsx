import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createPartner, createPartnerDemoData, deletePartner } from "@/app/admin/embed-partners/actions";
import { AdminPartnerForm } from "@/app/admin/embed-partners/admin-partner-form";
import { EmbedCode } from "@/app/admin/embed-partners/embed-code";

type PartnerRow = {
  id: number;
  name: string;
  slug: string;
  is_global: boolean;
  origin_is_global: boolean;
  locked_language: { name: string } | null;
  locked_origin_place: { name: string } | null;
  jurisdictions: { place: { name: string } }[];
};

export default async function AdminEmbedPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: partners } = (await supabase
    .from("embed_partners")
    .select(
      "id, name, slug, is_global, origin_is_global, locked_language:locked_language_id(name), locked_origin_place:locked_origin_place_id(name), jurisdictions:embed_partner_jurisdictions(place:place_id(name))",
    )
    .order("created_at", { ascending: false })) as unknown as { data: PartnerRow[] | null };

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <div className="flex w-full flex-col gap-8">
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <AdminPartnerForm action={createPartner} demoAction={createPartnerDemoData} />

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        {partners?.map((partner) => {
          const lockedOrigin = partner.locked_language ?? partner.locked_origin_place;
          const jurisdictionNames = partner.jurisdictions.map((j) => j.place.name);

          return (
            <div
              key={partner.id}
              className="flex flex-col gap-1 border-b border-border pb-4"
            >
              <p className="font-medium text-ink">{partner.name}</p>
              <p className="text-sm text-muted">
                /embed/{partner.slug} &mdash; locked to{" "}
                {partner.origin_is_global ? "Global" : lockedOrigin?.name ?? "?"}, jurisdiction:{" "}
                {partner.is_global ? "Global" : jurisdictionNames.join(", ") || "none"}
              </p>
              <EmbedCode
                snippet={`<iframe src="${origin}/embed/${partner.slug}" style="width: 100%; height: 640px; border: none;" title="CultureMesh"></iframe>`}
              />
              <div className="flex items-center gap-4">
                <Link
                  href={`/embed-partners/demo/${partner.slug}`}
                  target="_blank"
                  className="text-sm text-primary underline"
                >
                  View embassy demo
                </Link>
                <Link
                  href={`/embed-partners/travel-demo/${partner.slug}`}
                  target="_blank"
                  className="text-sm text-primary underline"
                >
                  View travel demo
                </Link>
                <Link
                  href={`/embed-partners/remittance-demo/${partner.slug}`}
                  target="_blank"
                  className="text-sm text-primary underline"
                >
                  View remittance demo
                </Link>
                <form action={deletePartner}>
                  <input type="hidden" name="partnerId" value={partner.id} />
                  <button type="submit" className="text-sm text-error underline">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {partners?.length === 0 && <p className="text-sm text-muted">No partners yet.</p>}
      </div>
    </div>
  );
}
