"use client";

import { AutocompleteField } from "@/components/autocomplete-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

type OrgRow = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  domain: string | null;
  organization_languages: { language: { name: string } | null }[];
  organization_admins: { user_id: string }[];
};

export function OrganizationManager({
  organizations,
  createOrganization,
  addOrganizationLanguage,
  inviteFirstAdmin,
}: {
  organizations: OrgRow[];
  createOrganization: (formData: FormData) => void;
  addOrganizationLanguage: (formData: FormData) => void;
  inviteFirstAdmin: (formData: FormData) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
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
              <Label htmlFor="org-subdomain">Subdomain</Label>
              <Input id="org-subdomain" name="subdomain" placeholder="e.g. learn" required />
            </Field>
            <Field>
              <Label htmlFor="org-domain">School email domain (optional)</Label>
              <Input id="org-domain" name="domain" placeholder="e.g. acme.edu" />
            </Field>
            <Field>
              <Label htmlFor="org-location">Location name</Label>
              <Input id="org-location" name="locationName" placeholder="e.g. Acme University" required />
            </Field>
          </div>
          <AutocompleteField
            label="Parent country"
            kind="place"
            placeType="country"
            hiddenName="parentCountryId"
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
              <p className="font-medium text-ink">{org.name}</p>
              <p className="text-sm text-muted">
                {org.subdomain}.culturemesh.com{org.domain ? ` · ${org.domain}` : ""}
              </p>
              <p className="text-sm text-muted">
                Languages: {org.organization_languages.map((l) => l.language?.name).filter(Boolean).join(", ") || "none yet"}
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
          </div>
        ))}
      </div>
    </div>
  );
}
