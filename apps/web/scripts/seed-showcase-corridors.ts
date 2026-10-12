// Real diaspora corridors for the cities the city pages are built around.
//
// Every one of these is a corridor that genuinely exists - Fuzhounese in
// New York, Nigerians and Vietnamese in Houston, the Hokkien diaspora out
// of Xiamen into Singapore and Manila. Nothing invented, so a page built
// on them shows a true shape rather than a demo.
//
// Members are deliberately NOT seeded. A network with nobody in it is the
// honest state of a corridor nobody has joined yet, and the city page is
// designed to show that as an invitation rather than hide it. Fabricating
// members would make the page a lie in exactly the place it needs to be
// trusted.
//
// Idempotent: existence is checked on (origin, location), so re-running
// adds only what is missing.
//
// Run: npx tsx scripts/seed-showcase-corridors.ts
import { adminClient } from "./lib/admin";

const NEW_YORK_CITY = 25760;
const HOUSTON = 24835;
const XIAMEN = 7252;
// There are two Londons in places; 11645 is the one under England (1259).
const LONDON_ENGLAND = 11645;

const CORRIDORS: { origin: number; location: number; why: string }[] = [
  // New York City, incoming. The Dominican Republic is the city's largest
  // single country of birth; Fujian is the sub-national origin that
  // "China" erases - Fuzhounese New York is its own world.
  { origin: 61, location: NEW_YORK_CITY, why: "Dominican Republic -> New York City" },
  { origin: 841, location: NEW_YORK_CITY, why: "Fujian -> New York City" },

  // New York City, outgoing. A city is also somewhere people leave.
  { origin: NEW_YORK_CITY, location: LONDON_ENGLAND, why: "New York City -> London" },

  // Houston, incoming. Houston has the largest Nigerian community in the
  // United States, and one of the largest Vietnamese ones.
  { origin: 164, location: HOUSTON, why: "Nigeria -> Houston" },
  { origin: 241, location: HOUSTON, why: "Vietnam -> Houston" },
  { origin: 210, location: HOUSTON, why: "El Salvador -> Houston" },

  // Xiamen, outgoing. Southern Fujian is where the Hokkien diaspora left
  // from, and Singapore and Manila are where a great deal of it went.
  { origin: XIAMEN, location: 198, why: "Xiamen -> Singapore" },
  { origin: XIAMEN, location: 19754, why: "Xiamen -> Manila" },
];

async function main() {
  const admin = adminClient();

  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .single();
  if (ownerError || !owner) throw new Error(`no admin profile to launch as: ${ownerError?.message}`);

  const placeIds = [...new Set(CORRIDORS.flatMap((c) => [c.origin, c.location]))];
  const { data: places } = await admin.from("places").select("id, name").in("id", placeIds);
  const nameOf = new Map((places ?? []).map((p) => [p.id as number, p.name as string]));

  for (const corridor of CORRIDORS) {
    const originName = nameOf.get(corridor.origin);
    const locationName = nameOf.get(corridor.location);
    if (!originName || !locationName) {
      console.log(`SKIP ${corridor.why}: a place is missing`);
      continue;
    }

    const { data: existing } = await admin
      .from("networks")
      .select("id, title")
      .eq("origin_place_id", corridor.origin)
      .eq("location_place_id", corridor.location)
      .maybeSingle();
    if (existing) {
      console.log(`have  ${existing.id}  ${existing.title}`);
      continue;
    }

    // Matches the stored-title convention the rest of the data uses.
    const title = `People from ${originName} in ${locationName}`;
    const { data: created, error } = await admin
      .from("networks")
      .insert({
        origin_place_id: corridor.origin,
        location_place_id: corridor.location,
        title,
        launched_by: owner.id,
      })
      .select("id, title")
      .single();
    if (error) {
      console.log(`FAIL  ${corridor.why}: ${error.message}`);
      continue;
    }
    console.log(`added ${created.id}  ${created.title}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
