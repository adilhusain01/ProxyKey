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

User-side CSPR.click submission is wired for vault deposit, vault withdraw, intent approval, and mandate revocation. Vault deposit uses a compiled session Wasm that transfers real CSPR from the user's main purse into the contract payable entrypoint; the other wallet actions build Casper package-call transactions through `packages/casper`. The API verifies the returned deploy or transaction hash against Casper Testnet RPC, decodes the target entrypoint/runtime args or session Wasm hash, and only then indexes the state change.

The API records verified deploy events in PostgreSQL for agent registration, intent staging, vault, approval/rejection, mandate, execution, x402, and receipt operations. `contracts/agent-mandates` is deployed on Casper Testnet as package `hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7`, with optimized Casper Wasm and generated Casper schema artifacts committed.

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
- `POST /users/:account/vault/deposit` indexes user vault funding after a confirmed deposit session transaction whose Wasm hash and runtime args match ProxyKey.
- `POST /users/:account/intents` indexes an agent intent after a confirmed `stage_intent` transaction.
- `PATCH /users/:account/intents/:id` approves or rejects. Approval requires a confirmed `create_mandate` transaction, creates the indexed mandate, and reserves vault balance. Rejection requires a confirmed `reject_intent` transaction.
- `POST /users/:account/mandates/:id/execute` executes within mandate scope, updates vault and mandate state, and writes a receipt.
- `GET /users/:account/intents`, `/mandates`, `/receipts`, and `/vault` power the PWA.
- `GET /users/:account/deploys`, `GET /deploys/:hash`, and `GET /contract` expose verified Casper deploy index events and live package state.

MCP tools in `apps/agent` return prepared Casper deploy payloads from `packages/casper`. `index_registered_agent` and `index_staged_intent` accept finalized Testnet hashes after the agent submits `register_agent` or `stage_intent`.

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm contracts:test
pnpm contracts:session:build
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

For MCP clients, build the agent server first and run the built stdio entrypoint. Do not point MCP clients at the `dev` watcher because stdio MCP servers must keep stdout reserved for JSON-RPC messages.

```sh
pnpm --filter @proxykey/agent build
node apps/agent/dist/main.js
```

## Demo Quick Start

Use this path when preparing or rehearsing the hackathon demo:

```sh
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm contracts:session:build
pnpm --filter @proxykey/api db:migrate
pnpm --filter @proxykey/api dev
pnpm --filter @proxykey/web dev
pnpm --filter @proxykey/agent build
```

Connect a Casper Testnet wallet in the PWA at `http://localhost:3000`, open `Vault`, and deposit enough CSPR for the mandate cap. Testnet contract calls use a 10 CSPR payment cap; unused payment is returned by Casper, but the wallet must have enough balance to cover the cap.

For a command-level lifecycle test with a funded Testnet key:

```sh
pnpm --filter @proxykey/agent testnet:lifecycle -- \
  --key ./casper_temp_private_key.pem \
  --deposit-motes 50000000 \
  --payment-motes 20000000
```

That command submits real Casper Testnet transactions and verifies the indexed API state. It performs:

1. Vault deposit through the session Wasm.
2. Agent registration on the ProxyKey package.
3. Intent staging for a paid RWA risk report.
4. Mandate creation for the staged intent.
5. Authorized payment execution to the RWA settlement account.
6. Receipt recording on-chain and in the API index.
7. x402 RWA report payment verification.
8. Account-scoped reads for vault, intents, mandates, receipts, and deploy events.

The script reads `.env`, `PROXYKEY_CONTRACT_HASH`, `CASPER_NODE_RPC_URL`, `PROXYKEY_API_BASE_URL`, `RWA_SERVICE_ACCOUNT`, and the private key path passed through `--key`. Private keys are ignored by git.

For the exact recording order, narration, screen sequence, and known-good Testnet proof, use [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## MCP Agent Connection

ProxyKey exposes a local stdio MCP server from `apps/agent`. Use it with any MCP client that supports local stdio servers. VS Code uses a `servers` key:

```json
{
  "servers": {
    "proxykey": {
      "command": "node",
      "args": [
        "/Users/adilhusain/Downloads/untitled folder/apps/agent/dist/main.js"
      ],
      "env": {
        "PROXYKEY_API_BASE_URL": "http://localhost:4000",
        "PROXYKEY_CONTRACT_HASH": "hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7"
      }
    }
  }
}
```

Claude Desktop, Cursor, and other clients commonly use `mcpServers`:

```json
{
  "mcpServers": {
    "proxykey": {
      "command": "node",
      "args": [
        "/Users/adilhusain/Downloads/untitled folder/apps/agent/dist/main.js"
      ],
      "env": {
        "PROXYKEY_API_BASE_URL": "http://localhost:4000",
        "PROXYKEY_CONTRACT_HASH": "hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7"
      }
    }
  }
}
```

The MCP server does not receive the user's private key. Agent tools return prepared Casper deploy data or index finalized hashes after a wallet/agent runtime submits transactions. See `apps/agent/README.md` for exact tool payloads.

## Demo Narrative

Use this flow for the video and live walkthrough:

1. Open with the problem: AI agents can discover opportunities and call APIs, but giving them a user private key is unacceptable. ProxyKey replaces private-key sharing with user-owned Casper mandates.
2. Show the PWA inbox and vault: the user controls a Casper Testnet vault, sees pending agent intents, and approves/revokes scoped authority.
3. Show the agent side: an MCP-connected AI agent registers identity, requests paid RWA risk data, and stages an intent without holding the user's key.
4. Show the user approval: the wallet signs a Casper mandate with cap, target, resource hash, and expiry.
5. Show execution: the agent executes with its own key; the contract enforces agent identity, target, resource hash, cap, nonce, expiry, and vault balance.
6. Show the x402 moment: the RWA API returns HTTP 402 payment requirements, then returns the report only after the Casper payment proof verifies.
7. Close on auditability: the UI shows Testnet deploy hashes and receipts, proving the agent acted under scoped user permission.

Recommended one-line pitch:

> ProxyKey is a Casper-native mandate layer that lets AI agents transact for users without ever receiving user private keys.

## Submission Package

The Casper Agentic Buildathon Qualification Round requires a working prototype on Casper Testnet with a transaction-producing on-chain component, an open-source repository with usage documentation, and a public demo video. The extended submission deadline shown in the hackathon details is July 7, 2026 at 23:59. Public pages: [DoraHacks detail](https://dorahacks.io/hackathon/casper-agentic-buildathon/detail), [DoraHacks tracks](https://dorahacks.io/hackathon/casper-agentic-buildathon/tracks), and [Casper AI Toolkit](https://www.casper.network/ai).

ProxyKey should be submitted under the unified Casper Innovation Track with the RWA/x402 narrative first and DeFi as the next adjacent use case.

Use this project description as the submission base:

```text
ProxyKey is a Casper-native authorization layer for AI agents. Instead of giving an agent a private key, a user funds a Casper vault and signs scoped mandates that define exactly what an agent may do: target, resource hash, spend cap, expiry, and revocation state.

The demo focuses on RWA x402 payments. An MCP-connected AI agent requests paid RWA risk intelligence, stages an intent on Casper Testnet, and waits for the user to approve a mandate in the ProxyKey PWA. After approval, the agent executes a Casper payment from the user-funded vault to the RWA service. The contract enforces mandate scope and records receipts, while the API indexes only finalized Casper transactions.

ProxyKey matters because AI agents need payment authority, but users and institutions cannot hand over signing keys. Casper's account model, Rust/Wasm contracts, upgradability, CSPR.click wallet flow, and Testnet transaction finality make it a strong base for auditable agent permissions.
```

Demo video checklist:

- Show the wallet connection on Casper Testnet.
- Show vault deposit producing a Casper Testnet transaction.
- Show an MCP agent staging an intent.
- Show the user approving a scoped mandate through CSPR.click.
- Show the agent executing an authorized payment.
- Show the x402 RWA report unlock.
- Show receipt/deploy hashes in the UI and on CSPR.live.

Judging alignment:

- Technical execution: monorepo with PWA, Fastify indexer, MCP server, shared schemas, Casper helpers, Odra contract, PostgreSQL, and live Testnet verification.
- Innovation and originality: user-owned mandates replace private-key sharing for AI agents.
- Use of AI/agentic systems: MCP tools let an AI agent register, request authority, stage intents, check mandates, execute authorized payments, and explain approvals.
- Real-world applicability: RWA risk-data payments demonstrate how treasury, DeFi, and institutional workflows can let agents act without custodying user keys.
- UX and design: mobile-first approval inbox, vault, mandate, agent, receipt, and report surfaces.
- Working smart contracts: deployed Casper Testnet package with vault, mandate, execution, and receipt entrypoints.
- Long-term launch plan: evolve from Testnet prototype into reusable Casper agent authorization infrastructure for RWA APIs, treasury agents, and DeFi automation.
- Long-term impact: positions Casper as a trust and permission layer for the agent economy, where agents can transact under auditable user-owned limits.

Repository submission checklist:

- GitHub URL.
- Demo video URL.
- Testnet package hash: `hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7`.
- At least one successful vault deposit, mandate creation, payment execution, and receipt deploy hash.
- README sections for setup, MCP, demo, and verification.
- Short project description using the RWA x402 narrative above.
- Project socials or launch-plan links if available, because final judging includes long-term launch plans.

## Environment

- `DATABASE_URL`: PostgreSQL connection used by the Fastify indexer API.
- `CASPER_NODE_RPC_URL`: Casper Testnet RPC endpoint used to verify deploy and transaction hashes before indexing.
- `CASPER_DEPLOY_VERIFY_ATTEMPTS`: bounded polling attempts for newly submitted hashes.
- `CASPER_DEPLOY_VERIFY_DELAY_MS`: delay between Casper RPC polling attempts.
- `PROXYKEY_API_BASE_URL`: API URL used by the MCP agent tools for indexing agent actions.
- `PROXYKEY_CONTRACT_HASH`: deployed Casper Testnet contract package hash. Current Testnet package: `hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7`.
- `PROXYKEY_DEPOSIT_SESSION_WASM_SHA256`: SHA-256 of the compiled vault deposit session Wasm accepted by the API for indexing deposits.
- `RWA_SERVICE_ACCOUNT`: Casper account hash that receives x402 RWA settlement payments.
- `VITE_CSPRCLICK_APP_ID`: CSPR.click app id. `csprclick-template` is valid for localhost development.
- `VITE_PROXYKEY_API_BASE_URL`: Fastify indexer API used by the web app.
- `VITE_PROXYKEY_CONTRACT_HASH`: deployed Casper Testnet package hash used by the PWA when building CSPR.click transactions.
- `VITE_PROXYKEY_DEPOSIT_SESSION_WASM_URL`: public web path for the compiled deposit session Wasm.
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

## On-Chain Status

The Testnet package is deployed and API mutation routes are gated by decoded, finalized contract calls. Vault funding uses a real payable CSPR session, withdrawals transfer CSPR from the contract purse back to the user, and authorized execution transfers CSPR to the supplied `settlement_account`. The contract emits domain events for agent registration, intents, vault movements, approvals, mandates, payment execution, and receipts; indexed deploy records expose parsed contract messages when present in Casper RPC payloads.
