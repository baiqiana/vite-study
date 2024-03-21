import { blue, green } from "picocolors";
import { getShortName, normalizePath } from "./utils";
import path from "path";

export function bindingHMREvents(serverContext) {
  const { watcher, ws, root } = serverContext;
  watcher.on("change", async (file) => {
    console.log(`✨${blue("[hmr]")} ${green(file)} changed`);
    // let type = path.extname(file).slice(1) + "-update";
    const { moduleGraph } = serverContext;
    await moduleGraph.invalidateModule(file);
    ws.send({
      type: "update",
      updates: [
        {
          type: "js-update",
          timestamp: Date.now(),
          path: "/" + getShortName(normalizePath(file), normalizePath(root)),
          acceptedPath:
            "/" + getShortName(normalizePath(file), normalizePath(root)),
        },
      ],
    });
  });
}
