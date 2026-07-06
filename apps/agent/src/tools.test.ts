import { beforeAll, describe, expect, it } from "vitest";

let tools: typeof import("./tools");

const hash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("agent tools", () => {
  beforeAll(async () => {
    process.env.PROXYKEY_API_BASE_URL = "";
    tools = await import("./tools");
  });

  it("stages an intent with a prepared Casper deploy", async () => {
    const result = await tools.stageIntent({
      user: "account-hash-user0001",
      agent: "account-hash-agent001",
      target: "rwa-risk-api",
      action: "fetch-risk-report",
      reason: "Agent needs RWA risk data before moving capital.",
      amount: 2500000000n,
      resourceHash: hash,
      payloadHash: hash,
      nonce: "nonce-001",
    });

    expect(result.intent.status).toBe("pending");
    expect(result.deploy.request.entrypoint).toBe("stage_intent");
  });

  it("explains approval risk in user language", () => {
    expect(
      tools.explainPendingApproval({
        agentName: "RWA Sentinel",
        target: "rwa-risk-api",
        amount: "2500000000",
        reason: "Needs paid risk data.",
      }).risk,
    ).toContain("cap spend");
  });

  it("validates and records receipt payloads", async () => {
    const result = await tools.recordReceipt({
      user: "account-hash-user0001",
      intentId: "intent-rwa-001",
      mandateId: "mandate-rwa-001",
      deployHash: hash,
      recordDeployHash: hash,
      amount: 2500000000n,
      target: "rwa-risk-api",
      resourceHash: hash,
      resultHash: hash,
    });

    expect(result.status).toBe("recorded");
    expect(result.receipt.mandateId).toBe("mandate-rwa-001");
  });
});
