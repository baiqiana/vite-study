import { NextHandleFunction } from "connect";
import {
  isJSRequest,
  cleanUrl,
  isCssRequest,
  isImportRequest,
} from "../../utils";
import createDebug from "debug";

const debug = createDebug("dev");

export async function transformRequest(url, serverContext) {
  const { pluginContainer, moduleGraph } = serverContext;
  if (!isImportRequest(url)) url = cleanUrl(url);
  let mod = await moduleGraph.getModuleByUrl(url);
  if (mod && mod.transformResult) {
    return mod.transformResult;
  }
  const resolvedResult = await pluginContainer.resolveId(url);
  let transformResult;
  if (resolvedResult?.id) {
    let code = await pluginContainer.load(resolvedResult.id);
    if (typeof code === "object" && code != null) {
      code = code.code;
    }
    const { moduleGraph } = serverContext;
    mod = await moduleGraph.ensureEntryFromUrl(url);
    if (code) {
      transformResult = await pluginContainer.transform(
        code,
        resolvedResult?.id
      );
    }
  }
  if (mod) {
    mod.transformResult = transformResult;
  }
  return transformResult;
}

export function transformMiddleware(serverContext) {
  return async (req, res, next) => {
    if (req.method !== "GET" || !req.url) {
      return next();
    }
    const url = req.url;
    debug("transformMiddleware: %s", url);
    if (isJSRequest(url) || isCssRequest(url) || isImportRequest(url)) {
      let result = await transformRequest(url, serverContext);
      if (!result) {
        return next();
      }
      if (result && typeof result !== "string") {
        result = result.code;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript");
      return res.end(result);
    }
    next();
  };
}
