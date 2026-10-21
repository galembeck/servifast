-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "sent_to_kitchen_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "kds_events" (
    "id" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "tab_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,

    CONSTRAINT "kds_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kds_events_restaurant_id_processed_at_idx" ON "kds_events"("restaurant_id", "processed_at");

-- AddForeignKey
ALTER TABLE "kds_events" ADD CONSTRAINT "kds_events_tab_id_fkey" FOREIGN KEY ("tab_id") REFERENCES "tabs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kds_events" ADD CONSTRAINT "kds_events_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
