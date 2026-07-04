import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { ShieldCheck, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { revokeIndexedMandate, useIndexedAgents, useIndexedMandates } from "#/lib/proxykey-api"
import { formatMotes } from "#/lib/proxykey-data"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/mandates")({ component: MandatesPage })

function MandatesPage() {
  const queryClient = useQueryClient()
  const store = useProxyKeyStore()
  const { account } = store
  const { data: mandates = [] } = useIndexedMandates(account)
  const { data: agents = [] } = useIndexedAgents()

  return (
    <main className="page-grid">
      <section className="surface-panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="m-0 text-2xl font-bold">Mandates</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Each mandate binds one agent to a target, spend cap, resource hash,
          and expiry block. Revocation is a user-signed Casper transaction.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {!account ? (
          <EmptyState
            title="Connect a wallet"
            body="Mandates are loaded for the connected wallet account."
          />
        ) : null}
        {account && mandates.length === 0 ? (
          <EmptyState
            title="No mandates indexed"
            body="Approved single-intent and delegated mandates will appear here after they are created."
          />
        ) : null}
        {mandates.map((mandate) => {
          const agent = agents.find((item) => item.accountHash === mandate.agent)
          const usedPct = Number((mandate.spent * 100n) / mandate.cap)
          return (
            <article key={mandate.id} className="surface-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge>{mandate.scope}</Badge>
                  <h2 className="mt-3 text-lg font-semibold">{mandate.target}</h2>
                  <p className="text-sm text-muted-foreground">{agent?.name}</p>
                </div>
                <Badge variant={mandate.status === "active" ? "default" : "outline"}>
                  {mandate.status}
                </Badge>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <Info label="Spent" value={formatMotes(mandate.spent)} />
                <Info label="Cap" value={formatMotes(mandate.cap)} />
                <Info label="Expiry block" value={mandate.expiryBlock.toString()} />
                <Info label="Resource" value={mandate.resourcePatternHash.slice(0, 18)} />
              </div>
              <Button
                variant="destructive"
                className="mt-4 w-full"
                onClick={() => {
                  void (async () => {
                    await revokeIndexedMandate(account, mandate.id)
                    await queryClient.invalidateQueries({
                      queryKey: ["proxykey", account, "mandates"],
                    })
                    toast.warning("Revocation prepared for CSPR.click signing")
                  })()
                }}
              >
                <XCircle className="size-4" />
                Revoke mandate
              </Button>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <article className="surface-panel p-4">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 break-words font-mono text-sm font-semibold">{value}</p>
    </div>
  )
}
