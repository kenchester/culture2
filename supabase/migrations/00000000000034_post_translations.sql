-- On-demand cache for the per-post/reply "Translate" button: a post is
-- translated at most once per target locale regardless of how many
-- viewers click it. Mirrors the likes table's nullable-XOR-FK pattern for
-- the same reason (one table for both post_id/reply_id targets instead of
-- two near-identical tables).
create table post_translations (
  post_id bigint references posts(id) on delete cascade,
  reply_id bigint references post_replies(id) on delete cascade,
  target_locale text not null,
  translated_body text not null,
  created_at timestamptz not null default now(),
  constraint exactly_one_translated_target check (
    (post_id is not null and reply_id is null) or
    (post_id is null and reply_id is not null)
  )
);

create unique index post_translations_unique_post on post_translations (post_id, target_locale) where post_id is not null;
create unique index post_translations_unique_reply on post_translations (reply_id, target_locale) where reply_id is not null;

alter table post_translations enable row level security;

-- A shared cache, not user-owned data - any authenticated viewer who
-- triggers a translation can write the cached result for everyone else to
-- reuse, same as how likes are publicly readable but writable by whoever
-- takes the action.
create policy "translations are publicly readable" on post_translations for select using (true);
create policy "authenticated users can cache a translation" on post_translations for insert with check (true);

grant select on post_translations to anon, authenticated;
grant insert on post_translations to authenticated;
