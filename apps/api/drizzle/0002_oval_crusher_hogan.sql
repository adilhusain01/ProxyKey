CREATE TABLE "deploy_events" (
	"deploy_hash" text PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"account_hash" text NOT NULL,
	"intent_id" text,
	"mandate_id" text,
	"status" text NOT NULL,
	"raw" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deploy_events_account_idx" ON "deploy_events" USING btree ("account_hash");--> statement-breakpoint
CREATE INDEX "deploy_events_operation_idx" ON "deploy_events" USING btree ("operation");