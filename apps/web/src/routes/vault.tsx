import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import type { FormEvent } from "react"
import { ArrowDownToLine, ArrowUpFromLine, WalletCards } from "lucide-react"
import { Button } from "#/components/ui/button"
import { Input } from "#/components/ui/input"
import { depositIndexedVault, useIndexedVault, withdrawIndexedVault } from "#/lib/proxykey-api"
import { emptyVaultBalance, formatMotes } from "#/lib/proxykey-data"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/vault")({ component: VaultPage })

function VaultPage() {
  const queryClient = useQueryClient()
  const store = useProxyKeyStore()
  const { data: vaultBalance = emptyVaultBalance(store.account) } = useIndexedVault(
    store.account,
  )

  async function mutateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!store.account) return

    const form = event.currentTarget
    const data = new FormData(form)
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const direction = submitter?.value
    const cspr = Number(data.get("amount") ?? "5")
    if (!Number.isFinite(cspr) || cspr <= 0) return

    const motes = BigInt(Math.round(cspr * 1_000_000_000))
    if (direction === "deposit") {
      await depositIndexedVault(store.account, motes)
    } else {
      await withdrawIndexedVault(store.account, motes)
    }
    await queryClient.invalidateQueries({
      queryKey: ["proxykey", store.account, "vault"],
    })
  }

  return (
    <main className="page-grid">
      <section className="surface-panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <WalletCards className="size-5 text-primary" />
          <h1 className="m-0 text-2xl font-bold">Vault</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          User-funded Casper vault used only by active mandates.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Balance label="Total" value={formatMotes(vaultBalance.total)} />
        <Balance label="Reserved" value={formatMotes(vaultBalance.reserved)} />
        <Balance label="Available" value={formatMotes(vaultBalance.available)} />
      </section>
      <section className="surface-panel max-w-2xl p-4">
        {!store.account ? (
          <p className="m-0 text-sm text-muted-foreground">
            Connect a wallet before funding or withdrawing from a vault.
          </p>
        ) : null}
        <form onSubmit={(event) => void mutateVault(event)}>
          <label className="text-sm font-medium" htmlFor="vault-amount">
            Amount in CSPR
          </label>
          <Input
            id="vault-amount"
            name="amount"
            className="mt-2"
            inputMode="decimal"
            defaultValue="5"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="submit" name="direction" value="deposit" disabled={!store.account}>
            <ArrowDownToLine className="size-4" />
            Deposit
          </Button>
          <Button
            type="submit"
            name="direction"
            value="withdraw"
            variant="outline"
            disabled={!store.account}
          >
            <ArrowUpFromLine className="size-4" />
            Withdraw
          </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <article className="surface-panel p-4">
      <p className="m-0 text-sm text-muted-foreground">{label}</p>
      <p className="m-0 mt-2 text-2xl font-bold">{value}</p>
    </article>
  )
}
