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
- Vault deposit, vault withdraw, intent approval, and mandate revocation first build a Casper contract-call transaction through `@proxykey/casper`.
- CSPR.click sends the transaction from the connected wallet.
- The API index is updated only after the wallet returns a deploy or transaction hash.

## CSPR.click

Local development uses the official `csprclick-template` app id. Set `VITE_CSPRCLICK_APP_ID` for a registered CSPR.build app id before deploying outside localhost.

Set `VITE_WALLETCONNECT_PROJECT_ID` to enable WalletConnect in the provider list.

Set `VITE_PROXYKEY_CONTRACT_HASH` to the deployed ProxyKey Casper Testnet contract hash before signing user actions.

## Current Limitation

The PWA now sends user-sensitive actions through CSPR.click. Final production behavior still needs a deployed Casper Testnet contract package and an indexer that reads confirmed contract events back into PostgreSQL.
