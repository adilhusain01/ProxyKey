import { bigint, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const agents = pgTable("agents", {
  accountHash: text("account_hash").primaryKey(),
  publicKey: text("public_key").notNull(),
  name: text("name").notNull(),
  metadataUri: text("metadata_uri").notNull(),
  capabilities: text("capabilities").notNull(),
  capabilitiesHash: text("capabilities_hash").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const intents = pgTable(
  "intents",
  {
    id: text("id").primaryKey(),
    user: text("user_account").notNull(),
    agent: text("agent_account").notNull(),
    target: text("target").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    resourceHash: text("resource_hash").notNull(),
    payloadHash: text("payload_hash").notNull(),
    nonce: text("nonce").notNull(),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("intents_user_idx").on(table.user),
    uniqueIndex("intents_agent_nonce_idx").on(table.agent, table.nonce),
  ],
);

export const mandates = pgTable(
  "mandates",
  {
    id: text("id").primaryKey(),
    user: text("user_account").notNull(),
    agent: text("agent_account").notNull(),
    scope: text("scope").notNull(),
    cap: bigint("cap", { mode: "bigint" }).notNull(),
    spent: bigint("spent", { mode: "bigint" }).notNull(),
    target: text("target").notNull(),
    resourcePatternHash: text("resource_pattern_hash").notNull(),
    expiryBlock: bigint("expiry_block", { mode: "bigint" }).notNull(),
    status: text("status").notNull(),
  },
  (table) => [index("mandates_user_idx").on(table.user)],
);

export const receipts = pgTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    intentId: text("intent_id").notNull(),
    mandateId: text("mandate_id").notNull(),
    deployHash: text("deploy_hash").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    target: text("target").notNull(),
    resourceHash: text("resource_hash").notNull(),
    resultHash: text("result_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("receipts_mandate_idx").on(table.mandateId)],
);

export const vaultBalances = pgTable("vault_balances", {
  user: text("user_account").primaryKey(),
  total: bigint("total", { mode: "bigint" }).notNull(),
  reserved: bigint("reserved", { mode: "bigint" }).notNull(),
  available: bigint("available", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const deployEvents = pgTable(
  "deploy_events",
  {
    deployHash: text("deploy_hash").primaryKey(),
    operation: text("operation").notNull(),
    account: text("account_hash").notNull(),
    intentId: text("intent_id"),
    mandateId: text("mandate_id"),
    status: text("status").notNull(),
    raw: text("raw").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("deploy_events_account_idx").on(table.account),
    index("deploy_events_operation_idx").on(table.operation),
  ],
);
