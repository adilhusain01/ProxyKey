import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { config } from "dotenv";
import { ZodError } from "zod";
import {
  agentProfileSchema,
  approveIntentInputSchema,
  createMandateInputSchema,
  executePaymentInputSchema,
  indexedReceiptInputSchema,
  paymentProofSchema,
  revokeMandateInputSchema,
  stagedIntentInputSchema,
  vaultOperationSchema,
  walletVerificationSchema,
  type WalletChallenge,
} from "@proxykey/shared";
import {
  verifyCasperDeployHash,
  type IndexedOperation,
} from "./casper-indexer";
import { closeDb, createDb } from "./db/client";
import {
  agents,
  deployEvents,
  intents,
  mandates,
  receipts,
  vaultBalances,
} from "./db/schema";
import { buildRwaReport, createResourceHash, verifyPaymentProof } from "./rwa";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const challenges = new Map<string, WalletChallenge>();

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function serializeJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeJson(item)]),
    );
  }
  return value;
}

function id(prefix: string, payload: unknown) {
  return `${prefix}-${crypto
    .createHash("sha256")
    .update(
      JSON.stringify(payload, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    )
    .digest("hex")
    .slice(0, 12)}`;
}

function requireMatchingAccount(routeAccount: string, bodyAccount: string) {
  if (routeAccount !== bodyAccount) {
    throw new HttpError(400, "Route account does not match request body account");
  }
}

function mandateReservedAmount(mandate: { cap: bigint; spent: bigint }) {
  return mandate.cap > mandate.spent ? mandate.cap - mandate.spent : 0n;
}

function defaultExpiryBlock() {
  return BigInt(process.env.DEFAULT_MANDATE_EXPIRY_BLOCK ?? "9000000");
}

async function buildDeployEvent(input: {
  deployHash: string;
  operation: IndexedOperation;
  account: string;
  intentId?: string | undefined;
  mandateId?: string | undefined;
}) {
  try {
    const verification = await verifyCasperDeployHash(input.deployHash);
    return {
      deployHash: input.deployHash,
      operation: input.operation,
      account: input.account,
      intentId: input.intentId,
      mandateId: input.mandateId,
      status: verification.status,
      raw: JSON.stringify(verification.raw),
      observedAt: new Date(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Casper RPC error";
    throw new HttpError(409, message);
  }
}

export function buildServer() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        status: "error",
        message: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (error instanceof HttpError) {
      return reply
        .code(error.statusCode)
        .send({ status: "error", message: error.message });
    }

    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return reply.code(500).send({ status: "error", message });
  });

  void app.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? true,
    methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
  });
  void app.register(helmet);

  app.addHook("onClose", async () => {
    await closeDb();
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "proxykey-api",
    network: "casper-test",
  }));

  app.get<{ Params: { hash: string } }>("/deploys/:hash", async (request, reply) => {
    const db = createDb();
    const [event] = await db
      .select()
      .from(deployEvents)
      .where(eq(deployEvents.deployHash, request.params.hash));

    if (!event) {
      return reply
        .code(404)
        .send({ status: "error", message: "Deploy event not indexed" });
    }

    return serializeJson(event);
  });

  app.post<{ Body: { account: string } }>("/auth/challenge", async (request) => {
    const nonce = crypto.randomBytes(18).toString("hex");
    const issuedAt = new Date().toISOString();
    const challenge = {
      account: request.body.account,
      nonce,
      issuedAt,
      message: `ProxyKey wallet verification for ${request.body.account} at ${issuedAt} with nonce ${nonce}`,
    };
    challenges.set(request.body.account, challenge);
    return challenge;
  });

  app.post("/auth/verify", async (request, reply) => {
    const verification = walletVerificationSchema.parse(request.body);
    const challenge = challenges.get(verification.account);

    if (!challenge || challenge.nonce !== verification.nonce) {
      return reply.code(401).send({ status: "error", message: "Invalid challenge" });
    }

    challenges.delete(verification.account);
    return {
      status: "success",
      account: verification.account,
      session: crypto
        .createHash("sha256")
        .update(`${verification.account}:${verification.signature}`)
        .digest("hex"),
    };
  });

  app.get("/agents", async () => {
    const db = createDb();
    const rows = await db.select().from(agents);
    return serializeJson(
      rows.map((agent) => ({
        ...agent,
        capabilities: JSON.parse(agent.capabilities) as Array<string>,
      })),
    );
  });

  app.post("/agents", async (request, reply) => {
    const agent = agentProfileSchema.parse(request.body);
    const db = createDb();
    const [created] = await db
      .insert(agents)
      .values({
        accountHash: agent.accountHash,
        publicKey: agent.publicKey,
        name: agent.name,
        metadataUri: agent.metadataUri,
        capabilities: JSON.stringify(agent.capabilities),
        capabilitiesHash: agent.capabilitiesHash,
        status: agent.status,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agents.accountHash,
        set: {
          publicKey: agent.publicKey,
          name: agent.name,
          metadataUri: agent.metadataUri,
          capabilities: JSON.stringify(agent.capabilities),
          capabilitiesHash: agent.capabilitiesHash,
          status: agent.status,
        },
      })
      .returning();

    if (!created) {
      throw new Error("Agent registration did not return a row");
    }

    return reply.code(201).send(
      serializeJson({
        ...created,
        capabilities: JSON.parse(created.capabilities) as Array<string>,
      }),
    );
  });

  app.get<{ Params: { id: string } }>("/agents/:id", async (request, reply) => {
    const db = createDb();
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.accountHash, request.params.id));
    if (!agent) {
      return reply.code(404).send({ status: "error", message: "Agent not found" });
    }
    return serializeJson({
      ...agent,
      capabilities: JSON.parse(agent.capabilities) as Array<string>,
    });
  });

  app.get<{ Params: { account: string } }>(
    "/users/:account/intents",
    async (request) => {
      const db = createDb();
      const rows = await db
        .select()
        .from(intents)
        .where(eq(intents.user, request.params.account));
      return serializeJson(rows);
    },
  );

  app.get<{ Params: { account: string } }>(
    "/users/:account/deploys",
    async (request) => {
      const db = createDb();
      const rows = await db
        .select()
        .from(deployEvents)
        .where(eq(deployEvents.account, request.params.account));
      return serializeJson(rows);
    },
  );

  app.post<{ Params: { account: string } }>(
    "/users/:account/intents",
    async (request, reply) => {
      const input = stagedIntentInputSchema.parse(request.body);
      requireMatchingAccount(request.params.account, input.user);
      const db = createDb();
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.accountHash, input.agent));

      if (!agent || agent.status !== "active") {
        throw new HttpError(409, "Agent is not registered or active");
      }

      const intent = {
        id: id("intent", input),
        ...input,
        status: "pending",
        createdAt: new Date(),
      };
      const [created] = await db.insert(intents).values(intent).returning();
      return reply.code(201).send(serializeJson(created));
    },
  );

  app.patch<{ Params: { account: string; id: string } }>(
    "/users/:account/intents/:id",
    async (request, reply) => {
      const body = approveIntentInputSchema.parse(request.body);
      if (body.status === "approved" && !body.deployHash) {
        throw new HttpError(400, "Approved intents require a Casper deploy hash");
      }
      const deployEvent =
        body.status === "approved"
          ? await buildDeployEvent({
              deployHash: body.deployHash!,
              operation: "intent.approve",
              account: request.params.account,
              intentId: request.params.id,
            })
          : undefined;
      const db = createDb();

      const result = await db.transaction(async (tx) => {
        const [intent] = await tx
          .select()
          .from(intents)
          .where(
            and(
              eq(intents.id, request.params.id),
              eq(intents.user, request.params.account),
            ),
          );

        if (!intent) {
          throw new HttpError(404, "Intent not found");
        }

        if (intent.status !== "pending" && intent.status !== "approved") {
          throw new HttpError(409, `Intent is already ${intent.status}`);
        }

        if (body.status === "rejected") {
          const [updated] = await tx
            .update(intents)
            .set({ status: "rejected" })
            .where(eq(intents.id, intent.id))
            .returning();
          return { intent: updated, mandate: undefined };
        }

        const cap = body.cap ?? intent.amount;
        const resourcePatternHash = body.resourcePatternHash ?? intent.resourceHash;
        const mandate = {
          id: id("mandate", {
            intentId: intent.id,
            user: intent.user,
            agent: intent.agent,
            scope: body.scope,
            target: intent.target,
            resourcePatternHash,
          }),
          user: intent.user,
          agent: intent.agent,
          scope: body.scope,
          cap,
          spent: 0n,
          target: intent.target,
          resourcePatternHash,
          expiryBlock: body.expiryBlock ?? defaultExpiryBlock(),
          status: "active",
        };

        const [existingMandate] = await tx
          .select()
          .from(mandates)
          .where(eq(mandates.id, mandate.id));

        if (existingMandate) {
          const [updatedIntent] = await tx
            .update(intents)
            .set({ status: "approved" })
            .where(eq(intents.id, intent.id))
            .returning();
          return { intent: updatedIntent, mandate: existingMandate };
        }

        const [balance] = await tx
          .select()
          .from(vaultBalances)
          .where(eq(vaultBalances.user, intent.user));

        if (!balance || balance.available < mandate.cap) {
          throw new HttpError(409, "Insufficient available vault balance for mandate cap");
        }

        const [createdMandate] = await tx
          .insert(mandates)
          .values(mandate)
          .onConflictDoUpdate({
            target: mandates.id,
            set: {
              scope: mandate.scope,
              cap: mandate.cap,
              target: mandate.target,
              resourcePatternHash: mandate.resourcePatternHash,
              expiryBlock: mandate.expiryBlock,
              status: "active",
            },
          })
          .returning();

        await tx
          .update(vaultBalances)
          .set({
            reserved: balance.reserved + mandate.cap,
            available: balance.available - mandate.cap,
            updatedAt: new Date(),
          })
          .where(eq(vaultBalances.user, intent.user));

        if (deployEvent) {
          await tx
            .insert(deployEvents)
            .values(deployEvent)
            .onConflictDoUpdate({
              target: deployEvents.deployHash,
              set: {
                operation: deployEvent.operation,
                status: deployEvent.status,
                raw: deployEvent.raw,
                observedAt: deployEvent.observedAt,
              },
            });
        }

        const [updatedIntent] = await tx
          .update(intents)
          .set({ status: "approved" })
          .where(eq(intents.id, intent.id))
          .returning();

        return { intent: updatedIntent, mandate: createdMandate };
      });

      return serializeJson(result);
    },
  );

  app.get<{ Params: { account: string } }>(
    "/users/:account/mandates",
    async (request) => {
      const db = createDb();
      const rows = await db
        .select()
        .from(mandates)
        .where(eq(mandates.user, request.params.account));
      return serializeJson(rows);
    },
  );

  app.post<{ Params: { account: string } }>(
    "/users/:account/mandates",
    async (request, reply) => {
      const input = createMandateInputSchema.parse(request.body);
      requireMatchingAccount(request.params.account, input.user);
      const { deployHash: _deployHash, ...mandateInput } = input;
      const deployEvent = await buildDeployEvent({
        deployHash: input.deployHash,
        operation: "mandate.create",
        account: input.user,
      });
      const db = createDb();

      const created = await db.transaction(async (tx) => {
        const [balance] = await tx
          .select()
          .from(vaultBalances)
          .where(eq(vaultBalances.user, mandateInput.user));

        if (!balance || balance.available < mandateInput.cap) {
          throw new HttpError(409, "Insufficient available vault balance for mandate cap");
        }

        const mandate = {
          id: id("mandate", mandateInput),
          ...mandateInput,
          spent: 0n,
          status: "active",
        };
        const [createdMandate] = await tx.insert(mandates).values(mandate).returning();
        if (!createdMandate) {
          throw new Error("Mandate creation did not return a row");
        }
        await tx
          .insert(deployEvents)
          .values({
            ...deployEvent,
            mandateId: createdMandate.id,
          })
          .onConflictDoUpdate({
            target: deployEvents.deployHash,
            set: {
              operation: deployEvent.operation,
              mandateId: createdMandate.id,
              status: deployEvent.status,
              raw: deployEvent.raw,
              observedAt: deployEvent.observedAt,
            },
          });
        await tx
          .update(vaultBalances)
          .set({
            reserved: balance.reserved + mandateInput.cap,
            available: balance.available - mandateInput.cap,
            updatedAt: new Date(),
          })
          .where(eq(vaultBalances.user, mandateInput.user));

        return createdMandate;
      });

      return reply.code(201).send(serializeJson(created));
    },
  );

  app.patch<{ Params: { account: string; id: string } }>(
    "/users/:account/mandates/:id/revoke",
    async (request, reply) => {
      const input = revokeMandateInputSchema.parse(request.body ?? {});
      const deployEvent = await buildDeployEvent({
        deployHash: input.deployHash,
        operation: "mandate.revoke",
        account: request.params.account,
        mandateId: request.params.id,
      });
      const db = createDb();
      const updated = await db.transaction(async (tx) => {
        const [mandate] = await tx
          .select()
          .from(mandates)
          .where(
            and(
              eq(mandates.id, request.params.id),
              eq(mandates.user, request.params.account),
            ),
          );

        if (!mandate) {
          throw new HttpError(404, "Mandate not found");
        }

        if (mandate.status !== "active") {
          throw new HttpError(409, `Mandate is already ${mandate.status}`);
        }

        const remainingReserve = mandateReservedAmount(mandate);
        const [balance] = await tx
          .select()
          .from(vaultBalances)
          .where(eq(vaultBalances.user, request.params.account));

        if (balance && remainingReserve > 0n) {
          await tx
            .update(vaultBalances)
            .set({
              reserved:
                balance.reserved > remainingReserve
                  ? balance.reserved - remainingReserve
                  : 0n,
              available: balance.available + remainingReserve,
              updatedAt: new Date(),
            })
            .where(eq(vaultBalances.user, request.params.account));
        }

        const [updatedMandate] = await tx
          .update(mandates)
          .set({ status: "revoked" })
          .where(eq(mandates.id, mandate.id))
          .returning();

        await tx
          .insert(deployEvents)
          .values(deployEvent)
          .onConflictDoUpdate({
            target: deployEvents.deployHash,
            set: {
              operation: deployEvent.operation,
              mandateId: deployEvent.mandateId,
              status: deployEvent.status,
              raw: deployEvent.raw,
              observedAt: deployEvent.observedAt,
            },
          });

        return updatedMandate;
      });

      return serializeJson(updated);
    },
  );

  app.post<{ Params: { account: string; id: string } }>(
    "/users/:account/mandates/:id/execute",
    async (request, reply) => {
      const input = executePaymentInputSchema.parse(request.body);
      const deployEvent = await buildDeployEvent({
        deployHash: input.deployHash,
        operation: "mandate.execute",
        account: request.params.account,
        intentId: input.intentId,
        mandateId: request.params.id,
      });
      const db = createDb();

      const result = await db.transaction(async (tx) => {
        const [mandate] = await tx
          .select()
          .from(mandates)
          .where(
            and(
              eq(mandates.id, request.params.id),
              eq(mandates.user, request.params.account),
            ),
          );

        if (!mandate) {
          throw new HttpError(404, "Mandate not found");
        }

        if (mandate.status !== "active") {
          throw new HttpError(409, "Mandate is not active");
        }

        if (mandate.agent !== input.agent) {
          throw new HttpError(403, "Agent is not authorized for this mandate");
        }

        if (mandate.target !== input.target) {
          throw new HttpError(409, "Target is outside mandate scope");
        }

        if (mandate.resourcePatternHash !== input.resourceHash) {
          throw new HttpError(409, "Resource hash is outside mandate scope");
        }

        if (input.currentBlock && input.currentBlock > mandate.expiryBlock) {
          throw new HttpError(409, "Mandate is expired");
        }

        const nextSpent = mandate.spent + input.amount;
        if (nextSpent > mandate.cap) {
          throw new HttpError(409, "Mandate cap exceeded");
        }

        const [balance] = await tx
          .select()
          .from(vaultBalances)
          .where(eq(vaultBalances.user, mandate.user));

        if (!balance || balance.reserved < input.amount || balance.total < input.amount) {
          throw new HttpError(409, "Insufficient reserved vault balance");
        }

        const mandateStatus = nextSpent === mandate.cap ? "exhausted" : "active";
        const [updatedMandate] = await tx
          .update(mandates)
          .set({
            spent: nextSpent,
            status: mandateStatus,
          })
          .where(eq(mandates.id, mandate.id))
          .returning();

        const [updatedVault] = await tx
          .update(vaultBalances)
          .set({
            total: balance.total - input.amount,
            reserved: balance.reserved - input.amount,
            updatedAt: new Date(),
          })
          .where(eq(vaultBalances.user, mandate.user))
          .returning();

        if (input.intentId) {
          await tx
            .update(intents)
            .set({ status: "executed" })
            .where(
              and(
                eq(intents.id, input.intentId),
                eq(intents.user, mandate.user),
              ),
            );
        }

        const receiptInput = {
          user: mandate.user,
          intentId: input.intentId ?? `manual-${mandate.id}`,
          mandateId: mandate.id,
          deployHash: input.deployHash,
          amount: input.amount,
          target: input.target,
          resourceHash: input.resourceHash,
          resultHash: input.resultHash,
        };
        const receipt = {
          id: id("receipt", receiptInput),
          intentId: receiptInput.intentId,
          mandateId: receiptInput.mandateId,
          deployHash: receiptInput.deployHash,
          amount: receiptInput.amount,
          target: receiptInput.target,
          resourceHash: receiptInput.resourceHash,
          resultHash: receiptInput.resultHash,
          createdAt: new Date(),
        };
        const [createdReceipt] = await tx
          .insert(receipts)
          .values(receipt)
          .onConflictDoUpdate({
            target: receipts.id,
            set: {
              deployHash: receipt.deployHash,
              resultHash: receipt.resultHash,
            },
          })
          .returning();

        await tx
          .insert(deployEvents)
          .values(deployEvent)
          .onConflictDoUpdate({
            target: deployEvents.deployHash,
            set: {
              operation: deployEvent.operation,
              intentId: deployEvent.intentId,
              mandateId: deployEvent.mandateId,
              status: deployEvent.status,
              raw: deployEvent.raw,
              observedAt: deployEvent.observedAt,
            },
          });

        return {
          status: "executed",
          mandate: updatedMandate,
          vault: updatedVault,
          receipt: createdReceipt,
        };
      });

      return reply.code(201).send(serializeJson(result));
    },
  );

  app.get<{ Params: { account: string } }>(
    "/users/:account/receipts",
    async (request) => {
      const db = createDb();
      const rows = await db
        .select({ receipt: receipts })
        .from(receipts)
        .innerJoin(mandates, eq(receipts.mandateId, mandates.id))
        .where(eq(mandates.user, request.params.account));
      return serializeJson(rows.map((row) => row.receipt));
    },
  );

  app.post("/receipts", async (request, reply) => {
    const input = indexedReceiptInputSchema.parse(request.body);
    const deployEvent = await buildDeployEvent({
      deployHash: input.deployHash,
      operation: "receipt.record",
      account: input.user,
      intentId: input.intentId,
      mandateId: input.mandateId,
    });
    const db = createDb();
    const receipt = {
      id: id("receipt", input),
      intentId: input.intentId,
      mandateId: input.mandateId,
      deployHash: input.deployHash,
      amount: input.amount,
      target: input.target,
      resourceHash: input.resourceHash,
      resultHash: input.resultHash,
      createdAt: new Date(),
    };
    const [created] = await db.transaction(async (tx) => {
      const [createdReceipt] = await tx.insert(receipts).values(receipt).returning();
      await tx
        .insert(deployEvents)
        .values(deployEvent)
        .onConflictDoUpdate({
          target: deployEvents.deployHash,
          set: {
            operation: deployEvent.operation,
            intentId: deployEvent.intentId,
            mandateId: deployEvent.mandateId,
            status: deployEvent.status,
            raw: deployEvent.raw,
            observedAt: deployEvent.observedAt,
          },
        });
      return [createdReceipt];
    });
    return reply.code(201).send(serializeJson(created));
  });

  app.get<{ Params: { account: string } }>(
    "/users/:account/vault",
    async (request) => {
      const db = createDb();
      const [balance] = await db
        .select()
        .from(vaultBalances)
        .where(eq(vaultBalances.user, request.params.account));

      return serializeJson(
        balance ?? {
          user: request.params.account,
          total: 0n,
          reserved: 0n,
          available: 0n,
          updatedAt: new Date(),
        },
      );
    },
  );

  app.post<{ Params: { account: string } }>(
    "/users/:account/vault/deposit",
    async (request, reply) => {
      const input = vaultOperationSchema.parse(request.body);
      const deployEvent = await buildDeployEvent({
        deployHash: input.deployHash,
        operation: "vault.deposit",
        account: request.params.account,
      });
      const now = new Date();
      const db = createDb();
      const [created] = await db.transaction(async (tx) => {
        const [updatedVault] = await tx
          .insert(vaultBalances)
          .values({
            user: request.params.account,
            total: input.amount,
            reserved: 0n,
            available: input.amount,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: vaultBalances.user,
            set: {
              total: sql`${vaultBalances.total} + ${input.amount}`,
              available: sql`${vaultBalances.available} + ${input.amount}`,
              updatedAt: now,
            },
          })
          .returning();
        await tx
          .insert(deployEvents)
          .values(deployEvent)
          .onConflictDoUpdate({
            target: deployEvents.deployHash,
            set: {
              operation: deployEvent.operation,
              status: deployEvent.status,
              raw: deployEvent.raw,
              observedAt: deployEvent.observedAt,
            },
          });
        return [updatedVault];
      });
      return reply.code(201).send(serializeJson(created));
    },
  );

  app.post<{ Params: { account: string } }>(
    "/users/:account/vault/withdraw",
    async (request, reply) => {
      const input = vaultOperationSchema.parse(request.body);
      const deployEvent = await buildDeployEvent({
        deployHash: input.deployHash,
        operation: "vault.withdraw",
        account: request.params.account,
      });
      const db = createDb();
      const updated = await db.transaction(async (tx) => {
        const [balance] = await tx
          .select()
          .from(vaultBalances)
          .where(eq(vaultBalances.user, request.params.account));

        if (!balance || balance.available < input.amount) {
          throw new HttpError(409, "Insufficient available vault balance");
        }

        const [updatedVault] = await tx
          .update(vaultBalances)
          .set({
            total: balance.total - input.amount,
            available: balance.available - input.amount,
            updatedAt: new Date(),
          })
          .where(eq(vaultBalances.user, request.params.account))
          .returning();
        await tx
          .insert(deployEvents)
          .values(deployEvent)
          .onConflictDoUpdate({
            target: deployEvents.deployHash,
            set: {
              operation: deployEvent.operation,
              status: deployEvent.status,
              raw: deployEvent.raw,
              observedAt: deployEvent.observedAt,
            },
          });
        return updatedVault;
      });

      return serializeJson(updated);
    },
  );

  app.post<{ Body: { asset: string } }>("/x402/rwa/report", async (request, reply) => {
    const resourceHash = createResourceHash(request.body.asset);
    return reply.code(402).send({
      status: "payment_required",
      accepts: [
        {
          scheme: "casper-testnet-mandate",
          network: "casper-test",
          amount: "2500000000",
          payTo: "account-hash-proxykey-rwa-service",
          resourceHash,
        },
      ],
    });
  });

  app.post<{ Body: { asset: string; proof: unknown } }>(
    "/x402/rwa/verify-payment",
    async (request) => {
      const proof = verifyPaymentProof(paymentProofSchema.parse(request.body.proof));
      return {
        status: "success",
        report: buildRwaReport(request.body.asset, proof),
      };
    },
  );

  return app;
}
