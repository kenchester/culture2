// Endangerment status for every language we hold, from Glottolog.
//
// Glottolog's AES (Agglomerated Endangerment Status) is itself a
// consolidation of EGIDS, UNESCO's Atlas of the World's Languages in
// Danger and the Catalogue of Endangered Languages, which is why it is
// the source here rather than any one of those: it is free, versioned,
// citable per language, and already reconciles the three scales that
// otherwise disagree.
//
// Matching is in two halves, and the split is the important part.
//
// Exact name matching against Glottolog's primary name gets 96 of our 162
// rows, and those are safe. The other 66 miss for two different reasons,
// which must not be treated the same way:
//
//   - Their primary name differs from ours. We say Cantonese, they say
//     Yue Chinese; we say Greek, they say Modern Greek; we say Oriya,
//     they say Odia. These are resolved by ISO 639-3 in CURATED below,
//     which is unambiguous, and the mapping is written out by hand so it
//     can be read and argued with.
//
//   - Our row is not one language. "Zapotec" is some sixty languages,
//     "Quechua" runs from not endangered to extinct, "Arabic" as spoken
//     is a dozen. Glottolog has no single status for these and neither
//     should we, so they are marked coverage='group' and get no status
//     at all.
//
// What this script will NOT do is fuzzy-match. A wrong endangerment
// status is worse than a missing one: it would be a confident, cited,
// wrong claim about whether somebody's language is dying, printed on a
// page aimed at the people trying to save it.
//
// Source: https://github.com/glottolog/glottolog-cldf (CC BY 4.0)
//
// Run: npm run load-language-endangerment -- --prod
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { adminClient } from "./lib/admin";

const BASE = "https://raw.githubusercontent.com/glottolog/glottolog-cldf/master/cldf";
// Cited on the page as the source of every status below. Glottolog
// releases are numbered; the CLDF master branch tracks the latest, so the
// label names the branch rather than claiming a version it might not be.
const SOURCE = "Glottolog (glottolog-cldf, master)";

/**
 * Our row -> Glottolog, by hand.
 *
 * A string is an ISO 639-3 code to resolve. `null` means "this is a group
 * of languages, record that and no status". Anything not listed here is
 * matched on name, or left alone if that fails too.
 */
const CURATED: Record<string, string | null> = {
  // Chinese: every one of these is a separate language in Glottolog, and
  // all are counted as "Chinese" by the census. The page says both.
  Cantonese: "yue",
  "Shanghainese/Wu": "wuu",
  "Taiwanese/Hokkien/Min Nan": "nan",
  // Glottolog puts Teochew and Oujiang inside Min Nan and Wu
  // respectively; glottolog_name on the page shows which, so the broader
  // name is visible rather than silently substituted.
  Teochew: "nan",
  "Wenzhounese/Oujiang": "wuu",
  "Fuzhounese/Hokchiu/Min Dong": "cdo",
  "Henghua/Pu-Xian Min": "cpx",
  "Min Bei": "mnp",
  "Leizhounese/Leizhou Min": "luh",
  Jin: "cjy",
  "Jiangxinese/Gan": "gan",
  Hakka: "hak",
  "Hunanese/Xiang": "hsn",

  // Named differently by Glottolog, same single language.
  Greek: "ell",
  "Haitian Creole": "hat",
  Khmer: "khm",
  Persian: "pes",
  Punjabi: "pan",
  Sinhalese: "sin",
  Ilokano: "ilo",
  Kirundi: "run",
  Uyghur: "uig",
  Oriya: "ory",
  Khandeshi: "khn",
  Kutchi: "kfr",
  Dhundhari: "dhd",
  Marwari: "rwr",
  Konkani: "gom",
  Deccan: "dcc",
  Chewa: "nya",
  Malagasy: "plt",
  "Serbo-Croatian": "hbs",
  "Cherokee language": "chr",
  "Amis Formosan": "ami",
  "Taiwanese Sign Language": "tss",
  "Shoshone/Goshute": "shh",
  "Oodham/Papago-Pima": "ood",

  // Groups. No single status exists, so none is claimed.
  Arabic: null,
  Pashto: null,
  Uzbek: null,
  Azerbaijani: null,
  Kurdish: null,
  Fula: null,
  Oromo: null,
  Balochi: null,
  Zhuang: null,
  Quechua: null,
  Hmong: null,
  Nahuatl: null,
  Mixtec: null,
  Zapotec: null,
  Maya: null,
  Yupik: null,
  "Inuit/Inuktitut/Greenlandic": null,
  Apache: null,
  Keres: null,
  Tewa: null,
  Tiwa: null,
  "Ohlone/Costanoan": null,
  "Lenape/Delaware": null,
  Romani: null,
  Sami: null,
  Berber: null,
  Gondi: null,
  Bodo: null,
  "Malay/Indonesian": null,
};

type Languoid = {
  id: string;
  name: string;
  glottocode: string;
  iso: string;
  level: string;
};

/**
 * Glottolog's values.csv is 21MB, so it is cached rather than refetched.
 *
 * GLOTTOLOG_DIR points at a directory holding languages.csv and
 * values.csv already downloaded; otherwise they are fetched once into a
 * temp directory and reused for the rest of the run.
 */
const cacheDir =
  process.env.GLOTTOLOG_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), "glottolog-"));

function fetchCsv(name: string): string[][] {
  const cached = path.join(cacheDir, `${name}.csv`);
  if (!fs.existsSync(cached)) {
    execFileSync("curl", ["-sSL", "-o", cached, `${BASE}/${name}.csv`]);
  }
  const text = fs.readFileSync(cached, "utf8");
  // Glottolog's CSV quotes any field containing a comma (language names
  // routinely do: "Marwari (India)", "Yoruba, Twi"), so this needs a real
  // parser rather than a split.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function table(name: string): Record<string, string>[] {
  const [header, ...rows] = fetchCsv(name);
  return rows
    .filter((r) => r.length >= header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const normalise = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** "Mandarin Chinese/Putonghua" -> ["mandarinchinese", "mandarin", "putonghua"] */
function nameVariants(name: string): string[] {
  const withoutParens = name.replace(/\([^)]*\)/g, "");
  const out: string[] = [];
  for (const part of withoutParens.split(/[/,]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    out.push(normalise(trimmed));
    // Our names often carry "Chinese" where Glottolog does not, and vice
    // versa ("Mandarin Chinese" vs "Mandarin").
    const bare = trimmed.replace(/\s*chinese$/i, "").trim();
    if (bare) out.push(normalise(bare));
  }
  return [...new Set(out)].filter(Boolean);
}

async function main() {
  const prod = process.argv.includes("--prod");
  // --dry-run resolves and reports every match without writing anything,
  // so the curated map above can be checked against the real 162 rows
  // before it touches a database - and before the columns it writes to
  // even exist.
  const dryRun = process.argv.includes("--dry-run");
  const supabase = adminClient({ readOnly: dryRun });

  console.log("Fetching Glottolog…");
  const languoids = table("languages");
  const values = table("values");

  const byIso = new Map<string, Languoid>();
  const byName = new Map<string, Languoid>();
  for (const row of languoids) {
    const languoid: Languoid = {
      id: row.ID,
      name: row.Name,
      glottocode: row.Glottocode,
      iso: row.ISO639P3code,
      level: row.Level,
    };
    if (languoid.iso) byIso.set(languoid.iso, languoid);
    // Only level=language competes for a name: a dialect called
    // "Cantonese" must not win over the language it belongs to.
    if (languoid.level === "language") {
      for (const variant of nameVariants(languoid.name)) {
        if (!byName.has(variant)) byName.set(variant, languoid);
      }
    }
  }

  const aes = new Map<string, string>();
  for (const row of values) {
    if (row.Parameter_ID === "aes") aes.set(row.Language_ID, row.Code_ID.replace(/^aes-/, ""));
  }
  console.log(`  ${languoids.length} languoids, ${aes.size} with a status`);

  const { data: ours, error } = await supabase
    .from("languages")
    .select("id, name, iso_code")
    .order("id");
  if (error) throw error;

  let single = 0;
  let group = 0;
  const unmatched: string[] = [];
  const atRisk: string[] = [];

  for (const language of ours ?? []) {
    const name = language.name as string;
    let update: Record<string, unknown> | null = null;

    if (name in CURATED) {
      const iso = CURATED[name];
      if (iso === null) {
        update = { coverage: "group", glottocode: null, iso639_3: null, endangerment: null };
        group++;
      } else {
        const languoid = byIso.get(iso);
        if (!languoid) {
          // A curated code that Glottolog does not have is a mistake in
          // the map above, not a missing language - say so loudly rather
          // than falling back to a name match that might disagree.
          console.warn(`  ! curated ISO ${iso} for ${name} is not in Glottolog`);
          unmatched.push(name);
          continue;
        }
        update = languoidUpdate(name, languoid);
        single++;
      }
    } else {
      let languoid: Languoid | undefined;
      for (const variant of nameVariants(name)) {
        languoid = byName.get(variant);
        if (languoid) break;
      }
      if (!languoid) {
        unmatched.push(name);
        continue;
      }
      update = languoidUpdate(name, languoid);
      single++;
    }

    if (dryRun) continue;
    const { error: writeError } = await supabase
      .from("languages")
      .update(update)
      .eq("id", language.id);
    if (writeError) throw writeError;
  }

  function languoidUpdate(ourName: string, languoid: Languoid) {
    const status = aes.get(languoid.id) ?? null;
    if (status && status !== "not_endangered") {
      atRisk.push(`${ourName} — ${status}`);
    }
    return {
      coverage: "single",
      glottocode: languoid.glottocode,
      iso639_3: languoid.iso || null,
      // Stored only when it differs, so the page can show "also known
      // as" without printing the same name twice.
      glottolog_name:
        normalise(languoid.name) === normalise(ourName) ? null : languoid.name,
      endangerment: status,
      endangerment_source: status ? SOURCE : null,
    };
  }

  console.log(`\n${single} single languages, ${group} groups, ${unmatched.length} unmatched`);
  if (unmatched.length) console.log(`unmatched: ${unmatched.join(", ")}`);
  console.log(`\n${atRisk.length} at risk:`);
  for (const line of atRisk.sort()) console.log(`  ${line}`);
  if (dryRun) console.log("\n(dry run — nothing written)");
  else if (!prod) console.log("\n(local database — pass --prod to write production)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
