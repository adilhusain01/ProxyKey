import { z } from "zod";
import type { AgentProfile, Intent, Mandate, PaymentProof, Receipt } from "@proxykey/shared";

export const casperNetworkConfigSchema = z.object({
  networkName: z.string().default("casper-test"),
  nodeRpcUrl: z.string().url(),
  chainName: z.string().default("casper-test"),
});

export type CasperNetworkConfig = z.infer<typeof casperNetworkConfigSchema>;

export const DEFAULT_TESTNET_CONFIG: CasperNetworkConfig = {
  networkName: "casper-test",
  nodeRpcUrl: "https://rpc.testnet.casper.network/rpc",
  chainName: "casper-test",
};

export type ContractEntrypoint =
  | "register_agent"
  | "stage_intent"
  | "deposit"
  | "withdraw"
  | "approve_intent"
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

export function prepareStageIntentDeploy(
  contractHash: string,
  intent: Intent,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "stage_intent",
    paymentMotes: 2_500_000_000n,
    args: {
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
      account_hash: agent.accountHash,
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

export function prepareMandateDeploy(
  contractHash: string,
  mandate: Mandate,
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "create_mandate",
    paymentMotes: 3_000_000_000n,
    args: {
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
    amount: bigint;
    target: string;
    resourceHash: string;
  },
): PreparedDeploy<Record<string, unknown>> {
  return prepareDeploy({
    contractHash,
    entrypoint: "execute_payment",
    paymentMotes: 3_000_000_000n,
    args: {
      mandate_id: input.mandateId,
      agent: input.agent,
      amount: input.amount,
      target: input.target,
      resource_hash: input.resourceHash,
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
