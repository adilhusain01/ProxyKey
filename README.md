# ProxyKey

ProxyKey is a Casper-native mandate layer for AI agents. Agents request authority, users approve or delegate scoped authority, and mandate execution is capped, auditable, and receipt-backed.

## Current Status

This repository is a connected hackathon prototype. The local product loop is wired through the Fastify API, MCP agent tools, PostgreSQL index, shared schemas, and the web PWA:

1. An agent registers its identity.
2. A user-funded vault is indexed for a connected wallet account.
3. An agent stages an intent for that user.
4. User approval creates a scoped mandate and reserves the mandate cap.
5. Agent execution consumes reserved vault funds, updates mandate spend, marks the intent executed, and records a receipt.
6. The web app reads only connected-wallet API data; it does not ship hardcoded fixture records.

User-side CSPR.click submission is wired for vault deposit, vault withdraw, intent approval, and mandate revocation. Those flows build Casper package-call transactions through `packages/casper`, send them through the connected wallet, verify the returned deploy or transaction hash against Casper Testnet RPC, decode the target entrypoint and runtime args, and only then index the state change in the API.

The API records verified deploy events in PostgreSQL for agent registration, intent staging, vault, approval/rejection, mandate, execution, x402, and receipt operations. `contracts/agent-mandates` is deployed on Casper Testnet as package `hash-2c26789c896fdb3500d760be852471234b1778dce90863ee05f5c7eb0ef34667`, with optimized Casper Wasm and generated Casper schema artifacts committed.

## Apps and Packages

- `apps/web`: mobile-first PWA control center built with TanStack Start, TanStack Router, TanStack Query, Tailwind CSS, and shadcn-style components.
- `apps/api`: Fastify API for wallet challenges, indexed reads, and x402 RWA payment verification.
- `apps/agent`: MCP server exposing ProxyKey tools for AI agents.
- `contracts/agent-mandates`: Odra/Rust Casper contract for agent registry, intent inbox, mandate vault, and receipt ledger behavior.
- `packages/shared`: shared Zod schemas and TypeScript types.
- `packages/casper`: Casper Testnet transaction helpers for CSPR.click and agent deploy payloads.
- `packages/ui`: shared UI package boundary for future extracted components.

## Product Flow

The connected local flow is API-first and mirrors the intended on-chain contract flow:

- `POST /agents` indexes an agent identity after a confirmed `register_agent` transaction.
- `POST /users/:account/vault/deposit` indexes user vault funding after a confirmed `deposit` transaction.
- `POST /users/:account/intents` indexes an agent intent after a confirmed `stage_intent` transaction.
- `PATCH /users/:account/intents/:id` approves or rejects. Approval requires a confirmed `create_mandate` transaction, creates the indexed mandate, and reserves vault balance. Rejection requires a confirmed `reject_intent` transaction.
- `POST /users/:account/mandates/:id/execute` executes within mandate scope, updates vault and mandate state, and writes a receipt.
- `GET /users/:account/intents`, `/mandates`, `/receipts`, and `/vault` power the PWA.
- `GET /users/:account/deploys`, `GET /deploys/:hash`, and `GET /contract` expose verified Casper deploy index events and live package state.

MCP tools in `apps/agent` return prepared Casper deploy payloads from `packages/casper`. Indexing happens after a real Testnet transaction hash is available.

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm contracts:test
pnpm --filter @proxykey/web dev
pnpm --filter @proxykey/api dev
pnpm --filter @proxykey/agent dev
pnpm contracts:build
pnpm contracts:schema
```

## Local Stack

```sh
cp .env.example .env
docker compose up -d postgres
pnpm --filter @proxykey/api db:migrate
pnpm --filter @proxykey/api dev
pnpm --filter @proxykey/web dev
pnpm --filter @proxykey/agent dev
```

The web app runs on `http://localhost:3000` by default. If that port is in use, Vite will offer the next available port.

## Environment

- `DATABASE_URL`: PostgreSQL connection used by the Fastify indexer API.
- `CASPER_NODE_RPC_URL`: Casper Testnet RPC endpoint used to verify deploy and transaction hashes before indexing.
- `CASPER_DEPLOY_VERIFY_ATTEMPTS`: bounded polling attempts for newly submitted hashes.
- `CASPER_DEPLOY_VERIFY_DELAY_MS`: delay between Casper RPC polling attempts.
- `PROXYKEY_API_BASE_URL`: API URL used by the MCP agent tools for indexing agent actions.
- `PROXYKEY_CONTRACT_HASH`: deployed Casper Testnet contract package hash. Current Testnet package: `hash-2c26789c896fdb3500d760be852471234b1778dce90863ee05f5c7eb0ef34667`.
- `VITE_CSPRCLICK_APP_ID`: CSPR.click app id. `csprclick-template` is valid for localhost development.
- `VITE_PROXYKEY_API_BASE_URL`: Fastify indexer API used by the web app.
- `VITE_PROXYKEY_CONTRACT_HASH`: deployed Casper Testnet package hash used by the PWA when building CSPR.click package-call transactions.
- `VITE_WALLETCONNECT_PROJECT_ID`: enables WalletConnect in CSPR.click when provided.

Local private keys such as `casper_temp_private_key.pem` are ignored by git. Keep temporary Casper keys in ignored files or `.env`; never stage them.

## Database

The API schema lives in `apps/api/src/db/schema.ts` and migrations live in `apps/api/drizzle`.

```sh
pnpm --filter @proxykey/api db:generate
pnpm --filter @proxykey/api db:migrate
```

PostgreSQL is an index for fast reads from contract and agent events. Casper contracts remain the authority for vault balances, mandate status, spend limits, and receipts.

`pnpm --filter @proxykey/api db:seed` is only a local development fixture for exercising screens without an agent. The web app itself does not ship seeded fallback records; it reads the connected wallet account and indexed API data.

## Verification

Run the full command checks before submitting:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:test
```

The current command-verified path covers shared schema validation, CSPR.click-ready transaction payload construction, Fastify route validation including deploy-hash gates, Casper deploy-event indexing code, MCP tool validation, production builds, and Rust contract-domain tests for nonce replay rejection, mandate caps, target/resource enforcement, revocation, and execution.
The contract checks require nightly Rust because Odra 2.8.2 uses nightly macro features. The contract package pins `rust-toolchain` to `nightly`; `pnpm contracts:test`, `pnpm contracts:build`, and `pnpm contracts:schema` use that path.

## Remaining On-Chain Work

The Testnet package is deployed and API mutation routes are gated by decoded, finalized contract calls. Remaining hardening:

1. Replace explicit-amount vault accounting with real CSPR custody/settlement once the wallet flow supports the required purse transfer path.
2. Add emitted contract messages for each domain event so the indexer can consume contract events directly instead of decoding transaction payloads and querying package state.
3. Add a post-submit agent index tool that accepts the executed deploy hash after an agent key submits `register_agent` or `stage_intent`.
