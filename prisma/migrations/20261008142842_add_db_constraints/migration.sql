-- This is an empty migration.
create unique index "vendor_categories_one_primary_per_profile" on "vendor_categories" ("profileId")
where "isPrimary" = true;

alter table "services" add constraint "services_price_min_positive" check ("priceMin" > 0 );

alter table "services" add constraint "services_price_max_value" check ("priceMax" is null or "priceMax" >= "priceMin");

alter table "working_hours" add constraint "working_hours_constraint" check ("dayOfWeek" between 0 and 6);

alter table "vendor_profiles" add constraint "vendor_profile_average_rating" check ("avgRating" between 0 and 5);

--    drop index if exists "vendor_categories_one_primary_per_profile";
--    alter table "services" drop constraint if exists "services_price_min_positive";
--    alter table "services" drop constraint if exists "services_price_max_value";
--    alter table "working_hours" drop constraint if exists "working_hours_constraint";
--    alter table "vendor_profiles" drop constraint if exists "vendor_profile_average_rating";