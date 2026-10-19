import { getLocale, getTranslations } from "next-intl/server";
import { approximateFlightHours, kmToMiles, type Spread } from "@/lib/distance";
import type { Locale } from "@/lib/locale";

/**
 * Distance across a corridor, exact when both ends are cities and a range
 * when either is a region.
 *
 * The range names the two cities it was measured between rather than
 * offering a single number from a region's geographic centroid, which is
 * a point where nobody necessarily lives. Nearest and farthest need no
 * population ranking - which this database does not have - and the width
 * of the spread is itself how rough the estimate is.
 */
export async function DistanceFacts({ distance }: { distance: Spread }) {
  const t = await getTranslations("corridor");
  const locale = (await getLocale()) as Locale;
  const value = (km: number) =>
    t("distanceValue", {
      km: km.toLocaleString(locale),
      miles: kmToMiles(km).toLocaleString(locale),
    });

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted">{t("distanceLabel")}</dt>
      {distance.isRange ? (
        <>
          <dd className="text-ink tabular-nums">
            <span className="text-sm text-muted">{t("nearestLabel")}</span>{" "}
            {distance.nearestFrom} — {value(distance.nearestKm)}
          </dd>
          <dd className="text-ink tabular-nums">
            <span className="text-sm text-muted">{t("farthestLabel")}</span>{" "}
            {distance.farthestFrom} — {value(distance.farthestKm)}
          </dd>
          <dd className="text-xs text-muted">{t("spreadNote")}</dd>
        </>
      ) : (
        <dd className="text-ink tabular-nums">{value(distance.nearestKm)}</dd>
      )}
      <dd className="text-ink tabular-nums">
        <span className="text-sm text-muted">{t("flightLabel")}</span>{" "}
        {t("flightValue", { hours: approximateFlightHours(distance.nearestKm) })}
      </dd>
      <dd className="text-xs text-muted">{t("flightCaveat")}</dd>
    </div>
  );
}
