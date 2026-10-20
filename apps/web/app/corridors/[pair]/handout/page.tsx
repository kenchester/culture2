import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { corridorIdsFromSlug, corridorSlug } from "@/lib/slug";
import { getCorridorContext } from "@/lib/corridor-context";
import { getSiteUrl } from "@/lib/site-url";
import { recordPageView, viewPath } from "@/lib/page-views";
import { approximateFlightHours, kmToMiles } from "@/lib/distance";
import type { Locale } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Printable page — CultureMesh",
  robots: { index: false, follow: false },
};

/**
 * A corridor on one sheet of paper.
 *
 * The distribution channel for this product is physical: a caseworker
 * hands something over, an association pins it to a noticeboard, someone
 * puts it on a table at a festival. Several of the people it is for have
 * no email address yet and reach the web through a phone camera, which
 * is why the QR code is the largest thing on the page.
 *
 * Rendered as a normal page with print styles rather than a generated
 * PDF: no toolchain, it works from any browser's print dialogue, and the
 * same URL is readable on screen if someone opens it instead.
 */
export default async function CorridorHandout({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await params;
  const ids = corridorIdsFromSlug(pair);
  if (!ids) notFound();
  const [lowId, highId] = ids;

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("handout");
  const tc = await getTranslations("corridor");
  const tq = await getTranslations("corridorQuestions");
  const supabase = await createClient();

  const { data: places } = await supabase
    .from("places")
    .select("id, name, hidden_from_search")
    .in("id", [lowId, highId]);
  const low = (places ?? []).find((p) => p.id === lowId);
  const high = (places ?? []).find((p) => p.id === highId);
  if (!low || !high || low.hidden_from_search || high.hidden_from_search) notFound();

  const a = { id: lowId, name: low.name as string };
  const b = { id: highId, name: high.name as string };
  recordPageView(viewPath("/handout", corridorSlug(a, b)));

  const [context, questions, siteUrl] = await Promise.all([
    getCorridorContext(
      supabase,
      { origin_place_id: lowId, location_place_id: highId },
      { allowEmpty: true },
    ),
    supabase.from("corridor_questions").select("key").order("sort_order"),
    getSiteUrl(),
  ]);

  const url = `${siteUrl}/corridors/${corridorSlug(a, b)}`;
  // Inlined as an SVG string: no external image request, so it survives
  // being printed from a machine that is offline.
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 220 });

  const legs = context?.distanceLegs ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 print:max-w-none print:py-0">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <h1 className="font-display text-3xl leading-tight text-balance text-ink">
          {a.name} ↔ {b.name}
        </h1>
        <p className="text-body">{tc("headingCorridor")}</p>
      </header>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex flex-col items-center gap-2">
          {/* The largest thing on the sheet, because a phone camera is
              how most of its readers will arrive. */}
          <div className="w-[180px]" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="max-w-[180px] text-center text-xs text-muted">{t("scanPrompt")}</p>
          <p className="max-w-[200px] break-all text-center text-[10px] text-muted">{url}</p>
        </div>

        <dl className="flex min-w-[14rem] flex-1 flex-col gap-3 text-sm">
          <h2 className="text-xs uppercase tracking-wide text-muted">{t("factsHeading")}</h2>
          {context?.people != null && (
            <div>
              <dt className="text-muted">{tc("bornLabel")}</dt>
              <dd className="text-ink">
                {context.countryName} — {context.people.toLocaleString(locale)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">{tc("consulateLabel")}</dt>
            <dd className="text-ink">
              {context?.consulate
                ? (context.consulate.missionType ?? tc("consulatePresent"))
                : context?.consulateDataLoaded
                  ? tc("consulateNone")
                  : tc("consulateUnknown")}
            </dd>
          </div>
          {legs.length > 0 && (
            <div>
              <dt className="text-muted">{tc("distanceLabel")}</dt>
              <dd className="text-ink">
                {legs[0].km.toLocaleString(locale)} km / {kmToMiles(legs[0].km).toLocaleString(locale)} mi
                {" · "}
                {tc("flightValue", { hours: approximateFlightHours(legs[0].km) })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">{tc("twinnedLabel")}</dt>
            <dd className="text-ink">
              {context?.twinning
                ? `${context.twinning.cityName} ↔ ${context.twinning.partnerName}`
                : tc("twinnedNo")}
            </dd>
          </div>
        </dl>
      </div>

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 className="text-xs uppercase tracking-wide text-muted">{t("questionsHeading")}</h2>
        <ul className="flex flex-col gap-1 text-sm text-body">
          {(questions.data ?? []).map((q) => (
            <li key={q.key as string}>· {tq(`question.${q.key as string}`)}</li>
          ))}
        </ul>
      </section>

      <p className="border-t border-border pt-4 text-xs text-muted">{t("footer")}</p>
    </div>
  );
}
