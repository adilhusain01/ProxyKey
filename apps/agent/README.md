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
pnpm --filter @proxykey/agent start
pnpm --filter @proxykey/agent testnet:lifecycle -- --key ./casper_temp_private_key.pem
pnpm --filter @proxykey/agent typecheck
pnpm --filter @proxykey/agent test
```

Use `dev` only in a terminal. MCP clients should run the built server with `start` or direct `node apps/agent/dist/main.js`, because stdio MCP servers must not print watcher logs to stdout.

## Integration

Set `PROXYKEY_API_BASE_URL` for post-transaction indexing through the Fastify API. `register_agent` and `stage_intent` return prepared Casper deploy payloads first; `index_registered_agent` and `index_staged_intent` submit the finalized Testnet deploy hash to the API after the agent key signs and sends the transaction.

`request_mandate` returns the mandate request and prepared deploy payload, but it does not index a created user mandate. The connected user wallet signs approval in the PWA through CSPR.click.

The MCP server never needs the user's private key. It stages intents, checks mandates, and executes only through mandate-scoped calls.

## MCP Client Config

Build before connecting:

```sh
pnpm --filter @proxykey/agent build
```

For VS Code MCP, add this server to `.vscode/mcp.json` or the user MCP config. VS Code uses the `servers` key:

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

For Claude Desktop, Cursor, and other clients that use the common MCP config shape, add:

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

For Cursor, put the JSON in `.cursor/mcp.json` for project scope or `~/.cursor/mcp.json` for global scope. For Claude Desktop, add the same `mcpServers` object to `claude_desktop_config.json`. Restart the MCP client after changing config.

## Agent Prompt

Use this as the agent instruction during the demo:

```text
You are RWA Sentinel, an AI agent connected to ProxyKey. You must never ask for or handle the user's private key. Register your agent identity, request a mandate to buy one RWA risk report from rwa-risk-api, stage the intent for the connected user account, wait for user approval, check the approved mandate, execute only within mandate scope, verify the x402 RWA report payment, and explain every pending approval in user-readable language.
```

## Tool Payloads

Replace account values with the actual Testnet accounts. Amounts are in motes.

`register_agent`:

```json
{
  "accountHash": "account-hash-agent...",
  "publicKey": "02...",
  "name": "RWA Sentinel",
  "metadataUri": "https://proxykey.local/agents/rwa-sentinel.json",
  "capabilities": ["rwa-risk-data", "x402-payment", "receipt-ledger"],
  "capabilitiesHash": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "status": "active"
}
```

After the agent wallet submits the returned `register_agent` deploy, call `index_registered_agent` with the same fields plus `deployHash`.

`stage_intent`:

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
  "nonce": "nonce-rwa-001"
}
```

After the agent wallet submits the returned `stage_intent` deploy, call `index_staged_intent` with the same fields plus `deployHash`. The intent then appears in the user's PWA approval inbox.

`explain_pending_approval`:

```json
{
  "agentName": "RWA Sentinel",
  "target": "rwa-risk-api",
  "amount": "2500000000",
  "reason": "Agent needs paid RWA risk data before recommending treasury allocation."
}
```

`check_mandate`:

```json
{
  "user": "account-hash-user...",
  "mandateId": "mandate-..."
}
```

`execute_authorized_payment` after the user approval is indexed:

```json
{
  "user": "account-hash-user...",
  "mandateId": "mandate-...",
  "agent": "account-hash-agent...",
  "settlementAccount": "account-hash-rwa-service...",
  "intentId": "intent-...",
  "amount": "2500000000",
  "target": "rwa-risk-api",
  "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "deployHash": "0xexecute_payment_deploy_hash",
  "resultHash": "0x4444444444444444444444444444444444444444444444444444444444444444",
  "currentBlock": "1"
}
```

`fetch_rwa_report`:

```json
{
  "asset": "tokenized-tbill",
  "apiBaseUrl": "http://localhost:4000"
}
```

`record_receipt` after a separate `record_receipt` deploy finalizes:

```json
{
  "user": "account-hash-user...",
  "intentId": "intent-...",
  "mandateId": "mandate-...",
  "deployHash": "0xexecute_payment_deploy_hash",
  "recordDeployHash": "0xrecord_receipt_deploy_hash",
  "amount": "2500000000",
  "target": "rwa-risk-api",
  "resourceHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "resultHash": "0x4444444444444444444444444444444444444444444444444444444444444444"
}
```

## Real Testnet Lifecycle Command

With the API running and a funded Testnet key available:

```sh
pnpm --filter @proxykey/agent testnet:lifecycle -- \
  --key ./casper_temp_private_key.pem \
  --deposit-motes 50000000 \
  --payment-motes 20000000
```

Optional flags:

- `--skip-deposit`: use existing indexed vault balance.
- `--api http://localhost:4000`: override `PROXYKEY_API_BASE_URL`.
- `--rpc https://node.testnet.casper.network/rpc`: override `CASPER_NODE_RPC_URL`.
- `--contract hash-...`: override `PROXYKEY_CONTRACT_HASH`.
- `--settlement-account account-hash-...`: override `RWA_SERVICE_ACCOUNT`.
- `--deploy-payment-motes 10000000000`: override the Testnet payment cap.

The command spends real Testnet CSPR for gas and submitted transfers.
