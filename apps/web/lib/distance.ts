/**
 * Great-circle distance between two places, and a rough flight time.
 *
 * Deliberately the only travel fact on a corridor page. Prices need a
 * commercial API and change daily; the free route datasets are a 2014
 * snapshot and would present pre-pandemic airline networks as current.
 * Distance is derived from coordinates this database already holds, is
 * correct today, and will still be correct in ten years.
 *
 * No "server-only" so it can be tested directly.
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Null when either place lacks coordinates - countries mostly do. */
export function greatCircleKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;

  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)));
}

export function kmToMiles(km: number): number {
  return Math.round(km * 0.621371);
}

/**
 * Hours in the air, to the nearest half hour.
 *
 * An estimate, labelled as one on the page: great-circle distance at a
 * typical cruising speed plus taxi and climb. It ignores winds, routing
 * around airspace and any connection, so it is a floor rather than a
 * prediction - which is the honest shape for a number nobody should book
 * a connection against.
 */
export function approximateFlightHours(km: number): number {
  const CRUISE_KMH = 800;
  const GROUND_AND_CLIMB_HOURS = 0.75;
  return Math.round((km / CRUISE_KMH + GROUND_AND_CLIMB_HOURS) * 2) / 2;
}
