import { createFileRoute } from "@tanstack/react-router"
import { FileText } from "lucide-react"
import { Badge } from "#/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table"
import { useIndexedReceipts } from "#/lib/proxykey-api"
import { formatMotes } from "#/lib/proxykey-data"
import { useProxyKeyStore } from "#/stores/proxykey-store"

export const Route = createFileRoute("/receipts")({ component: ReceiptsPage })

function ReceiptsPage() {
  const store = useProxyKeyStore()
  const { data: receipts = [] } = useIndexedReceipts(store.account)
  return (
    <main className="page-grid">
      <section className="surface-panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h1 className="m-0 text-2xl font-bold">Receipts</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Payment proof, result hash, and report details for mandate execution.
        </p>
      </section>
      <section className="surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>Mandate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Deploy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    No receipts indexed for this connected account.
                  </TableCell>
                </TableRow>
              ) : null}
              {receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell>{receipt.id}</TableCell>
                  <TableCell>{receipt.mandateId}</TableCell>
                  <TableCell>{formatMotes(receipt.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{receipt.deployHash.slice(0, 18)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="surface-panel p-4">
        <Badge>RWA x402</Badge>
        <h2 className="mt-3 text-xl font-semibold">Receipt-backed reports</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Paid RWA reports are shown only after the x402 payment proof is verified and a receipt is indexed.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Info label="Indexed receipts" value={receipts.length.toString()} />
          <Info label="Network" value="Casper Testnet" />
          <Info label="Authority" value="Mandate receipts" />
        </div>
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p className="m-0 mt-1 font-semibold">{value}</p>
    </div>
  )
}
