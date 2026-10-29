-- CreateIndex
CREATE INDEX "order_items_restaurant_id_sent_to_kitchen_at_status_idx" ON "order_items"("restaurant_id", "sent_to_kitchen_at", "status");

-- CreateIndex
CREATE INDEX "order_items_updated_at_idx" ON "order_items"("updated_at");
