-- CreateIndex
CREATE INDEX "order_items_tab_id_created_at_idx" ON "order_items"("tab_id", "created_at");

-- CreateIndex
CREATE INDEX "tabs_table_id_closed_at_idx" ON "tabs"("table_id", "closed_at");
