import { CLIENT_PUBLIC_PATH, HMR_PORT } from "../constants";
import fs from "fs-extra";
import path from "path";

export function clientInjectPlugin() {
  let serverContext;
  return {
    name: "m-vite:client-inject",
    configureServer(s) {
      serverContext = s;
    },
    resolveId(id) {
      if (id === CLIENT_PUBLIC_PATH) {
        return { id };
      }
      return null;
    },
    async load(id) {
      if (id === CLIENT_PUBLIC_PATH) {
        const realPath = path.join(
          serverContext.root,
          "node_modules",
          "mini-vite",
          "dist",
          "client.mjs"
        );
        const code = await fs.readFile(realPath, "utf-8");
        return {
          code: code.replace("__HMR_PORT__", JSON.stringify(HMR_PORT)),
        };
      }
    },

    transformIndexHtml(raw) {
      return raw.replace(
        "<head>",
        `<head><script type="module" src="${CLIENT_PUBLIC_PATH}"></script>`
      );
    },
  };
}
