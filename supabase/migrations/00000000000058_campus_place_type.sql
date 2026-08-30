-- A school itself is a point *within* a city, not a city - previously
-- schools were shoehorned into the 'city' type just to get the finest
-- available granularity (see 00000000000043_organizations.sql), which blurs
-- them together with real cities in search/hierarchy walks. This adds a
-- proper sub-city tier for them instead. Split into its own migration file:
-- a newly added enum value can't be referenced (e.g. in the trigger function
-- update in the next migration) until this ADD VALUE has actually committed.
alter type place_type add value 'campus';
