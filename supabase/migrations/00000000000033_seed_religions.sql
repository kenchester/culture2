-- Seeds the faith.culturemesh.com launch list. Aliases only where a
-- realistic alternate spelling exists: "Baha'i"/"Bahai" for the diacritic
-- spelling, and the individual words for the slash-compound "Daoist/Taoist"
-- entry, so searching either half finds it.
insert into religions (name, aliases) values
  ('Christian', '{}'),
  ('Muslim', '{}'),
  ('Hindu', '{}'),
  ('Buddhist', '{}'),
  ('Sikh', '{}'),
  ('Jew', '{}'),
  ('Bahá''í', ARRAY['Baha''i', 'Bahai']),
  ('Daoist/Taoist', ARRAY['Daoist', 'Taoist']),
  ('Confucian', '{}'),
  ('Jain', '{}'),
  ('Shintoist', '{}'),
  ('Atheist', '{}'),
  ('Agnostic', '{}');
