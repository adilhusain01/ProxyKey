import { describe, expect, it } from "vitest";
import {
  buildVaultDepositSessionTransaction,
  CONTRACT_CALL_PAYMENT_MOTES,
  prepareApproveIntentDeploy,
  VAULT_DEPOSIT_SESSION_PAYMENT_MOTES,
} from "./index";

const contractHash = `hash-${"1".repeat(64)}`;
const publicKey = `01${"2".repeat(64)}`;
const user = `account-hash-${"3".repeat(64)}`;

describe("casper deploy helpers", () => {
  it("keeps vault deposit session payment above observed Testnet gas", () => {
    expect(VAULT_DEPOSIT_SESSION_PAYMENT_MOTES).toBe(10_000_000_000);
  });

  it("keeps contract call payment above observed Testnet gas", () => {
    expect(CONTRACT_CALL_PAYMENT_MOTES).toBe(10_000_000_000n);
  });

  it("builds a CSPR.click-ready session transaction for vault deposits", () => {
    const payload = buildVaultDepositSessionTransaction(
      contractHash,
      new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
      publicKey,
      {
      user,
      amount: 2_500_000_000n,
      },
    );

    expect(payload.transactionHash).toHaveLength(64);
    expect(payload.transaction).toMatchObject({
      payload: expect.objectContaining({
        fields: expect.objectContaining({
          entry_point: "Call",
          target: expect.objectContaining({
            Session: expect.objectContaining({
              module_bytes: "0061736d01000000",
            }),
          }),
        }),
      }),
    });
  });

  it("keeps approve intent payloads bound to the planned entrypoint", () => {
    const prepared = prepareApproveIntentDeploy(contractHash, {
      intentId: "intent-rwa-001",
      user,
    });

    expect(prepared.request.entrypoint).toBe("approve_intent");
    expect(prepared.signingPayload).toContain("intent-rwa-001");
  });
});
