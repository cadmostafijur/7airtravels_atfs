import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ZKLib = require("node-zklib");

async function main() {
  const ip = process.env.K50A_IP || "192.168.0.201";
  const port = Number(process.env.K50A_PORT || 4370);
  const timeout = Number(process.env.K50A_TIMEOUT_MS || 60000);
  console.log({ ip, port, timeout });

  const zk = new ZKLib(ip, port, timeout, 4000);
  await zk.createSocket();
  console.log("connectionType", zk.connectionType);

  const info = await zk.getInfo();
  console.log("info", info);

  try {
    const users = await zk.getUsers();
    console.log("usersCount", users?.data?.length ?? users?.length);
    console.log("usersSample", (users?.data ?? users)?.slice?.(0, 3));
  } catch (e) {
    console.error("usersError", e);
  }

  try {
    const logs = await zk.getAttendances();
    const rows = logs?.data ?? logs;
    console.log("logsCount", Array.isArray(rows) ? rows.length : rows);
    console.log("logsSample", Array.isArray(rows) ? rows.slice(0, 5) : rows);
    console.log("logsErr", logs?.err ?? null);
  } catch (e) {
    console.error("logsError", e);
  }

  await zk.disconnect();
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
