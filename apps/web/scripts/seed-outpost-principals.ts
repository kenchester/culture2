// Seeds the outpost directory from geography that already has diaspora on
// the site: every origin place used by a network becomes a principal.
//
// Idempotent - re-running adds only what is new. Creates no outposts; the
// directory's first job is to show where representation is ABSENT, and
// inventing missions would defeat that.
//
// Run: npx tsx scripts/seed-outpost-principals.ts
import { adminClient } from "./lib/admin";

const PLACE_KIND: Record<string, string> = { country: "country", region: "region", city: "city" };

async function main() {
  const admin = adminClient();

  const { data: networks, error } = await admin
    .from("networks")
    .select("origin_place_id")
    .not("origin_place_id", "is", null);
  if (error) throw new Error(error.message);

  const originIds = [...new Set((networks ?? []).map((n) => n.origin_place_id as number))];
  // hidden_from_search is the one switch for "this place shouldn't
  // surface", and it covers test geographies as well as organisation
  // anchors. Without this filter the script mints principals for places
  // the directory then has to filter back out - Antarctica's test
  // networks produced exactly that.
  const { data: places } = await admin
    .from("places")
    .select("id, name, type")
    .in("id", originIds)
    .eq("hidden_from_search", false);

  const { data: existing } = await admin.from("principals").select("place_id");
  const have = new Set((existing ?? []).map((p) => p.place_id as number));

  const rows = (places ?? [])
    .filter((p) => !have.has(p.id as number) && PLACE_KIND[p.type as string])
    .map((p) => ({
      kind: PLACE_KIND[p.type as string],
      name: p.name as string,
      place_id: p.id as number,
    }));

  if (rows.length === 0) {
    console.log(`nothing to add - ${have.size} principal(s) already present`);
  } else {
    const { error: insErr } = await admin.from("principals").insert(rows);
    if (insErr) throw new Error(insErr.message);
    console.log(`added ${rows.length} principal(s): ${rows.map((r) => r.name).join(", ")}`);
  }

  // One historical outpost, so the directory shows what a closed mission
  // looks like and the heritage angle is visible from day one. Chosen
  // because it is documented and still standing: the former US consulate
  // on Gulangyu, Xiamen - a treaty-port post whose work was commercial
  // representation, not migration.
  const { data: usa } = await admin.from("places").select("id").eq("type", "country").eq("name", "United States").maybeSingle();
  const { data: xiamen } = await admin.from("places").select("id").eq("name", "Xiamen").eq("type", "city").maybeSingle();
  if (!usa || !xiamen) {
    console.log("skipped the Gulangyu entry - United States or Xiamen not found in places");
    return;
  }

  let { data: usPrincipal } = await admin.from("principals").select("id").eq("place_id", usa.id).maybeSingle();
  if (!usPrincipal) {
    const { data: created, error: pErr } = await admin
      .from("principals")
      .insert({ kind: "country", name: "United States", place_id: usa.id })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    usPrincipal = created;
  }

  const { data: already } = await admin
    .from("outposts")
    .select("id")
    .eq("principal_id", usPrincipal!.id)
    .eq("host_place_id", xiamen.id)
    .maybeSingle();
  if (already) {
    console.log("Gulangyu entry already present");
    return;
  }

  const { error: oErr } = await admin.from("outposts").insert({
    principal_id: usPrincipal!.id,
    host_place_id: xiamen.id,
    kind: "consulate",
    status: "historical",
    heritage_note:
      "The former United States consulate on Gulangyu island, Xiamen. A treaty-port post: its work was " +
      "representing American commercial interests in and around Xiamen. The building still stands and is " +
      "part of the Gulangyu UNESCO World Heritage site.",
  });
  if (oErr) throw new Error(oErr.message);
  console.log("added the historical Gulangyu outpost");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
