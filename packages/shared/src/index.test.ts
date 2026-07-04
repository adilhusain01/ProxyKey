import { describe, expect, it } from "vitest";
import { intentSchema, mandateSchema, paymentProofSchema } from "./index";

const hash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("shared schemas", () => {
  it("validates an agent intent", () => {
    const parsed = intentSchema.parse({
      id: "intent-001",
      user: "account-hash-user0001",
      agent: "account-hash-agent001",
      target: "rwa-risk-api",
      action: "fetch-risk-report",
      reason: "Agent needs current risk data before execution.",
      amount: "2500000000",
      resourceHash: hash,
      payloadHash: hash,
      nonce: "nonce-001",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    expect(parsed.amount).toBe(2500000000n);
  });

  it("rejects exhausted delegated caps", () => {
    expect(() =>
      mandateSchema.parse({
        id: "mandate-001",
        user: "account-hash-user0001",
        agent: "account-hash-agent001",
        scope: "delegated",
        cap: "0",
        spent: "0",
        target: "rwa-risk-api",
        resourcePatternHash: hash,
        expiryBlock: "100",
        status: "active",
      }),
    ).toThrow();
  });

  it("validates payment proof shape", () => {
    const parsed = paymentProofSchema.parse({
      deployHash: hash,
      from: "account-hash-user0001",
      to: "account-hash-service1",
      amount: 10,
      resourceHash: hash,
      signature: "signature".repeat(8),
    });

    expect(parsed.amount).toBe(10n);
  });
});
