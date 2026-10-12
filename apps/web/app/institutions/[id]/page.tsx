import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createCorridorInvite, revokeCorridorInvite } from "@/app/institutions/actions";
import { getSiteUrl } from "@/lib/site-url";
import { CopyTextButton } from "@/components/copy-text-button";
import { LocalDateTime } from "@/components/local-datetime";
import { FormError } from "@/components/ui/form-error";
import { Field, fieldClass, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = {
  title: "Referral links — CultureMesh",
  robots: { index: false, follow: false },
};

/**
 * Staff view for one institution: make a link, withdraw a link, read the
 * counts.
 *
 * The community picker is limited to networks located in this
 * institution's own city. That is not a shortcut around a search box - a
 * local agency refers people into local communities, and the whole list
 * is short enough to read.
 */
export default async function InstitutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const t = await getTranslations("institutions");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?returnTo=/institutions/${id}`);

  // The policy would hide the rows anyway; this turns "an empty page" into
  // an honest 404 for anyone who isn't staff here.
  const { data: staff } = await supabase
    .from("institution_staff")
    .select("institution_id")
    .eq("institution_id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!staff) notFound();

  const { data: institution } = await supabase
    .from("institutions")
    .select("id, name, place_id")
    .eq("id", id)
    .maybeSingle();
  if (!institution) notFound();

  const [{ data: place }, { data: invites }, { data: counts }, siteUrl] = await Promise.all([
    institution.place_id
      ? supabase.from("places").select("id, name").eq("id", institution.place_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("corridor_invites")
      .select("id, token, note, uses, revoked_at, created_at, network:networks(title)")
      .eq("institution_id", institution.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("institution_referrals")
      .select("month, joined_count, network:networks(title)")
      .eq("institution_id", institution.id)
      .order("month", { ascending: false }),
    getSiteUrl(),
  ]);

  // Communities in this institution's city, minus any an organisation
  // gates - the insert policy refuses those, so offering them would only
  // produce a confusing rejection.
  const { data: localNetworks } = institution.place_id
    ? await supabase
        .from("networks")
        .select("id, title, location_place_id")
        .eq("location_place_id", institution.place_id)
        .order("member_count", { ascending: false })
    : { data: [] };
  const { data: gated } = await supabase.from("organization_languages").select("network_id");
  const gatedIds = new Set((gated ?? []).map((g) => g.network_id as number));
  const choosable = (localNetworks ?? []).filter((n) => !gatedIds.has(n.id as number));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/institutions" className="text-sm text-muted underline hover:text-primary">
          ← {t("title")}
        </Link>
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {institution.name}
        </h1>
      </div>

      {error && <FormError>{error}</FormError>}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-medium text-ink">{t("inviteHeading")}</h2>
        <p className="text-sm text-body">{t("inviteIntro")}</p>

        {choosable.length === 0 ? (
          <p className="text-sm text-muted">{t("noNetworks")}</p>
        ) : (
          <form action={createCorridorInvite} className="flex flex-col gap-3">
            <input type="hidden" name="institutionId" value={institution.id} />
            <Field>
              <Label htmlFor="networkId">{t("chooseNetwork")}</Label>
              <select id="networkId" name="networkId" required className={fieldClass} defaultValue="">
                <option value="" disabled>
                  {t("chooseNetworkPlaceholder", { place: place?.name ?? "" })}
                </option>
                {choosable.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <Label htmlFor="note">{t("noteLabel")}</Label>
              <Input id="note" name="note" placeholder={t("notePlaceholder")} />
            </Field>
            <SubmitButton className="self-start">{t("createCta")}</SubmitButton>
          </form>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {(invites ?? []).length === 0 && (
            <p className="text-sm text-muted">{t("noInvites")}</p>
          )}
          {(invites ?? []).map((invite) => {
            const network = invite.network as unknown as { title: string } | null;
            const url = `${siteUrl}/join/${invite.token}`;
            return (
              <div key={invite.id} className="flex flex-col gap-1 rounded-md border border-border p-3">
                <p className="font-medium text-ink">{network?.title}</p>
                {invite.note && <p className="text-xs text-muted">{invite.note}</p>}
                {invite.revoked_at ? (
                  <p className="text-sm text-muted">{t("revoked")}</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs text-body">{url}</code>
                    <CopyTextButton text={url} />
                  </div>
                )}
                <p className="text-xs text-muted tabular-nums">
                  {t("usesLabel", { count: invite.uses as number })} ·{" "}
                  <LocalDateTime iso={invite.created_at as string} />
                </p>
                {!invite.revoked_at && (
                  <form action={revokeCorridorInvite}>
                    <input type="hidden" name="institutionId" value={institution.id} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <SubmitButton className="self-start !bg-transparent !px-0 !text-sm !font-normal !text-muted underline hover:!text-primary">
                      {t("revoke")}
                    </SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">{t("countsHeading")}</h2>
        {/* Stated here so the limitation reads as a decision rather than a
            missing feature - because somebody will eventually ask for the
            per-person breakdown. */}
        <p className="text-sm text-muted">{t("countsIntro")}</p>
        {(counts ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t("noCounts")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">{t("countsMonth")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("countsNetwork")}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t("countsJoined")}</th>
                </tr>
              </thead>
              <tbody>
                {(counts ?? []).map((row, i) => {
                  const network = row.network as unknown as { title: string } | null;
                  return (
                    <tr key={i} className="border-b border-border">
                      <td className="py-2 pr-4 text-body">{String(row.month).slice(0, 7)}</td>
                      <td className="py-2 pr-4 text-body">{network?.title}</td>
                      <td className="py-2 text-right text-body tabular-nums">
                        {row.joined_count as number}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
