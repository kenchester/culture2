import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import type { CorridorContext } from "@/lib/corridor-context";
import type { Locale } from "@/lib/locale";
import { approximateFlightHours, kmToMiles } from "@/lib/distance";

/**
 * The reference layer for a corridor, rendered above the feed while the
 * network is still empty and below it once a community exists.
 *
 * Nothing here is ever removed - a corridor's population, its consular
 * situation and its sister-city status stay true and stay useful after
 * people arrive. What changes is only whether it comes before or after
 * the conversation, because a member wants the feed and a stranger who
 * arrived from a search engine wants to know what this place is.
 */
export async function CorridorContextBlock({
  context,
  cityPlaceId,
  isEmpty,
  heading,
  directionLabel,
}: {
  context: CorridorContext;
  cityPlaceId: number;
  /** Drives the invitation line only; the content is identical either way. */
  isEmpty: boolean;
  /** "About this network" on a network page, "About this corridor" on a
   *  corridor page - the same facts, a different thing being described. */
  heading: string;
  /** Shown on the corridor page, where both directions appear and the
   *  facts are meaningless without knowing which way round they are. */
  directionLabel?: string;
}) {
  const t = await getTranslations("corridor");
  const locale = (await getLocale()) as Locale;
  const people = context.people?.toLocaleString(locale) ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-xs uppercase tracking-wide text-muted">{heading}</h2>
      {directionLabel && <p className="font-medium text-ink">{directionLabel}</p>}

      <dl className="flex flex-col gap-3">
        {people && (
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-muted">{t("bornLabel")}</dt>
            {/* Country first, then the count. The other way round read as
                "366,301 Fujianese" on a Fujian corridor, when the figure
                is for China. The country is data, not copy, so there is
                no preposition to get wrong in any language. */}
            <dd className="text-ink">{context.countryName}</dd>
            <dd className="text-2xl text-ink tabular-nums">{people}</dd>
            {/* Said plainly wherever the corridor is narrower than the
                statistic, because the number is otherwise read as a
                measure of this community rather than of the country it
                sits inside. */}
            {context.subNationalOrigin && (
              <dd className="text-sm text-muted">
                {t("notCountedSeparately", { origin: context.subNationalOrigin })}
              </dd>
            )}
            {context.peopleSource && (
              <dd className="text-xs text-muted">
                {t("censusSource", {
                  source: context.peopleSource,
                  period: context.peoplePeriod ?? "",
                })}
              </dd>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">{t("consulateLabel")}</dt>
            <dd className="text-ink">
              {context.consulate ? (
                context.consulate.website ? (
                  <a
                    href={context.consulate.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary underline"
                    title={t("consulateLink")}
                  >
                    {context.consulate.missionType ?? t("consulatePresent")}
                  </a>
                ) : (
                  (context.consulate.missionType ?? t("consulatePresent"))
                )
              ) : (
                <span className="text-muted">
                  {context.consulateDataLoaded ? t("consulateNone") : t("consulateUnknown")}
                </span>
              )}
            </dd>
          </div>

          {context.distanceKm !== null && !directionLabel && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted">{t("distanceLabel")}</dt>
              <dd className="text-ink tabular-nums">
                {t("distanceValue", {
                  km: context.distanceKm.toLocaleString(locale),
                  miles: kmToMiles(context.distanceKm).toLocaleString(locale),
                })}
              </dd>
              {/* Air time from the distance, not an itinerary: it ignores
                  winds, routing and any connection, so it is a floor
                  rather than a prediction. */}
              <dd className="text-ink tabular-nums">
                <span className="text-sm text-muted">{t("flightLabel")}</span>{" "}
                {t("flightValue", { hours: approximateFlightHours(context.distanceKm) })}
              </dd>
              <dd className="text-xs text-muted">{t("flightCaveat")}</dd>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted">{t("twinnedLabel")}</dt>
            {/* Naming the pair rather than saying "yes": the fact is
                which two cities are twinned, and a bare yes was what let
                a country-level match pass as a city-level one. */}
            <dd className={context.twinning ? "text-ink" : "text-muted"}>
              {context.twinning
                ? `${context.twinning.cityName} ↔ ${context.twinning.partnerName}`
                : t("twinnedNo")}
            </dd>
          </div>
        </div>
      </dl>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {isEmpty && <p className="text-sm text-muted">{t("beFirst")}</p>}
        <Link href={`/cities/${cityPlaceId}`} className="text-sm text-primary underline">
          {t("cityLink", { city: context.cityName })}
        </Link>
      </div>
    </section>
  );
}
