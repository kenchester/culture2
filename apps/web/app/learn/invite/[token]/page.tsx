import { createAdminClient } from "@/lib/supabase/admin";
import { acceptOrganizationInvite } from "@/app/learn/invite/[token]/actions";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function OrganizationInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("organization_admin_invites")
    .select("email, accepted_at, expires_at, organization:organizations(name)")
    .eq("token", token)
    .maybeSingle();

  const org = (invite?.organization as unknown as { name: string } | null) ?? null;
  const alreadyAccepted = Boolean(invite?.accepted_at);
  const expired = invite ? new Date(invite.expires_at) < new Date() : false;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-2xl text-ink">Admin invite</h1>

        {!invite ? (
          <p className="text-sm text-error">This invite link isn&apos;t valid.</p>
        ) : alreadyAccepted ? (
          <p className="text-sm text-error">This invite has already been accepted.</p>
        ) : expired ? (
          <p className="text-sm text-error">This invite has expired.</p>
        ) : (
          <>
            <p className="text-body">
              You&apos;ve been invited to be the first admin for <strong>{org?.name}</strong> on CultureMesh,
              sent to {invite.email}.
            </p>
            <form action={acceptOrganizationInvite}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton className="w-full">
                Accept invite
              </SubmitButton>
            </form>
          </>
        )}

        {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
