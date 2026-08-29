import { createClient } from "@/lib/supabase/server";
import {
  createOrganization,
  addOrganizationLanguage,
  inviteFirstAdmin,
  updateOrganizationDomainSettings,
  deleteOrganization,
  approveOrganizationRequest,
  rejectOrganizationRequest,
} from "@/app/admin/organizations/actions";
import { OrganizationManager } from "@/app/admin/organizations/organization-manager";

type OrgRow = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  domain: string | null;
  domain_signin_enabled: boolean;
  organization_languages: { language: { name: string } | null }[];
  organization_admins: { user_id: string }[];
};

type RequestRow = {
  id: number;
  institutional_email: string;
  profile_url: string;
  school_name: string;
  location_name: string;
  created_at: string;
  language: { name: string } | null;
};

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const [{ data: organizations }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, slug, subdomain, domain, domain_signin_enabled, organization_languages(language:languages(name)), organization_admins(user_id)",
      )
      .order("name"),
    supabase
      .from("organization_requests")
      .select("id, institutional_email, profile_url, school_name, location_name, created_at, language:languages(name)")
      .eq("status", "pending")
      .order("created_at"),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      {success && <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      <OrganizationManager
        organizations={(organizations ?? []) as unknown as OrgRow[]}
        pendingRequests={(pendingRequests ?? []) as unknown as RequestRow[]}
        createOrganization={createOrganization}
        addOrganizationLanguage={addOrganizationLanguage}
        inviteFirstAdmin={inviteFirstAdmin}
        updateOrganizationDomainSettings={updateOrganizationDomainSettings}
        deleteOrganization={deleteOrganization}
        approveOrganizationRequest={approveOrganizationRequest}
        rejectOrganizationRequest={rejectOrganizationRequest}
      />
    </div>
  );
}
