import { McpServer } from "@modelcontextprotocol/server";
import {
  checkMandate,
  executeAuthorizedPayment,
  explainPendingApproval,
  fetchRwaReport,
  registerAgent,
  recordReceipt,
  requestMandate,
  schemas,
  stageIntent,
} from "./tools";

function asText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2),
      },
    ],
  };
}

export function buildMcpServer() {
  const server = new McpServer({ name: "proxykey-agent", version: "0.1.0" });

  server.registerTool(
    "register_agent",
    {
      description: "Register an AI agent identity for ProxyKey Casper mandates.",
      inputSchema: schemas.registerAgent,
    },
    async (input) => asText(await registerAgent(input)),
  );

  server.registerTool(
    "stage_intent",
    {
      description: "Stage a Casper mandate intent for user approval.",
      inputSchema: schemas.stageIntent,
    },
    async (input) => asText(await stageIntent(input)),
  );

  server.registerTool(
    "request_mandate",
    {
      description: "Request a one-time or delegated user mandate.",
      inputSchema: schemas.requestMandate,
    },
    async (input) => asText(await requestMandate(input)),
  );

  server.registerTool(
    "check_mandate",
    {
      description: "Check the status of a mandate before agent execution.",
      inputSchema: schemas.checkMandate,
    },
    async (input) => asText(await checkMandate(input)),
  );

  server.registerTool(
    "execute_authorized_payment",
    {
      description: "Prepare execution for a payment authorized by a user mandate.",
      inputSchema: schemas.executeAuthorizedPayment,
    },
    async (input) => asText(await executeAuthorizedPayment(input)),
  );

  server.registerTool(
    "fetch_rwa_report",
    {
      description: "Fetch x402 payment requirements for a protected RWA risk report.",
      inputSchema: schemas.fetchRwaReport,
    },
    async (input) => asText(await fetchRwaReport(input)),
  );

  server.registerTool(
    "record_receipt",
    {
      description: "Index an on-chain ProxyKey receipt after authorized Casper execution.",
      inputSchema: schemas.recordReceipt,
    },
    async (input: unknown) => asText(await recordReceipt(input)),
  );

  server.registerTool(
    "explain_pending_approval",
    {
      description: "Explain a pending ProxyKey approval in user-readable terms.",
      inputSchema: schemas.explainPendingApproval,
    },
    async (input) => asText(explainPendingApproval(input)),
  );

  return server;
}
