# ProxyKey Agent Mandates Contract Domain

Rust implementation of the ProxyKey mandate domain:

- `AgentRegistry`
- `IntentInbox`
- `MandateVault`
- `ReceiptLedger`

## Commands

```sh
cargo test --manifest-path contracts/agent-mandates/Cargo.toml
```

## Covered Behavior

The current tests cover:

- active agent validation
- intent staging
- nonce replay rejection
- delegated mandate cap enforcement
- target enforcement
- resource hash enforcement
- vault balance checks
- revocation blocking execution

## Remaining On-Chain Work

This package is not yet a deployed Casper Testnet contract package. The next step is to convert the domain implementation into deployable Odra contracts, deploy to Casper Testnet, set `PROXYKEY_CONTRACT_HASH`, and index confirmed deploy events into PostgreSQL.
