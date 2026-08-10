-- Suggest-a-network collapses to one submission (a language OR a place, not
-- a paired origin+location) - asking for both was redundant since they're
-- really the same "what's missing from the directory" question pulling
-- from the same underlying places/languages data. The one prior test
-- submission ("Tagalog") becomes kind='language' via the temporary default.
alter table suggested_networks
  add column kind text not null default 'language' check (kind in ('language', 'place')),
  add column place_type text check (place_type in ('city', 'region', 'country'));

alter table suggested_networks alter column kind drop default;

alter table suggested_networks
  add constraint place_type_required_for_place check (
    kind <> 'place' or place_type is not null
  );

alter table suggested_networks drop column location_text;
alter table suggested_networks rename column origin_text to suggestion_text;
