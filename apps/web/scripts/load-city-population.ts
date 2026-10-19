// Population for cities, from GeoNames.
//
// Serves one purpose: ranking the cities inside a region or country, so a
// corridor page can measure distance from the places people actually live
// rather than from a geographic centroid.
//
// Matching is deliberately strict - exact normalised name within 50km of
// the place's own coordinates. 93% of cities match; the misses are
// transliteration variants of small towns (Al Fujayrah, Umm al Qaywayn),
// none of which any corridor would be measured from. A loose match would
// silently attach the wrong population to the right name, which is worse
// than no population at all.
//
// Source: https://download.geonames.org/export/dump/cities15000.zip (CC BY 4.0)
//
// Run: npm run load-city-population -- --prod
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { adminClient } from "./lib/admin";

const SOURCE = "https://download.geonames.org/export/dump/cities15000.zip";

const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
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

type Candidate = { name: string; lat: number; lng: number; population: number };

function loadGeonames(): Map<string, Candidate[]> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "geonames-"));
  const zip = path.join(dir, "cities15000.zip");
  execFileSync("curl", ["-sSL", "-o", zip, SOURCE]);
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  const text = fs.readFileSync(path.join(dir, "cities15000.txt"), "utf8");
  fs.rmSync(dir, { recursive: true, force: true });

  // Bucketed by whole degree, so a lookup only scans its own
  // neighbourhood rather than all 34,000 rows.
  const grid = new Map<string, Candidate[]>();
  for (const line of text.split("\n")) {
    const f = line.split("\t");
    if (f.length < 15) continue;
    const lat = Number(f[4]);
    const lng = Number(f[5]);
    const population = Number(f[14]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !population) continue;
    const key = `${Math.round(lat)}:${Math.round(lng)}`;
    const bucket = grid.get(key) ?? [];
    // Both the official name and the ascii form, since this dataset's
    // names come from a mixture of sources.
    for (const name of new Set([normalise(f[1]), normalise(f[2])])) {
      bucket.push({ name, lat, lng, population });
    }
    grid.set(key, bucket);
  }
  return grid;
}

async function main() {
  const admin = adminClient();
  console.log("downloading GeoNames...");
  const grid = loadGeonames();

  let scanned = 0;
  let matched = 0;
  const updates: { id: number; population: number }[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("places")
      .select("id, name, lat, lng")
      .eq("type", "city")
      .not("lat", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const place of data) {
      scanned++;
      const target = normalise(place.name as string);
      const lat = place.lat as number;
      const lng = place.lng as number;
      let best: number | null = null;
      for (let dLat = -1; dLat <= 1; dLat++) {
        for (let dLng = -1; dLng <= 1; dLng++) {
          for (const candidate of grid.get(`${Math.round(lat) + dLat}:${Math.round(lng) + dLng}`) ?? []) {
            if (candidate.name !== target) continue;
            if (km([lat, lng], [candidate.lat, candidate.lng]) > 50) continue;
            // Same name within 50km more than once means a city and its
            // suburb share a name; the larger figure is the city.
            best = Math.max(best ?? 0, candidate.population);
          }
        }
      }
      if (best !== null) {
        matched++;
        updates.push({ id: place.id as number, population: best });
      }
    }
    if (data.length < 1000) break;
  }

  console.log(`matched ${matched} of ${scanned} cities (${((100 * matched) / scanned).toFixed(1)}%)`);

  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    await Promise.all(
      chunk.map((u) => admin.from("places").update({ population: u.population }).eq("id", u.id)),
    );
    console.log(`  written ${Math.min(i + 500, updates.length)}/${updates.length}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
