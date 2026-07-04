import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import * as z from "zod/v4";
import {
  agentProfileSchema,
  indexedReceiptInputSchema,
  executePaymentInputSchema,
  mandateInputSchema,
  stagedIntentInputSchema,
  type AgentProfile,
  type ExecutePaymentInput,
  type MandateInput,
  type StagedIntentInput,
} from "@proxykey/shared";
import {
  prepareExecutePaymentDeploy,
  prepareMandateDeploy,
  prepareRegisterAgentDeploy,
  prepareStageIntentDeploy,
} from "@proxykey/casper";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const CONTRACT_HASH =
  process.env.PROXYKEY_CONTRACT_HASH ??
  "hash-0000000000000000000000000000000000000000000000000000000000000000";
const API_BASE_URL = process.env.PROXYKEY_API_BASE_URL || undefined;

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

export async function registerAgent(input: AgentProfile) {
  const agent = agentProfileSchema.parse(input);
  const indexed = await postApi("/agents", agent);
  return {
    status: "registered",
    agent,
    indexed,
    deploy: prepareRegisterAgentDeploy(CONTRACT_HASH, agent),
  };
}

export async function stageIntent(input: StagedIntentInput) {
  const staged = stagedIntentInputSchema.parse(input);
  const intent = {
    id: id("intent", staged),
    ...staged,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  const deploy = prepareStageIntentDeploy(CONTRACT_HASH, intent);
  const indexed = await postApi(`/users/${staged.user}/intents`, staged);
  return { intent, indexed, deploy };
}

export async function requestMandate(input: MandateInput) {
  const mandate = mandateInputSchema.parse(input);
  const indexed = await postApi(`/users/${mandate.user}/mandates`, mandate);
  return {
    mandateRequestId: id("mandate-request", mandate),
    status: "pending-user-approval",
    mandate,
    indexed,
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
  input: ExecutePaymentInput & { user: string; mandateId: string },
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
    deploy: prepareExecutePaymentDeploy(CONTRACT_HASH, {
      mandateId: execution.mandateId,
      agent: execution.agent,
      amount: execution.amount,
      target: execution.target,
      resourceHash: execution.resourceHash,
    }),
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
  registerAgent: agentProfileSchema,
  stageIntent: stagedIntentInputSchema,
  requestMandate: mandateInputSchema,
  checkMandate: z.object({
    user: z.string().min(16),
    mandateId: z.string().min(8),
  }),
  executeAuthorizedPayment: executePaymentInputSchema.extend({
    user: z.string().min(16),
    mandateId: z.string().min(8),
  }),
  fetchRwaReport: z.object({
    asset: z.string().min(2),
    apiBaseUrl: z.string().url(),
  }),
  recordReceipt: indexedReceiptInputSchema,
  explainPendingApproval: z.object({
    agentName: z.string().min(2),
    target: z.string().min(3),
    amount: z.string().min(1),
    reason: z.string().min(8),
  }),
};
