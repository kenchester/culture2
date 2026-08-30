import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, buildSubdomainUrl } from "@/lib/site-url";
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
  organization_languages: { network_id: number; language: { name: string } | null }[];
  organization_admins: { user_id: string }[];
};

type RequestRow = {
  id: number;
  institutional_email: string;
  profile_url: string;
  school_name: string;
  created_at: string;
  language: { name: string } | null;
};

const ORGS_PER_PAGE = 5;

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; page?: string }>;
}) {
  const { error, success, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * ORGS_PER_PAGE;
  // Fetches one extra row past this page's worth so hasNextPage can be
  // determined from the result itself, rather than a separate count query.
  const to = from + ORGS_PER_PAGE;

  const supabase = await createClient();

  const [{ data: organizationsRaw }, { data: pendingRequests }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "id, name, slug, subdomain, domain, domain_signin_enabled, organization_languages(network_id, language:languages(name)), organization_admins(user_id)",
      )
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("organization_requests")
      .select("id, institutional_email, profile_url, school_name, created_at, language:languages(name)")
      .eq("status", "pending")
      .order("created_at"),
  ]);

  const hasNextPage = (organizationsRaw?.length ?? 0) > ORGS_PER_PAGE;
  const organizations = (organizationsRaw ?? []).slice(0, ORGS_PER_PAGE);

  // Admin lives on the bare culturemesh.com host - a plain relative
  // /networks/{id} link here would resolve against that host, not
  // learn.culturemesh.com, silently leaking an org-gated network out of its
  // subdomain. Built explicitly so every org/network link below points at
  // the right host regardless of which host admin itself is served from.
  const siteUrl = await getSiteUrl();
  const learnBaseUrl = buildSubdomainUrl(siteUrl, "learn", "");

  return (
    <div className="flex w-full flex-col gap-6">
      {success && <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      <OrganizationManager
        organizations={organizations as unknown as OrgRow[]}
        pendingRequests={(pendingRequests ?? []) as unknown as RequestRow[]}
        currentPage={currentPage}
        hasNextPage={hasNextPage}
        learnBaseUrl={learnBaseUrl}
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
