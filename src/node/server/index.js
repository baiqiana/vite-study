import connect from "connect";
import { blue, green } from "picocolors";
import { optimize } from "../optimizer/index";
import { resolvePlugins } from "../plugins";
import { createPluginContainer } from "../pluginContainer";
import { indexHtmlMiddware } from "./middlewares/indexHtml";
import { transformMiddleware } from "./middlewares/transform";
import { staticMiddleware } from "./middlewares/static";
import { ModuleGraph } from "../ModuleGraph";
import { createWebSocketServer } from "../ws";
import chokidar, { FSWatcher } from "chokidar";
import { bindingHMREvents } from "../hmr";
export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();

  const watcher = chokidar.watch(root, {
    ignored: ["**/node_modules/**", "**/.git/**"],
    ignoreInitial: true,
  });

  const ws = createWebSocketServer(app);

  const moduleGraph = new ModuleGraph((url) => pluginContainer.resolveId(url));
  const plugins = resolvePlugins();
  const pluginContainer = createPluginContainer(plugins);

  const serverContext = {
    root: process.cwd(),
    app,
    pluginContainer,
    plugins,
    moduleGraph,
    ws,
    watcher,
  };
  bindingHMREvents(serverContext);

  for (const plugin of plugins) {
    if (plugin.configureServer) {
      await plugin.configureServer(serverContext);
    }
  }

  app.use(transformMiddleware(serverContext));
  app.use(indexHtmlMiddware(serverContext));
  app.use(staticMiddleware(serverContext));

  app.listen(3001, async () => {
    try {
      await optimize(root);
      console.log(
        green("🚀 No-Bundle 服务已经成功启动!"),
        `耗时：${Date.now() - startTime}ms`
      );
    } catch (error) {
      console.log("error ------- ", error);
    }
  });
}
