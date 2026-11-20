-- CreateEnum
CREATE TYPE "cash_register_transaction_type" AS ENUM ('OPENING', 'SUPPLY', 'WITHDRAWAL', 'CLOSING');

-- CreateTable
CREATE TABLE "cash_register_sessions" (
    "id" TEXT NOT NULL,
    "opening_amount_in_cents" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "counted_amount_in_cents" INTEGER,
    "expected_amount_in_cents" INTEGER,
    "difference_in_cents" INTEGER,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "restaurant_id" TEXT NOT NULL,

    CONSTRAINT "cash_register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register_transactions" (
    "id" TEXT NOT NULL,
    "type" "cash_register_transaction_type" NOT NULL,
    "amount_in_cents" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,

    CONSTRAINT "cash_register_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_register_sessions_restaurant_id_opened_at_idx" ON "cash_register_sessions"("restaurant_id", "opened_at");

-- CreateIndex
CREATE INDEX "cash_register_transactions_session_id_created_at_idx" ON "cash_register_transactions"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_transactions" ADD CONSTRAINT "cash_register_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cash_register_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_transactions" ADD CONSTRAINT "cash_register_transactions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_transactions" ADD CONSTRAINT "cash_register_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: business rules enforced by the database itself
-- ---------------------------------------------------------------------------

-- Only one open cash register per restaurant.
CREATE UNIQUE INDEX "cash_register_sessions_one_open_per_restaurant_idx"
    ON "cash_register_sessions"("restaurant_id")
    WHERE "closed_at" IS NULL;

-- Amounts are never negative (the transaction type carries the direction).
ALTER TABLE "cash_register_sessions"
    ADD CONSTRAINT "cash_register_sessions_opening_amount_check" CHECK ("opening_amount_in_cents" >= 0);
ALTER TABLE "cash_register_transactions"
    ADD CONSTRAINT "cash_register_transactions_amount_check" CHECK ("amount_in_cents" >= 0);

-- RN03: cash-register movements are an append-only audit log. DELETE stays
-- allowed so that shutting down a restaurant can cascade; no API route deletes.
CREATE FUNCTION "reject_cash_register_transaction_update"() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'cash_register_transactions rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_register_transactions_immutable"
    BEFORE UPDATE ON "cash_register_transactions"
    FOR EACH ROW EXECUTE FUNCTION "reject_cash_register_transaction_update"();

-- RN03: a session can only be updated while open (i.e. the closing update);
-- once closed, it is frozen.
CREATE FUNCTION "reject_closed_cash_register_session_update"() RETURNS TRIGGER AS $$
BEGIN
    IF OLD."closed_at" IS NOT NULL THEN
        RAISE EXCEPTION 'closed cash_register_sessions rows are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cash_register_sessions_immutable_when_closed"
    BEFORE UPDATE ON "cash_register_sessions"
    FOR EACH ROW EXECUTE FUNCTION "reject_closed_cash_register_session_update"();
