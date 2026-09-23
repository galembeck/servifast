BEGIN;

ALTER TABLE "projects" DROP CONSTRAINT "projects_owner_id_fkey";
ALTER TABLE "projects" DROP CONSTRAINT "projects_restaurant_id_fkey";

DROP TABLE "projects";

COMMIT;
