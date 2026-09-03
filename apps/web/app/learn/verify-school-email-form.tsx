import { getTranslations } from "next-intl/server";
import { requestEmailVerificationCode, verifyEmailCode } from "@/app/learn/[slug]/actions";
import { Field, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

// Shown instead of GetStartedBanner when someone is already signed in -
// under their main CultureMesh account, or one tied to a school they've
// since left - but isn't recognized by this org. Routing them through
// sign-in/register again would be confusing (they can see they're already
// logged in) and wrong: the fix is proving they also control a school
// email, not switching accounts. pendingEmail (set once a code has been
// sent) drives which of the two steps renders; both are plain server
// actions + redirect-with-searchParam, no client state needed, the same
// shape as DomainCheckBanner/checkSchoolDomain.
export async function VerifySchoolEmailForm({
  organizationId,
  slug,
  orgName,
  domain,
  pendingEmail,
  error,
}: {
  organizationId: number;
  slug: string;
  orgName: string;
  domain: string | null;
  pendingEmail?: string;
  error?: string;
}) {
  const t = await getTranslations("learn");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div>
        <h2 className="font-display text-lg text-ink">
          {domain ? t("verifyHeadingWithDomain", { domain }) : t("verifyHeadingGeneric")}
        </h2>
        <p className="text-sm text-muted">{t("verifySubheading", { name: orgName })}</p>
      </div>
      {error && <p className="rounded-md bg-error-bg px-3 py-2 text-sm text-error">{error}</p>}
      {pendingEmail ? (
        <form action={verifyEmailCode} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="email" value={pendingEmail} />
          <div className="flex-1">
            <Field>
              <Label htmlFor="verify-code">{t("verifyCodeLabel", { email: pendingEmail })}</Label>
              <Input id="verify-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
            </Field>
          </div>
          <SubmitButton>{t("verifyCodeSubmit")}</SubmitButton>
        </form>
      ) : (
        <form action={requestEmailVerificationCode} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="slug" value={slug} />
          <div className="flex-1">
            <Field>
              <Label htmlFor="verify-email">{t("verifyEmailLabel")}</Label>
              <Input
                id="verify-email"
                name="email"
                type="email"
                placeholder={domain ? `you@${domain}` : "you@school.edu"}
                required
              />
            </Field>
          </div>
          <SubmitButton>{t("verifyEmailSubmit")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
