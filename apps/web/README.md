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
- Vault deposit first builds a Casper Testnet session transaction around `/wasm/proxykey_deposit_session.wasm`; vault withdraw, intent approval, and mandate revocation build package-call transactions through `@proxykey/casper`.
- CSPR.click sends the transaction from the connected wallet.
- The API index is updated only after the wallet returns a deploy or transaction hash and the API verifies the finalized entrypoint/runtime args.

## Demo Operator Flow

1. Start the API and web app.
2. Connect a funded Casper Testnet wallet through CSPR.click.
3. Open `Vault`, enter the amount in CSPR, and sign `Deposit`.
4. Use the MCP agent or `pnpm --filter @proxykey/agent testnet:lifecycle -- --skip-deposit --key ./casper_temp_private_key.pem` to register the agent and stage an intent.
5. Open `Inbox`, inspect the pending agent request, and approve a scoped mandate through CSPR.click.
6. Let the agent execute the authorized payment and verify the x402 report.
7. Open `Mandates` and `Receipts` to show cap usage, status, and deploy hashes.

The UI should show empty states for accounts with no indexed records. It should not show seeded fixture data during the demo.

## CSPR.click

Local development uses the official `csprclick-template` app id. Set `VITE_CSPRCLICK_APP_ID` for a registered CSPR.build app id before deploying outside localhost.

Set `VITE_WALLETCONNECT_PROJECT_ID` to enable WalletConnect in the provider list.

Set `VITE_PROXYKEY_CONTRACT_HASH` to the deployed ProxyKey Casper Testnet package hash before signing user actions. Current Testnet package: `hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7`.

Set `VITE_PROXYKEY_DEPOSIT_SESSION_WASM_URL` to the public deposit session path. Local development uses `/wasm/proxykey_deposit_session.wasm`.

The PWA sends user-sensitive actions through CSPR.click and never receives the user's private key.
