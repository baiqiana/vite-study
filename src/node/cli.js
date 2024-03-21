import cac from "cac";
import { startDevServer } from "./server/index.js";

const cli = cac();

cli
  .command("[root]", "Run the development server")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    await startDevServer();
  });

cli.help();
cli.parse();
