# ProxyKey API

Fastify API for ProxyKey indexed state, x402 RWA payment requirements, and local orchestration of the mandate flow.

## Responsibilities

- Register agent identities after confirmed `register_agent` transactions.
- Index staged intents for connected wallet accounts after confirmed `stage_intent` transactions.
- Convert user approvals with confirmed `create_mandate` transactions into scoped mandates.
- Reserve vault balance for active mandate caps.
- Execute authorized payments inside mandate scope.
- Record receipts and expose account-scoped reads for the PWA.
- Verify submitted deploy or transaction hashes against Casper Testnet RPC before mutating indexed state.
- Record verified deploy events for account and hash-level audit views.
- Verify vault deposit session Wasm by SHA-256 before indexing funded CSPR custody.

## Commands

```sh
pnpm --filter @proxykey/api dev
pnpm --filter @proxykey/api build
pnpm --filter @proxykey/api typecheck
pnpm --filter @proxykey/api test
pnpm --filter @proxykey/api db:migrate
```

`db:seed` is only a local fixture command. It is not required for the product flow.

## Core Routes

- `POST /agents`
- `GET /agents`
- `POST /users/:account/intents`
- `PATCH /users/:account/intents/:id`
- `POST /users/:account/mandates`
- `PATCH /users/:account/mandates/:id/revoke`
- `POST /users/:account/mandates/:id/execute`
- `GET /users/:account/intents`
- `GET /users/:account/mandates`
- `GET /users/:account/receipts`
- `GET /users/:account/deploys`
- `GET /users/:account/vault`
- `GET /deploys/:hash`
- `GET /contract`
- `POST /users/:account/vault/deposit`
- `POST /users/:account/vault/withdraw`
- `POST /x402/rwa/report`
- `POST /x402/rwa/verify-payment`

## Indexing Payload Order

All mutation routes expect finalized Casper Testnet deploy or transaction hashes. The API rejects requests that do not match the expected entrypoint, runtime args, package hash, or deposit session Wasm hash.

1. `POST /users/:account/vault/deposit`

```json
{
  "amount": "50000000",
  "deployHash": "0xvault_deposit_session_hash"
}
```

2. `POST /agents`

```json
{
  "accountHash": "account-hash-agent...",
  "publicKey": "02...",
  "name": "RWA Sentinel",
  "metadataUri": "https://proxykey.local/agents/rwa-sentinel.json",
  "capabilities": ["rwa-risk-data", "x402-payment", "receipt-ledger"],
  "capabilitiesHash": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "status": "active",
  "deployHash": "0xregister_agent_hash"
}
```

3. `POST /users/:account/intents`

```json
{
  "user": "account-hash-user...",
  "agent": "account-hash-agent...",
  "target": "rwa-risk-api",
  "action": "fetch-rwa-risk-report",
  "reason": "Agent needs paid RWA risk data before recommending treasury allocation.",
  "amount": "2500000000",
  "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "payloadHash": "0x3333333333333333333333333333333333333333333333333333333333333333",
  "nonce": "nonce-rwa-001",
  "deployHash": "0xstage_intent_hash"
}
```

4. `PATCH /users/:account/intents/:id`

```json
{
  "status": "approved",
  "mandateId": "mandate-rwa-001",
  "scope": "single-intent",
  "cap": "2500000000",
  "resourcePatternHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "expiryBlock": "9000000",
  "deployHash": "0xcreate_mandate_hash"
}
```

5. `POST /users/:account/mandates/:id/execute`

```json
{
  "agent": "account-hash-agent...",
  "settlementAccount": "account-hash-rwa-service...",
  "intentId": "intent-...",
  "amount": "2500000000",
  "target": "rwa-risk-api",
  "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "deployHash": "0xexecute_payment_hash",
  "resultHash": "0x4444444444444444444444444444444444444444444444444444444444444444",
  "currentBlock": "1"
}
```

6. `POST /receipts`

```json
{
  "user": "account-hash-user...",
  "intentId": "intent-...",
  "mandateId": "mandate-rwa-001",
  "deployHash": "0xexecute_payment_hash",
  "recordDeployHash": "0xrecord_receipt_hash",
  "amount": "2500000000",
  "target": "rwa-risk-api",
  "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "resultHash": "0x4444444444444444444444444444444444444444444444444444444444444444"
}
```

7. `POST /x402/rwa/verify-payment`

```json
{
  "asset": "tokenized-tbill",
  "proof": {
    "deployHash": "0xexecute_payment_hash",
    "from": "account-hash-user...",
    "to": "account-hash-rwa-service...",
    "amount": "2500000000",
    "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
    "signature": "0x11111111111111111111111111111111"
  }
}
```

## Authority Model

PostgreSQL is an index and local development coordination layer. Index writes for agent registration, intent staging, vault operations, approvals, direct mandate creation, revocation, execution, x402 payment verification, and receipt recording require Casper deploy or transaction hashes in the request payload. The API polls Casper RPC through `CASPER_NODE_RPC_URL`, verifies the transaction is finalized, decodes the contract entrypoint/runtime args or deposit session Wasm hash against the expected operation, and records confirmed hashes in `deploy_events` before applying the corresponding state update.

The final authority is the Odra contract package in `contracts/agent-mandates`, currently deployed on Casper Testnet at `hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7`.
