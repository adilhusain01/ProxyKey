# ProxyKey Agent MCP Server

MCP server exposing ProxyKey tools for AI agents that request user-owned mandates instead of receiving user private keys.

## Tools

- `register_agent`
- `stage_intent`
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

Set `PROXYKEY_API_BASE_URL` to index agent actions through the Fastify API. Tool responses also include prepared Casper deploy payloads from `packages/casper` so the same agent flow can move to deployed Casper entrypoints.

The MCP server never needs the user's private key. It stages intents, checks mandates, and executes only through mandate-scoped calls.
