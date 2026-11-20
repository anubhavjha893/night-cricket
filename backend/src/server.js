import { env } from "./config/env.js";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDatabase, initializeDatabase } from "./config/database.js";

const app = createApp({ env });
await connectDatabase(env);
await initializeDatabase(env);
const port = Number(env.PORT || 4000);
const server = app.listen(port, () =>
  console.log(`UGM Cricket server ready on http://localhost:${port}`),
);

function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
