-- Adds a third join-heading option: "Join a local [blank] network", where
-- the admin fills in what this diaspora group calls itself (e.g. "Saudis"
-- rather than "Saudi Arabians"). join_heading_group_name only has meaning
-- when join_heading_style = 'custom_group' - left null otherwise, same as
-- the other two styles ignore it.
alter table embed_partners
  drop constraint embed_partners_join_heading_style_check;

alter table embed_partners
  add constraint embed_partners_join_heading_style_check
    check (join_heading_style in ('partner_name', 'diaspora_network', 'custom_group'));

alter table embed_partners
  add column join_heading_group_name text;
