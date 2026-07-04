import { z } from "zod";

export const accountHashSchema = z
  .string()
  .min(16)
  .describe("Casper account hash or public key hex");

export const hashSchema = z
  .string()
  .regex(/^(0x)?[a-fA-F0-9]{32,128}$/)
  .describe("Hex-encoded content, deploy, or result hash");

export const positiveAmountSchema = z.coerce
  .bigint()
  .refine((value) => value > 0n, "Amount must be positive");

export const agentCapabilitySchema = z.enum([
  "rwa-risk-data",
  "x402-payment",
  "defi-rebalance",
  "receipt-ledger",
]);

export const statusSchema = z.enum(["active", "paused", "revoked"]);

export const agentProfileSchema = z.object({
  accountHash: accountHashSchema,
  publicKey: z.string().min(32),
  name: z.string().min(2).max(80),
  metadataUri: z.string().url(),
  capabilities: z.array(agentCapabilitySchema).min(1),
  capabilitiesHash: hashSchema,
  status: statusSchema,
});

export const intentStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "executed",
  "expired",
]);

export const intentSchema = z.object({
  id: z.string().min(8),
  user: accountHashSchema,
  agent: accountHashSchema,
  target: z.string().min(3).max(120),
  action: z.string().min(3).max(120),
  reason: z.string().min(8).max(500),
  amount: positiveAmountSchema,
  resourceHash: hashSchema,
  payloadHash: hashSchema,
  nonce: z.string().min(8),
  status: intentStatusSchema,
  createdAt: z.string().datetime(),
});

export const mandateScopeSchema = z.enum(["single-intent", "delegated"]);

export const mandateStatusSchema = z.enum(["active", "revoked", "exhausted"]);

export const mandateSchema = z.object({
  id: z.string().min(8),
  user: accountHashSchema,
  agent: accountHashSchema,
  scope: mandateScopeSchema,
  cap: positiveAmountSchema,
  spent: z.coerce.bigint().nonnegative(),
  target: z.string().min(3).max(120),
  resourcePatternHash: hashSchema,
  expiryBlock: z.coerce.bigint().positive(),
  status: mandateStatusSchema,
});

export const receiptSchema = z.object({
  id: z.string().min(8),
  intentId: z.string().min(8),
  mandateId: z.string().min(8),
  deployHash: hashSchema,
  amount: positiveAmountSchema,
  target: z.string().min(3).max(120),
  resourceHash: hashSchema,
  resultHash: hashSchema,
  createdAt: z.string().datetime(),
});

export const vaultBalanceSchema = z.object({
  user: accountHashSchema,
  total: z.coerce.bigint().nonnegative(),
  reserved: z.coerce.bigint().nonnegative(),
  available: z.coerce.bigint().nonnegative(),
});

export const vaultOperationSchema = z.object({
  amount: positiveAmountSchema,
  deployHash: hashSchema.optional(),
});

export const paymentProofSchema = z.object({
  deployHash: hashSchema,
  from: accountHashSchema,
  to: accountHashSchema,
  amount: positiveAmountSchema,
  resourceHash: hashSchema,
  signature: z.string().min(32),
});

export const rwaReportSchema = z.object({
  reportId: z.string().min(8),
  asset: z.string().min(2).max(120),
  rating: z.enum(["low-risk", "moderate-risk", "elevated-risk", "high-risk"]),
  yieldBps: z.number().int().nonnegative(),
  liquidityScore: z.number().min(0).max(100),
  jurisdiction: z.string().min(2).max(80),
  sourceDataHash: hashSchema,
  receiptId: z.string().min(8),
  generatedAt: z.string().datetime(),
});

export const walletChallengeSchema = z.object({
  account: accountHashSchema,
  nonce: z.string().min(16),
  message: z.string().min(16),
  issuedAt: z.string().datetime(),
});

export const walletVerificationSchema = walletChallengeSchema.extend({
  signature: z.string().min(32),
});

export const stagedIntentInputSchema = intentSchema.omit({
  id: true,
  status: true,
  createdAt: true,
});

export const mandateInputSchema = mandateSchema.omit({
  id: true,
  spent: true,
  status: true,
});

export const receiptInputSchema = receiptSchema.omit({
  id: true,
  createdAt: true,
});

export const indexedReceiptInputSchema = receiptInputSchema.extend({
  user: accountHashSchema,
});

export const approveIntentInputSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  scope: mandateScopeSchema.default("single-intent"),
  cap: positiveAmountSchema.optional(),
  resourcePatternHash: hashSchema.optional(),
  expiryBlock: z.coerce.bigint().positive().optional(),
});

export const executePaymentInputSchema = z.object({
  agent: accountHashSchema,
  intentId: z.string().min(8).optional(),
  amount: positiveAmountSchema,
  target: z.string().min(3).max(120),
  resourceHash: hashSchema,
  deployHash: hashSchema,
  resultHash: hashSchema,
  currentBlock: z.coerce.bigint().positive().optional(),
});

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;
export type AgentProfile = z.infer<typeof agentProfileSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type Mandate = z.infer<typeof mandateSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type VaultBalance = z.infer<typeof vaultBalanceSchema>;
export type VaultOperation = z.infer<typeof vaultOperationSchema>;
export type PaymentProof = z.infer<typeof paymentProofSchema>;
export type RwaReport = z.infer<typeof rwaReportSchema>;
export type WalletChallenge = z.infer<typeof walletChallengeSchema>;
export type WalletVerification = z.infer<typeof walletVerificationSchema>;
export type StagedIntentInput = z.infer<typeof stagedIntentInputSchema>;
export type MandateInput = z.infer<typeof mandateInputSchema>;
export type ReceiptInput = z.infer<typeof receiptInputSchema>;
export type IndexedReceiptInput = z.infer<typeof indexedReceiptInputSchema>;
export type ApproveIntentInput = z.infer<typeof approveIntentInputSchema>;
export type ExecutePaymentInput = z.infer<typeof executePaymentInputSchema>;

export function bigintToJson(value: bigint): string {
  return value.toString();
}

export function parseAmount(value: string | number | bigint): bigint {
  const amount = BigInt(value);
  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }
  return amount;
}
