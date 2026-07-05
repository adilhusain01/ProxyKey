import { useQuery } from "@tanstack/react-query"
import {
  agentProfileSchema,
  intentSchema,
  mandateSchema,
  receiptSchema,
  vaultBalanceSchema,
} from "@proxykey/shared"

export const proxyKeyApiBaseUrl = (
  import.meta.env.VITE_PROXYKEY_API_BASE_URL as string | undefined
)?.replace(/\/$/, "")

async function requestJson(path: string, init?: RequestInit) {
  if (!proxyKeyApiBaseUrl) {
    throw new Error("VITE_PROXYKEY_API_BASE_URL is not configured")
  }

  const response = await fetch(`${proxyKeyApiBaseUrl}${path}`, init)
  const payload = await response.json()

  if (!response.ok) {
    throw new Error(`ProxyKey API ${response.status}: ${JSON.stringify(payload)}`)
  }

  return payload
}

async function fetchJson(path: string) {
  return requestJson(path)
}

function jsonBody(body?: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  }
}

const enabled = Boolean(proxyKeyApiBaseUrl)

export function useIndexedAgents() {
  return useQuery({
    queryKey: ["proxykey", "agents"],
    queryFn: async () => agentProfileSchema.array().parse(await fetchJson("/agents")),
    enabled,
  })
}

export function useIndexedIntents(account: string) {
  return useQuery({
    queryKey: ["proxykey", account, "intents"],
    queryFn: async () =>
      intentSchema.array().parse(await fetchJson(`/users/${account}/intents`)),
    enabled: enabled && Boolean(account),
  })
}

export function useIndexedMandates(account: string) {
  return useQuery({
    queryKey: ["proxykey", account, "mandates"],
    queryFn: async () =>
      mandateSchema.array().parse(await fetchJson(`/users/${account}/mandates`)),
    enabled: enabled && Boolean(account),
  })
}

export function useIndexedReceipts(account: string) {
  return useQuery({
    queryKey: ["proxykey", account, "receipts"],
    queryFn: async () =>
      receiptSchema.array().parse(await fetchJson(`/users/${account}/receipts`)),
    enabled: enabled && Boolean(account),
  })
}

export function useIndexedVault(account: string) {
  return useQuery({
    queryKey: ["proxykey", account, "vault"],
    queryFn: async () =>
      vaultBalanceSchema.parse(await fetchJson(`/users/${account}/vault`)),
    enabled: enabled && Boolean(account),
  })
}

export async function updateIntentStatus(
  account: string,
  intentId: string,
  status: "approved" | "rejected",
  deployHash: string,
  mandate?: {
    mandateId?: string
    scope?: "single-intent" | "delegated"
    cap?: bigint
    resourcePatternHash?: string
    expiryBlock?: bigint
  },
) {
  const payload = await requestJson(`/users/${account}/intents/${intentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        { status, deployHash, ...mandate },
        (_, value) => (typeof value === "bigint" ? value.toString() : value),
      ),
    })

  return {
    intent: intentSchema.parse(payload.intent),
    mandate: payload.mandate ? mandateSchema.parse(payload.mandate) : undefined,
  }
}

export async function revokeIndexedMandate(
  account: string,
  mandateId: string,
  deployHash: string,
) {
  return mandateSchema.parse(
    await requestJson(`/users/${account}/mandates/${mandateId}/revoke`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deployHash }),
    }),
  )
}

export async function depositIndexedVault(
  account: string,
  amountMotes: bigint,
  deployHash: string,
) {
  return vaultBalanceSchema.parse(
    await requestJson(
      `/users/${account}/vault/deposit`,
      jsonBody({ amount: amountMotes, deployHash }),
    ),
  )
}

export async function withdrawIndexedVault(
  account: string,
  amountMotes: bigint,
  deployHash: string,
) {
  return vaultBalanceSchema.parse(
    await requestJson(
      `/users/${account}/vault/withdraw`,
      jsonBody({ amount: amountMotes, deployHash }),
    ),
  )
}
