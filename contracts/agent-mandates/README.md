# ProxyKey Agent Mandates Contract

Deployable Odra/Rust Casper contract for the ProxyKey mandate domain:

- agent registry
- intent inbox
- mandate vault
- receipt ledger

The contract is implemented as one `AgentMandates` Odra module because execution needs shared state across agents, intents, mandates, balances, and receipts.

## Commands

```sh
cargo +nightly test --manifest-path contracts/agent-mandates/Cargo.toml
cd contracts/agent-mandates && cargo odra build
cd contracts/agent-mandates && cargo odra schema
cargo +nightly run --manifest-path contracts/agent-mandates/Cargo.toml --bin proxykey_agent_mandates_cli -- --help
```

Odra 2.8.2 requires nightly Rust. This package pins `rust-toolchain` to `nightly`. `cargo odra build` also requires `wasm32-unknown-unknown`, `wasm-opt` from Binaryen, and `wasm-strip` from WABT.

## Testnet Deployment

The deployment CLI uses Odra livenet environment variables:

```sh
export ODRA_CASPER_LIVENET_NODE_ADDRESS="http://<casper-node>:7777/rpc"
export ODRA_CASPER_LIVENET_CHAIN_NAME="casper-test"
export ODRA_CASPER_LIVENET_EVENTS_URL="http://<casper-node>:9999/events"
export ODRA_CASPER_LIVENET_SECRET_KEY_PATH="$PWD/casper_temp_private_key.pem"
cargo +nightly run --manifest-path contracts/agent-mandates/Cargo.toml --bin proxykey_agent_mandates_cli -- deploy --deploy-mode override
```

Use a funded Casper Testnet account for `ODRA_CASPER_LIVENET_SECRET_KEY_PATH`. Do not commit local private keys or `.env` files.

Current Testnet deployment:

- package hash: `hash-2c26789c896fdb3500d760be852471234b1778dce90863ee05f5c7eb0ef34667`
- latest deploy transaction: `d4c0a9161efcc1cb04102a55523326788ff1270e0e283e20b02d6295e8087ccb`

Generated artifacts:

- `wasm/AgentMandates.wasm`
- `resources/casper_contract_schemas/agent_mandates_schema.json`
- `resources/legacy/agent_mandates_schema.json`

## Covered Behavior

The current tests cover:

- active agent validation
- intent staging
- nonce replay rejection
- user caller checks
- explicit-amount vault deposits
- delegated mandate cap enforcement
- target enforcement
- resource hash enforcement
- vault balance checks
- revocation blocking execution
- receipt recording

## Entrypoints

- `register_agent`
- `stage_intent`
- `deposit`
- `withdraw`
- `approve_intent`
- `reject_intent`
- `create_mandate`
- `revoke_mandate`
- `execute_payment`
- `record_receipt`

## Remaining On-Chain Work

The package is deployed to Casper Testnet. Remaining hardening is real CSPR custody settlement for the vault and emitted contract messages for direct event indexing.
