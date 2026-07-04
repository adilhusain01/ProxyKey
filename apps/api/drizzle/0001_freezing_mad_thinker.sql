CREATE INDEX "intents_user_idx" ON "intents" USING btree ("user_account");--> statement-breakpoint
CREATE UNIQUE INDEX "intents_agent_nonce_idx" ON "intents" USING btree ("agent_account","nonce");--> statement-breakpoint
CREATE INDEX "mandates_user_idx" ON "mandates" USING btree ("user_account");--> statement-breakpoint
CREATE INDEX "receipts_mandate_idx" ON "receipts" USING btree ("mandate_id");