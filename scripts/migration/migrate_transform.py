"""Transform legacy users/networks/network_registration/posts/events/
event_registration into the new schema's shape.

This performs NO writes to Supabase and sends NO emails - it only reads
the parsed legacy JSON (see parse_mysql.py) and the reconstructed
legacy-id map (see reconstruct_full_map.py) and writes transformed JSON +
a validation report to scripts/migration/output/. A separate, deliberately
not-yet-built "apply" step would be needed to actually create Supabase
Auth users and insert rows - that's a real production action requiring
its own explicit go-ahead (see the plan's Phase 8 cutover).

Usage: python3 migrate_transform.py
"""

import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PARSED_DIR = REPO_ROOT / "scripts/migration/output/parsed"
LEGACY_MAP_PATH = REPO_ROOT / "scripts/migration/output/full-legacy-map.json"
USER_IMAGES_DIR = REPO_ROOT / "htdocs/user_images"
OUT_DIR = REPO_ROOT / "scripts/migration/output/migrated"


def load(name):
    with open(PARSED_DIR / f"{name}.json") as f:
        return json.load(f)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(LEGACY_MAP_PATH) as f:
        place_map = json.load(f)
    country_map = place_map["countries"]
    region_map = place_map["regions"]
    city_map = place_map["cities"]
    lang_map = place_map["languages"]

    users = load("users")
    networks = load("networks")
    network_registration = load("network_registration")
    posts = load("posts")
    events = load("events")
    event_registration = load("event_registration")

    report = {}

    # ---------- users ----------
    migrated_users = {}
    seen_emails = set()
    dup_emails = 0
    for u in users:
        email = (u["email"] or "").strip().lower()
        if not email:
            continue
        if email in seen_emails:
            dup_emails += 1
            continue
        seen_emails.add(email)

        img_link = u.get("img_link")
        img_exists = bool(img_link) and os.path.isfile(USER_IMAGES_DIR / img_link)

        migrated_users[u["id"]] = {
            "legacy_id": u["id"],
            "email": email,
            "username": u.get("username"),
            "first_name": u.get("first_name"),
            "last_name": u.get("last_name"),
            "about_me": u.get("about_me"),
            "img_link": img_link,
            "img_exists_locally": img_exists,
            "register_date": u.get("register_date"),
            "notification_prefs": {
                "events_upcoming": u.get("events_upcoming") not in (None, "0"),
                "events_interested_in": u.get("events_interested_in") not in (None, "0"),
                "network_activity": u.get("network_activity") not in (None, "0"),
                "product_updates": u.get("company_news") not in (None, "0"),
            },
        }

    report["users"] = {
        "legacy_total": len(users),
        "migrated": len(migrated_users),
        "skipped_no_email": len(users) - len(migrated_users) - dup_emails,
        "skipped_duplicate_email": dup_emails,
        "with_resolvable_image": sum(1 for u in migrated_users.values() if u["img_exists_locally"]),
    }

    # ---------- networks ----------
    def resolve_location(n):
        for legacy_id_field, mapping in (
            ("id_city_cur", city_map),
            ("id_region_cur", region_map),
            ("id_country_cur", country_map),
        ):
            if n.get(legacy_id_field):
                pid = mapping.get(n[legacy_id_field])
                if pid:
                    return pid
        return None

    def resolve_origin(n):
        cls = n.get("network_class")
        if cls == "cc" and n.get("id_city_origin"):
            pid = city_map.get(n["id_city_origin"])
            if pid:
                return ("place", pid, n.get("city_origin"))
        elif cls == "rc" and n.get("id_region_origin"):
            pid = region_map.get(n["id_region_origin"])
            if pid:
                return ("place", pid, n.get("region_origin"))
        elif cls == "co" and n.get("id_country_origin"):
            pid = country_map.get(n["id_country_origin"])
            if pid:
                return ("place", pid, n.get("country_origin"))
        elif cls == "_l" and n.get("id_language_origin"):
            pid = lang_map.get(n["id_language_origin"])
            if pid:
                return ("language", pid, n.get("language_origin"))
        return None

    def location_name(n):
        return n.get("city_cur") or n.get("region_cur") or n.get("country_cur")

    migrated_networks = {}
    skip_reasons = {"no_origin_class": 0, "origin_unresolved": 0, "location_unresolved": 0}
    for n in networks:
        if n.get("network_class") not in ("cc", "rc", "co", "_l"):
            skip_reasons["no_origin_class"] += 1
            continue

        origin = resolve_origin(n)
        if origin is None:
            skip_reasons["origin_unresolved"] += 1
            continue

        location_id = resolve_location(n)
        if location_id is None:
            skip_reasons["location_unresolved"] += 1
            continue

        origin_kind, origin_id, origin_name = origin
        loc_name = location_name(n)
        is_language = origin_kind == "language"
        title = (
            f"{origin_name} speakers in {loc_name}"
            if is_language
            else f"People from {origin_name} in {loc_name}"
        )

        migrated_networks[n["id"]] = {
            "legacy_id": n["id"],
            "language_id": origin_id if is_language else None,
            "origin_place_id": None if is_language else origin_id,
            "location_place_id": location_id,
            "title": title,
            "launched_at": n.get("date_added"),
            # legacy schema has no concept of who launched a network
            "launched_by": None,
        }

    report["networks"] = {
        "legacy_total": len(networks),
        "migrated": len(migrated_networks),
        "skipped": skip_reasons,
    }

    # ---------- network_registration -> network_members ----------
    migrated_members = []
    skipped_members = 0
    for reg in network_registration:
        if reg["id_user"] in migrated_users and reg["id_network"] in migrated_networks:
            migrated_members.append(
                {
                    "legacy_user_id": reg["id_user"],
                    "legacy_network_id": reg["id_network"],
                    "joined_at": reg.get("join_date"),
                }
            )
        else:
            skipped_members += 1

    report["network_members"] = {
        "legacy_total": len(network_registration),
        "migrated": len(migrated_members),
        "skipped_orphaned": skipped_members,
    }

    # ---------- posts ----------
    migrated_posts = []
    skipped_posts = 0
    posts_with_image = 0
    for p in posts:
        if p["id_user"] in migrated_users and p["id_network"] in migrated_networks:
            img_link = p.get("img_link") or None
            img_exists = bool(img_link) and os.path.isfile(USER_IMAGES_DIR / img_link)
            if img_exists:
                posts_with_image += 1
            migrated_posts.append(
                {
                    "legacy_id": p["id"],
                    "legacy_user_id": p["id_user"],
                    "legacy_network_id": p["id_network"],
                    "body": p.get("post_text") or "",
                    "video_url": p.get("vid_link") or None,
                    "img_link": img_link,
                    "img_exists_locally": img_exists,
                    "created_at": p.get("post_date"),
                }
            )
        else:
            skipped_posts += 1

    report["posts"] = {
        "legacy_total": len(posts),
        "migrated": len(migrated_posts),
        "skipped_orphaned": skipped_posts,
        "with_resolvable_image": posts_with_image,
    }

    # ---------- events ----------
    migrated_events = {}
    skipped_events = 0
    for e in events:
        if e["id_network"] in migrated_networks and e["id_host"] in migrated_users:
            location_parts = [
                e.get("address_1"), e.get("address_2"), e.get("city"),
                e.get("region"), e.get("country"),
            ]
            location = ", ".join(p for p in location_parts if p)
            migrated_events[e["id"]] = {
                "legacy_id": e["id"],
                "legacy_network_id": e["id_network"],
                "legacy_host_id": e["id_host"],
                "title": e.get("title"),
                "description": e.get("description"),
                "event_date": e.get("event_date"),
                "location": location or None,
            }
        else:
            skipped_events += 1

    report["events"] = {
        "legacy_total": len(events),
        "migrated": len(migrated_events),
        "skipped_orphaned": skipped_events,
    }

    # ---------- event_registration -> event_rsvps ----------
    migrated_rsvps = []
    skipped_rsvps = 0
    for reg in event_registration:
        if reg["id_guest"] in migrated_users and reg["id_event"] in migrated_events:
            migrated_rsvps.append(
                {
                    "legacy_guest_id": reg["id_guest"],
                    "legacy_event_id": reg["id_event"],
                    "status": "going",
                }
            )
        else:
            skipped_rsvps += 1

    report["event_rsvps"] = {
        "legacy_total": len(event_registration),
        "migrated": len(migrated_rsvps),
        "skipped_orphaned": skipped_rsvps,
    }

    # ---------- write outputs ----------
    with open(OUT_DIR / "users.json", "w") as f:
        json.dump(list(migrated_users.values()), f)
    with open(OUT_DIR / "networks.json", "w") as f:
        json.dump(list(migrated_networks.values()), f)
    with open(OUT_DIR / "network_members.json", "w") as f:
        json.dump(migrated_members, f)
    with open(OUT_DIR / "posts.json", "w") as f:
        json.dump(migrated_posts, f)
    with open(OUT_DIR / "events.json", "w") as f:
        json.dump(list(migrated_events.values()), f)
    with open(OUT_DIR / "event_rsvps.json", "w") as f:
        json.dump(migrated_rsvps, f)
    with open(REPO_ROOT / "scripts/migration/output/report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
