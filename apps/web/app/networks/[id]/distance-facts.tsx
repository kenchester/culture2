import { getLocale, getTranslations } from "next-intl/server";
import { approximateFlightHours, kmToMiles, type Leg } from "@/lib/distance";
import type { Locale } from "@/lib/locale";

/**
 * Distance across a corridor, measured between real cities.
 *
 * A single figure only exists when both ends are cities. Otherwise each
 * row is the distance from one of the origin's largest cities to the
 * destination's largest, because a region or country has no single
 * location and its stored coordinate is a geographic centroid - a point
 * that is precise and uninhabited.
 */
export async function DistanceFacts({ legs }: { legs: Leg[] }) {
  const t = await getTranslations("corridor");
  const locale = (await getLocale()) as Locale;
  if (legs.length === 0) return null;

  const value = (km: number) =>
    t("distanceValue", {
      km: km.toLocaleString(locale),
      miles: kmToMiles(km).toLocaleString(locale),
    });

  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted">{t("distanceLabel")}</dt>
      {legs.length === 1 ? (
        <dd className="text-ink tabular-nums">{value(legs[0].km)}</dd>
      ) : (
        <>
          {legs.map((leg) => (
            <dd key={leg.from} className="text-ink tabular-nums">
              <span className="text-sm text-muted">{leg.from} → {leg.to}</span>{" "}
              {value(leg.km)}
            </dd>
          ))}
          <dd className="text-xs text-muted">{t("spreadNote")}</dd>
        </>
      )}
      <dd className="text-ink tabular-nums">
        <span className="text-sm text-muted">{t("flightLabel")}</span>{" "}
        {t("flightValue", { hours: approximateFlightHours(legs[0].km) })}
      </dd>
      <dd className="text-xs text-muted">{t("flightCaveat")}</dd>
    </div>
  );
}
