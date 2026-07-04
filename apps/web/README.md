# ProxyKey Web

Mobile-first ProxyKey control center for Casper agent mandates.

The web app is not backed by hardcoded fixture data. It reads the connected CSPR.click wallet account and loads intents, mandates, vault balances, agents, and receipts from the Fastify API.

## Stack

- TanStack Start with server-side rendering
- TanStack Router and TanStack Query
- Tailwind CSS v4
- shadcn-style components
- CSPR.click wallet connection on Casper Testnet

## Commands

```sh
pnpm --filter @proxykey/web dev
pnpm --filter @proxykey/web build
pnpm --filter @proxykey/web typecheck
pnpm --filter @proxykey/web test
```

## Data Flow

- Wallet identity comes from CSPR.click and is stored in the local Zustand account store.
- TanStack Query reads account-scoped data from `VITE_PROXYKEY_API_BASE_URL`.
- Empty states are shown when the connected account has no indexed intents, mandates, receipts, or vault balance.
- Approval and vault actions call the API routes that mirror the intended Casper contract flow.

## CSPR.click

Local development uses the official `csprclick-template` app id. Set `VITE_CSPRCLICK_APP_ID` for a registered CSPR.build app id before deploying outside localhost.

Set `VITE_WALLETCONNECT_PROJECT_ID` to enable WalletConnect in the provider list.

## Current Limitation

The PWA currently prepares and indexes the mandate flow through the API. Final production behavior still needs CSPR.click signed Casper Testnet deploy submission and an indexer that reads confirmed contract events back into PostgreSQL.
