import crypto from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_CASPER_RPC_URL = "https://node.testnet.casper.network/rpc";

export type IndexedOperation =
  | "agent.register"
  | "intent.stage"
  | "intent.reject"
  | "vault.deposit"
  | "vault.withdraw"
  | "intent.approve"
  | "mandate.create"
  | "mandate.revoke"
  | "mandate.execute"
  | "receipt.record";

export interface CasperDeployVerification {
  deployHash: string;
  status: "confirmed";
  raw: unknown;
}

export interface ContractCallExpectation {
  entrypoint: string;
  packageHash?: string | undefined;
  args?: Record<string, string | bigint | undefined> | undefined;
}

type RpcResponse = {
  result?: unknown;
  error?: { code?: number; message?: string };
};

function rpcUrl() {
  return process.env.CASPER_NODE_RPC_URL ?? DEFAULT_CASPER_RPC_URL;
}

async function rpcCall(method: string, params: unknown): Promise<RpcResponse> {
  const response = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `proxykey-${crypto.randomUUID()}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Casper RPC HTTP ${response.status}`);
  }

  return (await response.json()) as RpcResponse;
}

async function findCasperTransaction(hash: string) {
  const attempts = [
    () =>
      rpcCall("info_get_transaction", {
        transaction_hash: { Version1: hash },
        finalized_approvals: true,
      }),
    () =>
      rpcCall("info_get_transaction", {
        transaction_hash: { Deploy: hash },
        finalized_approvals: true,
      }),
    () =>
      rpcCall("info_get_deploy", {
        deploy_hash: hash,
        finalized_approvals: true,
      }),
  ];

  for (const attempt of attempts) {
    const response = await attempt();
    if (response.result) return response.result;
  }

  return undefined;
}

export async function verifyCasperDeployHash(
  deployHash: string,
): Promise<CasperDeployVerification> {
  const attempts = Number(process.env.CASPER_DEPLOY_VERIFY_ATTEMPTS ?? 8);
  const delayMs = Number(process.env.CASPER_DEPLOY_VERIFY_DELAY_MS ?? 2_000);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await findCasperTransaction(deployHash);
    if (result) {
      return {
        deployHash,
        status: "confirmed",
        raw: result,
      };
    }

    if (attempt < attempts) {
      await delay(delayMs);
    }
  }

  throw new Error(`Casper transaction ${deployHash} was not confirmed by RPC`);
}

function normalizeHash(hash: string | undefined) {
  return hash
    ?.replace(/^contract-package-/, "")
    .replace(/^package-/, "")
    .replace(/^hash-/, "")
    .replace(/^0x/, "")
    .toLowerCase();
}

function findObjectWithKey(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (key in record) return record;
  for (const child of Object.values(record)) {
    const found = findObjectWithKey(child, key);
    if (found) return found;
  }
  return undefined;
}

function findEntrypoint(raw: unknown): string | undefined {
  const entrypoint = findObjectWithKey(raw, "entry_point")?.entry_point;
  if (typeof entrypoint === "string") return entrypoint;
  if (entrypoint && typeof entrypoint === "object") {
    const values = Object.values(entrypoint as Record<string, unknown>);
    const custom = values.find((value) => typeof value === "string");
    if (typeof custom === "string") return custom;
  }
  return undefined;
}

function findPackageHash(raw: unknown): string | undefined {
  const byPackageHash = findObjectWithKey(raw, "byPackageHash")?.byPackageHash;
  if (byPackageHash && typeof byPackageHash === "object") {
    const addr = (byPackageHash as Record<string, unknown>).addr;
    if (typeof addr === "string") return normalizeHash(addr);
    if (addr && typeof addr === "object") {
      const hex = Object.values(addr as Record<string, unknown>).find(
        (value) => typeof value === "string",
      );
      if (typeof hex === "string") return normalizeHash(hex);
    }
  }

  const byHash = findObjectWithKey(raw, "byHash")?.byHash;
  if (typeof byHash === "string") return normalizeHash(byHash);
  return undefined;
}

function parseNamedArgs(raw: unknown): Record<string, string> {
  const namedArgs = findObjectWithKey(raw, "Named")?.Named;
  if (!Array.isArray(namedArgs)) return {};

  return Object.fromEntries(
    namedArgs
      .filter(
        (item): item is [string, { parsed?: unknown }] =>
          Array.isArray(item) && typeof item[0] === "string",
      )
      .map(([name, value]) => [name, String(value?.parsed ?? "")]),
  );
}

export function assertVerifiedContractCall(
  verification: CasperDeployVerification,
  expectation: ContractCallExpectation,
) {
  const entrypoint = findEntrypoint(verification.raw);
  if (entrypoint !== expectation.entrypoint) {
    throw new Error(
      `Casper transaction called ${entrypoint ?? "unknown"} instead of ${expectation.entrypoint}`,
    );
  }

  const expectedPackageHash = normalizeHash(
    expectation.packageHash ?? process.env.PROXYKEY_CONTRACT_HASH,
  );
  if (expectedPackageHash) {
    const actualPackageHash = findPackageHash(verification.raw);
    if (actualPackageHash && actualPackageHash !== expectedPackageHash) {
      throw new Error("Casper transaction targeted a different contract package");
    }
  }

  const actualArgs = parseNamedArgs(verification.raw);
  for (const [name, expectedValue] of Object.entries(expectation.args ?? {})) {
    if (expectedValue === undefined) continue;
    const actual = actualArgs[name];
    if (actual !== undefined && actual !== String(expectedValue)) {
      throw new Error(`Casper transaction arg ${name} did not match indexed value`);
    }
  }
}

export async function verifyCasperContractCall(
  deployHash: string,
  expectation: ContractCallExpectation,
): Promise<CasperDeployVerification> {
  const verification = await verifyCasperDeployHash(deployHash);
  assertVerifiedContractCall(verification, expectation);
  return verification;
}

export async function getProxyKeyPackageState(packageHash = process.env.PROXYKEY_CONTRACT_HASH) {
  const normalized = normalizeHash(packageHash);
  if (!normalized) {
    throw new Error("PROXYKEY_CONTRACT_HASH is not configured");
  }

  const response = await rpcCall("query_global_state", {
    key: `hash-${normalized}`,
    path: [],
  });

  if (response.error) {
    throw new Error(response.error.message ?? "Casper package state query failed");
  }

  return response.result;
}
