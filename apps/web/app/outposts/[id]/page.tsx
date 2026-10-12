import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { previewText, shareMetadata } from "@/lib/share-metadata";
import { saveConsulPage } from "@/app/outposts/[id]/actions";
import { getDisplayName, type Author } from "@/lib/profiles";
import { LocalDateTime } from "@/components/local-datetime";
import { ShareLink } from "@/components/share-link";
import { FormError } from "@/components/ui/form-error";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

type OutpostRow = {
  id: number;
  principal_id: number;
  host_place_id: number;
  status: string;
  heritage_note: string | null;
  about: string | null;
  contact: string | null;
  website: string | null;
  page_updated_at: string | null;
};

type OfficerRow = {
  id: number;
  user_id: string;
  appointed_at: string;
  term_ends_at: string | null;
  election_id: number | null;
  profile: Author | null;
};

/**
 * What an elected consul actually holds.
 *
 * Before this, winning produced a name in a table cell. The page is
 * deliberately narrow - who the community is, how to reach them - and
 * carries the disclaimer on every view. Nothing here is shaped like
 * issuing a document or speaking for a place, because that is where an
 * unofficial office starts sounding official and the disclaimer stops
 * being believed.
 */
async function loadOutpost(id: string) {
  const supabase = await createClient();

  const { data: outpost } = await supabase
    .from("outposts")
    .select(
      "id, principal_id, host_place_id, status, about, contact, website, heritage_note, page_updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!outpost) return null;

  const [{ data: principal }, { data: host }, { data: officers }] = await Promise.all([
    supabase.from("principals").select("name, place_id").eq("id", outpost.principal_id).maybeSingle(),
    supabase.from("places").select("name").eq("id", outpost.host_place_id).maybeSingle(),
    // The policy already hides revoked officers, so the most recent row
    // here is the serving one.
    supabase
      .from("outpost_officers")
      .select(
        "id, user_id, appointed_at, term_ends_at, election_id, profile:user_id(first_name, last_name, username)",
      )
      .eq("outpost_id", outpost.id)
      .order("appointed_at", { ascending: false })
      .limit(1),
  ]);

  const officer = ((officers ?? []) as unknown as OfficerRow[])[0] ?? null;

  // The network is derivable from the pairing - principal place to host
  // place is a network's origin to location - so no stored link can drift.
  const { data: network } = principal?.place_id
    ? await supabase
        .from("networks")
        .select("id")
        .eq("origin_place_id", principal.place_id)
        .eq("location_place_id", outpost.host_place_id)
        .maybeSingle()
    : { data: null };

  return {
    outpost: outpost as unknown as OutpostRow,
    principalName: (principal?.name as string | null) ?? "",
    hostName: (host?.name as string | null) ?? "",
    officer,
    networkId: (network?.id as number | undefined) ?? null,
  };
}

function termHasEnded(officer: OfficerRow | null) {
  if (!officer?.term_ends_at) return false;
  return new Date(officer.term_ends_at).getTime() <= Date.now();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("consul");
  const loaded = await loadOutpost(id);
  if (!loaded) return {};

  const heading = t("heading", {
    principal: loaded.principalName,
    host: loaded.hostName,
  });
  const name = loaded.officer?.profile ? getDisplayName(loaded.officer.profile) : null;

  return shareMetadata({
    title: name ? `${name} — ${t("role")}` : heading,
    description: previewText(
      name
        ? t("metaDescription", {
            name,
            principal: loaded.principalName,
            host: loaded.hostName,
          })
        : t("vacant"),
    ),
    path: `/outposts/${id}`,
  });
}

export default async function OutpostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const t = await getTranslations("consul");
  const loaded = await loadOutpost(id);
  if (!loaded) notFound();

  const { outpost, principalName, hostName, officer, networkId } = loaded;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ended = termHasEnded(officer);
  // Matching update_outpost_page's own condition: an expired term loses
  // the page with it, so the form must not be offered either.
  const canEdit = Boolean(user && officer && officer.user_id === user.id && !ended);
  const name = officer?.profile ? getDisplayName(officer.profile) : null;
  const hasContent = Boolean(outpost.about || outpost.contact || outpost.website);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-1">
        <Link href="/outposts" className="text-sm text-muted underline hover:text-primary">
          ← {t("backToOutposts")}
        </Link>
        <h1 className="font-display text-[1.75rem] leading-tight text-balance text-ink">
          {t("heading", { principal: principalName, host: hostName })}
        </h1>
        {name ? (
          <p className="text-body">
            {t("role")}: <span className="font-medium text-ink">{name}</span>
          </p>
        ) : (
          <p className="text-body">{t("vacant")}</p>
        )}
      </div>

      {error && <FormError>{error}</FormError>}
      {saved && (
        <p className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">{t("saved")}</p>
      )}

      {/* A closed mission has no consul but does have a history, which is
          the only thing on its page worth reading. The directory shows
          this note; the outpost's own page was dropping it. */}
      {outpost.heritage_note && (
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">{t("historyHeading")}</p>
          <p className="text-body">{outpost.heritage_note}</p>
        </section>
      )}

      {officer && (
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="text-muted">
            {t("servingSince")} <LocalDateTime iso={officer.appointed_at} />
          </p>
          {officer.term_ends_at && (
            <p className="text-muted">
              {t("termEnds")} <LocalDateTime iso={officer.term_ends_at} />
            </p>
          )}
          {/* A mandate that quietly never expires is the thing the
              election was supposed to prevent, so an expired term says so
              rather than going silently blank. */}
          {ended && <p className="pt-1 text-ink">{t("termEnded")}</p>}
          {officer.election_id && (
            <Link
              href={`/outposts/elections/${officer.election_id}`}
              className="pt-1 text-primary underline"
            >
              {t("electionLink")}
            </Link>
          )}
        </section>
      )}

      {hasContent ? (
        <div className="flex flex-col gap-6">
          {outpost.about && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-ink">{t("aboutHeading")}</h2>
              <p className="whitespace-pre-line text-body">{outpost.about}</p>
            </section>
          )}
          {outpost.contact && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-ink">{t("contactHeading")}</h2>
              <p className="whitespace-pre-line text-body">{outpost.contact}</p>
            </section>
          )}
          {outpost.website && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-ink">{t("websiteHeading")}</h2>
              {/* noopener/noreferrer and nofollow: this URL is written by
                  a community member, not by us. */}
              <a
                href={outpost.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-primary underline"
              >
                {outpost.website}
              </a>
            </section>
          )}
          {outpost.page_updated_at && (
            <p className="text-xs text-muted">
              {t("lastUpdated")} <LocalDateTime iso={outpost.page_updated_at} />
            </p>
          )}
        </div>
      ) : (
        officer && <p className="text-sm text-muted">{t("nothingYet")}</p>
      )}

      {canEdit && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-lg font-medium text-ink">{t("editHeading")}</h2>
          <p className="text-sm text-body">{t("editIntro")}</p>
          <form action={saveConsulPage} className="flex flex-col gap-3">
            <input type="hidden" name="outpostId" value={outpost.id} />
            <Field>
              <Label htmlFor="about">{t("aboutLabel")}</Label>
              <Textarea
                id="about"
                name="about"
                rows={5}
                defaultValue={outpost.about ?? ""}
                placeholder={t("aboutPlaceholder")}
              />
            </Field>
            <Field>
              <Label htmlFor="contact">{t("contactLabel")}</Label>
              <Textarea
                id="contact"
                name="contact"
                rows={3}
                defaultValue={outpost.contact ?? ""}
                placeholder={t("contactPlaceholder")}
              />
            </Field>
            <Field>
              <Label htmlFor="website">{t("websiteLabel")}</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={outpost.website ?? ""}
                placeholder="https://"
              />
            </Field>
            <SubmitButton className="self-start">{t("save")}</SubmitButton>
          </form>
        </section>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {networkId && (
          <Link href={`/networks/${networkId}`} className="text-primary underline">
            {t("networkLink")}
          </Link>
        )}
        {name && (
          <ShareLink path={`/outposts/${outpost.id}`} title={`${name} — ${t("role")}`} />
        )}
        {/* On every view, not only the flattering ones. */}
        <p className="text-sm text-muted">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
