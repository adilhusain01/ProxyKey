import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import * as z from "zod/v4";
import {
  agentProfileSchema,
  indexedAgentProfileSchema,
  indexedReceiptInputSchema,
  indexedStagedIntentInputSchema,
  executePaymentInputSchema,
  mandateInputSchema,
  stagedIntentInputSchema,
} from "@proxykey/shared";
import {
  prepareExecutePaymentDeploy,
  prepareMandateDeploy,
  prepareRegisterAgentDeploy,
  prepareStageIntentDeploy,
} from "@proxykey/casper";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const CONTRACT_HASH =
  process.env.PROXYKEY_CONTRACT_HASH ??
  "hash-0000000000000000000000000000000000000000000000000000000000000000";
const API_BASE_URL = process.env.PROXYKEY_API_BASE_URL || undefined;

const mcpAccountHashSchema = z
  .string()
  .min(16)
  .describe("Casper account hash or public key hex");
const mcpHashSchema = z
  .string()
  .regex(/^(0x)?[a-fA-F0-9]{32,128}$/)
  .describe("Hex-encoded content, deploy, or result hash");
const mcpPositiveAmountSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .describe("Positive integer encoded as a decimal string in motes");
const mcpNonZeroBlockSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .describe("Positive Casper block height encoded as a decimal string");

const mcpAgentProfileSchema = z.object({
  accountHash: mcpAccountHashSchema,
  publicKey: z.string().min(32),
  name: z.string().min(2).max(80),
  metadataUri: z.string().url(),
  capabilities: z
    .array(
      z.enum([
        "rwa-risk-data",
        "x402-payment",
        "defi-rebalance",
        "receipt-ledger",
      ]),
    )
    .min(1),
  capabilitiesHash: mcpHashSchema,
  status: z.enum(["active", "paused", "revoked"]),
});

const mcpIndexedAgentProfileSchema = mcpAgentProfileSchema.extend({
  deployHash: mcpHashSchema,
});

const mcpStagedIntentInputSchema = z.object({
  user: mcpAccountHashSchema,
  agent: mcpAccountHashSchema,
  target: z.string().min(3).max(120),
  action: z.string().min(3).max(120),
  reason: z.string().min(8).max(500),
  amount: mcpPositiveAmountSchema,
  resourceHash: mcpHashSchema,
  payloadHash: mcpHashSchema,
  nonce: z.string().min(8),
});

const mcpIndexedStagedIntentInputSchema = mcpStagedIntentInputSchema.extend({
  deployHash: mcpHashSchema,
});

const mcpMandateInputSchema = z.object({
  user: mcpAccountHashSchema,
  agent: mcpAccountHashSchema,
  scope: z.enum(["single-intent", "delegated"]),
  cap: mcpPositiveAmountSchema,
  target: z.string().min(3).max(120),
  resourcePatternHash: mcpHashSchema,
  expiryBlock: mcpNonZeroBlockSchema,
});

const mcpExecutePaymentInputSchema = z.object({
  user: mcpAccountHashSchema,
  mandateId: z.string().min(8),
  agent: mcpAccountHashSchema,
  settlementAccount: mcpAccountHashSchema,
  intentId: z.string().min(8).optional(),
  amount: mcpPositiveAmountSchema,
  target: z.string().min(3).max(120),
  resourceHash: mcpHashSchema,
  deployHash: mcpHashSchema,
  resultHash: mcpHashSchema,
  currentBlock: mcpNonZeroBlockSchema.optional(),
});

const mcpReceiptInputSchema = z.object({
  user: mcpAccountHashSchema,
  intentId: z.string().min(8),
  mandateId: z.string().min(8),
  deployHash: mcpHashSchema,
  recordDeployHash: mcpHashSchema,
  amount: mcpPositiveAmountSchema,
  target: z.string().min(3).max(120),
  resourceHash: mcpHashSchema,
  resultHash: mcpHashSchema,
});

function id(prefix: string, payload: unknown) {
  return `${prefix}-${crypto
    .createHash("sha256")
    .update(JSON.stringify(payload, (_, value) => (typeof value === "bigint" ? value.toString() : value)))
    .digest("hex")
    .slice(0, 12)}`;
}

async function postApi(path: string, body: unknown) {
  if (!API_BASE_URL) return undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `ProxyKey API ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

async function getApi(path: string) {
  if (!API_BASE_URL) return undefined;

  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `ProxyKey API ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

export async function registerAgent(input: unknown) {
  const agent = agentProfileSchema.parse(input);
  return {
    status: "deploy-ready",
    agent,
    indexing: "Submit the deploy, then POST /agents with the deployHash to index the confirmed registration.",
    deploy: prepareRegisterAgentDeploy(CONTRACT_HASH, agent),
  };
}

export async function stageIntent(input: unknown) {
  const staged = stagedIntentInputSchema.parse(input);
  const intent = {
    id: id("intent", staged),
    ...staged,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  const deploy = prepareStageIntentDeploy(CONTRACT_HASH, intent);
  return {
    intent,
    indexing: "Submit the deploy, then POST /users/:account/intents with the deployHash to index the confirmed intent.",
    deploy,
  };
}

export async function indexRegisteredAgent(input: unknown) {
  const agent = indexedAgentProfileSchema.parse(input);
  const indexed = await postApi("/agents", agent);

  return {
    status: "indexed",
    agent,
    indexed,
  };
}

export async function indexStagedIntent(input: unknown) {
  const intent = indexedStagedIntentInputSchema.parse(input);
  const indexed = await postApi(`/users/${intent.user}/intents`, intent);

  return {
    status: "indexed",
    intent,
    indexed,
  };
}

export async function requestMandate(input: unknown) {
  const mandate = mandateInputSchema.parse(input);
  return {
    mandateRequestId: id("mandate-request", mandate),
    status: "pending-user-approval",
    mandate,
    deploy: prepareMandateDeploy(CONTRACT_HASH, {
      id: id("mandate-preview", mandate),
      ...mandate,
      spent: 0n,
      status: "active",
    }),
  };
}

export async function checkMandate(input: { user: string; mandateId: string }) {
  const mandates = (await getApi(`/users/${input.user}/mandates`)) as
    | Array<{ id: string }>
    | undefined;
  const mandate = mandates?.find((item) => item.id === input.mandateId);
  return {
    mandateId: input.mandateId,
    status: mandate ? "indexed" : "not-indexed",
    mandate,
    contractHash: CONTRACT_HASH,
    entrypoint: "create_mandate",
  };
}

export async function executeAuthorizedPayment(
  input: unknown,
) {
  const execution = executePaymentInputSchema
    .extend({
      user: z.string().min(16),
      mandateId: z.string().min(8),
    })
    .parse(input);
  const indexed = await postApi(
    `/users/${execution.user}/mandates/${execution.mandateId}/execute`,
    execution,
  );
  return {
    status: "executed",
    deploy: prepareExecutePaymentDeploy(
      CONTRACT_HASH,
      execution.currentBlock
        ? {
            mandateId: execution.mandateId,
            agent: execution.agent,
            settlementAccount: execution.settlementAccount,
            amount: execution.amount,
            target: execution.target,
            resourceHash: execution.resourceHash,
            currentBlock: execution.currentBlock,
          }
        : {
            mandateId: execution.mandateId,
            agent: execution.agent,
            settlementAccount: execution.settlementAccount,
            amount: execution.amount,
            target: execution.target,
            resourceHash: execution.resourceHash,
          },
    ),
    args: execution,
    indexed,
  };
}

export async function fetchRwaReport(input: { asset: string; apiBaseUrl: string }) {
  const reportResponse = await fetch(`${input.apiBaseUrl}/x402/rwa/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset: input.asset }),
  });

  return {
    status: reportResponse.status,
    body: await reportResponse.json(),
  };
}

export async function recordReceipt(input: unknown) {
  const receipt = indexedReceiptInputSchema.parse(input);
  const indexed = await postApi("/receipts", receipt);
  return {
    status: "recorded",
    receipt,
    indexed,
  };
}

export function explainPendingApproval(input: {
  agentName: string;
  target: string;
  amount: string;
  reason: string;
}) {
  return {
    summary: `${input.agentName} is requesting authority to pay ${input.amount} motes to ${input.target}.`,
    risk: "The agent cannot execute until the user signs a mandate. The mandate can cap spend, target, resource hash, and expiry block.",
    reason: input.reason,
  };
}

export const schemas = {
  registerAgent: mcpAgentProfileSchema,
  stageIntent: mcpStagedIntentInputSchema,
  indexRegisteredAgent: mcpIndexedAgentProfileSchema,
  indexStagedIntent: mcpIndexedStagedIntentInputSchema,
  requestMandate: mcpMandateInputSchema,
  checkMandate: z.object({
    user: z.string().min(16),
    mandateId: z.string().min(8),
  }),
  executeAuthorizedPayment: mcpExecutePaymentInputSchema,
  fetchRwaReport: z.object({
    asset: z.string().min(2),
    apiBaseUrl: z.string().url(),
  }),
  recordReceipt: mcpReceiptInputSchema,
  explainPendingApproval: z.object({
    agentName: z.string().min(2),
    target: z.string().min(3),
    amount: z.string().min(1),
    reason: z.string().min(8),
  }),
};
