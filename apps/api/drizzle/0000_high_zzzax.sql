CREATE TABLE "agents" (
	"account_hash" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"name" text NOT NULL,
	"metadata_uri" text NOT NULL,
	"capabilities" text NOT NULL,
	"capabilities_hash" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_account" text NOT NULL,
	"agent_account" text NOT NULL,
	"target" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"amount" bigint NOT NULL,
	"resource_hash" text NOT NULL,
	"payload_hash" text NOT NULL,
	"nonce" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" text PRIMARY KEY NOT NULL,
	"user_account" text NOT NULL,
	"agent_account" text NOT NULL,
	"scope" text NOT NULL,
	"cap" bigint NOT NULL,
	"spent" bigint NOT NULL,
	"target" text NOT NULL,
	"resource_pattern_hash" text NOT NULL,
	"expiry_block" bigint NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"intent_id" text NOT NULL,
	"mandate_id" text NOT NULL,
	"deploy_hash" text NOT NULL,
	"amount" bigint NOT NULL,
	"target" text NOT NULL,
	"resource_hash" text NOT NULL,
	"result_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_balances" (
	"user_account" text PRIMARY KEY NOT NULL,
	"total" bigint NOT NULL,
	"reserved" bigint NOT NULL,
	"available" bigint NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
