import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 4000);
await buildServer().listen({ port, host: "0.0.0.0" });
