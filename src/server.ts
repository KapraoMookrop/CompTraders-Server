import http from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import pool from "./config/database.js";
import { initSocket } from "./socket.js";

async function start() {
  await pool.connect();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(ENV.PORT, () => {
    console.log(`Server running on port ${ENV.PORT}`);
  });

  app.use((err: any, req: any, res: any, next: any) => {
    res.status(err.status || 500).json({
      status: "error",
      message: err.message || "Internal Server Error"
    });
  });
}

await start();