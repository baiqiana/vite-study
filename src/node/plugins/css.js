import { readFile } from "fs-extra";
import { isCssRequest, getShortName, normalizePath } from "../utils";
import { CLIENT_PUBLIC_PATH } from "../constants";
export function cssPlugin() {
  let serverContext;
  return {
    name: "m-vite:css",
    configureServer(server) {
      serverContext = server;
    },
    load(id) {
      if (isCssRequest(id)) {
        return readFile(id, "utf-8");
      }
    },

    async transform(code, id) {
        console.log("css content ---- ", id);
        if (isCssRequest(id)) {
        const jsContent = `
        import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";
        import.meta.hot = __vite__createHotContext("/${getShortName(
          normalizePath(id),
          normalizePath(serverContext.root)
        )}");
        import { updateStyle, remoteStyle } from "${CLIENT_PUBLIC_PATH}"

        const id = "${
          "/" +
          getShortName(normalizePath(id), normalizePath(serverContext.root))
        }";
        const css = '${code.replace(/\n/g, "")}';
        updateStyle(id, css);
        import.meta.hot.accept();
        export default css;
        import.meta.hot.prune(() => removeStyle(id));`.trim();
        return {
          code: jsContent,
        };
      }
      return null;
    },
  };
}
