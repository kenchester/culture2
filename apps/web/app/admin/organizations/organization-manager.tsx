"use client";

import { useState } from "react";
import Link from "next/link";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

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

// A two-step reveal (click "Delete" once to show a slug-confirmation
// input, click again to actually submit) - this is the first genuinely
// destructive admin action in the app, so it gets its own guard rail
// rather than a single-click button like everything else here.
function DeleteOrgForm({
  org,
  deleteOrganization,
}: {
  org: OrgRow;
  deleteOrganization: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        Delete organization
      </Button>
    );
  }

  return (
    <form action={deleteOrganization} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="organizationId" value={org.id} />
      <Field>
        <Label htmlFor={`confirm-slug-${org.id}`}>
          Type &quot;{org.slug}&quot; to permanently delete this organization and all its networks/posts
        </Label>
        <Input id={`confirm-slug-${org.id}`} name="confirmSlug" placeholder={org.slug} required />
      </Field>
      <Button type="submit" variant="ghost">
        Confirm delete
      </Button>
      <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}

export function OrganizationManager({
  organizations,
  pendingRequests,
  currentPage,
  hasNextPage,
  createOrganization,
  addOrganizationLanguage,
  inviteFirstAdmin,
  updateOrganizationDomainSettings,
  deleteOrganization,
  approveOrganizationRequest,
  rejectOrganizationRequest,
}: {
  organizations: OrgRow[];
  pendingRequests: RequestRow[];
  currentPage: number;
  hasNextPage: boolean;
  createOrganization: (formData: FormData) => void;
  addOrganizationLanguage: (formData: FormData) => void;
  inviteFirstAdmin: (formData: FormData) => void;
  updateOrganizationDomainSettings: (formData: FormData) => void;
  deleteOrganization: (formData: FormData) => void;
  approveOrganizationRequest: (formData: FormData) => void;
  rejectOrganizationRequest: (formData: FormData) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {pendingRequests.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink">Pending requests</h3>
          {pendingRequests.map((request) => (
            <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <p className="font-medium text-ink">
                {request.school_name} <span className="text-sm text-muted">· {request.language?.name ?? "?"}</span>
              </p>
              <p className="text-sm text-muted">{request.institutional_email}</p>
              <a
                href={request.profile_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                View profile
              </a>
              <div className="flex gap-2 pt-2">
                <form action={approveOrganizationRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit">Approve</Button>
                </form>
                <form action={rejectOrganizationRequest}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit" variant="ghost">
                    Reject
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Create an organization</h3>
        <form action={createOrganization} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="org-name">Name</Label>
              <Input id="org-name" name="name" placeholder="e.g. Acme University" required />
            </Field>
            <Field>
              <Label htmlFor="org-slug">URL slug</Label>
              <Input id="org-slug" name="slug" placeholder="e.g. acme-university" required />
            </Field>
            <Field>
              <Label htmlFor="org-domain">School email domain (optional)</Label>
              <Input id="org-domain" name="domain" placeholder="e.g. acme.edu" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-body">
            <input type="checkbox" name="domainSigninEnabled" defaultChecked />
            Recognize students who sign in with a matching school email
          </label>
          <AutocompleteField
            label="Parent geography"
            kind="place"
            placeType={["country", "region", "city"]}
            hiddenName="parentPlaceId"
          />
          <Button type="submit" className="self-start">
            Create organization
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">Organizations</h3>
        {organizations.length === 0 && <p className="text-sm text-muted">No organizations yet.</p>}
        {organizations.map((org) => (
          <div key={org.id} className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <div>
              <p className="font-medium text-ink">
                {org.organization_languages.length === 1 && org.organization_languages[0].network_id ? (
                  <a
                    href={`/networks/${org.organization_languages[0].network_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {org.name}
                  </a>
                ) : (
                  org.name
                )}
              </p>
              <p className="text-sm text-muted">
                {org.subdomain}.culturemesh.com{org.domain ? ` · ${org.domain}` : ""}
              </p>
              <p className="text-sm text-muted">
                Languages:{" "}
                {org.organization_languages.length > 0
                  ? org.organization_languages.map((l, i) => (
                      <span key={l.network_id ?? i}>
                        {i > 0 && ", "}
                        {l.network_id ? (
                          <a
                            href={`/networks/${l.network_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            {l.language?.name ?? "?"}
                          </a>
                        ) : (
                          l.language?.name ?? "?"
                        )}
                      </span>
                    ))
                  : "none yet"}
              </p>
              <p className="text-sm text-muted">Admins: {org.organization_admins.length}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <form action={addOrganizationLanguage} className="flex flex-col gap-2">
                <input type="hidden" name="organizationId" value={org.id} />
                <AutocompleteField
                  label="Add a language network"
                  kind="language"
                  hiddenName="languageId"
                />
                <Button type="submit" variant="secondary" className="self-start">
                  Add language
                </Button>
              </form>

              {org.organization_admins.length === 0 && (
                <form action={inviteFirstAdmin} className="flex flex-col gap-2">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Field>
                    <Label htmlFor={`invite-email-${org.id}`}>Invite first admin (email)</Label>
                    <Input id={`invite-email-${org.id}`} name="email" type="email" required />
                  </Field>
                  <Button type="submit" variant="secondary" className="self-start">
                    Send invite
                  </Button>
                </form>
              )}
            </div>

            <form action={updateOrganizationDomainSettings} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
              <input type="hidden" name="organizationId" value={org.id} />
              <Field>
                <Label htmlFor={`domain-${org.id}`}>School email domain</Label>
                <Input id={`domain-${org.id}`} name="domain" defaultValue={org.domain ?? ""} placeholder="e.g. acme.edu" />
              </Field>
              <label className="flex items-center gap-2 pb-2 text-sm text-body">
                <input type="checkbox" name="domainSigninEnabled" defaultChecked={org.domain_signin_enabled} />
                Recognize matching-domain sign-ins
              </label>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>

            <div className="border-t border-border pt-3">
              <DeleteOrgForm org={org} deleteOrganization={deleteOrganization} />
            </div>
          </div>
        ))}
        {(currentPage > 1 || hasNextPage) && (
          <div className="flex items-center justify-between pt-2">
            {currentPage > 1 ? (
              <Link
                href={`/admin/organizations?page=${currentPage - 1}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                ← Previous 5 organizations
              </Link>
            ) : (
              <span />
            )}
            {hasNextPage && (
              <Link
                href={`/admin/organizations?page=${currentPage + 1}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Next 5 organizations →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
