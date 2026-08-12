-- Lets an admin choose the embed's pre-search heading wording per partner:
-- "Join the local network of [Partner Name]" (the existing, and default,
-- wording) or a generic "Join our diaspora network". The default value
-- means every already-created partner keeps rendering exactly as before -
-- this only ever changes anything for partners that explicitly pick the
-- other option going forward.
alter table embed_partners
  add column join_heading_style text not null default 'partner_name'
    check (join_heading_style in ('partner_name', 'diaspora_network'));
