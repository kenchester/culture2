import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createPartner, deletePartner } from "@/app/admin/embed-partners/actions";
import { AdminPartnerForm } from "@/app/admin/embed-partners/admin-partner-form";
import { EmbedCode } from "@/app/admin/embed-partners/embed-code";

type PartnerRow = {
  id: number;
  name: string;
  slug: string;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-body">
        Sign in as an admin to continue.
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return <div className="mx-auto max-w-lg px-4 py-12 text-body">Not authorized.</div>;
  }

  const { data: partners } = (await supabase
    .from("embed_partners")
    .select(
      "id, name, slug, locked_language:locked_language_id(name), locked_origin_place:locked_origin_place_id(name), jurisdictions:embed_partner_jurisdictions(place:place_id(name))",
    )
    .order("created_at", { ascending: false })) as unknown as { data: PartnerRow[] | null };

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Embed partners</h1>
      {error && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
      )}
      <AdminPartnerForm action={createPartner} />

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
                /embed/{partner.slug} &mdash; locked to {lockedOrigin?.name ?? "?"}, jurisdiction:{" "}
                {jurisdictionNames.join(", ") || "none"}
              </p>
              <EmbedCode
                snippet={`<iframe src="${origin}/embed/${partner.slug}" style="width: 100%; height: 640px; border: none;" title="CultureMesh"></iframe>`}
              />
              <form action={deletePartner}>
                <input type="hidden" name="partnerId" value={partner.id} />
                <button type="submit" className="self-start text-sm text-error underline">
                  Delete
                </button>
              </form>
            </div>
          );
        })}
        {partners?.length === 0 && <p className="text-sm text-muted">No partners yet.</p>}
      </div>
    </div>
  );
}
