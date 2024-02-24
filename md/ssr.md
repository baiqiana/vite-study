# 为什么需要SSR
以前是通过`JSP`形式开发，是天然的服务端渲染，服务器返回带有数据的页面，此后随着前端的发展，模块化，语法转换等，前后端分离，此时前端是CSR模式，即客户端渲染，但此时页面内只有空的`app`标签，需要执行`JS`脚本，经过框架初始化，数据拉取等操作后，页面才有内容

1. 首屏加载慢，即要等一系列操作之后，用户才能看到内容
2. SEO不友好，初始页面是空白的

`SSR`只能生成页面的结构和内容，交互是无法添加的，所以需要在`客户端`进行`hydrate`注水，同步服务端数据和注册事件等，让页面具有交互的能力。

# Vite构建SSR基本应用
`Vite`构建`SSR`分为两块，`构建时`和`运行时`

1. 构建时
   1. 移除`CSS`代码，服务端无法识别`CSS`代码，`CSS Module`除外
   2. 通过`node_modules`读取依赖
2. 运行时
   1. 加载入口模块
   2. 数据拉取
   3. 渲染组件
   4. HTML拼接

## SSR构建API
1. `vite.ssrLoadModule`通过`no-bundle`模式加载模块
2. 打包时，服务端入口文件打包出`commonjs`文件运行在服务端
``` javascript
{
    "build:server": 'vite build --ssr 服务端入口文件'
}
```

## 项目搭建
先通过`create-vite`初始化一个项目
1. 客户端入口文件
``` javascript
import React from "react";
import ReactDom from "react-dom";
import "./index.css";
import App from "./App";

// @ts-ignore
const data = window.__SSR_DATA__;

ReactDom.hydrate(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
```
2. 服务端入口文件
``` javascript
import App from "./App";
import "./index.css";

function ServerEntry(props: any) {
  return <App />;
}

async function fetchData() {
  return { user: "ababa" };
}

export { ServerEntry, fetchData };

```

## SSR运行时逻辑
主要就是4步
   1. 加载入口模块
   2. 数据拉取
   3. 渲染组件
   4. HTML拼接
``` javascript
import express, { RequestHandler, Express } from "express";
import { ViteDevServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import { renderToString } from "react-dom/server";
import React from "react";

const isProd = process.env.NODE_ENV === "production";

async function loadSsrEntryModule(vite: ViteDevServer | null) {
  if (isProd) {
    const entryPath = path.join(process.cwd(), "dist/server/entry-server.js");
    return require(entryPath);
  } else {
    const entryPath = path.join(process.cwd(), "src/entry-server.tsx");
    return vite!.ssrLoadModule(entryPath);
  }
}

function resolveTemplatePath() {
  return isProd
    ? path.join(process.cwd(), "dist/client/index.html")
    : path.join(process.cwd(), "index.html");
}

async function createSsrMiddleware(app: Express): Promise<RequestHandler> {
  let vite: ViteDevServer | null = null;

  if (!isProd) {
    // vite-dev-server
    vite = await (
      await import("vite")
    ).createServer({
      root: process.cwd(),
      server: {
        middlewareMode: true,
      },
      appType: "custom",
    });

    // 注册 Vite Middlewares
    // 处理客户端资源
    app.use(vite.middlewares);
  }
  return async (req, res, next) => {
    try {
      console.log("url111");
      const url = req.originalUrl;

      if (url !== "/") return await next();
      // 1. 加载服务端入口文件
      const { ServerEntry, fetchData } = await loadSsrEntryModule(vite);
      // 2. 数据拉取
      const data = await fetchData();
      // 3. [核心]渲染组件
      const appHtml = renderToString(
        React.createElement(ServerEntry, { data })
      );
      // 4. 拼接HTML，返回响应
      const templatePath = resolveTemplatePath();
      let template = await fs.readFileSync(templatePath, "utf-8");
      if (!isProd && vite) {
        // 注入HMR、环境变量等
        template = await vite.transformIndexHtml(url, template);
      }

      const html = template
        .replace("<!-- SSR_APP -->", appHtml)
        .replace(
          "<!-- SSR_DATA -->",
          `<script> window.__SSR_DATA__=${JSON.stringify(
            Object.assign(data)
          )}</script>`
        );
      res.status(200).setHeader("Content-Type", "text/html").end(html);
    } catch (error) {
      console.log("error --------- ", error);
    }
  };
}

async function createServer() {
  const app = express();

  app.use(await createSsrMiddleware(app));

  app.listen(4173, () => {
    console.log("node 服务器已启动 http://localhost:3000");
  });
}

createServer();
```
