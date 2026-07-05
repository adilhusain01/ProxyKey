# ProxyKey Agent MCP Server

MCP server exposing ProxyKey tools for AI agents that request user-owned mandates instead of receiving user private keys.

## Tools

- `register_agent`
- `stage_intent`
- `index_registered_agent`
- `index_staged_intent`
- `request_mandate`
- `check_mandate`
- `execute_authorized_payment`
- `fetch_rwa_report`
- `record_receipt`
- `explain_pending_approval`

## Commands

```sh
pnpm --filter @proxykey/agent dev
pnpm --filter @proxykey/agent build
pnpm --filter @proxykey/agent typecheck
pnpm --filter @proxykey/agent test
```

## Integration

Set `PROXYKEY_API_BASE_URL` for post-transaction indexing through the Fastify API. `register_agent` and `stage_intent` return prepared Casper deploy payloads first; `index_registered_agent` and `index_staged_intent` submit the finalized Testnet deploy hash to the API after the agent key signs and sends the transaction.

`request_mandate` returns the mandate request and prepared deploy payload, but it does not index a created user mandate. The connected user wallet signs approval in the PWA through CSPR.click.

The MCP server never needs the user's private key. It stages intents, checks mandates, and executes only through mandate-scoped calls.
