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

Remaining production gap: real Casper Testnet deployment and CSPR.click signed deploy submission are not complete yet. `contracts/agent-mandates` is a tested Rust contract-domain implementation, and `packages/casper` prepares Casper entrypoint payloads, but the authority still needs to move from the local API/index flow to deployed Casper contracts and an event indexer.

## Apps and Packages

- `apps/web`: mobile-first PWA control center built with TanStack Start, TanStack Router, TanStack Query, Tailwind CSS, and shadcn-style components.
- `apps/api`: Fastify API for wallet challenges, indexed reads, and x402 RWA payment verification.
- `apps/agent`: MCP server exposing ProxyKey tools for AI agents.
- `contracts/agent-mandates`: Rust contract-domain implementation for AgentRegistry, IntentInbox, MandateVault, and ReceiptLedger behavior.
- `packages/shared`: shared Zod schemas and TypeScript types.
- `packages/casper`: Casper Testnet client/deploy helpers.
- `packages/ui`: shared UI package boundary for future extracted components.

## Product Flow

The connected local flow is API-first and mirrors the intended on-chain contract flow:

- `POST /agents` registers an agent identity.
- `POST /users/:account/vault/deposit` indexes user vault funding.
- `POST /users/:account/intents` stages an agent intent for approval.
- `PATCH /users/:account/intents/:id` approves or rejects. Approval creates a mandate and reserves vault balance.
- `POST /users/:account/mandates/:id/execute` executes within mandate scope, updates vault and mandate state, and writes a receipt.
- `GET /users/:account/intents`, `/mandates`, `/receipts`, and `/vault` power the PWA.

MCP tools in `apps/agent` call these same API paths and return prepared Casper deploy payloads from `packages/casper`.

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
- `PROXYKEY_API_BASE_URL`: API URL used by the MCP agent tools for indexing agent actions.
- `PROXYKEY_CONTRACT_HASH`: deployed Casper Testnet contract package hash.
- `VITE_CSPRCLICK_APP_ID`: CSPR.click app id. `csprclick-template` is valid for localhost development.
- `VITE_PROXYKEY_API_BASE_URL`: Fastify indexer API used by the web app.
- `VITE_WALLETCONNECT_PROJECT_ID`: enables WalletConnect in CSPR.click when provided.

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

The current command-verified path covers shared schema validation, Fastify route validation, MCP tool validation, production builds, and Rust contract-domain tests for nonce replay rejection, mandate caps, target/resource enforcement, revocation, and execution.

## Next On-Chain Work

To make ProxyKey fully Casper-authoritative:

1. Convert the Rust contract-domain implementation into deployable Odra contracts.
2. Deploy the contract package to Casper Testnet and set `PROXYKEY_CONTRACT_HASH`.
3. Submit user actions through CSPR.click signed deploys instead of direct API writes.
4. Add an indexer that watches Casper deploy results and updates PostgreSQL from contract events.
5. Gate API mutation routes so only verified agent/user signatures can index pending off-chain state.
