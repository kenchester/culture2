"""Rebuild the complete legacy-id -> new-place-id / new-language-id mapping.

Phase 2 only persisted the country/region halves of this mapping
(supabase/seed-data/legacy-place-id-map.json) since cities/languages
weren't needed until this migration. This script re-derives the full
mapping by replicating supabase/seed-data's original ID-assignment order
exactly - it must be run against the same parsed/countries.json,
parsed/regions.json, parsed/cities.json, parsed/languages.json files (see
parse_mysql.py) for the ids to line up with what's actually live in the
database. Verified in the Phase 7 dry run: the reconstructed
country/region maps matched the committed Phase 2 file byte-for-byte, and
three known city ids (Jakarta, Ann Arbor, Detroit) matched live database
values queried directly.

Usage: python3 reconstruct_full_map.py
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PARSED_DIR = REPO_ROOT / "scripts/migration/output/parsed"
OUT_PATH = REPO_ROOT / "scripts/migration/output/full-legacy-map.json"


def load(name):
    with open(PARSED_DIR / f"{name}.json") as f:
        return json.load(f)


def main():
    countries = load("countries")
    regions = load("regions")
    cities = load("cities")
    languages = load("languages")

    country_map = {}
    region_map = {}
    city_map = {}
    next_id = 1

    seen_country_names = set()
    for c in countries:
        name = c["name"]
        if name is None or name.strip() == "":
            continue
        seen_country_names.add(name)
        new_id = next_id
        next_id += 1
        country_map[c["id"]] = new_id

    for r in regions:
        name = r["name"]
        if name is None or name.strip() == "":
            continue
        parent = country_map.get(r["country_id"])
        if parent is None:
            continue
        new_id = next_id
        next_id += 1
        region_map[r["id"]] = new_id

    for city in cities:
        name = city["name"]
        if name is None or name.strip() == "":
            continue
        parent = None
        if city.get("region_id") is not None:
            parent = region_map.get(city["region_id"])
        if parent is None and city.get("country_id") is not None:
            parent = country_map.get(city["country_id"])
        if parent is None:
            continue
        new_id = next_id
        next_id += 1
        city_map[city["id"]] = new_id

    lang_map = {}
    seen_lang_names = set()
    lang_next_id = 1
    for lang in languages:
        name = lang["name"]
        if name is None or name.strip() == "":
            continue
        if name in seen_lang_names:
            continue
        seen_lang_names.add(name)
        lang_map[lang["id"]] = lang_next_id
        lang_next_id += 1

    print("country_map:", len(country_map))
    print("region_map:", len(region_map))
    print("city_map:", len(city_map))
    print("lang_map:", len(lang_map))

    out = {
        "countries": country_map,
        "regions": region_map,
        "cities": city_map,
        "languages": lang_map,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)
    print("wrote", OUT_PATH)


if __name__ == "__main__":
    main()
