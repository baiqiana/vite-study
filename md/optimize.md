# vite为什么要预构建
1. 某些第三方包不存在`ESM`规范的包，Vite是基于`ESM`的，所以需要把依赖包转为`ESM`
2. 某些包会发很多请求，例如`lodash`，可以通过打包的方式，打成一个包，防止大量的请求

代码分为源代码和第三方依赖的代码，只有第三方依赖的代码，也就是`bare import`会被预构建

# 自动开启预构建
当第一次启动项目时，Vite会自动预构建，输出`Pre-bundling`信息，同时在`node_modules`目录下，生成一个`.vite`目录，存放预构建产物   
浏览器访问页面后，请求路径会重定向到`.vite`目录下，同时如果以下条件不变，则会使用缓存文件
```
package.json的dependencies字段
包管理器的lock文件
optimizeDeps配置内容
```
# 手动开启预构建
## optimizeDeps.entries
自定义预构建的入口文件。
实际上`Vite`会默认抓取项目中所有的HTML文件，将`HTML文件`作为入口扫描第三方依赖，最后对这些依赖逐个编译    
当默认扫描`HTML`行为无法满足时，可以手动添加入口
``` javascript
{
    optimizeDeps: {
        entries: ["./src/main.vue"], // [**/*.vue]
    }
}
```

## include添加依赖
某些场景下，第三方依赖没有被扫描出来，可以手动进行预构建，防止二次预构建，会刷新页面
1. 动态import
``` javascript
{
    optimizeDeps: {
        include: [
            "object-assign"
        ]
    }
}
```

# 实现Vite依赖预构建
启动流程：     
项目根目录下运行`mini-vite`命令，在当前项目的`node_modules`目录查找`mini-vite`模块，然后执行它`package.json`中`bin`字段指向的文件   
此处是加载`mini-vite`的入口文件，通过`cli.parse`启动`cli`命令行工具，通过`process.argv`获取传入的命令，调用对应的命令。
```javascript
// 1. pnpm dev

// 2. mini-vite模块指定脚本文件
  "bin": {
    "mini-vite": "bin/mini-vite"
  }

// 3. 系统文件用node执行
#!/usr/bin/env node
require("../dist/index.js");

// 4. 执行cli命令，创建devServer
import cac from "cac";
import { startDevServer } from "../server/index.js";

const cli = cac();

cli
  .command("[root]", "Run the development server")
  .alias("serve")
  .alias("dev")
  .action(async () => {
    await startDevServer();
  });

cli.help();
cli.parse(); // 解析命令参数执行
```

## 2. 创建本地服务器
``` javascript
import connect from "connect";
import { blue, green } from "picocolors";
import { optimize } from "../node/optimizer/index";

export async function startDevServer() {
  const app = connect();
  const root = process.cwd();
  const startTime = Date.now();

  app.listen(3000, async () => {
    await optimize(root);
    console.log(
      green("🚀 No-Bundle 服务已经成功启动!"),
      `耗时：${Date.now() - startTime}ms`
    );
  });
}
```

## 开始预构建
通过`esbuild`的打包，扫描第三方依赖，如果是`bare import`，则打上标记，放到deps中，最后调用`esbuild.build`打包
``` javascript
import path from "path";
import { build } from "esbuild";
import { green } from "picocolors";
import { scanPlugin } from "./scanPlugin";
import { preBundlePlugin } from "./preBundlePlugin.js";
import { PRE_BUNDLE_DIR } from "../constants";

export async function optimize(root) {
  // 1. 确定入口
  const entry = path.resolve(root, "src/main.js");
  // 2. 从入口处扫描依赖
  const deps = new Set();
  await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    plugins: [scanPlugin(deps)],
  });
  console.log(
    `${green("需要预构建的依赖")} :\n${[...deps]
        .map(green)
        .map((item) => `${item}`)
        .join("\n")}`
  );
  // 3. 预构建依赖
  await build({
    entryPoints: [...deps],
    write: true,
    bundle: true,
    format: "esm",
    splitting: true,
    outdir: path.resolve(root, PRE_BUNDLE_DIR),
    plugins: [preBundlePlugin(deps)],
  });
}
```

## scanPlugin
`esbuild`无法处理的资源`external`掉，然后再`deps`中记录依赖
``` javascript
import { BARE_IMPORT_RE, EXTERNAL_TYPES } from "../constants";

export function scanPlugin(deps) {
  return {
    name: "esbuild:scan-deps",
    setup(build) {
      build.onResolve(
        {
          filter: new RegExp(`\\.(${EXTERNAL_TYPES.join("|")})$`),
        },
        (resolveInfo) => {
          return {
            path: resolveInfo.path,
            external: true,
          };
        }
      );

      build.onResolve({ filter: BARE_IMPORT_RE }, (resolveInfo) => {
        const { path: id } = resolveInfo;
        deps.add(id);
        return {
          path: id,
          external: true,
        };
      });
    },
  };
}
```

## preBundlePlugin
判断模块是否在`deps`数组中，即需要预构建的依赖，通过`export default require(modulePath)`方式创建一个文件，来加载`commonjs`依赖，再以`esmodule`的规范导出
``` javascript
import { Loader, Plugin } from "esbuild";
import { BARE_IMPORT_RE } from "../constants";
import { init, parse } from "es-module-lexer";
import path from "path";
import resolve from "resolve";
import fs from "fs-extra";
import createDebug from "debug";
import { red } from "picocolors";
import os from "os";

const debug = createDebug("dev");

export function slash(p) {
  return p.replace(/\\/g, "/");
}
export const isWindows = os.platform() === "win32";

 function normalizePath(id) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}

export function preBundlePlugin(deps) {
  return {
    name: "esbuild:pre-bundle",
    setup(build) {
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id, importer } = resolveInfo;
          const isEntry = !importer;
          if (deps.has(id)) {
            return isEntry
              ? {
                  path: id,
                  namespace: "dep",
                }
              : {
                  path: resolve.sync(id, { basedir: process.cwd() }),
                };
          }
        }
      );

      build.onLoad(
        {
          filter: /.*/,
          namespace: "dep",
        },
        async (loadInfo) => {
          await init;
          const id = loadInfo.path;
          const root = process.cwd();
          const entryPath = normalizePath(resolve.sync(id, { basedir: root }));
          const code = await fs.readFile(entryPath, "utf-8");
          const [imports, exports] = await parse(code);
          let proxyModule = [];

          if (!imports.length && !exports.length) {
            const res = require(entryPath);
            const specifiers = Object.keys(res);
            proxyModule.push(
              `export {${specifiers.join(",")}} from "${entryPath}"`,
              `export default require("${entryPath}")`
            );
          } else {
            if (exports.includes("default")) {
              proxyModule.push(
                `import d from "${entryPath}"; export default d"`
              );
            }
            proxyModule.push(`export * from "${entryPath}"`);
          }
          debug("代理模块内容：%o", proxyModule.join("\n"));
          const loader = path.extname(entryPath).slice(1);
          return {
            loader: loader,
            contents: proxyModule.join("\n"),
            resolveDir: root,
          };
        }
      );
    },
  };
}

```
