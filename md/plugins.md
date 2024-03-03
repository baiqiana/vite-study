# Vite插件
vite启动开发服务器前，调用`resolvePlugins`收集所有的插件并排序，通过服务器中间件例如`transformMiddleware``transformIndexHtmlMiddleware`等处理请求，再通过`pluginContainer`容器调用所有插件对应的钩子
通过生成`pluginContext`上下文对象，提供`pluginContainer`例如`resolveId``transform`方法，能执行所有插件对应的钩子，例如`./App`，在`importAnalysis`插件加上后缀变为`./App.tsx`后，调用`pluginContext.resolveId`   
可以获取完整的路径，补全路径，真正请求进来时再走`tsx`文件的编译流程

以下是vite插件的简易实现
## 开发服务器处理插件
``` javascript
  const plugins = resolvePlugins(); // 获取所有插件
  const pluginContainer = createPluginContainer(plugins); // 生成pluginContainer

  // 提供开发服务器上下文
  const serverContext = {
    root: process.cwd(),
    app,
    pluginContainer,
    plugins,
  };

  // 插件注入serverContext
  for (const plugin of plugins) {
    if (plugin.configureServer) {
      await plugin.configureServer(serverContext);
    }
  }
  // 服务器注册中间件，处理请求，调用插件钩子
  app.use(transformMiddleware(serverContext));
  app.use(indexHtmlMiddware(serverContext));

```

## js文件处理
``` javascript
export async function transformRequest(url, serverContext) {
  const { pluginContainer } = serverContext;
  url = cleanUrl(url);
  // 遍历所有插件的resolveId钩子，按顺序执行
  const resolvedResult = await pluginContainer.resolveId(url);
  let transformResult;
  if (resolvedResult?.id) {
    // 遍历所有插件的load钩子，按顺序执行
    let code = await pluginContainer.load(resolvedResult.id);
    if (typeof code === "object" && code != null) {
      code = code.code;
    }
    if (code) {
      // 遍历所有插件的transform钩子，按顺序执行
      transformResult = await pluginContainer.transform(
        code,
        resolvedResult?.id
      );
    }
  }
  return transformResult;
}

```

## 入口index.html处理
``` javascript
export function indexHtmlMiddware(serverContext) {
  return async (req, res, next) => {
    if (req.url === "/") {
      const { root } = serverContext;
      const indexHtmlPath = path.join(root, "index.html");
      if (await pathExists(indexHtmlPath)) {
        // 读取index.html文件
        const rawHtml = await readFile(indexHtmlPath, "utf-8");
        let html = rawHtml;
        for (const plugin of serverContext.plugins) {
          if (plugin.transformIndexHtml) {
            html = await plugin.transformIndexHtml(html);
          }
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        return res.end(html);
      }
    }
    return next();
  };
}
```

## resolvePlugins实现
`resolvePlugins`方法主要是收集所有的插件并排序，最终返回一个数组
``` javascript
import { esbuildTransformPlugin } from "./esbuild";
import { importAnalysisPlugin } from "./importAnalysis";
import { resolvePlugin } from "./resolve";

export function resolvePlugins() {
  return [resolvePlugin(), esbuildTransformPlugin(), importAnalysisPlugin()];
}
```

## resolvePlugin实现
``` javascript
import resolve from "resolve";
import path from "path";
import { pathExists } from "fs-extra";
import { DEFAULT_EXTERSIONS } from "../constants";
import { cleanUrl } from "../utils";
import { normalizePath } from "../utils.js";


export function resolvePlugin() {
  let serverContext;
  return {
    name: "m-vite:resolve",
    configureServer(s) {
      serverContext = s;
    },
    // 处理依赖路径
    async resolveId(id, importer) {
      if (path.isAbsolute(id)) {
        if (await pathExists(id)) {
          return { id };
        }

        id = path.join(serverContext.root, id);
        if (await pathExists(id)) {
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
          // 依赖自动加上后缀，并补全路径
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

``` 
## importAnalysis实现
主要是分析页面依赖，并把路径处理成正确的路径，以及后续的构建依赖图
``` javascript
import { init, parse } from "es-module-lexer";
import {
  BARE_IMPORT_RE,
  DEFAULT_EXTERSIONS,
  PRE_BUNDLE_DIR,
} from "../constants";

import { cleanUrl, isJSRequest } from "../utils.js";

import MagicString from "magic-string";
import path from "path";
import { pathExists } from "fs-extra";
import resolve from "resolve";
import { normalizePath } from "../utils.js";

function getShortName(file, root) {
  return file.startsWith(root + "/") ? path.posix.relative(root, file) : file;
}

export function importAnalysisPlugin() {
  let serverContext;
  return {
    name: "m-vite:import-analysis",
    configureServer(s) {
      serverContext = s;
    },
    async transform(code, id) {
      if (!isJSRequest(id)) {
        return null;
      }

      await init;

      const [imports] = parse(code);
      const ms = new MagicString(code);
      for (const importInfo of imports) {
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) continue;

        if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = normalizePath(
            path.join("/", PRE_BUNDLE_DIR, `${modSource}.js`)
          );
          ms.overwrite(modStart, modEnd, bundlePath);
        } else if (modSource.startsWith(".") || modSource.startsWith("/")) {
          const resolved = await this.resolve(modSource, id);
          let resolvedId = `/${getShortName(
            normalizePath(resolved.id),
            normalizePath(serverContext.root)
          )}`;
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolvedId);
          }
        }
      }
      return {
        code: ms.toString(),
        map: ms.generateMap(),
      };
    },
  };
}
```

# cac构建cli
通过`process.env.args`获取命令行参数，`[root]`表示默认，该文件意义在于用户输入`mini-vite`，则执行`startDevServer`
1. cli开发
``` javascript
import cac from "cac";
import { startDevServer } from "./server/index.js";

const cli = cac();

cli
  .command("[root]", "Run the development server")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    await startDevServer();
  });

cli.help();
cli.parse();
```
2. 通过`package.json`的`bin`字段，指向系统可执行文件
``` javascript
{
// package.json
  "bin": {
    "mini-vite": "bin/mini-vite"
  },
}
```
3. 在`bin`目录下新建`mini-vite`文件
``` javascript
#!/usr/bin/env node
require("../dist/index.js");
```
4. cli文件打包
5. 项目中在`devDependencies`中添加`mini-vite: mini-vite目录`，会自动根据`package.json.bin`查找可执行文件，相当于启动`cli`，启动开发服务器

# rollup插件常用钩子
![image](https://github.com/baiqiana/vite-study/assets/56482105/4a606b0f-b098-4f75-bc5d-571d303db9ad)

# vite插件钩子执行顺序
![image](https://github.com/baiqiana/vite-study/assets/56482105/49e86b94-c234-4336-ab1c-f13e9550f0f8)
