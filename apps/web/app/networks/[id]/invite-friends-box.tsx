import { getTranslations } from "next-intl/server";
import { sendNetworkInvites } from "@/app/networks/actions";
import { Field, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

// Plain server-rendered form - no client interactivity needed, so this
// stays a native form post like the rest of the app's simple forms
// (contact, suggest-network) rather than a client component.
export async function InviteFriendsBox({
  networkId,
  invited,
  inviteError,
}: {
  networkId: number;
  invited?: boolean;
  inviteError?: string;
}) {
  const t = await getTranslations("inviteFriends");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium text-ink">{t("heading")}</h2>
      <p className="text-sm text-muted">{t("intro")}</p>
      {invited && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">
          {t("sent")}
        </p>
      )}
      {inviteError && (
        <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{inviteError}</p>
      )}
      <form action={sendNetworkInvites} className="flex flex-col gap-2">
        <input type="hidden" name="networkId" value={networkId} />
        <Field>
          <Label htmlFor="invite-emails">{t("emailsLabel")}</Label>
          <Textarea
            id="invite-emails"
            name="emails"
            placeholder={t("emailsPlaceholder")}
            required
          />
        </Field>
        <SubmitButton className="self-start">
          {t("submit")}
        </SubmitButton>
      </form>
    </div>
  );
}
