import { createClient } from "@/lib/supabase/server";
import { whitelistMember, removeWhitelistedMember, assignWhitelistLanguages } from "@/app/learn/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";

type WhitelistRow = {
  id: number;
  email: string;
  role: string;
  language_ids: number[];
  claimed_at: string | null;
};

type OrgLanguageRow = { language: { id: number; name: string } | null };

export default async function LearnAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("id").eq("subdomain", "learn").single();

  const [{ data: whitelist }, { data: orgLanguages }] = await Promise.all([
    supabase
      .from("organization_whitelist")
      .select("id, email, role, language_ids, claimed_at")
      .eq("organization_id", org!.id)
      .order("created_at", { ascending: false }),
    supabase.from("organization_languages").select("language:languages(id, name)").eq("organization_id", org!.id),
  ]);

  const languages = ((orgLanguages ?? []) as unknown as OrgLanguageRow[])
    .map((row) => row.language)
    .filter((l): l is { id: number; name: string } => l !== null);
  const languageNameById = new Map(languages.map((l) => [l.id, l.name]));

  return (
    <div className="flex w-full flex-col gap-6">
      {success && <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Whitelist a member</h2>
        <form action={whitelistMember} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <input type="hidden" name="organizationId" value={org!.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="whitelist-email">Email</Label>
              <Input id="whitelist-email" name="email" type="email" required />
            </Field>
            <Field>
              <Label htmlFor="whitelist-role">Role</Label>
              <select id="whitelist-role" name="role" defaultValue="student" className="rounded-md border border-border bg-surface px-3 py-2 text-ink">
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Enrolled languages</legend>
            <div className="flex flex-wrap gap-4">
              {languages.map((language) => (
                <label key={language.id} className="flex items-center gap-2 text-sm text-body">
                  <input type="checkbox" name="languageIds" value={language.id} />
                  {language.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="self-start">
            Whitelist
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">Members</h2>
        {(!whitelist || whitelist.length === 0) && <p className="text-sm text-muted">No one whitelisted yet.</p>}
        {((whitelist ?? []) as WhitelistRow[]).map((entry) => {
          const isPending = Boolean(entry.claimed_at) && entry.language_ids.length === 0;
          return (
            <div key={entry.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-body">
                    {entry.email} <span className="text-sm text-muted">· {entry.role}</span>
                    {isPending && (
                      <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                        Pending - recognized via school email
                      </span>
                    )}
                  </p>
                  {!isPending && (
                    <p className="text-sm text-muted">
                      {entry.language_ids.map((id) => languageNameById.get(id)).filter(Boolean).join(", ") || "no languages"}
                      {" · "}
                      {entry.claimed_at ? "active" : "invited, not yet signed in"}
                    </p>
                  )}
                </div>
                <form action={removeWhitelistedMember}>
                  <input type="hidden" name="whitelistId" value={entry.id} />
                  <Button type="submit" variant="ghost">
                    Remove
                  </Button>
                </form>
              </div>
              {isPending && (
                <form action={assignWhitelistLanguages} className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <input type="hidden" name="whitelistId" value={entry.id} />
                  {languages.map((language) => (
                    <label key={language.id} className="flex items-center gap-2 text-sm text-body">
                      <input type="checkbox" name="languageIds" value={language.id} />
                      {language.name}
                    </label>
                  ))}
                  <Button type="submit" variant="secondary">
                    Assign
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
