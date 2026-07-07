export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-8 text-sm text-muted-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <p className="m-0">
          ProxyKey records agent mandates, execution, and receipts on Casper Testnet.
        </p>
        <p className="m-0 font-semibold text-foreground">
          User signs authority. Agent never receives the private key.
        </p>
      </div>
    </footer>
  )
}
