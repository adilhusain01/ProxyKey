import { createFileRoute, Link } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  DatabaseZap,
  FileCheck2,
  FileText,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { prepareMandateDeploy, prepareRejectIntentDeploy } from "@proxykey/casper"
import {
  EmptyState,
  HashValue,
  InfoTile,
  QueryBanner,
  StatusPill,
  UsageBar,
} from "#/components/DesignPrimitives"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import { requireProxyKeyContractHash, sendPreparedDeploy } from "#/lib/csprclick"
import {
  useIndexedAgents,
  useIndexedIntents,
  useIndexedMandates,
  useIndexedReceipts,
  useIndexedVault,
  updateIntentStatus,
} from "#/lib/proxykey-api"
import { emptyVaultBalance, formatMotes } from "#/lib/proxykey-data"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/")({ component: HomePage })

function HomePage() {
  const queryClient = useQueryClient()
  const { account } = useProxyKeyStore()
  const agentsQuery = useIndexedAgents()
  const intentsQuery = useIndexedIntents(account)
  const mandatesQuery = useIndexedMandates(account)
  const receiptsQuery = useIndexedReceipts(account)
  const vaultQuery = useIndexedVault(account)

  const agents = agentsQuery.data ?? []
  const intents = intentsQuery.data ?? []
  const mandates = mandatesQuery.data ?? []
  const receipts = receiptsQuery.data ?? []
  const vaultBalance = vaultQuery.data ?? emptyVaultBalance(account)
  const pending = intents.filter((intent) => intent.status === "pending")
  const executed = intents.filter((intent) => intent.status === "executed")
  const activeMandates = mandates.filter((mandate) => mandate.status === "active")
  const exhaustedMandates = mandates.filter((mandate) => mandate.status === "exhausted")
  const latestReceipt = receipts.at(-1)
  const hasAccount = Boolean(account)

  async function refreshAccountData() {
    if (!account) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["proxykey", "agents"] }),
      queryClient.invalidateQueries({ queryKey: ["proxykey", account, "intents"] }),
      queryClient.invalidateQueries({ queryKey: ["proxykey", account, "mandates"] }),
      queryClient.invalidateQueries({ queryKey: ["proxykey", account, "receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["proxykey", account, "vault"] }),
    ])
  }

  async function approve(intentId: string) {
    if (!account) return
    const intent = intents.find((item) => item.id === intentId)
    if (!intent) return
    const mandateId = `mandate-${crypto.randomUUID()}`
    const mandate = {
      id: mandateId,
      user: intent.user,
      agent: intent.agent,
      scope: "single-intent" as const,
      cap: intent.amount,
      spent: 0n,
      target: intent.target,
      resourcePatternHash: intent.resourceHash,
      expiryBlock: 9_000_000n,
      status: "active" as const,
    }
    const deployHash = await sendPreparedDeploy(
      prepareMandateDeploy(requireProxyKeyContractHash(), mandate),
    )
    await updateIntentStatus(account, intentId, "approved", deployHash, {
      mandateId,
      scope: mandate.scope,
      cap: mandate.cap,
      resourcePatternHash: mandate.resourcePatternHash,
      expiryBlock: mandate.expiryBlock,
    })
    await refreshAccountData()
    toast.success("Mandate approval recorded")
  }

  async function reject(intentId: string) {
    if (!account) return
    const deployHash = await sendPreparedDeploy(
      prepareRejectIntentDeploy(requireProxyKeyContractHash(), {
        intentId,
        user: account,
      }),
    )
    await updateIntentStatus(account, intentId, "rejected", deployHash)
    await refreshAccountData()
    toast.error("Intent rejected")
  }

  const queryError =
    agentsQuery.error ??
    intentsQuery.error ??
    mandatesQuery.error ??
    receiptsQuery.error ??
    vaultQuery.error

  return (
    <>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="section-kicker">Casper Testnet mandate infrastructure</p>
            <h1>ProxyKey</h1>
            <p>
              A user-owned approval layer for AI agents. Agents request authority,
              users sign scoped mandates, and Casper records every payment and receipt
              without exposing the user private key.
            </p>
            <div className="hero-actions">
              <Button asChild size="lg">
                <a href="#control-center">
                  Open control center
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/receipts">
                  Inspect receipts
                  <FileText className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="proof-strip">
              <div>
                <p>Wallet state</p>
                <strong>{hasAccount ? "Connected" : "Waiting"}</strong>
              </div>
              <div>
                <p>Recorded receipts</p>
                <strong>{receipts.length}</strong>
              </div>
              <div>
                <p>Vault available</p>
                <strong>{formatMotes(vaultBalance.available)}</strong>
              </div>
            </div>
          </div>

          <section className="console-visual" aria-label="ProxyKey live lifecycle console">
            <div className="console-topbar">
              <div className="flex items-center gap-2">
                <span className="brand-mark">
                  <KeyRound className="size-4" />
                </span>
                <div>
                  <p className="m-0 text-sm font-black">Live mandate console</p>
                  <p className="m-0 text-xs text-white/60">Casper Testnet indexed state</p>
                </div>
              </div>
              <Badge variant="outline" className="border-white/20 text-white">
                x402 RWA
              </Badge>
            </div>
            <div className="console-grid">
              <div className="console-cell">
                <h3>Agent requests</h3>
                <span className="console-number">{intents.length}</span>
                <p>
                  {pending.length > 0
                    ? `${pending.length} request needs approval.`
                    : `${executed.length} executed requests are indexed.`}
                </p>
              </div>
              <div className="console-cell">
                <h3>Mandate custody</h3>
                <span className="console-number">{mandates.length}</span>
                <p>
                  {activeMandates.length} active and {exhaustedMandates.length} exhausted
                  mandate scopes.
                </p>
              </div>
              <div className="console-cell">
                <h3>Vault accounting</h3>
                <span className="console-number">{formatMotes(vaultBalance.total)}</span>
                <p>Reserved: {formatMotes(vaultBalance.reserved)}</p>
              </div>
              <div className="console-cell">
                <h3>Latest proof</h3>
                <p>
                  {latestReceipt ? (
                    <>
                      Receipt <HashValue value={latestReceipt.id} chars={18} /> recorded
                      against deploy <HashValue value={latestReceipt.deployHash} chars={12} />.
                    </>
                  ) : (
                    "Receipts appear after an agent executes an authorized payment."
                  )}
                </p>
              </div>
            </div>
          </section>
        </section>

        <section className="landing-band" id="product">
          <p className="section-kicker">Built for the agent era</p>
          <div className="band-grid">
            <Feature
              icon={<Bot className="size-5" />}
              title="Agents stage intents"
              body="The MCP server lets an agent request a specific action, target, amount, resource hash, payload hash, and nonce."
            />
            <Feature
              icon={<ShieldCheck className="size-5" />}
              title="Users sign mandates"
              body="The wallet approves a one-intent or delegated mandate with a cap, target, expiry block, and revocation path."
            />
            <Feature
              icon={<FileCheck2 className="size-5" />}
              title="Receipts close the loop"
              body="Execution, payment proof, x402 RWA access, and result hashes are visible in the UI after indexing."
            />
          </div>
        </section>

        <section className="control-section" id="control-center">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker">Control center</p>
              <h2 className="m-0 text-3xl font-black tracking-normal md:text-4xl">
                Review authority, balances, and receipts from one account view.
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshAccountData()}
              disabled={!account}
            >
              <RefreshCw className="size-4" />
              Refresh state
            </Button>
          </div>

          {queryError ? (
            <QueryBanner
              error={queryError}
              onRetry={() => void refreshAccountData()}
            />
          ) : null}

          <div className="control-grid mt-4">
            <section className="space-y-4">
              {!hasAccount ? (
                <EmptyState
                  title="Connect a wallet to load live lifecycle data"
                  body="ProxyKey reads intents, mandates, vault balances, and receipts for the connected Casper account hash."
                />
              ) : (
                <Tabs defaultValue="all" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="all">Lifecycle</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="executed">Executed</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="data-list">
                    {intents.length === 0 ? (
                      <EmptyState
                        title="No intents indexed"
                        body="Run the MCP lifecycle and this account-scoped list will update from the API."
                      />
                    ) : null}
                    {intents.map((intent) => (
                      <IntentRow
                        key={intent.id}
                        intent={intent}
                        agentName={
                          agents.find((agent) => agent.accountHash === intent.agent)?.name
                        }
                        onApprove={approve}
                        onReject={reject}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="pending" className="data-list">
                    {pending.length === 0 ? (
                      <EmptyState
                        title="No pending approvals"
                        body="All currently indexed intents for this account are already resolved."
                      />
                    ) : null}
                    {pending.map((intent) => (
                      <IntentRow
                        key={intent.id}
                        intent={intent}
                        agentName={
                          agents.find((agent) => agent.accountHash === intent.agent)?.name
                        }
                        onApprove={approve}
                        onReject={reject}
                      />
                    ))}
                  </TabsContent>
                  <TabsContent value="executed" className="data-list">
                    {executed.length === 0 ? (
                      <EmptyState
                        title="No executed intents"
                        body="Agent payments appear here after mandate execution is indexed."
                      />
                    ) : null}
                    {executed.map((intent) => (
                      <IntentRow
                        key={intent.id}
                        intent={intent}
                        agentName={
                          agents.find((agent) => agent.accountHash === intent.agent)?.name
                        }
                        onApprove={approve}
                        onReject={reject}
                      />
                    ))}
                  </TabsContent>
                </Tabs>
              )}
            </section>

            <aside className="space-y-4">
              <section className="surface-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <WalletCards className="size-4 text-primary" />
                    <h2 className="m-0 text-base font-black">Vault</h2>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/vault">Manage</Link>
                  </Button>
                </div>
                <div className="mt-4 grid gap-3">
                  <InfoTile label="Total" value={formatMotes(vaultBalance.total)} />
                  <InfoTile label="Reserved" value={formatMotes(vaultBalance.reserved)} />
                  <InfoTile
                    label="Available"
                    value={formatMotes(vaultBalance.available)}
                    tone="success"
                  />
                </div>
              </section>

              <section className="surface-panel p-4">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-primary" />
                  <h2 className="m-0 text-base font-black">Mandates</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {mandates.slice(-4).reverse().map((mandate) => {
                    const pct =
                      mandate.cap > 0n ? Number((mandate.spent * 100n) / mandate.cap) : 0
                    return (
                      <div key={mandate.id} className="data-row p-3">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-sm">{mandate.target}</strong>
                          <StatusPill status={mandate.status} />
                        </div>
                        <div className="mt-3">
                          <UsageBar value={pct} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatMotes(mandate.spent)} used of {formatMotes(mandate.cap)}
                        </p>
                      </div>
                    )
                  })}
                  {mandates.length === 0 ? (
                    <p className="m-0 text-sm text-muted-foreground">
                      No mandates indexed for this account.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="surface-panel p-4">
                <div className="flex items-center gap-2">
                  <DatabaseZap className="size-4 text-primary" />
                  <h2 className="m-0 text-base font-black">x402 RWA proof</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  The demo path is agent intent, user mandate, authorized Casper
                  payment, x402 report access, and receipt indexing.
                </p>
                <div className="mt-4 grid gap-2">
                  <InfoTile label="Receipts" value={receipts.length} />
                  <InfoTile label="Latest receipt" value={latestReceipt?.id ?? "None"} />
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <article className="feature-panel">
      <span className="brand-mark">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  )
}

function IntentRow({
  intent,
  agentName,
  onApprove,
  onReject,
}: {
  intent: {
    id: string
    action: string
    target: string
    reason: string
    amount: bigint
    resourceHash: string
    payloadHash: string
    nonce: string
    status: string
  }
  agentName?: string
  onApprove: (intentId: string) => Promise<void>
  onReject: (intentId: string) => Promise<void>
}) {
  const isPending = intent.status === "pending"

  return (
    <article className="data-row">
      <div className="data-row-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={intent.status} />
            <Badge variant="outline">{agentName ?? "Agent account"}</Badge>
          </div>
          <h3 className="mt-3 text-xl font-black">
            {intent.action} on {intent.target}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {intent.reason}
          </p>
        </div>
        {isPending ? (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
            <Button onClick={() => void onApprove(intent.id)}>
              <ShieldCheck className="size-4" />
              Approve mandate
            </Button>
            <Button variant="outline" onClick={() => void onReject(intent.id)}>
              <XCircle className="size-4" />
              Reject
            </Button>
          </div>
        ) : (
          <BadgeCheck className="size-5 shrink-0 text-[color:var(--success)]" />
        )}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile label="Spend" value={formatMotes(intent.amount)} />
        <InfoTile label="Resource" value={<HashValue value={intent.resourceHash} />} />
        <InfoTile label="Payload" value={<HashValue value={intent.payloadHash} />} />
        <InfoTile label="Nonce" value={intent.nonce} />
      </div>
    </article>
  )
}
