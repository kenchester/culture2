-- Population for cities, so "the largest cities in a region" is a query
-- rather than a guess.
--
-- Until now a region's only coordinate was its geographic centroid -
-- Texas sits in farmland near Brady, 420km from Houston - so any distance
-- measured from a region was measured from where nobody lives. Picking
-- representative cities instead needs a size ranking, and there was none:
-- alphabetical or insertion order is arbitrary dressed as authoritative.
--
-- Loaded from GeoNames (cities15000, CC BY 4.0), matched on exact
-- normalised name within 50km of a place's own coordinates. Strict on
-- purpose: 93% of cities match, and the misses are transliteration
-- variants of small places (Al Fujayrah, Umm al Qaywayn) rather than
-- anywhere a corridor would be measured from.
alter table places add column population int;
-- Ranking the cities inside a region or country is the only query this
-- serves, and it always wants the biggest first.
create index places_parent_population_idx on places (parent_id, population desc nulls last);
