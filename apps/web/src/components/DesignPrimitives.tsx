import type { ReactNode } from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"

export function PageIntro({
  eyebrow,
  title,
  body,
  icon,
  action,
}: {
  eyebrow?: string
  title: string
  body?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="page-intro">
      <div className="min-w-0">
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <div className="flex items-center gap-2">
          {icon ? <span className="text-primary">{icon}</span> : null}
          <h1>{title}</h1>
        </div>
        {body ? <p>{body}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <article className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  )
}

export function InfoTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: ReactNode
  tone?: "neutral" | "success" | "warning" | "danger"
}) {
  return (
    <div className={`info-tile info-tile-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

export function HashValue({ value, chars = 16 }: { value: string; chars?: number }) {
  const display =
    value.length > chars + 8
      ? `${value.slice(0, chars)}...${value.slice(-6)}`
      : value

  return <span className="hash-value" title={value}>{display}</span>
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const variant =
    normalized === "active" || normalized === "approved" || normalized === "executed"
      ? "default"
      : "outline"

  return (
    <Badge variant={variant} className={`status-pill status-${normalized}`}>
      {status}
    </Badge>
  )
}

export function QueryBanner({
  title = "Live data unavailable",
  error,
  onRetry,
}: {
  title?: string
  error: unknown
  onRetry?: () => void
}) {
  const message = error instanceof Error ? error.message : "ProxyKey API did not return data."

  return (
    <div className="query-banner">
      <AlertCircle className="size-4" />
      <div className="min-w-0">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function UsageBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(value, 100))
  return (
    <div className="usage-bar" aria-label={`${width}% used`}>
      <span style={{ width: `${width}%` }} />
    </div>
  )
}
