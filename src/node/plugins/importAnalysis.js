import { init, parse } from "es-module-lexer";
import {
  BARE_IMPORT_RE,
  CLIENT_PUBLIC_PATH,
  DEFAULT_EXTERSIONS,
  PRE_BUNDLE_DIR,
} from "../constants";
import {
  cleanUrl,
  isJSRequest,
  getShortName,
  normalizePath,
  isInternalRequest,
} from "../utils.js";
import MagicString from "magic-string";
import resolve from "resolve";
import { pathExists } from "fs-extra";
import path from "path";
export function importAnalysisPlugin() {
  let serverContext;
  return {
    name: "m-vite:import-analysis",
    configureServer(s) {
      serverContext = s;
    },
    async transform(code, id) {
      if (!isJSRequest(id) || isInternalRequest(id)) {
        return null;
      }

      await init;

      const [imports] = parse(code);
      const ms = new MagicString(code);
      const importedModules = new Set();

      const resolve = async (id, importer) => {
        const resolved = await this.resolve(id, importer);
        if (!resolved) {
          return;
        }
        const cleanedId = cleanUrl(resolved.id);
        const mod = moduleGraph.getModuleById(cleanedId);
        let resolvedId = `${getShortName(resolved.id, serverContext.root)}`;
        if (mod && mod.lastHMRTimestamp > 0) {
          resolvedId += "?t=" + mod.lastHMRTimestamp;
        }
        return resolvedId;
      };

      const { moduleGraph } = serverContext;
      const curMod = moduleGraph.getModuleById(id);

      for (const importInfo of imports) {
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) continue;
        if (modSource.endsWith(".svg")) {
          const resolveUrl = `/${getShortName(
            normalizePath(path.join(path.dirname(id), modSource)),
            normalizePath(serverContext.root)
          )}`;
          ms.overwrite(modStart, modEnd, `${resolveUrl}?import`);
        } else if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = normalizePath(
            path.join("/", PRE_BUNDLE_DIR, `${modSource}.js`)
          );
          ms.overwrite(modStart, modEnd, bundlePath);
          importedModules.add(bundlePath);
        } else if (modSource.startsWith(".") || modSource.startsWith("/")) {
          const resolved = await resolve(modSource, id);
          let resolvedId = `/${getShortName(
            normalizePath(resolved.id || resolved),
            normalizePath(serverContext.root)
          )}`;
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolvedId);
            importedModules.add(resolvedId);
          }
        }
      }
      if (!id.includes("node_modules")) {
        ms.prepend(
          `import { createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}";` +
            `import.meta.hot = __vite__createHotContext(${JSON.stringify(
              cleanUrl(curMod.url)
            )});`
        );
      }
      moduleGraph.updateModuleInfo(curMod, importedModules);
      return {
        code: ms.toString(),
        map: ms.generateMap(),
      };
    },
  };
}
