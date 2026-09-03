import { createClient } from "@/lib/supabase/server";
import {
  whitelistMember,
  removeWhitelistedMember,
  assignWhitelistLanguages,
  bulkWhitelistRoster,
} from "@/app/learn/[slug]/admin/actions";
import { setNetworkPrompt } from "@/app/networks/actions";
import { getLearnAccess } from "@/lib/organization-whitelist";
import { getDisplayName } from "@/lib/profiles";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

type WhitelistRow = {
  id: number;
  email: string;
  role: string;
  language_ids: number[];
  claimed_at: string | null;
};

type OrgLanguageRow = {
  network: { id: number; title: string; instructor_prompt: string | null } | null;
  language: { id: number; name: string } | null;
};

type ParticipationRow = {
  userId: string;
  displayName: string;
  postCount: number;
  lastPostAt: string | null;
};

// Aggregated in JS rather than a SQL function - this is admin/instructor
// tooling for a single network's roster (a handful to a few dozen people
// for a pilot), not a hot path, so two plain queries plus an in-memory
// group-by is simpler than a new RPC for it.
async function getParticipation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  networkId: number,
): Promise<ParticipationRow[]> {
  const [{ data: members }, { data: posts }] = await Promise.all([
    supabase
      .from("network_members")
      .select("user_id, profile:user_id(first_name, last_name, username)")
      .eq("network_id", networkId),
    supabase.from("posts").select("user_id, created_at").eq("network_id", networkId),
  ]);

  const postsByUser = new Map<string, { count: number; lastPostAt: string }>();
  for (const post of posts ?? []) {
    const existing = postsByUser.get(post.user_id);
    if (existing) {
      existing.count += 1;
      if (post.created_at > existing.lastPostAt) existing.lastPostAt = post.created_at;
    } else {
      postsByUser.set(post.user_id, { count: 1, lastPostAt: post.created_at });
    }
  }

  return (members ?? [])
    .map((member) => {
      const profile = member.profile as unknown as {
        first_name: string | null;
        last_name: string | null;
        username: string | null;
      } | null;
      const stats = postsByUser.get(member.user_id);
      return {
        userId: member.user_id,
        displayName: profile ? getDisplayName(profile) : "CultureMesh member",
        postCount: stats?.count ?? 0,
        lastPostAt: stats?.lastPostAt ?? null,
      };
    })
    .sort((a, b) => a.postCount - b.postCount);
}

export default async function LearnAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { slug } = await params;
  const { error, success } = await searchParams;
  const supabase = await createClient();
  const { org, role, languageIds } = await getLearnAccess(slug);

  const [{ data: whitelist }, { data: orgLanguages }] = await Promise.all([
    role === "admin"
      ? supabase
          .from("organization_whitelist")
          .select("id, email, role, language_ids, claimed_at")
          .eq("organization_id", org!.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase
      .from("organization_languages")
      .select("network:networks(id, title, instructor_prompt), language:languages(id, name)")
      .eq("organization_id", org!.id),
  ]);

  const languages = ((orgLanguages ?? []) as unknown as OrgLanguageRow[])
    .map((row) => row.language)
    .filter((l): l is { id: number; name: string } => l !== null);
  const languageNameById = new Map(languages.map((l) => [l.id, l.name]));

  const myNetworks = ((orgLanguages ?? []) as unknown as OrgLanguageRow[]).filter(
    (row) => row.network && row.language && (role === "admin" || languageIds.includes(row.language.id)),
  );
  const participationByNetwork = new Map(
    await Promise.all(
      myNetworks.map(
        async (row) => [row.network!.id, await getParticipation(supabase, row.network!.id)] as const,
      ),
    ),
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {success && <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{success}</p>}
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-ink">Your networks</h2>
        {myNetworks.length === 0 && <p className="text-sm text-muted">No networks assigned yet.</p>}
        {myNetworks.map(({ network, language }) => (
          <div key={network!.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <p className="font-medium text-ink">{language!.name}</p>

            <form action={setNetworkPrompt} className="flex flex-col gap-2">
              <input type="hidden" name="networkId" value={network!.id} />
              <Field>
                <Label htmlFor={`prompt-${network!.id}`}>This week&apos;s prompt</Label>
                <Textarea
                  id={`prompt-${network!.id}`}
                  name="prompt"
                  defaultValue={network!.instructor_prompt ?? ""}
                  placeholder="e.g. Describe your favorite meal from home."
                  rows={2}
                />
              </Field>
              <SubmitButton variant="secondary" className="self-start">
                Save prompt
              </SubmitButton>
            </form>

            <div>
              <p className="mb-1 text-sm font-medium text-ink">Participation</p>
              <div className="flex flex-col gap-1">
                {(participationByNetwork.get(network!.id) ?? []).map((row) => (
                  <div key={row.userId} className="flex items-center justify-between text-sm text-body">
                    <span>{row.displayName}</span>
                    <span className="text-muted">
                      {row.postCount} post{row.postCount === 1 ? "" : "s"}
                      {row.lastPostAt ? ` · last ${new Date(row.lastPostAt).toLocaleDateString()}` : ""}
                    </span>
                  </div>
                ))}
                {(participationByNetwork.get(network!.id) ?? []).length === 0 && (
                  <p className="text-sm text-muted">No members yet.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {role === "admin" && (
        <>
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
              <SubmitButton className="self-start">
                Whitelist
              </SubmitButton>
            </form>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-ink">Bulk whitelist a roster</h2>
            <form action={bulkWhitelistRoster} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <input type="hidden" name="organizationId" value={org!.id} />
              <Field>
                <Label htmlFor="roster-file">Roster file (CSV or text)</Label>
                <input id="roster-file" name="roster" type="file" accept=".csv,.txt" />
              </Field>
              <Field>
                <Label htmlFor="roster-emails">Or paste emails</Label>
                <Textarea
                  id="roster-emails"
                  name="emailsText"
                  placeholder="One email per line, or pasted straight from a spreadsheet"
                  rows={3}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="roster-role">Role</Label>
                  <select id="roster-role" name="role" defaultValue="student" className="rounded-md border border-border bg-surface px-3 py-2 text-ink">
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
              <SubmitButton className="self-start">
                Upload roster
              </SubmitButton>
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
                      <SubmitButton variant="ghost">
                        Remove
                      </SubmitButton>
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
                      <SubmitButton variant="secondary">
                        Assign
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
