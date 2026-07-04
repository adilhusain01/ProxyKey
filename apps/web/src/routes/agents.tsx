import { createFileRoute } from "@tanstack/react-router"
import { Bot, ExternalLink } from "lucide-react"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import { useIndexedAgents, useIndexedReceipts } from "#/lib/proxykey-api"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/agents")({ component: AgentsPage })

function AgentsPage() {
  const store = useProxyKeyStore()
  const { data: agents = [] } = useIndexedAgents()
  const { data: receipts = [] } = useIndexedReceipts(store.account)
  return (
    <main className="page-grid">
      <section className="surface-panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-primary" />
          <h1 className="m-0 text-2xl font-bold">Agents</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Registered agent identities and capabilities for Casper mandate execution.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {agents.length === 0 ? (
          <article className="surface-panel p-4">
            <h2 className="m-0 text-lg font-semibold">No agents registered</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Agent identities will appear after registration through the API, MCP server, or contract indexer.
            </p>
          </article>
        ) : null}
        {agents.map((agent) => (
          <article key={agent.accountHash} className="surface-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-lg font-semibold">{agent.name}</h2>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {agent.accountHash}
                </p>
              </div>
              <Badge>{agent.status}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.capabilities.map((capability) => (
                <Badge key={capability} variant="outline">
                  {capability}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Receipts recorded: {receipts.filter((receipt) => receipt.target.includes("rwa")).length}
            </p>
            <Button className="mt-4" variant="outline">
              <ExternalLink className="size-4" />
              Metadata
            </Button>
          </article>
        ))}
      </section>
    </main>
  )
}
