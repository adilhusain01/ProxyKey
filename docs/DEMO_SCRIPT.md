# ProxyKey Demo Script

This is the recording runbook for a Casper Agentic Buildathon demo. It is written as a live operator script: do the action, say the narration, then move to the next screen.

## Core Message

One-line pitch:

> ProxyKey lets AI agents transact on Casper through user-owned mandates instead of user private keys.

Do not frame ProxyKey as a wallet replacement. Frame it as agent authorization infrastructure:

- The user owns the wallet and vault.
- The agent can request authority.
- The user signs scoped mandates.
- The contract enforces target, amount, resource hash, expiry, and revocation.
- The receipt trail is visible on Casper Testnet.

## Pre-Recording Setup

Open four surfaces:

1. ProxyKey web app: `http://localhost:3000`
2. API terminal:

```sh
pnpm --filter @proxykey/api dev
```

3. Web terminal:

```sh
pnpm --filter @proxykey/web dev
```

4. Agent/MCP build:

```sh
pnpm --filter @proxykey/agent build
```

Confirm the API is healthy:

```sh
curl http://localhost:4000/health
```

Confirm the wallet is connected in the PWA and the connected account is the Casper Testnet account you want to demo.

Recommended demo account for this local setup:

```text
public key: 020234d10b0b9f719b01a76e11fc0c9ccc7a497bd08b1b98dd09c3ca08c86ae8b752
account hash: account-hash-e477f3fc9ee23eb4a63afe976e2cd5865922432728fcb00b5ac42c03855c00a7
```

Keep the Testnet package hash ready:

```text
hash-ea3286e01d2a2631293212506ea22e18eea25b1336e1b5cf06d493bb55a1f3b7
```

Before recording, create a fresh live Testnet proof set:

```sh
pnpm --filter @proxykey/agent testnet:lifecycle -- \
  --key ./casper_temp_private_key.pem \
  --skip-deposit \
  --payment-motes 20000000
```

This command spends real Testnet CSPR and creates a fresh agent registration, staged intent, mandate, payment execution, receipt, x402 verification, and indexed readback. Keep the printed deploy hashes visible in a terminal tab for the proof section.

## Antigravity Prompt

Paste this into Antigravity after confirming the ProxyKey MCP server is connected:

```text
You are RWA Sentinel, an AI agent connected to ProxyKey through MCP.

Use the ProxyKey MCP tools to demonstrate an agent payment request for a tokenized-tbill RWA risk report.

Do not ask for or handle the user's private key.

Use this user and agent account for the demo:
account-hash-e477f3fc9ee23eb4a63afe976e2cd5865922432728fcb00b5ac42c03855c00a7

Use target rwa-risk-api, asset tokenized-tbill, amount 20000000 motes, and a single-intent mandate.

First call fetch_rwa_report to show the x402 payment requirement.
Then call stage_intent with a fresh nonce and explain_pending_approval for the user.
Then call request_mandate to show the mandate shape.
After I provide finalized deploy hashes, call index_staged_intent, check_mandate, execute_authorized_payment, and record_receipt as appropriate.

Explain every step in user-readable language and emphasize that the agent never receives the user's private key.
```

## Demo Flow

### 1. Opening

Screen:

- ProxyKey PWA, Inbox page.

Action:

- Show the top navigation: Inbox, Mandates, Vault, Agents, Receipts.
- Show the connected wallet button and Testnet label.

Say:

> AI agents are becoming capable enough to discover opportunities, call APIs, and trigger transactions. The problem is that today's wallet model was built for humans clicking buttons, not autonomous agents. Giving an agent a private key is too dangerous. ProxyKey solves that by turning agent actions into user-owned Casper mandates.

### 2. Explain The Product

Screen:

- Stay on the PWA.

Action:

- Point to the app shell and approval inbox.

Say:

> ProxyKey is a Casper-native mandate layer. An agent can request authority, but the user keeps custody. The user can fund a vault, approve one-time or delegated mandates, cap spend, restrict the target service, restrict the resource hash, and revoke authority later. The agent never receives the user's private key.

### 3. Show Vault Control

Screen:

- Open `Vault`.

Action:

- Show total, reserved, and available balances.
- If needed, deposit a small amount from the connected wallet.

Say:

> This is the user-controlled vault. Funds are not handed to the agent. The vault is the source of mandate-limited spend, and the contract enforces how much can be used. Reserved balance means capital is locked for active mandates; available balance means the user can still withdraw or allocate it.

If you deposit during recording, say:

> This deposit is a real Casper Testnet transaction through CSPR.click. The API only indexes it after the finalized transaction matches the expected ProxyKey deposit session Wasm and runtime arguments.

### 4. Show The Agent Interface

Screen:

- Open Antigravity or the MCP client with ProxyKey tools visible.

Action:

- Show that the ProxyKey MCP server exposes tools like `register_agent`, `stage_intent`, `request_mandate`, `check_mandate`, `execute_authorized_payment`, `fetch_rwa_report`, and `record_receipt`.

Say:

> On the agent side, ProxyKey exposes an MCP server. This lets an AI agent interact with Casper authorization infrastructure without handling the user's private key. The agent can register identity, stage an intent, explain the approval, check the mandate, and index finalized execution.

### 5. Agent Requests Paid RWA Data

Screen:

- MCP client or terminal.

Action:

- Call or show `fetch_rwa_report` for `tokenized-tbill`.
- It should return `402 payment_required`.

Example MCP payload:

```json
{
  "asset": "tokenized-tbill",
  "apiBaseUrl": "http://localhost:4000"
}
```

Say:

> The demo use case is RWA risk data through an x402-style payment flow. The agent asks for a tokenized treasury risk report. The service responds with HTTP 402 payment requirements: network, payment amount, settlement account, and resource hash. The agent now knows what it wants to buy, but it still cannot spend user funds without a mandate.

### 6. Agent Stages The Intent

Screen:

- MCP client.

Action:

- Call or show `stage_intent`.
- Use the connected account as `user`.
- Use the agent account as `agent`.
- Use `rwa-risk-api` as `target`.
- Use amount in motes, for example `20000000`.

Example MCP payload:

```json
{
  "user": "account-hash-e477f3fc9ee23eb4a63afe976e2cd5865922432728fcb00b5ac42c03855c00a7",
  "agent": "account-hash-e477f3fc9ee23eb4a63afe976e2cd5865922432728fcb00b5ac42c03855c00a7",
  "target": "rwa-risk-api",
  "action": "fetch-rwa-risk-report",
  "reason": "Agent needs paid RWA risk data before recommending treasury allocation.",
  "amount": "20000000",
  "resourceHash": "32a04b63531a5f95ce8d32f6bd4b2744279feabfea959a7cd64dfc173d604722",
  "payloadHash": "ad7bbb741dce28a8f103e08f44f1c371b982c994488f7a92f2f8f9e0a867ad21",
  "nonce": "nonce-demo-001"
}
```

Say:

> The agent stages an intent. Notice what is inside it: who the user is, who the agent is, the target service, requested action, spend amount, resource hash, payload hash, and nonce. This is not a blank approval. It is a structured request that can be verified on-chain and indexed for the user.

### 7. Explain The Pending Approval

Screen:

- MCP client.

Action:

- Call or show `explain_pending_approval`.

Say:

> Before the user signs anything, the agent can explain the approval in plain language. The user sees the risk boundary: the agent cannot execute until a mandate exists, and the mandate can cap spend, target, resource hash, and expiry.

### 8. User Approves A Mandate

Screen:

- ProxyKey PWA, Inbox.

Action:

- Show pending intent if it is already indexed.
- Approve a scoped mandate through CSPR.click.
- Use a single-intent mandate for the cleanest demo.

Say:

> Now we switch back to the user. The user sees the pending agent request in the approval inbox. The important part is that the user is not signing over the private key. The user signs a Casper mandate: this agent, this target, this resource hash, this cap, until this expiry.

If you use the lifecycle command to create the approval for recording, say:

> For the recording, I am using the same funded Testnet key as both the demo user and demo agent account so the entire flow can be shown deterministically. The important design boundary remains the same: the MCP server does not receive the user's private key; it only sees finalized hashes and indexed state.

### 9. Agent Checks The Mandate

Screen:

- MCP client.

Action:

- Call `check_mandate`.

Example:

```json
{
  "user": "account-hash-e477f3fc9ee23eb4a63afe976e2cd5865922432728fcb00b5ac42c03855c00a7",
  "mandateId": "mandate-preview-f09d26a20777"
}
```

Say:

> After approval, the agent checks the mandate. It can see that authority exists, but it still only has authority inside the mandate scope. If the agent tries the wrong target, wrong resource hash, too much spend, replayed nonce, or expired block, the contract rejects it.

### 10. Agent Executes Authorized Payment

Screen:

- MCP client or terminal.

Action:

- Execute the authorized payment with a finalized Casper deploy hash.
- Show the mandate status changing to exhausted if the spend equals the cap.

Say:

> The agent now executes with its own key, under the user's mandate. The Casper contract checks agent identity, mandate status, cap, target, resource hash, expiry, nonce behavior, and vault balance. Only then does it settle payment to the RWA service and record the execution.

### 11. Show x402 Report Unlock

Screen:

- API output or MCP/API result.

Action:

- Show `/x402/rwa/verify-payment` returning `status: success`.
- Show the generated report fields: rating, yield, liquidity score, jurisdiction, source data hash, and receipt id.

Say:

> This is the x402 moment. The RWA API only returns the report after verifying the Casper payment proof. Now the agent receives structured risk data, and the user can audit exactly which mandate and deploy paid for it.

### 12. Show Receipts And Deploy Hashes

Screen:

- ProxyKey PWA, Receipts.
- Optionally open CSPR.live transaction pages for the deploy hashes.

Action:

- Show the receipt row.
- Show deploy hash for execution.
- Show receipt-record deploy hash if available in deploy events.

Say:

> The final output is not just a UI state change. ProxyKey records auditable receipts. The user can see the action, amount, target, resource hash, result hash, and Casper deploy hashes. This is the difference between letting an agent hold a private key and giving an agent scoped, revocable authority.

### 13. Closing

Screen:

- ProxyKey PWA, Mandates or Receipts.

Say:

> ProxyKey turns Casper into an authorization layer for the agent economy. Agents get the ability to act, users keep custody, and every action is capped, scoped, revocable, and receipt-backed. The first use case is RWA x402 payments, but the same mandate model can extend to DeFi rebalancing, DAO execution, treasury workflows, and agent-to-service commerce.

## Exact Recording Sequence

Use this order for the final demo video:

1. Inbox page: state the private-key problem.
2. Vault page: show user-controlled funds.
3. MCP client: show ProxyKey tools.
4. MCP `fetch_rwa_report`: show HTTP 402 payment requirement.
5. MCP `stage_intent`: show structured intent payload.
6. MCP `explain_pending_approval`: show human-readable risk summary.
7. PWA Inbox: approve mandate.
8. MCP `check_mandate`: show active mandate.
9. MCP `execute_authorized_payment`: show mandate execution.
10. API x402 verify: show report unlock.
11. PWA Receipts: show audit trail.
12. Closing: Casper as the trust layer for AI-agent authorization.

## Known Good Testnet Proof

This path was verified through real MCP calls plus real Casper Testnet deploys:

- Stage intent: `ae02e05865d6cb625b8e758a1764d7e568f4be60f4fce99ab60f67698a682860`
- Create mandate: `4aea693ad3530dd4b3abd9c96439d8e59e7cc4151d7bb3273622bc93ce98c6cb`
- Execute payment: `07e80e0e3d6951a964e954f652cedc4025a3932422a64052780a8aa1f1ca9d15`
- Record receipt: `534b662e41a807f6406153cbfe95cfcc0cdc8f7cffc7b7e5d3209f65987c7689`
- Receipt id: `receipt-703ae29f7d9f`
- x402 report id: `rwa-2e9550eca955`

## Submission Description

Use this short version in DoraHacks:

```text
ProxyKey is a Casper-native mandate layer for AI agents. Instead of giving an agent a private key, a user funds a Casper vault and signs scoped mandates that define exactly what the agent may do: target, resource hash, spend cap, expiry, and revocation state.

The demo focuses on RWA x402 payments. An MCP-connected AI agent requests paid RWA risk intelligence, stages an intent on Casper Testnet, waits for user approval, then executes a Casper payment from the user-funded vault under contract-enforced limits. The RWA API returns the report only after verifying the Casper payment proof, and ProxyKey records auditable receipts for the user.

ProxyKey matters because AI agents need payment authority, but users and institutions cannot hand over signing keys. Casper's account model, Rust/Wasm contracts, CSPR.click wallet flow, and Testnet finality make it a strong base for scoped, revocable, auditable agent permissions.
```
