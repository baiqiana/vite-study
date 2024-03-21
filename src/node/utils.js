import path from "path";
import {
  JS_TYPES_RE,
  HASH_RE,
  QEURY_RE,
  CLIENT_PUBLIC_PATH,
} from "./constants";

import os from "os";

export function slash(p) {
  return p.replace(/\\/g, "/");
}
export const isWindows = os.platform() === "win32";

export function normalizePath(id) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}

export const isJSRequest = (id) => {
  id = cleanUrl(id);
  if (JS_TYPES_RE.test(id)) {
    return true;
  }
  if (!path.extname(id) && !id.endsWith("/")) {
    return true;
  }
  return false;
};

export function getShortName(file, root) {
  return file.startsWith(root + "/") ? path.posix.relative(root, file) : file;
}

export const cleanUrl = (url) => url.replace(HASH_RE, "").replace(QEURY_RE, "");
export const isCssRequest = (id) => id.indexOf(".css") > -1;
export const isImportRequest = (id) => id.endsWith("?import");
const INTERNAL_LIST = [CLIENT_PUBLIC_PATH, "/@react-refresh"];
export function isInternalRequest(url) {
  return INTERNAL_LIST.includes(url);
}
