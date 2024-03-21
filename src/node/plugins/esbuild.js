import { readFile } from "fs-extra";
import { isJSRequest } from "../utils";
import esbuild from "esbuild";
import path from "path";

export function esbuildTransformPlugin() {
  return {
    name: "m-vite:esbuild-transform",
    async load(id) {
      if (isJSRequest(id)) {
        try {
          const code = await readFile(id, "utf-8");
          return code
        } catch (e) {
          return null;
        }
      }
    },
    async transform(code, id) {
      if (isJSRequest(id)) {
        const extname = path.extname(id).slice(1);
        const { code: transofromedCode, map } = await esbuild.transform(code, {
          target: "esnext",
          format: "esm",
          sourcemap: true,
          loader: extname,
        });
        return {
          code: transofromedCode,
          map,
        };
      }
      return null;
    },
  };
}
