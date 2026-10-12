import { createAdminClient } from "@/lib/supabase/admin";
import {
  addInstitutionStaff,
  archiveInstitution,
  createInstitution,
} from "@/app/admin/institutions/actions";
import { AutocompleteField } from "@/components/autocomplete-field";
import { Field, fieldClass, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

const KINDS = [
  "resettlement_agency",
  "association",
  "faith",
  "library",
  "clinic",
  "school_office",
  "city_office",
  "other",
] as const;

// Reads with the admin client: this page sits under the admin layout's
// is_admin gate, and institution_staff is deliberately not readable by
// anyone but the staff member themselves (00000000000091).
export default async function AdminInstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const admin = createAdminClient();

  const { data: institutions } = await admin
    .from("institutions")
    .select("id, name, kind, contact_email, archived_at, place:places(name)")
    .order("created_at", { ascending: false });

  const ids = (institutions ?? []).map((i) => i.id as number);
  const { data: staff } = ids.length
    ? await admin
        .from("institution_staff")
        .select("institution_id, revoked_at, profile:user_id(username, first_name, last_name)")
        .in("institution_id", ids)
        .is("revoked_at", null)
    : { data: [] };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">Add an institution</h2>
        <p className="text-sm text-muted">
          A resettlement agency office, hometown association, library or clinic that refers
          people into a community. Staff can then create reusable referral links. CultureMesh
          records how many people joined through a link and never who, so this cannot be turned
          into a client list.
        </p>
        {error && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>
        )}
        <form action={createInstitution} className="flex flex-col gap-3">
          <Field>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="e.g. Refugee Services of Lansing" />
          </Field>
          <Field>
            <Label htmlFor="kind">Kind</Label>
            <select id="kind" name="kind" className={fieldClass} defaultValue="resettlement_agency">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <AutocompleteField
            label="City it works in"
            kind="place"
            placeType={["city"]}
            hiddenName="placeId"
            placeholder="e.g. Lansing"
          />
          <Field>
            <Label htmlFor="contactEmail">Contact email (optional)</Label>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </Field>
          <SubmitButton className="self-start">Add institution</SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">Institutions</h2>
        {(institutions ?? []).length === 0 && (
          <p className="text-sm text-muted">None yet.</p>
        )}
        {(institutions ?? []).map((institution) => {
          const place = institution.place as unknown as { name: string } | null;
          const members = (staff ?? []).filter(
            (s) => s.institution_id === institution.id,
          );
          return (
            <div
              key={institution.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <p className="font-medium text-ink">
                {institution.name}
                {institution.archived_at && (
                  <span className="ml-2 text-xs font-normal text-muted">archived</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {(institution.kind as string).replace(/_/g, " ")}
                {place ? ` · ${place.name}` : ""}
                {institution.contact_email ? ` · ${institution.contact_email}` : ""}
              </p>
              <p className="text-sm text-body">
                Staff:{" "}
                {members.length === 0
                  ? "nobody yet"
                  : members
                      .map((s) => {
                        const p = s.profile as unknown as {
                          username: string | null;
                          first_name: string | null;
                          last_name: string | null;
                        } | null;
                        return (
                          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
                          p?.username ||
                          "a member"
                        );
                      })
                      .join(", ")}
              </p>
              <form action={addInstitutionStaff} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="institutionId" value={institution.id} />
                <Field>
                  <Label htmlFor={`staff-${institution.id}`}>Add staff by email</Label>
                  <Input id={`staff-${institution.id}`} name="email" type="email" />
                </Field>
                <SubmitButton>Add</SubmitButton>
              </form>
              {!institution.archived_at && (
                <form action={archiveInstitution}>
                  <input type="hidden" name="institutionId" value={institution.id} />
                  <SubmitButton className="self-start !bg-transparent !px-0 !text-sm !font-normal !text-muted underline hover:!text-primary">
                    Archive
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
