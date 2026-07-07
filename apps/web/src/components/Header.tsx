import { Link } from "@tanstack/react-router"
import { Bell, KeyRound, ShieldCheck } from "lucide-react"
import ThemeToggle from "./ThemeToggle"
import { Button } from "#/components/ui/button"
import WalletConnectButton from "./WalletConnectButton"

const navItems = [
  { to: "/", label: "Home" },
  { to: "/mandates", label: "Mandates" },
  { to: "/vault", label: "Vault" },
  { to: "/agents", label: "Agents" },
  { to: "/receipts", label: "Receipts" },
] as const

export default function Header() {
  return (
    <header className="app-header px-4">
      <nav className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 rounded-lg text-foreground no-underline"
        >
          <span className="brand-mark">
            <KeyRound className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black">ProxyKey</span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              Agent mandates on Casper
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="app-nav-link"
              activeProps={{
                className: "app-nav-link app-nav-link-active",
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
      <div className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto pb-3 xl:hidden">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="app-nav-link whitespace-nowrap"
            activeProps={{
              className: "app-nav-link app-nav-link-active whitespace-nowrap",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </header>
  )
}
