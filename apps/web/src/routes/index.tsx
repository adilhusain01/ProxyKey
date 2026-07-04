import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  FileText,
  KeyRound,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import {
  useIndexedAgents,
  useIndexedIntents,
  useIndexedMandates,
  useIndexedVault,
  updateIntentStatus,
} from "#/lib/proxykey-api"
import { emptyVaultBalance, formatMotes } from "#/lib/proxykey-data"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/")({ component: ApprovalInbox })

function ApprovalInbox() {
  const queryClient = useQueryClient()
  const store = useProxyKeyStore()
  const { account } = store
  const hasAccount = Boolean(account)
  const { data: agents = [] } = useIndexedAgents()
  const { data: intents = [] } = useIndexedIntents(account)
  const { data: mandates = [] } = useIndexedMandates(account)
  const { data: vaultBalance = emptyVaultBalance(account) } = useIndexedVault(account)
  const pending = intents.filter((intent) => intent.status === "pending")

  async function approve(intentId: string) {
    if (!account) return
    await updateIntentStatus(account, intentId, "approved")
    await queryClient.invalidateQueries({ queryKey: ["proxykey", account, "intents"] })
    toast.success("Mandate approval prepared for CSPR.click signing")
  }

  async function reject(intentId: string) {
    if (!account) return
    await updateIntentStatus(account, intentId, "rejected")
    await queryClient.invalidateQueries({ queryKey: ["proxykey", account, "intents"] })
    toast.error("Intent rejected")
  }

  return (
    <main className="mx-auto grid min-h-[calc(100svh-8rem)] w-full max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <div className="surface-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge variant="outline" className="mb-3">
                Casper Testnet control center
              </Badge>
              <h1 className="m-0 max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-4xl">
                Approve agent actions without giving agents your private key.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                ProxyKey turns agent requests into user-owned Casper mandates:
                scoped, revocable, capped, and recorded with receipts.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="m-0 text-muted-foreground">Connected account</p>
              <p className="m-0 mt-1 font-mono text-xs font-semibold text-foreground">
                {account || "Connect wallet"}
              </p>
            </div>
          </div>
        </div>

        {!hasAccount ? (
          <EmptyState
            title="Connect a wallet to load approvals"
            body="ProxyKey only reads intents, mandates, vault balances, and receipts for the connected wallet account."
          />
        ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="all">All intents</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-3">
            {pending.length === 0 ? (
              <EmptyState
                title="No pending intents"
                body="Agent requests will appear here after an agent stages an intent for this wallet through the API or MCP server."
              />
            ) : null}
            {pending.map((intent) => {
              const agent = agents.find((item) => item.accountHash === intent.agent)
              return (
                <article key={intent.id} className="surface-panel p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>Human approval required</Badge>
                        <Badge variant="outline">{agent?.name ?? intent.agent}</Badge>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-foreground">
                        {intent.action} on {intent.target}
                      </h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {intent.reason}
                      </p>
                      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        <Metric label="Requested spend" value={formatMotes(intent.amount)} />
                        <Metric label="Resource hash" value={intent.resourceHash.slice(0, 14)} />
                        <Metric label="Nonce" value={intent.nonce} />
                      </div>
                    </div>
                    <div className="flex min-w-56 flex-col gap-2">
                      <Button onClick={() => void approve(intent.id)}>
                        <ShieldCheck className="size-4" />
                        Approve mandate
                      </Button>
                      <Button variant="outline" onClick={() => void reject(intent.id)}>
                        <XCircle className="size-4" />
                        Reject
                      </Button>
                      <Button variant="ghost" asChild>
                        <Link to="/mandates">
                          View policy
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              )
            })}
          </TabsContent>
          <TabsContent value="approved" className="space-y-3">
            {intents.filter((intent) => intent.status === "approved").length === 0 ? (
              <EmptyState
                title="No approved intents"
                body="Approved or delegated agent actions for this account will appear here."
              />
            ) : null}
            {intents
              .filter((intent) => intent.status === "approved")
              .map((intent) => (
                <article key={intent.id} className="surface-panel p-4">
                  <BadgeCheck className="mb-3 size-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold">{intent.action}</h2>
                  <p className="text-sm text-muted-foreground">{intent.reason}</p>
                </article>
              ))}
          </TabsContent>
          <TabsContent value="all" className="space-y-3">
            {intents.length === 0 ? (
              <EmptyState
                title="No intents indexed"
                body="The API has no staged intents for this connected account yet."
              />
            ) : null}
            {intents.map((intent) => (
              <article key={intent.id} className="surface-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 font-semibold">{intent.id}</p>
                    <p className="m-0 text-sm text-muted-foreground">{intent.action}</p>
                  </div>
                  <Badge variant="outline">{intent.status}</Badge>
                </div>
              </article>
            ))}
          </TabsContent>
        </Tabs>
        )}
      </section>

      <aside className="space-y-4">
        <section className="surface-panel p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h2 className="m-0 text-base font-semibold">Vault</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <Metric label="Total balance" value={formatMotes(vaultBalance.total)} />
            <Metric label="Reserved" value={formatMotes(vaultBalance.reserved)} />
            <Metric label="Available" value={formatMotes(vaultBalance.available)} />
          </div>
          <Button className="mt-4 w-full" asChild>
            <Link to="/vault">Manage vault</Link>
          </Button>
        </section>

        <section className="surface-panel p-4">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" />
            <h2 className="m-0 text-base font-semibold">Active mandates</h2>
          </div>
          <div className="mt-4 space-y-3">
            {mandates.map((mandate) => (
              <div key={mandate.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-sm font-semibold">{mandate.target}</p>
                  <Badge variant={mandate.status === "active" ? "default" : "outline"}>
                    {mandate.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatMotes(mandate.spent)} used of {formatMotes(mandate.cap)}
                </p>
              </div>
            ))}
            {mandates.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                No mandates indexed for this account.
              </p>
            ) : null}
          </div>
        </section>

        <section className="surface-panel p-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="m-0 text-base font-semibold">RWA x402 path</h2>
          </div>
          <ol className="mt-4 space-y-3 pl-5 text-sm text-muted-foreground">
            <li>Agent receives HTTP 402 payment requirements.</li>
            <li>User signs a capped Casper mandate.</li>
            <li>Agent pays under mandate and receives the report.</li>
            <li>Receipt is recorded on Casper Testnet.</li>
          </ol>
        </section>
      </aside>
    </main>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="surface-panel p-4">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 break-words font-mono text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}
