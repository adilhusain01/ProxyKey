import { describe, expect, it } from "vitest";
import { buildServer } from "./server";
import { RWA_SERVICE_ACCOUNT, createResourceHash } from "./rwa";

const hash =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

describe("api server", () => {
  process.env.CASPER_DEPLOY_VERIFY_ATTEMPTS = "1";
  process.env.CASPER_DEPLOY_VERIFY_DELAY_MS = "1";

  it("serves health", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "proxykey-api" });
    await app.close();
  });

  it("returns x402 payment requirements for RWA reports", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/x402/rwa/report",
      payload: { asset: "tokenized-treasury-note" },
    });

    expect(response.statusCode).toBe(402);
    expect(response.json().accepts[0]).toMatchObject({
      scheme: "casper-testnet-mandate",
      network: "casper-test",
    });
    await app.close();
  });

  it("rejects an x402 proof without a confirmed Casper payment", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/x402/rwa/verify-payment",
      payload: {
        asset: "tokenized-treasury-note",
        proof: {
          deployHash: hash,
          from: "account-hash-user0001",
          to: RWA_SERVICE_ACCOUNT,
          amount: "2500000000",
          resourceHash: createResourceHash("tokenized-treasury-note"),
          signature: "0x11111111111111111111111111111111",
        },
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ status: "error" });
    await app.close();
  });

  it("returns validation errors for malformed agent registration", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "RWA Sentinel" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: "error" });
    await app.close();
  });

  it("rejects vault indexing without a Casper deploy hash", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/users/account-hash-user0001/vault/deposit",
      payload: { amount: "2500000000" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: "error" });
    await app.close();
  });

  it("rejects mandate revocation indexing without a Casper deploy hash", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "PATCH",
      url: "/users/account-hash-user0001/mandates/mandate-rwa-001/revoke",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ status: "error" });
    await app.close();
  });
});
