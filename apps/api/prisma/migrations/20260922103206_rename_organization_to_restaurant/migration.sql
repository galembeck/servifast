BEGIN;

ALTER TABLE "organizations" RENAME TO "restaurants";

ALTER TABLE "invites" RENAME COLUMN "organization_id" TO "restaurant_id";
ALTER TABLE "members" RENAME COLUMN "organization_id" TO "restaurant_id";
ALTER TABLE "projects" RENAME COLUMN "organization_id" TO "restaurant_id";

ALTER TABLE "restaurants" RENAME CONSTRAINT "organizations_owner_id_fkey" TO "restaurants_owner_id_fkey";
ALTER TABLE "invites" RENAME CONSTRAINT "invites_organization_id_fkey" TO "invites_restaurant_id_fkey";
ALTER TABLE "members" RENAME CONSTRAINT "members_organization_id_fkey" TO "members_restaurant_id_fkey";
ALTER TABLE "projects" RENAME CONSTRAINT "projects_organization_id_fkey" TO "projects_restaurant_id_fkey";

ALTER INDEX "organizations_pkey" RENAME TO "restaurants_pkey";
ALTER INDEX "organizations_slug_key" RENAME TO "restaurants_slug_key";
ALTER INDEX "organizations_domain_key" RENAME TO "restaurants_domain_key";
ALTER INDEX "invites_email_organization_id_key" RENAME TO "invites_email_restaurant_id_key";
ALTER INDEX "members_organization_id_user_id_key" RENAME TO "members_restaurant_id_user_id_key";

COMMIT;
