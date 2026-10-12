// Repairs place names where a non-Latin-1 character was replaced by a
// literal "?" during some historic import.
//
// This is NOT mojibake (see fix-mojibake-names.ts). Mojibake is lossless -
// "Ã©" still contains the bytes of "é" and can be decoded back. A "?" is
// lossy: the original codepoint is gone, so nothing can recover it from the
// stored value and the correct spelling has to be supplied here.
//
// The giveaway is which characters survived. "Hlavní m?sto Praha" kept its
// í (U+00ED, inside Latin-1) and lost its ě (U+011B, outside it) - the
// signature of text passed through ISO-8859-1.
//
// Confidence is recorded per row because six of these are reconstructed by
// inference from the "?" positions rather than known outright, and a wrong
// "fix" is worse than a visible "?".
//
// Run: npx tsx scripts/fix-lossy-place-names.ts [--apply]
import { adminClient } from "./lib/admin";

type Fix = { id: number; from: string; to: string; confidence: "certain" | "inferred"; note: string };

const FIXES: Fix[] = [
  // Czech: these are the official names of Czech regions. Known, not guessed.
  { id: 954, from: "Hlavní m?sto Praha", to: "Hlavní město Praha", confidence: "certain", note: "ě" },
  { id: 955, from: "Jiho?eský kraj", to: "Jihočeský kraj", confidence: "certain", note: "č" },
  { id: 957, from: "Kraj Vyso?ina", to: "Kraj Vysočina", confidence: "certain", note: "č" },
  { id: 963, from: "Plze?ský kraj", to: "Plzeňský kraj", confidence: "certain", note: "ň" },

  // Azerbaijani: the dataset already romanises Ş to S, so the only missing
  // character is the schwa ə. Position of each "?" matches exactly.
  { id: 462, from: "S?ki S?h?ri", to: "Səki Səhəri", confidence: "inferred", note: "ə ×3" },
  { id: 481, from: "Susa S?h?ri", to: "Susa Səhəri", confidence: "inferred", note: "ə ×2" },

  // Qatari municipalities, in the macron transliteration this dataset uses
  // elsewhere: baladīyat = بلدية. Each "?" count matches the reconstruction.
  { id: 2965, from: "Balad?yat Jaray?n al B??inah", to: "Baladīyat Jarayān al Bāṭinah", confidence: "inferred", note: "ī ā ā ṭ" },
  { id: 2966, from: "Balad?yat Umm Sa‘?d", to: "Baladīyat Umm Sa‘īd", confidence: "inferred", note: "ī ī" },
  { id: 2969, from: "Balad?yat al Ghuwayr?yah", to: "Baladīyat al Ghuwayrīyah", confidence: "inferred", note: "ī ī" },
  { id: 2970, from: "Balad?yat al Jumayl?yah", to: "Baladīyat al Jumaylīyah", confidence: "inferred", note: "ī ī" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const admin = adminClient();

  const { data: rows } = await admin
    .from("places")
    .select("id, name")
    .in("id", FIXES.map((f) => f.id));
  const current = new Map((rows ?? []).map((r) => [r.id as number, r.name as string]));

  let changed = 0;
  for (const fix of FIXES) {
    const now = current.get(fix.id);
    if (now === undefined) {
      console.log(`  [${fix.id}] MISSING - skipped`);
      continue;
    }
    if (now === fix.to) {
      console.log(`  [${fix.id}] already correct`);
      continue;
    }
    // Refuse to touch a row that isn't what this script was written against.
    if (now !== fix.from) {
      console.log(`  [${fix.id}] SKIPPED - expected ${JSON.stringify(fix.from)}, found ${JSON.stringify(now)}`);
      continue;
    }
    console.log(`  [${fix.id}] ${fix.confidence.padEnd(8)} ${JSON.stringify(now)} -> ${JSON.stringify(fix.to)}  (${fix.note})`);
    if (apply) {
      const { error } = await admin.from("places").update({ name: fix.to }).eq("id", fix.id);
      if (error) { console.log(`        FAILED: ${error.message}`); continue; }
      changed++;
    }
  }

  // networks.title is denormalised text, so a repaired place does not
  // repair a title already built from the broken one.
  const { data: nets } = await admin.from("networks").select("id, title").like("title", "%?%");
  for (const net of nets ?? []) {
    let title = net.title as string;
    for (const fix of FIXES) title = title.split(fix.from).join(fix.to);
    if (title === net.title) continue;
    console.log(`  network ${net.id}: ${JSON.stringify(net.title)} -> ${JSON.stringify(title)}`);
    if (apply) {
      const { error } = await admin.from("networks").update({ title }).eq("id", net.id);
      if (error) console.log(`        FAILED: ${error.message}`);
      else changed++;
    }
  }

  console.log(apply ? `\napplied ${changed} change(s)` : "\ndry run - pass --apply to write");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
