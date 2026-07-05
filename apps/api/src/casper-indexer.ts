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
  entrypoint?: string | undefined;
  packageHash?: string | undefined;
  sessionWasmSha256?: string | undefined;
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

function findModuleBytes(raw: unknown): string | undefined {
  const moduleBytes = findObjectWithKey(raw, "module_bytes")?.module_bytes;
  return typeof moduleBytes === "string" ? moduleBytes : undefined;
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

function parseU512Bytes(hex: string): string {
  const buffer = Buffer.from(hex, "hex");
  const byteLength = buffer.at(0) ?? 0;
  let value = 0n;

  for (let index = 0; index < byteLength; index += 1) {
    value += BigInt(buffer.at(index + 1) ?? 0) << BigInt(index * 8);
  }

  return value.toString();
}

function parseUInt64Bytes(hex: string): string {
  const buffer = Buffer.from(hex, "hex");
  let value = 0n;

  for (let index = 0; index < buffer.length; index += 1) {
    value += BigInt(buffer.at(index) ?? 0) << BigInt(index * 8);
  }

  return value.toString();
}

function parseStringBytes(hex: string): string {
  const buffer = Buffer.from(hex, "hex");
  const length = buffer.readUInt32LE(0);
  return buffer.subarray(4, 4 + length).toString("utf8");
}

function parseKeyBytes(hex: string): string {
  if (hex.startsWith("00") && hex.length >= 66) {
    return `account-hash-${hex.slice(2, 66)}`;
  }

  return hex;
}

function parseNamedArgValue(value: { bytes?: unknown; cl_type?: unknown; parsed?: unknown }) {
  if (value.parsed !== undefined) return String(value.parsed);
  if (typeof value.bytes !== "string") return "";

  if (value.cl_type === "U512") return parseU512Bytes(value.bytes);
  if (value.cl_type === "U64") return parseUInt64Bytes(value.bytes);
  if (value.cl_type === "String") return parseStringBytes(value.bytes);
  if (value.cl_type === "Key") return parseKeyBytes(value.bytes);
  if (
    value.cl_type &&
    typeof value.cl_type === "object" &&
    "ByteArray" in value.cl_type
  ) {
    return value.bytes.toLowerCase();
  }

  return value.bytes;
}

function parseNamedArgs(raw: unknown): Record<string, string> {
  const namedArgs = findObjectWithKey(raw, "Named")?.Named;
  if (!Array.isArray(namedArgs)) return {};

  return Object.fromEntries(
    namedArgs
      .filter(
        (item): item is [
          string,
          { bytes?: unknown; cl_type?: unknown; parsed?: unknown },
        ] =>
          Array.isArray(item) && typeof item[0] === "string",
      )
      .map(([name, value]) => [name, parseNamedArgValue(value)]),
  );
}

function normalizeComparableArg(value: string) {
  const maybeHash = normalizeHash(value);
  return maybeHash && /^[\da-f]{64}$/.test(maybeHash) ? maybeHash : value;
}

export function extractCasperContractMessages(raw: unknown) {
  const messages: Array<Record<string, unknown>> = [];

  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    const record = value as Record<string, unknown>;
    const hasMessageShape =
      "message" in record ||
      "payload" in record ||
      "topic_name" in record ||
      "topic" in record ||
      "entity_hash" in record ||
      "message_hash" in record;

    if (hasMessageShape && ("topic_name" in record || "topic" in record || "message" in record)) {
      messages.push(record);
    }

    for (const child of Object.values(record)) visit(child);
  }

  visit(raw);
  return messages;
}

export function assertVerifiedContractCall(
  verification: CasperDeployVerification,
  expectation: ContractCallExpectation,
) {
  const entrypoint = findEntrypoint(verification.raw);
  if (expectation.entrypoint && entrypoint !== expectation.entrypoint) {
    throw new Error(
      `Casper transaction called ${entrypoint ?? "unknown"} instead of ${expectation.entrypoint}`,
    );
  }

  if (expectation.sessionWasmSha256) {
    const moduleBytes = findModuleBytes(verification.raw);
    if (!moduleBytes) {
      throw new Error("Casper transaction did not include session Wasm");
    }

    const actualSha256 = crypto
      .createHash("sha256")
      .update(Buffer.from(moduleBytes, "hex"))
      .digest("hex");

    if (actualSha256 !== expectation.sessionWasmSha256.toLowerCase()) {
      throw new Error("Casper transaction used a different session Wasm");
    }
  }

  const expectedPackageHash = normalizeHash(
    expectation.packageHash ?? process.env.PROXYKEY_CONTRACT_HASH,
  );
  const actualArgs = parseNamedArgs(verification.raw);
  if (expectedPackageHash) {
    const actualPackageHash = findPackageHash(verification.raw) ?? actualArgs.package_hash;
    if (actualPackageHash && normalizeHash(actualPackageHash) !== expectedPackageHash) {
      throw new Error("Casper transaction targeted a different contract package");
    }
  }

  for (const [name, expectedValue] of Object.entries(expectation.args ?? {})) {
    if (expectedValue === undefined) continue;
    const actual = actualArgs[name];
    if (actual === undefined) {
      throw new Error(`Casper transaction arg ${name} was not present`);
    }
    if (normalizeComparableArg(actual) !== normalizeComparableArg(String(expectedValue))) {
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
