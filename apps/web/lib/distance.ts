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

/**
 * Rounds a centroid-derived figure to a confidence it can actually
 * support.
 *
 * Region rows carry geographic centroids, not cities: Texas sits at
 * farmland near Brady, 420km from Houston, and Michigan's is woods near
 * Cadillac. Reporting "1,743 km" from a point that far from where anyone
 * lives is false precision, so any distance involving a non-city end is
 * reported to the nearest hundred kilometres.
 */
export function roundToConfidence(km: number): number {
  return Math.round(km / 100) * 100;
}

export type Point = { name: string; lat: number | null; lng: number | null };

export type Spread = {
  nearestKm: number;
  farthestKm: number;
  /** The actual places the two figures were measured between. */
  nearestFrom: string;
  nearestTo: string;
  farthestFrom: string;
  farthestTo: string;
  /** False when both ends were single cities and the figure is exact. */
  isRange: boolean;
};

/**
 * The shortest and longest real city-to-city distance across a corridor.
 *
 * A region has no single location. Its stored coordinate is a geographic
 * centroid - Texas sits in farmland 420km from Houston, Michigan's is
 * woods near Cadillac - so measuring from it reports a precise number
 * from a point where nobody lives.
 *
 * Picking "a few representative cities" instead would need a population
 * ranking this database does not have, and any other choice (alphabetical,
 * insertion order) is arbitrary dressed as authoritative. Nearest and
 * farthest need no ranking, name real places, and the width of the spread
 * is itself the answer to how rough the estimate is.
 */
export function distanceSpread(from: Point[], to: Point[]): Spread | null {
  let nearest: Spread | null = null;
  let farthestKm = -1;
  let farthestFrom = "";
  let farthestTo = "";

  for (const a of from) {
    for (const b of to) {
      const km = greatCircleKm(a, b);
      if (km === null) continue;
      if (nearest === null || km < nearest.nearestKm) {
        nearest = {
          nearestKm: km,
          farthestKm: km,
          nearestFrom: a.name,
          nearestTo: b.name,
          farthestFrom: a.name,
          farthestTo: b.name,
          isRange: false,
        };
      }
      if (km > farthestKm) {
        farthestKm = km;
        farthestFrom = a.name;
        farthestTo = b.name;
      }
    }
  }
  if (nearest === null) return null;

  return {
    ...nearest,
    farthestKm,
    farthestFrom,
    farthestTo,
    // One pair means both ends were single cities: an exact measurement,
    // not a range.
    isRange: from.length * to.length > 1 && farthestKm !== nearest.nearestKm,
  };
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
