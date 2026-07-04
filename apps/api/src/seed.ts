import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { agents, intents, mandates, receipts, vaultBalances } from "./db/schema";
import { closeDb, createDb } from "./db/client";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const hash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const user = "account-hash-user001";
const now = new Date();

const db = createDb();

await db
  .insert(agents)
  .values([
    {
      accountHash: "account-hash-agent001",
      publicKey:
        "01rwasentinel00000000000000000000000000000000000000000000000001",
      name: "RWA Sentinel",
      metadataUri: "https://proxykey.app/agents/rwa-sentinel.json",
      capabilities: JSON.stringify([
        "rwa-risk-data",
        "x402-payment",
        "receipt-ledger",
      ]),
      capabilitiesHash: hash,
      status: "active",
      createdAt: now,
    },
    {
      accountHash: "account-hash-agent002",
      publicKey:
        "01yieldrouter00000000000000000000000000000000000000000000000002",
      name: "Yield Router",
      metadataUri: "https://proxykey.app/agents/yield-router.json",
      capabilities: JSON.stringify(["defi-rebalance", "receipt-ledger"]),
      capabilitiesHash: hash,
      status: "active",
      createdAt: now,
    },
  ])
  .onConflictDoUpdate({
    target: agents.accountHash,
    set: {
      publicKey: sql`excluded.public_key`,
      name: sql`excluded.name`,
      metadataUri: sql`excluded.metadata_uri`,
      capabilities: sql`excluded.capabilities`,
      capabilitiesHash: sql`excluded.capabilities_hash`,
      status: sql`excluded.status`,
      createdAt: sql`excluded.created_at`,
    },
  });

await db
  .insert(intents)
  .values([
    {
      id: "intent-rwa-001",
      user,
      agent: "account-hash-agent001",
      target: "rwa-risk-api",
      action: "fetch-risk-report",
      reason:
        "Fetch paid RWA risk data before approving a tokenized treasury allocation.",
      amount: 2_500_000_000n,
      resourceHash: hash,
      payloadHash: hash,
      nonce: "nonce-rwa-001",
      status: "pending",
      createdAt: now,
    },
    {
      id: "intent-defi-002",
      user,
      agent: "account-hash-agent002",
      target: "defi-rebalance-contract",
      action: "rebalance-position",
      reason:
        "Rebalance within the allowed DeFi mandate after risk threshold changes.",
      amount: 1_000_000_000n,
      resourceHash: hash,
      payloadHash: hash,
      nonce: "nonce-defi-002",
      status: "approved",
      createdAt: now,
    },
  ])
  .onConflictDoUpdate({
    target: intents.id,
    set: {
      user: sql`excluded.user_account`,
      agent: sql`excluded.agent_account`,
      target: sql`excluded.target`,
      action: sql`excluded.action`,
      reason: sql`excluded.reason`,
      amount: sql`excluded.amount`,
      resourceHash: sql`excluded.resource_hash`,
      payloadHash: sql`excluded.payload_hash`,
      nonce: sql`excluded.nonce`,
      status: sql`excluded.status`,
      createdAt: sql`excluded.created_at`,
    },
  });

await db
  .insert(mandates)
  .values([
    {
      id: "mandate-rwa-001",
      user,
      agent: "account-hash-agent001",
      scope: "delegated",
      cap: 10_000_000_000n,
      spent: 2_500_000_000n,
      target: "rwa-risk-api",
      resourcePatternHash: hash,
      expiryBlock: 8_124_421n,
      status: "active",
    },
    {
      id: "mandate-defi-002",
      user,
      agent: "account-hash-agent002",
      scope: "single-intent",
      cap: 1_000_000_000n,
      spent: 1_000_000_000n,
      target: "defi-rebalance-contract",
      resourcePatternHash: hash,
      expiryBlock: 8_121_500n,
      status: "exhausted",
    },
  ])
  .onConflictDoUpdate({
    target: mandates.id,
    set: {
      user: sql`excluded.user_account`,
      agent: sql`excluded.agent_account`,
      scope: sql`excluded.scope`,
      cap: sql`excluded.cap`,
      spent: sql`excluded.spent`,
      target: sql`excluded.target`,
      resourcePatternHash: sql`excluded.resource_pattern_hash`,
      expiryBlock: sql`excluded.expiry_block`,
      status: sql`excluded.status`,
    },
  });

await db
  .insert(receipts)
  .values({
    id: "receipt-rwa-001",
    intentId: "intent-rwa-001",
    mandateId: "mandate-rwa-001",
    deployHash: hash,
    amount: 2_500_000_000n,
    target: "rwa-risk-api",
    resourceHash: hash,
    resultHash: hash,
    createdAt: now,
  })
  .onConflictDoUpdate({
    target: receipts.id,
    set: {
      intentId: sql`excluded.intent_id`,
      mandateId: sql`excluded.mandate_id`,
      deployHash: sql`excluded.deploy_hash`,
      amount: sql`excluded.amount`,
      target: sql`excluded.target`,
      resourceHash: sql`excluded.resource_hash`,
      resultHash: sql`excluded.result_hash`,
      createdAt: sql`excluded.created_at`,
    },
  });

await db
  .insert(vaultBalances)
  .values({
    user,
    total: 12_000_000_000n,
    reserved: 3_500_000_000n,
    available: 8_500_000_000n,
    updatedAt: now,
  })
  .onConflictDoUpdate({
    target: vaultBalances.user,
    set: {
      total: 12_000_000_000n,
      reserved: 3_500_000_000n,
      available: 8_500_000_000n,
      updatedAt: now,
    },
  });

await closeDb();

console.log("Seeded ProxyKey Postgres index.");
