import crypto from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_CASPER_RPC_URL = "https://rpc.testnet.casper.network/rpc";

export type IndexedOperation =
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
