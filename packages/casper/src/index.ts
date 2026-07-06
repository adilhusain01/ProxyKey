import { z } from "zod";
import CasperSdk from "casper-js-sdk";
import type { AgentProfile, Intent, Mandate, PaymentProof, Receipt } from "@proxykey/shared";

export const casperNetworkConfigSchema = z.object({
  networkName: z.string().default("casper-test"),
  nodeRpcUrl: z.string().url(),
  chainName: z.string().default("casper-test"),
});

export type CasperNetworkConfig = z.infer<typeof casperNetworkConfigSchema>;

export const DEFAULT_TESTNET_CONFIG: CasperNetworkConfig = {
  networkName: "casper-test",
  nodeRpcUrl: "https://node.testnet.casper.network/rpc",
  chainName: "casper-test",
};

export const VAULT_DEPOSIT_SESSION_PAYMENT_MOTES = 6_000_000_000;

export type ContractEntrypoint =
  | "register_agent"
  | "stage_intent"
  | "deposit"
  | "withdraw"
  | "approve_intent"
  | "reject_intent"
  | "create_mandate"
  | "revoke_mandate"
  | "execute_payment"
  | "record_receipt";

export interface DeployRequest<TArgs extends Record<string, unknown>> {
  contractHash: string;
  entrypoint: ContractEntrypoint;
  args: TArgs;
  paymentMotes: bigint;
}

export interface PreparedDeploy<TArgs extends Record<string, unknown>> {
  network: CasperNetworkConfig;
  request: DeployRequest<TArgs>;
  signingPayload: string;
}

export interface CsprClickTransactionPayload {
  transaction: unknown;
  transactionHash: string;
}

const casperSdk = CasperSdk as unknown as {
  Args: {
    fromMap(args: Record<string, unknown>): unknown;
  };
  CLValue: {
    newCLByteArray(value: ArrayLike<number>): unknown;
    newCLKey(value: unknown): unknown;
    newCLString(value: string): unknown;
    newCLUInt512(value: string): unknown;
    newCLUint64(value: string): unknown;
  };
  Key: {
    newKey(value: string): unknown;
  };
  ContractCallBuilder: new () => {
    from(publicKey: unknown): unknown;
    byHash(contractHash: string): unknown;
    byPackageHash(packageHash: string, version?: number | null): unknown;
    entryPoint(entrypoint: string): unknown;
    runtimeArgs(args: unknown): unknown;
    chainName(chainName: string): unknown;
    payment(paymentMotes: number): unknown;
    build(): {
      hash: { toJSON(): string };
      toJSON(): unknown;
    };
  };
  SessionBuilder: new () => {
    from(publicKey: unknown): unknown;
    wasm(moduleBytes: Uint8Array): unknown;
    runtimeArgs(args: unknown): unknown;
    chainName(chainName: string): unknown;
    payment(paymentMotes: number): unknown;
    build(): {
      hash: { toJSON(): string };
      toJSON(): unknown;
    };
  };
  PublicKey: {
    fromHex(publicKeyHex: string): unknown;
  };
};

const ACCOUNT_KEY_ARGS = new Set(["user", "agent", "settlement_account"]);

export function createSigningPayload<TArgs extends Record<string, unknown>>(
  request: DeployRequest<TArgs>,
): string {
  return JSON.stringify(
    request,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
}

export function prepareDeploy<TArgs extends Record<string, unknown>>(
  request: DeployRequest<TArgs>,
  network: CasperNetworkConfig = DEFAULT_TESTNET_CONFIG,
): PreparedDeploy<TArgs> {
  return {
    network: casperNetworkConfigSchema.parse(network),
    request,
    signingPayload: createSigningPayload(request),
  };
}

function normalizeContractHash(contractHash: string): string {
  return contractHash
    .replace(/^contract-package-/, "")
    .replace(/^package-/, "")
    .replace(/^hash-/, "")
    .replace(/^0x/, "");
}

function contractHashToByteArray(contractHash: string): number[] {
  const normalized = normalizeContractHash(contractHash);
  if (!/^[\da-fA-F]{64}$/.test(normalized)) {
    throw new Error("Casper contract package hash must be 32 bytes");
  }

  return Array.from({ length: 32 }, (_, index) =>
    Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );
}

function encodeRuntimeArg(name: string, value: unknown): unknown {
  if (
    typeof value === "string" &&
    ACCOUNT_KEY_ARGS.has(name) &&
    value.startsWith("account-hash-")
  ) {
    return casperSdk.CLValue.newCLKey(casperSdk.Key.newKey(value));
  }

  if (typeof value === "bigint") {
    return name.endsWith("_block")
      ? casperSdk.CLValue.newCLUint64(value.toString())
      : casperSdk.CLValue.newCLUInt512(value.toString());
  }

  if (typeof value === "number") {
    return casperSdk.CLValue.newCLUint64(String(value));
  }

  if (typeof value === "string") {
    return casperSdk.CLValue.newCLString(value);
  }

  throw new TypeError(`Unsupported Casper runtime arg ${name}`);
}

function runtimeArgsFromRecord(args: Record<string, unknown>): unknown {
  return casperSdk.Args.fromMap(
    Object.fromEntries(
      Object.entries(args).map(([name, value]) => [
        name,
        encodeRuntimeArg(name, value),
      ]),
    ),
  );
}

export function buildContractCallTransaction<TArgs extends Record<string, unknown>>(
  prepared: PreparedDeploy<TArgs>,
  signingPublicKeyHex: string,
): CsprClickTransactionPayload {
  const transaction = new casperSdk.ContractCallBuilder();
  transaction.from(casperSdk.PublicKey.fromHex(signingPublicKeyHex));
  transaction.byPackageHash(normalizeContractHash(prepared.request.contractHash));
  transaction.entryPoint(prepared.request.entrypoint);
  transaction.runtimeArgs(runtimeArgsFromRecord(prepared.request.args));
  transaction.chainName(prepared.network.chainName);
  transaction.payment(Number(prepared.request.paymentMotes));

  const built = transaction.build();
  return {
    transaction: built.toJSON(),
    transactionHash: built.hash.toJSON(),
  };
}

export function buildVaultDepositSessionTransaction(
  contractHash: string,
  wasmBytes: Uint8Array,
  signingPublicKeyHex: string,
  input: { user: string; amount: bigint },
  network: CasperNetworkConfig = DEFAULT_TESTNET_CONFIG,
): CsprClickTransactionPayload {
  const transaction = new casperSdk.SessionBuilder();
  transaction.from(casperSdk.PublicKey.fromHex(signingPublicKeyHex));
  transaction.wasm(wasmBytes);
  transaction.runtimeArgs(
    casperSdk.Args.fromMap({
      package_hash: casperSdk.CLValue.newCLByteArray(
        contractHashToByteArray(contractHash),
      ),
      user: casperSdk.CLValue.newCLKey(casperSdk.Key.newKey(input.user)),
      amount: casperSdk.CLValue.newCLUInt512(input.amount.toString()),
    }),
  );
  transaction.chainName(network.chainName);
  transaction.payment(VAULT_DEPOSIT_SESSION_PAYMENT_MOTES);

  const built = transaction.build();
  return {
    transaction: built.toJSON(),
    transactionHash: built.hash.toJSON(),
  };
}

export function accountHashFromPublicKey(publicKeyHex: string): string {
  const publicKey = casperSdk.PublicKey.fromHex(publicKeyHex) as {
    accountHash(): { toHex(): string; toPrefixedString?: () => string };
  };
  const accountHash = publicKey.accountHash();
  return accountHash.toPrefixedString?.() ?? `account-hash-${accountHash.toHex()}`;
}

export function prepareStageIntentDeploy(
  contractHash: string,
  intent: Intent,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "stage_intent",
    paymentMotes: 2_500_000_000n,
    args: {
      intent_id: intent.id,
      user: intent.user,
      agent: intent.agent,
      target: intent.target,
      action: intent.action,
      amount: intent.amount,
      resource_hash: intent.resourceHash,
      payload_hash: intent.payloadHash,
      nonce: intent.nonce,
    },
  });
}

export function prepareRegisterAgentDeploy(
  contractHash: string,
  agent: AgentProfile,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "register_agent",
    paymentMotes: 2_500_000_000n,
    args: {
      agent: agent.accountHash,
      public_key: agent.publicKey,
      name: agent.name,
      metadata_uri: agent.metadataUri,
      capabilities_hash: agent.capabilitiesHash,
      status: agent.status,
    },
  });
}

export function prepareVaultDepositDeploy(
  contractHash: string,
  input: { user: string; amount: bigint },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "deposit",
    paymentMotes: 2_500_000_000n,
    args: {
      user: input.user,
      amount: input.amount,
    },
  });
}

export function prepareVaultWithdrawDeploy(
  contractHash: string,
  input: { user: string; amount: bigint },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "withdraw",
    paymentMotes: 2_500_000_000n,
    args: {
      user: input.user,
      amount: input.amount,
    },
  });
}

export function prepareApproveIntentDeploy(
  contractHash: string,
  input: { intentId: string; user: string },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "approve_intent",
    paymentMotes: 2_500_000_000n,
    args: {
      intent_id: input.intentId,
      user: input.user,
    },
  });
}

export function prepareRejectIntentDeploy(
  contractHash: string,
  input: { intentId: string; user: string },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "reject_intent",
    paymentMotes: 2_500_000_000n,
    args: {
      intent_id: input.intentId,
      user: input.user,
    },
  });
}

export function prepareMandateDeploy(
  contractHash: string,
  mandate: Mandate,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "create_mandate",
    paymentMotes: 3_000_000_000n,
    args: {
      mandate_id: mandate.id,
      user: mandate.user,
      agent: mandate.agent,
      scope: mandate.scope,
      cap: mandate.cap,
      target: mandate.target,
      resource_pattern_hash: mandate.resourcePatternHash,
      expiry_block: mandate.expiryBlock,
    },
  });
}

export function prepareRevokeMandateDeploy(
  contractHash: string,
  input: { mandateId: string; user: string },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "revoke_mandate",
    paymentMotes: 2_500_000_000n,
    args: {
      mandate_id: input.mandateId,
      user: input.user,
    },
  });
}

export function prepareExecutePaymentDeploy(
  contractHash: string,
  input: {
    mandateId: string;
    agent: string;
    settlementAccount: string;
    amount: bigint;
    target: string;
    resourceHash: string;
    currentBlock?: bigint;
  },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "execute_payment",
    paymentMotes: 3_000_000_000n,
    args: {
      mandate_id: input.mandateId,
      agent: input.agent,
      settlement_account: input.settlementAccount,
      amount: input.amount,
      target: input.target,
      resource_hash: input.resourceHash,
      current_block: input.currentBlock ?? 1n,
    },
  });
}

export function prepareRecordReceiptDeploy(
  contractHash: string,
  receipt: Receipt,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "record_receipt",
    paymentMotes: 2_500_000_000n,
    args: {
      receipt_id: receipt.id,
      intent_id: receipt.intentId,
      mandate_id: receipt.mandateId,
      deploy_hash: receipt.deployHash,
      amount: receipt.amount,
      target: receipt.target,
      resource_hash: receipt.resourceHash,
      result_hash: receipt.resultHash,
    },
  });
}

export function verifyPaymentProofShape(proof: PaymentProof): boolean {
  return proof.amount > 0n && proof.deployHash.length >= 32;
}
