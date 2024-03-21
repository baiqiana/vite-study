import { esbuildTransformPlugin } from "./esbuild";
import { importAnalysisPlugin } from "./importAnalysis";
import { resolvePlugin } from "./resolve";
import { cssPlugin } from "./css";
import { assetPlugin } from "./asset";
import { clientInjectPlugin } from "./clientInject";

export function resolvePlugins() {
  return [
    clientInjectPlugin(),
    assetPlugin(),
    resolvePlugin(),
    esbuildTransformPlugin(),
    cssPlugin(),
    importAnalysisPlugin(),
  ];
}
