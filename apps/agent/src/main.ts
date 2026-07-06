import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { buildMcpServer } from "./server.js";

const server = buildMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
