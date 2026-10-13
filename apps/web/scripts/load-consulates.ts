// Consular presence, per city.
//
// Compiled from Wikipedia's per-city diplomatic-mission lists. Only cities
// whose list could actually be read in full are here: entering a consular
// corps from memory would put unsourced claims on a page whose entire
// value is being checkable, and the page renders without this block.
//
// Run: npm run load-consulates -- --prod
import countries from "i18n-iso-countries";
import enCountryNames from "i18n-iso-countries/langs/en.json";
import { adminClient } from "./lib/admin";

countries.registerLocale(enCountryNames);

// Same reasoning as load-census-origins: the formal ISO rendering of
// these carries a political claim this project has no reason to make.
const DISPLAY: Record<string, string> = {
  CN: "China", TW: "Taiwan", HK: "Hong Kong", MO: "Macao",
  KR: "South Korea", KP: "North Korea", PS: "Palestine", VN: "Vietnam",
  LA: "Laos", MD: "Moldova", SY: "Syria", RU: "Russia", BO: "Bolivia",
  TZ: "Tanzania", VE: "Venezuela", IR: "Iran", GB: "United Kingdom",
  CD: "Democratic Republic of the Congo", CZ: "Czechia",
};

const ALIASES: Record<string, string> = {
  "Ivory Coast": "CI",
  "Czech Republic": "CZ",
  "South Korea": "KR",
  Russia: "RU",
  Taiwan: "TW",
  Vietnam: "VN",
  Turkey: "TR",
  Syria: "SY",
  Laos: "LA",
  Moldova: "MD",
  Bolivia: "BO",
  Venezuela: "VE",
  Iran: "IR",
  Tanzania: "TZ",
};

const DATA: {
  cityPlaceId: number;
  cityName: string;
  source: string;
  sourceUrl: string;
  missions: [string, string][];
}[] = [
  {
    cityPlaceId: 24835,
    cityName: "Houston",
    source: "Wikipedia: List of diplomatic missions in Houston",
    sourceUrl: "https://en.wikipedia.org/wiki/List_of_diplomatic_missions_in_Houston",
    missions: [
      ["Albania", "Honorary Consul"], ["Angola", "Consulate-General"],
      ["Argentina", "Consulate-General"], ["Australia", "Consulate-General"],
      ["Austria", "Honorary Consulate"], ["Bangladesh", "Consulate-General"],
      ["Barbados", "Honorary Consulate"], ["Belgium", "Honorary Consulate"],
      ["Belize", "Consulate-General"], ["Bolivia", "Consulate-General"],
      ["Botswana", "Honorary Consulate"], ["Brazil", "Consulate-General"],
      ["Cameroon", "Honorary Consulate"], ["Canada", "Trade Commission"],
      ["Chile", "Consulate-General"], ["Colombia", "Consulate-General"],
      ["Costa Rica", "Consulate-General"], ["Ivory Coast", "Consulate-General"],
      ["Cyprus", "Honorary Consulate"], ["Czech Republic", "Honorary Consulate"],
      ["Denmark", "Consulate-General"], ["Dominican Republic", "Consulate-General"],
      ["Ecuador", "Consulate-General"], ["Egypt", "Consulate-General"],
      ["El Salvador", "Consulate-General"], ["Equatorial Guinea", "Consulate-General"],
      ["Ethiopia", "Honorary Consulate"], ["Finland", "Honorary Consulate"],
      ["France", "Consulate-General"], ["Georgia", "Honorary Consulate"],
      ["Germany", "Consulate-General"], ["Ghana", "Honorary Consulate"],
      ["Greece", "Consulate-General"], ["Guatemala", "Consulate-General"],
      ["Guyana", "Honorary Consulate"], ["Haiti", "Honorary Vice Consul"],
      ["Honduras", "Consulate-General"], ["Hungary", "Vice-Consulate"],
      ["Iceland", "Honorary Consulate"], ["India", "Consulate-General"],
      ["Indonesia", "Consulate-General"], ["Ireland", "Honorary Consulate"],
      ["Israel", "Consulate-General"], ["Italy", "Consulate-General"],
      ["Jamaica", "Honorary Consulate"], ["Japan", "Consulate-General"],
      ["Jordan", "Consulate-General"], ["South Korea", "Consulate-General"],
      ["Kyrgyzstan", "Honorary Consulate"], ["Latvia", "Honorary Consulate"],
      ["Lebanon", "Honorary Consulate"], ["Lithuania", "Honorary Consulate"],
      ["Madagascar", "Honorary Consulate"], ["Malaysia", "Honorary Consulate"],
      ["Malta", "Honorary Consulate"], ["Mexico", "Consulate-General"],
      ["Mongolia", "Honorary Consulate"], ["Morocco", "Honorary Consulate"],
      ["Namibia", "Honorary Consulate"], ["Netherlands", "Honorary Consulate"],
      ["New Zealand", "Honorary Consulate"], ["Nicaragua", "Consulate-General"],
      ["Pakistan", "Consulate-General"], ["Panama", "Consulate-General"],
      ["Papua New Guinea", "Consulate-General"], ["Peru", "Consulate-General"],
      ["Philippines", "Consulate-General"], ["Poland", "Consulate-General"],
      ["Portugal", "Honorary Consulate"], ["Qatar", "Consulate-General"],
      ["Romania", "Consulate-General"], ["Russia", "Consulate-General"],
      ["Saudi Arabia", "Consulate-General"], ["Senegal", "Consulate-General"],
      ["Slovenia", "Honorary Consulate"], ["Spain", "Consulate-General"],
      ["Sweden", "Consulate-General"], ["Switzerland", "Honorary Consulate"],
      ["Taiwan", "Economic and Cultural Office"], ["Thailand", "Consulate-General"],
      ["Trinidad and Tobago", "Honorary Consulate"], ["Tunisia", "Honorary Consulate"],
      ["Turkey", "Consulate-General"], ["Ukraine", "Honorary Consulate"],
      ["United Kingdom", "Consulate-General"], ["Uruguay", "Consulate-General"],
      ["Vietnam", "Consulate-General"],
    ],
  },
];

async function main() {
  const admin = adminClient();
  for (const city of DATA) {
    const rows: Record<string, unknown>[] = [];
    const unmatched: string[] = [];
    for (const [name, type] of city.missions) {
      const iso = ALIASES[name] ?? countries.getAlpha2Code(name, "en");
      if (!iso) { unmatched.push(name); continue; }
      rows.push({
        city_place_id: city.cityPlaceId,
        country_iso: iso,
        country_name: DISPLAY[iso] ?? countries.getName(iso, "en") ?? name,
        mission_type: type,
        source: city.source,
        source_url: city.sourceUrl,
      });
    }
    // Replace wholesale: a consular corps changes by addition and closure,
    // and a stale row is worse than a missing one.
    await admin.from("city_consulates").delete().eq("city_place_id", city.cityPlaceId);
    const { error } = await admin.from("city_consulates").insert(rows);
    if (error) { console.log(`FAIL ${city.cityName}: ${error.message}`); continue; }
    console.log(`${city.cityName}: ${rows.length} missions loaded`);
    if (unmatched.length) console.log(`  unmatched: ${unmatched.join(", ")}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
