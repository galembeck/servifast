CREATE TYPE "FinancialEntryType" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('LEGACY', 'PENDING', 'PAID', 'RECEIVED');

-- Historical expenses have no payment status. Preserve them without guessing
-- whether they were paid, or inventing an effective date or operation timestamp.
ALTER TABLE "expenses"
  ADD COLUMN "type" "FinancialEntryType" NOT NULL DEFAULT 'EXPENSE',
  ADD COLUMN "status" "FinancialEntryStatus" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "settled_on" DATE,
  ADD COLUMN "settled_at" TIMESTAMPTZ(3);
ALTER TABLE "expenses" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_settlement_consistency" CHECK (
  ("status" IN ('LEGACY', 'PENDING') AND "settled_on" IS NULL AND "settled_at" IS NULL)
  OR ("settled_on" IS NOT NULL AND "settled_at" IS NOT NULL AND (
    ("type" = 'EXPENSE' AND "status" = 'PAID') OR
    ("type" = 'INCOME' AND "status" = 'RECEIVED')
  ))
);
