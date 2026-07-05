import { describe, expect, it } from "vitest";
import {
  buildContractCallTransaction,
  prepareApproveIntentDeploy,
  prepareVaultDepositDeploy,
} from "./index";

const contractHash = `hash-${"1".repeat(64)}`;
const publicKey = `01${"2".repeat(64)}`;

describe("casper deploy helpers", () => {
  it("builds a CSPR.click-ready contract transaction for vault deposits", () => {
    const prepared = prepareVaultDepositDeploy(contractHash, {
      user: "account-hash-user0001",
      amount: 2_500_000_000n,
    });

    const payload = buildContractCallTransaction(prepared, publicKey);

    expect(payload.transactionHash).toHaveLength(64);
    expect(payload.transaction).toMatchObject({
      payload: expect.objectContaining({
        fields: expect.objectContaining({
          entry_point: { Custom: "deposit" },
        }),
      }),
    });
  });

  it("keeps approve intent payloads bound to the planned entrypoint", () => {
    const prepared = prepareApproveIntentDeploy(contractHash, {
      intentId: "intent-rwa-001",
      user: "account-hash-user0001",
    });

    expect(prepared.request.entrypoint).toBe("approve_intent");
    expect(prepared.signingPayload).toContain("intent-rwa-001");
  });
});
