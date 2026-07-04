import type { VaultBalance } from "@proxykey/shared"

export function emptyVaultBalance(user: string): VaultBalance {
  return {
    user,
    total: 0n,
    reserved: 0n,
    available: 0n,
  }
}

export function formatMotes(value: bigint) {
  return `${Number(value) / 1_000_000_000} CSPR`
}
