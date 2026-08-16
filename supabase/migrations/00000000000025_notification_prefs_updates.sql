-- "Upcoming events" and "Events I'm interested in" were redundant in the
-- settings UI - consolidating to the single events_upcoming column.
-- events_interested_in is confirmed unreferenced anywhere except the
-- settings page/action being updated alongside this migration.
alter table notification_prefs drop column events_interested_in;

-- Two new notification categories, both defaulting to on like the
-- existing columns, backing the new "Replies to your posts" and "Likes
-- on your posts" checkboxes.
alter table notification_prefs add column replies_to_your_posts boolean not null default true;
alter table notification_prefs add column likes_on_your_posts boolean not null default true;
