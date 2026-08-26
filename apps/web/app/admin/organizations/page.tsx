import { createClient } from "@/lib/supabase/server";
import { createOrganization, addOrganizationLanguage, inviteFirstAdmin } from "@/app/admin/organizations/actions";
import { OrganizationManager } from "@/app/admin/organizations/organization-manager";

type OrgRow = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  domain: string | null;
  organization_languages: { language: { name: string } | null }[];
  organization_admins: { user_id: string }[];
};

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: organizations } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, subdomain, domain, organization_languages(language:languages(name)), organization_admins(user_id)",
    )
    .order("name");

  return (
    <div className="flex w-full flex-col gap-6">
      {success && <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      <OrganizationManager
        organizations={(organizations ?? []) as unknown as OrgRow[]}
        createOrganization={createOrganization}
        addOrganizationLanguage={addOrganizationLanguage}
        inviteFirstAdmin={inviteFirstAdmin}
      />
    </div>
  );
}
