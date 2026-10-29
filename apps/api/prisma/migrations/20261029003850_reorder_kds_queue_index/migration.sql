-- DropIndex
DROP INDEX "order_items_restaurant_id_sent_to_kitchen_at_status_idx";

-- CreateIndex
CREATE INDEX "order_items_restaurant_id_status_sent_to_kitchen_at_idx" ON "order_items"("restaurant_id", "status", "sent_to_kitchen_at");
