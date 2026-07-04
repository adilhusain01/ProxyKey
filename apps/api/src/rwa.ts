import crypto from "node:crypto";
import {
  paymentProofSchema,
  type PaymentProof,
  type RwaReport,
} from "@proxykey/shared";

export const RWA_SERVICE_ACCOUNT = "account-hash-proxykey-rwa-service";

export function createResourceHash(asset: string): string {
  return `0x${crypto.createHash("sha256").update(`rwa:${asset}`).digest("hex")}`;
}

export function verifyPaymentProof(input: unknown): PaymentProof {
  const proof = paymentProofSchema.parse(input);
  if (proof.to !== RWA_SERVICE_ACCOUNT) {
    throw new Error("Payment proof recipient does not match RWA service");
  }
  return proof;
}

export function buildRwaReport(asset: string, proof: PaymentProof): RwaReport {
  const sourceDataHash = createResourceHash(`${asset}:${proof.deployHash}`);
  return {
    reportId: `rwa-${sourceDataHash.slice(2, 14)}`,
    asset,
    rating: "moderate-risk",
    yieldBps: 735,
    liquidityScore: 82,
    jurisdiction: "US",
    sourceDataHash,
    receiptId: `receipt-${proof.deployHash.slice(2, 14)}`,
    generatedAt: new Date().toISOString(),
  };
}
