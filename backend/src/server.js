import { env } from "./config/env.js";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDatabase, initializeDatabase } from "./config/database.js";
import { configureHttpServer, installShutdown } from "./config/http-server.js";

const app = createApp({ env });
await connectDatabase(env);
await initializeDatabase(env);
const port = Number(env.PORT || 4000);
const server = app.listen(port, () =>
  console.log(`UGM Cricket server ready on http://localhost:${port}`),
);

configureHttpServer(server);
const shutdown = installShutdown(server, app, () => mongoose.disconnect());
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
