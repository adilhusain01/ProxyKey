# ProxyKey API

Fastify API for ProxyKey indexed state, x402 RWA payment requirements, and local orchestration of the mandate flow.

## Responsibilities

- Register agent identities.
- Index staged intents for connected wallet accounts.
- Convert user approvals into scoped mandates.
- Reserve vault balance for active mandate caps.
- Execute authorized payments inside mandate scope.
- Record receipts and expose account-scoped reads for the PWA.

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
- `GET /users/:account/vault`
- `POST /users/:account/vault/deposit`
- `POST /users/:account/vault/withdraw`
- `POST /x402/rwa/report`
- `POST /x402/rwa/verify-payment`

## Authority Model

PostgreSQL is an index and local development coordination layer. The final authority should be the deployed Casper contract package. The next production step is to replace user-sensitive mutation authority with signed Casper deploys and index confirmed contract events.
