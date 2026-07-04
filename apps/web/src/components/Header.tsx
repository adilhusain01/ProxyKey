import { Link } from "@tanstack/react-router"
import { Bell, KeyRound, ShieldCheck } from "lucide-react"
import ThemeToggle from "./ThemeToggle"
import { Button } from "#/components/ui/button"
import WalletConnectButton from "./WalletConnectButton"

const navItems = [
  { to: "/", label: "Inbox" },
  { to: "/mandates", label: "Mandates" },
  { to: "/vault", label: "Vault" },
  { to: "/agents", label: "Agents" },
  { to: "/receipts", label: "Receipts" },
] as const

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/88 px-4 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 rounded-lg text-foreground no-underline"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <KeyRound className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold">ProxyKey</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Casper agent mandates
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition hover:bg-muted hover:text-foreground"
              activeProps={{
                className:
                  "rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground no-underline",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <WalletConnectButton />
          <Button variant="ghost" size="icon" aria-label="Pending approvals">
            <Bell className="size-4" />
          </Button>
          <ThemeToggle />
          <Button size="sm" className="hidden md:inline-flex">
            <ShieldCheck className="size-4" />
            Testnet
          </Button>
        </div>
      </nav>
      <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto pb-3 lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground no-underline"
            activeProps={{
              className:
                "whitespace-nowrap rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground no-underline",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  )
}
