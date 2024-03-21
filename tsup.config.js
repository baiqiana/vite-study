import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/node/cli.js",
    client: "src/client/client.js",
  },
  format: ["esm", "cjs"],
  target: "es2020",
  sourcemap: true,
  splitting: false,
  external: ["esbuild"],
  minify: false,
});
