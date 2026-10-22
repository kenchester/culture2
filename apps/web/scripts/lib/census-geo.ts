// US cities resolved to census geo ids, shared by every ACS loader.
//
// Extracted from load-census-origins.ts when a second loader
// (load-language-census.ts, ACS table B16001) needed exactly the same
// list. Two copies of a name-and-proximity match against a 30,000-row
// gazetteer would be two chances to drift apart, and the failure mode of
// drift is the quiet one: two tables on the same page, each about a
// slightly different set of cities.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

// Census geo ids are 16000US + state FIPS + place FIPS. Rather than
// hand-looking those up, they are resolved from the Census Bureau's own
// gazetteer, matched against each place's name and coordinates - the same
// shape of match used for GeoNames population, and for the same reason:
// a wrong code silently attaches the right name to another city's
// statistics.
const GAZETTEER =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip";

// Census Reporter rejects requests with no User-Agent (403), and
// identifying the caller is polite against a free nonprofit API.
export const CENSUS_REPORTER_UA =
  "CultureMesh/1.0 (city pages; https://www.culturemesh.com)";

// How large a US city has to be before it gets a page. Low enough to
// cover the places diasporas actually settle, high enough that the
// loader is not fetching a thousand census tables for villages.
export const MIN_POPULATION = 250_000;

export const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /\b(city|town|village|cdp|municipality|borough|urban county|consolidated government|metro government|metropolitan government)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");

function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type GazRow = { geoid: string; name: string; lat: number; lng: number };

/**
 * The gazetteer, cached on disk.
 *
 * CENSUS_GAZETTEER_DIR points at a directory already holding the
 * extracted .txt, which both avoids a 10MB download per run and lets the
 * loader work where the download is unavailable.
 */
function loadGazetteer(): GazRow[] {
  const cacheDir =
    process.env.CENSUS_GAZETTEER_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), "gaz-"));
  fs.mkdirSync(cacheDir, { recursive: true });
  let file = fs.readdirSync(cacheDir).find((f) => f.endsWith(".txt"));
  if (!file) {
    const zip = path.join(cacheDir, "gaz.zip");
    execFileSync("curl", ["-sSL", "-o", zip, GAZETTEER]);
    execFileSync("unzip", ["-o", "-q", zip, "-d", cacheDir]);
    file = fs.readdirSync(cacheDir).find((f) => f.endsWith(".txt"))!;
  }
  const text = fs.readFileSync(path.join(cacheDir, file), "utf8");

  const rows: GazRow[] = [];
  for (const line of text.split("\n").slice(1)) {
    const f = line.split("\t");
    if (f.length < 12) continue;
    const lat = Number(f[10]);
    const lng = Number(f[11]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    rows.push({ geoid: f[1].trim(), name: normalise(f[3]), lat, lng });
  }
  return rows;
}

export type ResolvedCity = { placeId: number; name: string; geoId: string };

/**
 * The US cities worth a page, resolved to census geo ids.
 *
 * A city qualifies on population rather than on being hand-listed, and
 * its FIPS code is matched by name and proximity - so this list grows by
 * changing a threshold rather than by looking codes up one at a time.
 */
export async function resolveCities(admin: SupabaseClient): Promise<ResolvedCity[]> {
  const gazetteer = loadGazetteer();

  const { data: us } = await admin
    .from("places")
    .select("id")
    .eq("type", "country")
    .eq("iso_code", "US")
    .single();
  const { data: states } = await admin
    .from("places")
    .select("id")
    .eq("parent_id", us!.id)
    .eq("type", "region");

  const { data: cities } = await admin
    .from("places")
    .select("id, name, lat, lng, population")
    .in("parent_id", (states ?? []).map((s) => s.id))
    .eq("type", "city")
    .gte("population", MIN_POPULATION)
    .not("lat", "is", null)
    .order("population", { ascending: false });

  const resolved: ResolvedCity[] = [];
  const unresolved: string[] = [];
  for (const city of cities ?? []) {
    const target = normalise(city.name as string);
    const lat = city.lat as number;
    const lng = city.lng as number;
    let best: GazRow | null = null;
    let bestKm = Infinity;
    for (const row of gazetteer) {
      if (row.name !== target) continue;
      const d = km([lat, lng], [row.lat, row.lng]);
      // 40km: a city's gazetteer centroid and ours can differ, but not
      // by more than the city is wide.
      if (d > 40 || d >= bestKm) continue;
      best = row;
      bestKm = d;
    }
    if (best) {
      resolved.push({
        placeId: city.id as number,
        name: city.name as string,
        geoId: `16000US${best.geoid}`,
      });
    } else {
      unresolved.push(city.name as string);
    }
  }
  console.log(`resolved ${resolved.length} US cities over ${MIN_POPULATION.toLocaleString()}`);
  if (unresolved.length) {
    console.log(
      `  no census place matched (boroughs and neighbourhoods mostly): ${unresolved.join(", ")}`,
    );
  }
  return resolved;
}
