-- Existing payments retain their amounts. NULL subtotal means a legacy
-- payment with no adjustments; new checkouts store a complete snapshot.
ALTER TABLE "payments"
 ADD COLUMN "subtotal_in_cents" INTEGER,
 ADD COLUMN "service_fee_in_cents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "discount_in_cents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "adjustments" JSONB;
ALTER TABLE "payments" ADD CONSTRAINT "payments_checkout_total_consistency" CHECK (
 "service_fee_in_cents" >= 0 AND "discount_in_cents" >= 0 AND "amount_in_cents" >= 0
 AND ( ("subtotal_in_cents" IS NULL AND "service_fee_in_cents" = 0 AND "discount_in_cents" = 0 AND "adjustments" IS NULL)
 OR ("subtotal_in_cents" IS NOT NULL AND "subtotal_in_cents" >= 0 AND "amount_in_cents"::bigint = "subtotal_in_cents"::bigint + "service_fee_in_cents"::bigint - "discount_in_cents"::bigint) )
);
