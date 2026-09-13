// Creates a throwaway network under Acme University with 100 trivial posts,
// purely so infinite scroll has something to scroll through. Idempotent:
// re-running tops the network back up to 100 rather than creating a second
// one or duplicating posts.
//
// Deliberately NOT added to organization_languages. That table is what the
// school page (app/learn/[slug]/page.tsx) lists, so staying out of it keeps
// this off the Acme demo page - and also leaves it ungated by
// 00000000000078, which is what we want for a scroll fixture.
//
// Run: npx tsx scripts/seed-scroll-test-network.ts
process.loadEnvFile(".env.local");
import { createClient } from "@supabase/supabase-js";

const ACME_CAMPUS_PLACE_ID = 27497;
const TITLE = "Scroll test (Acme University)";
const TARGET_POSTS = 100;

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  const { data: owner, error: ownerErr } = await admin
    .from("profiles").select("id, first_name, last_name").eq("is_admin", true).limit(1).single();
  if (ownerErr || !owner) throw new Error(`no admin profile to own the posts: ${ownerErr?.message}`);

  // Any language works; English keeps the purity check irrelevant.
  const { data: lang } = await admin.from("languages").select("id, name").eq("name", "English").single();
  if (!lang) throw new Error("no English language row");

  let { data: network } = await admin
    .from("networks").select("id, title, post_count")
    .eq("location_place_id", ACME_CAMPUS_PLACE_ID).eq("language_id", lang.id).maybeSingle();

  if (!network) {
    const { data: created, error } = await admin.from("networks").insert({
      language_id: lang.id,
      location_place_id: ACME_CAMPUS_PLACE_ID,
      title: TITLE,
      launched_by: owner.id,
    }).select("id, title, post_count").single();
    if (error) throw new Error(`create network: ${error.message}`);
    network = created;
    console.log(`created network ${network.id} "${network.title}"`);
  } else {
    console.log(`reusing network ${network.id} "${network.title}" (${network.post_count} posts)`);
  }

  await admin.from("network_members").upsert(
    { network_id: network.id, user_id: owner.id },
    { onConflict: "network_id,user_id", ignoreDuplicates: true },
  );

  const { count: existing } = await admin
    .from("posts").select("id", { count: "exact", head: true }).eq("network_id", network.id);
  const needed = TARGET_POSTS - (existing ?? 0);
  if (needed <= 0) {
    console.log(`already has ${existing} posts; nothing to add.`);
    return;
  }

  // Spread created_at so the keyset cursor has distinct timestamps to walk,
  // and so the feed reads like a real one rather than 100 rows sharing a
  // millisecond.
  const start = Date.now() - needed * 60_000;
  const rows = Array.from({ length: needed }, (_, i) => ({
    network_id: network!.id,
    user_id: owner.id,
    body: `Test post ${(existing ?? 0) + i + 1}`,
    created_at: new Date(start + i * 60_000).toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await admin.from("posts").insert(chunk);
    if (error) throw new Error(`insert posts: ${error.message}`);
    console.log(`  inserted ${Math.min(i + 50, rows.length)}/${rows.length}`);
  }

  const { count: total } = await admin
    .from("posts").select("id", { count: "exact", head: true }).eq("network_id", network.id);
  console.log(`\nnetwork ${network.id} now has ${total} posts`);
  console.log(`  https://learn.culturemesh.com/networks/${network.id}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
