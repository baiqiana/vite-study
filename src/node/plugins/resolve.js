import resolve from "resolve";
import path from "path";
import { pathExists } from "fs-extra";
import { DEFAULT_EXTERSIONS } from "../constants";
import { cleanUrl, isImportRequest } from "../utils";
import { normalizePath } from "../utils.js";

export function resolvePlugin() {
  let serverContext;
  return {
    name: "m-vite:resolve",
    configureServer(s) {
      serverContext = s;
    },
    async resolveId(id, importer) {
      if (path.isAbsolute(id)) {
        if (await pathExists(id)) {
          return { id };
        }

        id = path.join(serverContext.root, id);
        let parseId = id;
        if (isImportRequest(id)) parseId = id.replace("?import", "");
        if (await pathExists(parseId)) {
          return { id };
        }
      } else if (id.startsWith(".")) {
        if (!importer) {
          throw new Error("`importer` should not be undefined");
        }
        const hasExtension = path.extname(id).length > 1;
        let resolveId;
        if (hasExtension) {
          resolveId = normalizePath(
            resolve.sync(id, { basedir: path.dirname(importer) })
          );
          if (await pathExists(resolveId)) {
            return { id: resolveId };
          }
        } else {
          for (const extname of DEFAULT_EXTERSIONS) {
            try {
              const withExtension = `${id}${extname}`;
              resolveId = normalizePath(
                resolve.sync(withExtension, {
                  basedir: path.dirname(importer),
                })
              );
              if (await pathExists(resolveId)) {
                return { id: resolveId };
              }
            } catch (error) {
              continue;
            }
          }
        }
      }
      return null;
    },
  };
}
