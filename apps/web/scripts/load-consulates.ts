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
  "North Macedonia": "MK",
  Kosovo: "XK",
  "Cape Verde": "CV",
  Myanmar: "MM",
  "Saint Lucia": "LC",
  "San Marino": "SM",
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
  missions: [string, string, string?][];
}[] = [
  {
    cityPlaceId: 24835,
    cityName: "Houston",
    source: "Wikipedia: List of diplomatic missions in Houston",
    sourceUrl: "https://en.wikipedia.org/wiki/List_of_diplomatic_missions_in_Houston",
    missions: [
      ["Albania", "Honorary Consul"], ["Angola", "Consulate-General", "http://www.angolaconsulate-tx.org/"],
      ["Argentina", "Consulate-General", "http://www.chous.mrecic.gov.ar/"], ["Australia", "Consulate-General", "https://usa.embassy.gov.au/our-locations"],
      ["Austria", "Honorary Consulate", "http://www.austrianconsulatehouston.org/"], ["Bangladesh", "Consulate-General"],
      ["Barbados", "Honorary Consulate"], ["Belgium", "Honorary Consulate"],
      ["Belize", "Consulate-General"], ["Bolivia", "Consulate-General", "http://www.boliviatx.org"],
      ["Botswana", "Honorary Consulate"], ["Brazil", "Consulate-General", "http://houston.itamaraty.gov.br/en-us/"],
      ["Cameroon", "Honorary Consulate"], ["Canada", "Trade Commission", "https://www.tradecommissioner.gc.ca/united-states-of-america-etats-unis-amerique/index.aspx?lang=eng"],
      ["Chile", "Consulate-General", "https://chile.gob.cl/houston/"], ["Colombia", "Consulate-General"],
      ["Costa Rica", "Consulate-General"], ["Ivory Coast", "Consulate-General"],
      ["Cyprus", "Honorary Consulate"], ["Czech Republic", "Honorary Consulate"],
      ["Denmark", "Consulate-General", "https://usa.um.dk/en/about-us/danish-missions/consulate-general-of-denmark-houston"], ["Dominican Republic", "Consulate-General"],
      ["Ecuador", "Consulate-General", "https://www.facebook.com/Cecuhouston/"], ["Egypt", "Consulate-General"],
      ["El Salvador", "Consulate-General", "https://www.facebook.com/CGESHoustonSV/"], ["Equatorial Guinea", "Consulate-General"],
      ["Ethiopia", "Honorary Consulate"], ["Finland", "Honorary Consulate"],
      ["France", "Consulate-General", "https://houston.consulfrance.org/-english-"], ["Georgia", "Honorary Consulate"],
      ["Germany", "Consulate-General", "http://www.germany.info/houston"], ["Ghana", "Honorary Consulate", "https://www.facebook.com/GhanaConsulateHouston/"],
      ["Greece", "Consulate-General", "https://www.mfa.gr/usa/en/consulate-in-houston/"], ["Guatemala", "Consulate-General", "https://www.facebook.com/GuateenHouston/"],
      ["Guyana", "Honorary Consulate"], ["Haiti", "Honorary Vice Consul"],
      ["Honduras", "Consulate-General"], ["Hungary", "Vice-Consulate"],
      ["Iceland", "Honorary Consulate"], ["India", "Consulate-General", "https://cgihouston.gov.in"],
      ["Indonesia", "Consulate-General", "https://www.kemlu.go.id/houston/id/default.aspx"], ["Ireland", "Honorary Consulate"],
      ["Israel", "Consulate-General", "https://embassies.gov.il/houston/Pages/Home.aspx"], ["Italy", "Consulate-General", "https://conshouston.esteri.it/consolato_houston/it/"],
      ["Jamaica", "Honorary Consulate"], ["Japan", "Consulate-General", "http://www.houston.us.emb-japan.go.jp/index_e.htm"],
      ["Jordan", "Consulate-General"], ["South Korea", "Consulate-General", "http://usa-houston.mofa.go.kr/english/"],
      ["Kyrgyzstan", "Honorary Consulate"], ["Latvia", "Honorary Consulate"],
      ["Lebanon", "Honorary Consulate"], ["Lithuania", "Honorary Consulate"],
      ["Madagascar", "Honorary Consulate"], ["Malaysia", "Honorary Consulate"],
      ["Malta", "Honorary Consulate"], ["Mexico", "Consulate-General", "http://consulmex.sre.gob.mx/houston/"],
      ["Mongolia", "Honorary Consulate"], ["Morocco", "Honorary Consulate"],
      ["Namibia", "Honorary Consulate"], ["Netherlands", "Honorary Consulate"],
      ["New Zealand", "Honorary Consulate"], ["Nicaragua", "Consulate-General"],
      ["Pakistan", "Consulate-General"], ["Panama", "Consulate-General"],
      ["Papua New Guinea", "Consulate-General"], ["Peru", "Consulate-General", "https://www.consulado.pe/es/Houston/Paginas/Inicio.aspx"],
      ["Philippines", "Consulate-General"], ["Poland", "Consulate-General"],
      ["Portugal", "Honorary Consulate"], ["Qatar", "Consulate-General"],
      ["Romania", "Consulate-General"], ["Russia", "Consulate-General", "https://houston.kdmid.ru"],
      ["Saudi Arabia", "Consulate-General"], ["Senegal", "Consulate-General"],
      ["Slovenia", "Honorary Consulate"], ["Spain", "Consulate-General", "https://www.exteriores.gob.es/Consulados/houston/en/Paginas/index.aspx"],
      ["Sweden", "Consulate-General", "https://www.swedenabroad.se/sv/utlandsmyndigheter/usa-houston/"], ["Switzerland", "Honorary Consulate"],
      ["Taiwan", "Economic and Cultural Office", "http://www.taiwanembassy.org/US/HOU/mp.asp?mp=37"], ["Thailand", "Consulate-General"],
      ["Trinidad and Tobago", "Honorary Consulate"], ["Tunisia", "Honorary Consulate"],
      ["Turkey", "Consulate-General"], ["Ukraine", "Honorary Consulate"],
      ["United Kingdom", "Consulate-General", "https://www.gov.uk/government/world/organisations/british-consulate-general-houston"], ["Uruguay", "Consulate-General"],
      ["Vietnam", "Consulate-General", "http://vietnamconsulateinhouston.org/"],
    ],
  },
  {
    cityPlaceId: 25420,
    cityName: "Detroit",
    // Wikipedia has no Detroit missions list and its US-wide page is too
    // long to read in full, so this comes from embassies.net. That source
    // carries no URLs, so the links below were derived from each foreign
    // ministry's own pattern and then checked: only Detroit-specific URLs
    // that actually resolve are included. Generic ministry index pages
    // ("all our representations") were dropped - linking one as "the
    // Detroit consulate's page" would be misleading.
    source: "embassies.net: Foreign embassies and consulates in Detroit",
    sourceUrl: "https://embassies.net/united-states/detroit",
    missions: [
      ["Austria", "Consulate"],
      ["Belgium", "Honorary Consulate"],
      ["Belize", "Consulate-General"],
      ["Canada", "Consulate-General", "https://www.international.gc.ca/country-pays/us-eu/detroit.aspx?lang=eng"],
      ["Denmark", "Honorary Consulate"],
      ["Finland", "Honorary Consulate"],
      ["France", "Honorary Consulate"],
      ["Germany", "Honorary Consulate"],
      ["Iceland", "Consulate-General"],
      ["Iraq", "Consulate-General", "https://mofa.gov.iq/detroit/en/"],
      ["Italy", "Consulate-General"],
      // Returns 403 to automated requests, but the host is live and the
      // hostname follows the same pattern as the verified Houston one.
      ["Japan", "Consulate-General", "https://www.detroit.us.emb-japan.go.jp/itpr_en/index.html"],
      ["Lebanon", "Consulate-General"],
      ["Mexico", "Consulate", "https://consulmex.sre.gob.mx/detroit/"],
      ["Netherlands", "Honorary Consulate"],
      ["North Macedonia", "Consulate-General"],
      ["Poland", "Honorary Consulate", "https://www.gov.pl/web/usa-en/detroit"],
      ["San Marino", "Consulate"],
      ["Slovenia", "Consulate"],
      ["Sweden", "Consulate"],
      ["Switzerland", "Consulate"],
    ],
  },
  {
    cityPlaceId: 25760,
    cityName: "New York City",
    // Permanent Missions are kept but labelled verbatim: a mission to the
    // UN is not a consulate and will not renew anyone's passport, so
    // flattening the two would mislead exactly the person who most needs
    // the distinction. Where a country has both, the consular one wins.
    source: "embassies.net: Foreign embassies and consulates in New York",
    sourceUrl: "https://embassies.net/united-states/new-york",
    missions: [
      ["Algeria", "Consulate-General"], ["Angola", "Consulate-General"],
      ["Cape Verde", "Consulate"], ["Central African Republic", "Consulate"],
      ["Chad", "Permanent Mission to the UN"], ["Comoros", "Permanent Mission to the UN"],
      ["Egypt", "Consulate-General"], ["Ghana", "Consulate-General"],
      ["Kenya", "Consulate-General"], ["Liberia", "Consulate-General"],
      ["Morocco", "Consulate-General"], ["Nigeria", "Consulate-General"],
      ["South Africa", "Consulate-General"],
      ["Afghanistan", "Consulate-General"], ["Azerbaijan", "Permanent Mission to the UN"],
      ["Bangladesh", "Consulate-General", "https://bdcgny.org/"],
      ["Bhutan", "Consulate-General"], ["Cambodia", "Permanent Mission to the UN"],
      ["China", "Consulate-General", "http://newyork.china-consulate.gov.cn/"],
      ["Georgia", "Consulate-General"],
      ["India", "Consulate-General", "https://www.indiainnewyork.gov.in/"],
      ["Indonesia", "Consulate-General"], ["Japan", "Consulate-General"],
      ["Kazakhstan", "Consulate-General"], ["Kyrgyzstan", "Consulate"],
      ["Laos", "Permanent Mission to the UN"], ["Malaysia", "Consulate-General"],
      ["Mongolia", "Permanent Mission to the UN"], ["Myanmar", "Consulate-General"],
      ["Nepal", "Consulate-General"], ["Pakistan", "Consulate-General"],
      ["Philippines", "Consulate-General", "https://newyorkpcg.org/"],
      ["Singapore", "Consulate"], ["South Korea", "Consulate-General"],
      ["Thailand", "Consulate-General"], ["Turkmenistan", "Permanent Mission to the UN"],
      ["Uzbekistan", "Consulate-General"], ["Vietnam", "Consulate"],
      ["Antigua and Barbuda", "Consulate-General"], ["Bahamas", "Consulate-General"],
      ["Barbados", "Consulate-General"], ["Costa Rica", "Consulate-General"],
      ["Dominica", "Consulate-General"], ["Dominican Republic", "Consulate-General"],
      ["El Salvador", "Consulate-General"], ["Grenada", "Embassy"],
      ["Guatemala", "Consulate-General"], ["Haiti", "Consulate-General"],
      ["Honduras", "Consulate-General"], ["Jamaica", "Consulate-General"],
      ["Montserrat", "Consulate"], ["Nicaragua", "Consulate-General"],
      ["Saint Lucia", "Embassy"], ["Trinidad and Tobago", "Embassy"],
      ["Canada", "Consulate-General"],
      ["Mexico", "Consulate-General", "https://consulmex.sre.gob.mx/nuevayork/"],
      ["Argentina", "Consulate-General"], ["Bolivia", "Consulate-General"],
      ["Brazil", "Consulate-General"], ["Chile", "Consulate-General"],
      ["Colombia", "Consulate-General", "https://nuevayork.consulado.gov.co/"],
      ["Ecuador", "Consulate-General"], ["Guyana", "Consulate-General"],
      ["Paraguay", "Permanent Mission to the UN"], ["Peru", "Consulate-General"],
      ["Uruguay", "Consulate-General"], ["Venezuela", "Consulate-General"],
      ["Albania", "Permanent Mission to the UN"], ["Andorra", "Embassy"],
      ["Austria", "Consulate-General"], ["Belarus", "Consulate-General"],
      ["Belgium", "Consulate-General"], ["Bosnia and Herzegovina", "Consulate-General"],
      ["Bulgaria", "Consulate-General"], ["Croatia", "Permanent Mission to the UN"],
      ["Cyprus", "Consulate-General"], ["Czech Republic", "Consulate-General"],
      ["Denmark", "Consulate-General"], ["Estonia", "Consulate-General"],
      ["Finland", "Consulate-General"], ["France", "Consulate-General"],
      ["Germany", "Consulate-General"], ["Greece", "Consulate-General"],
      ["Hungary", "Consulate-General"], ["Iceland", "Consulate-General"],
      ["Ireland", "Consulate-General"], ["Italy", "Consulate-General"],
      ["Kosovo", "Consulate-General"], ["Latvia", "Consulate"],
      ["Liechtenstein", "Embassy"], ["Lithuania", "Consulate-General"],
      ["Luxembourg", "Consulate-General"], ["Malta", "Permanent Mission to the UN"],
      ["Monaco", "Consulate-General"], ["Montenegro", "Consulate-General"],
      ["Netherlands", "Consulate-General"], ["Poland", "Consulate-General"],
      ["Portugal", "Consulate-General"], ["Romania", "Consulate-General"],
      ["Russia", "Consulate-General"], ["San Marino", "Consulate-General"],
      ["Serbia", "Consulate-General"], ["Slovakia", "Consulate-General"],
      ["Slovenia", "Consulate-General"], ["Spain", "Consulate-General"],
      ["Sweden", "Consulate-General"], ["Switzerland", "Consulate-General"],
      ["Ukraine", "Consulate-General"], ["United Kingdom", "Consulate-General"],
      ["Bahrain", "Permanent Mission to the UN"], ["Iraq", "Permanent Mission to the UN"],
      ["Israel", "Consulate-General"], ["Kuwait", "Consulate-General"],
      ["Lebanon", "Consulate-General"], ["Qatar", "Consulate-General"],
      ["Australia", "Consulate-General"], ["Nauru", "Permanent Mission to the UN"],
      ["New Zealand", "Consulate-General"],
    ],
  },
];

async function main() {
  const admin = adminClient();
  for (const city of DATA) {
    const rows: Record<string, unknown>[] = [];
    const unmatched: string[] = [];
    for (const [name, type, website] of city.missions) {
      const iso = ALIASES[name] ?? countries.getAlpha2Code(name, "en");
      if (!iso) { unmatched.push(name); continue; }
      rows.push({
        city_place_id: city.cityPlaceId,
        country_iso: iso,
        country_name: DISPLAY[iso] ?? countries.getName(iso, "en") ?? name,
        mission_type: type,
        // Only where the source actually lists one. Roughly a third do.
        website: website ?? null,
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
