import { App } from "./App";

const port = process.env.PORT || "8080";

async function main() {
  const app = new App(port);
  await app.listen();
  await app.initWorker();
  await app.initSignal();
}

main().catch((err) => {
  console.error("Fatal server error:", err);
});
