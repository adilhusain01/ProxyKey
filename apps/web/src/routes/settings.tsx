import { createFileRoute } from "@tanstack/react-router"
import { Settings } from "lucide-react"
import { Switch } from "#/components/ui/switch"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

function SettingsPage() {
  return (
    <main className="page-grid">
      <section className="surface-panel p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h1 className="m-0 text-2xl font-bold">Settings</h1>
        </div>
      </section>
      <section className="surface-panel max-w-2xl divide-y divide-border">
        {["Push approval notifications", "Require biometric confirmation", "Show advanced hashes"].map(
          (label) => (
            <div key={label} className="flex items-center justify-between gap-4 p-4">
              <span className="text-sm font-medium">{label}</span>
              <Switch />
            </div>
          ),
        )}
      </section>
    </main>
  )
}
