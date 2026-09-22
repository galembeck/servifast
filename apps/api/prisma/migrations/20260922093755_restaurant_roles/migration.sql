BEGIN;

-- Temporarily widen to TEXT so we can remap old role values before
-- recreating the enum with the new restaurant-domain roles.
ALTER TABLE "invites" ALTER COLUMN "role" TYPE TEXT;
ALTER TABLE "members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "members" ALTER COLUMN "role" TYPE TEXT;

-- Best-effort mapping from the old SaaS-template roles to the new ones.
-- ADMIN -> OWNER (full access), MEMBER -> WAITER (least-privileged default),
-- BILLING stays BILLING.
UPDATE "invites" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';
UPDATE "invites" SET "role" = 'WAITER' WHERE "role" = 'MEMBER';
UPDATE "members" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';
UPDATE "members" SET "role" = 'WAITER' WHERE "role" = 'MEMBER';

CREATE TYPE "Role_new" AS ENUM ('OWNER', 'MANAGER', 'WAITER', 'CASHIER', 'KITCHEN', 'BILLING');

ALTER TABLE "invites" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::"Role_new");
ALTER TABLE "members" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::"Role_new");

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'WAITER';

COMMIT;
