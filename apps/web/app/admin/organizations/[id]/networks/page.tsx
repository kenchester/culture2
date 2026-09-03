import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMainSiteUrl, buildSubdomainUrl } from "@/lib/site-url";
import { FormError, FormSuccess } from "@/components/ui/form-error";
import { NetworkRow } from "@/app/admin/organizations/[id]/networks/network-row";
import { deleteOrgNetwork, renameOrgNetwork } from "@/app/admin/organizations/[id]/networks/actions";

type OrgLanguageRow = {
  network_id: number;
  language: { name: string } | null;
  network: { id: number; title: string; member_count: number; post_count: number } | null;
};

export default async function ManageOrgNetworksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", Number(id))
    .maybeSingle();

  if (!org) {
    notFound();
  }

  // Through the admin client so the counts are the real ones rather than
  // whatever this admin's own RLS view of a school-gated network allows.
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("organization_languages")
    .select("network_id, language:languages(name), network:networks(id, title, member_count, post_count)")
    .eq("organization_id", org.id);

  const networks = ((rows ?? []) as unknown as OrgLanguageRow[]).filter((r) => r.network);
  const mainSiteUrl = await getMainSiteUrl();
  const learnBaseUrl = buildSubdomainUrl(mainSiteUrl, "learn", "");

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link href="/admin/organizations" className="text-sm text-muted underline hover:text-primary">
          ← Back to organizations
        </Link>
        <h2 className="mt-2 font-display text-xl text-ink">Networks at {org.name}</h2>
        <p className="text-sm text-muted">
          Renaming changes the title students see. Deleting removes the network and every post,
          reply and recording in it — it cannot be undone.
        </p>
      </div>

      {error && <FormError>{error}</FormError>}
      {success && <FormSuccess>{success}</FormSuccess>}

      {networks.length === 0 ? (
        <p className="text-sm text-muted">This school has no language networks yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {networks.map((row) => (
            <NetworkRow
              key={row.network!.id}
              organizationId={org.id}
              network={row.network!}
              languageName={row.language?.name ?? "?"}
              networkHref={`${learnBaseUrl}/networks/${row.network!.id}`}
              renameOrgNetwork={renameOrgNetwork}
              deleteOrgNetwork={deleteOrgNetwork}
            />
          ))}
        </div>
      )}
    </div>
  );
}
