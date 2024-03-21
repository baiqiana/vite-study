import { isImportRequest, getShortName, normalizePath } from "../utils";

export function assetPlugin() {
  let serverContext;
  return {
    name: "m-vite:asset",
    configureServer(s) {
      serverContext = s;
    },
    async load(id) {
      const resolvedId = `/${getShortName(
        normalizePath(id),
        normalizePath(serverContext.root)
      )}`;
      if (isImportRequest(id)) {
        return {
          code: `export default "${resolvedId.replace('?import', '')}"`,
        };
      }
      return null;
    },
  };
}
