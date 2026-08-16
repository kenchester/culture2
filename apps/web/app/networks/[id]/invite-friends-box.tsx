import { sendNetworkInvites } from "@/app/networks/actions";
import { Button } from "@/components/ui/button";
import { Field, Label, Textarea } from "@/components/ui/input";

// Plain server-rendered form - no client interactivity needed, so this
// stays a native form post like the rest of the app's simple forms
// (contact, suggest-network) rather than a client component.
export function InviteFriendsBox({
  networkId,
  invited,
  inviteError,
}: {
  networkId: number;
  invited?: boolean;
  inviteError?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium text-ink">Invite friends</h2>
      <p className="text-sm text-muted">
        Know someone who&apos;d want to join this network? Enter their emails, separated by
        commas.
      </p>
      {invited && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">Invites sent.</p>
      )}
      {inviteError && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{inviteError}</p>
      )}
      <form action={sendNetworkInvites} className="flex flex-col gap-2">
        <input type="hidden" name="networkId" value={networkId} />
        <Field>
          <Label htmlFor="invite-emails">Emails</Label>
          <Textarea
            id="invite-emails"
            name="emails"
            placeholder="friend1@email.com, friend2@email.com"
            required
          />
        </Field>
        <Button type="submit" className="self-start">
          Send invites
        </Button>
      </form>
    </div>
  );
}
