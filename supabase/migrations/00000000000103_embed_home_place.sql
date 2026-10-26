-- An embed about one place, readable from both ends.
--
-- Every embed so far has been an embassy or a consulate: the origin is
-- locked to the country it represents, and the visitor says where they
-- live now. That shape is one-directional by design, because a consulate
-- only has one question to ask - "are you one of ours, abroad?"
--
-- A city promoting itself has two, and they are equally important to it:
--
--   people from Ningde, now elsewhere      (its diaspora)
--   people from elsewhere, now in Ningde   (who it has attracted)
--
-- Those are the same place on opposite sides of the same relation, and
-- the existing columns cannot express the second one at all - the
-- location side has only ever been a jurisdiction to search within, never
-- a fixed value.
--
-- Rather than add a locked_location_place_id to sit beside
-- locked_origin_place_id and have to be kept mutually exclusive with it,
-- this adds one place and a direction. The place is the subject of the
-- embed; the direction says which side of the relation it currently sits
-- on. For a city that wants both, the toggle is the feature: one embed,
-- one place, two questions.
alter table embed_partners add column home_place_id bigint references places(id);

-- outbound: home is the ORIGIN, visitor picks where they live now.
--           Identical in behaviour to a locked-origin partner.
-- inbound:  home is the LOCATION, visitor picks where they are from.
-- both:     the visitor flips between the two.
alter table embed_partners add column direction text not null default 'outbound'
  check (direction in ('outbound', 'inbound', 'both'));

-- A direction other than outbound needs a home place to point at: without
-- one, "inbound" would mean a fixed location that is not set, and the
-- embed would have nothing to search for.
alter table embed_partners add constraint embed_partners_direction_needs_home check (
  direction = 'outbound' or home_place_id is not null
);

-- A home place REPLACES the locked origin rather than supplementing it.
--
-- Both set would be genuinely ambiguous in the outbound direction - two
-- different answers to "what is the origin" - and silently contradictory
-- in the inbound one, where the locked origin would be the thing the
-- visitor is being asked to choose. origin_is_global is excluded for the
-- same reason: it means "the visitor picks the origin", which is already
-- what the inbound direction says and the opposite of what outbound
-- needs.
alter table embed_partners add constraint embed_partners_home_replaces_locked check (
  home_place_id is null
  or (
    locked_language_id is null
    and locked_origin_place_id is null
    and origin_is_global = false
  )
);

-- A language cannot be a home place, and the type system already says so:
-- home_place_id references places. Worth stating because the origin side
-- accepts either, and the asymmetry is deliberate - nobody lives "in
-- Cantonese", so a language could never take the inbound direction's
-- location slot.
