![image](https://github.com/baiqiana/vite-study/assets/56482105/6efc501b-1ef1-44fe-a272-97b7594209f4)# 为什么需要module federation
模块联邦，很好地解决了多应用模块复用的问题

复用代码其它方案的缺点
1. **npm包**    
发布NPM包是常见的复用模块的方法，将公用的代码封装到一个npm包
   1. 开发效率，每次都要重新发版，并且项目需要更新依赖
   2. 项目构建，公共库的代码需要打包到项目的最终产物中，导致体积变大

2. **git submodule**     
将公共代码封装到公共的Git仓库中，复用到不同的应用中
``` javascript
//添加子模块
git submodule add gitUrl
```
缺点与NPM包一致

3. **external + CDN引入**    
对于某些第三方依赖我们并不需要让其参与构建，而是使用公用的代码，对某些依赖声明external，并在`HTML`中加入依赖的CDN地址，通常需要UMD格式产物，来在不同的应用中使用
   1. 兼容性，不是所有的依赖都具有UMD格式产物
   2. 依赖顺序问题
   3. 产物体积，CDN是全量引用依赖的代码

4. **monorepo**   
   多个项目可以放到一个git中，各个互相依赖的子项目通过软链的方式进行调试
   1. 旧项目调整大，改造成本比较高
   2. 产物体积，跟npm一样，公共代码进入打包流程

# MF核心
模块联邦主要有两种模块：`本地模块`和`远程模块`，本地模块即为当前构建流程中的一部分，而远程模块不属于当前构建流程，**在本地模块运行时导入**，同时它们之间可以共享代码

![image](https://github.com/baiqiana/vite-study/assets/56482105/dcbd6f00-d613-4096-b1da-64412aa61592)


## MF的优势
1. 任意粒度的模块共享    
   1. 包括第三方npm依赖、业务组件、工具函数，甚至可以是整个前端应用，而整个前端应用能够共享产物，代表各个应用单独开发、测试、部署，也是`微前端`的一种实现
2. 产物体积    
   1. 远程模块在本地模块运行时拉取，不用参与本地模块的构建，加速构建过程，减小构建产物
3. 运行时按需加载   
   1. 通过`import()`动态加载，例如`import('remote_app/utils')`，只加载`utils`工具包，其它远程模块不会加载下来
4. 第三方依赖共享    
   1. 通过模块联邦中的共享依赖机制，很方便在模块间公用依赖，避免`external + CDN`的各种问题

## MF实战
`Vite`有一个比较成熟的模块联邦插件`@originjs/vite-plugin-federation`，基于`Rollup`实现完整的模块联邦能力

1. 初始化两个项目`host`和`remote`，分别安装`@originjs/vite-plugin-federation`
``` javascript
// 远程模块 remote/vite.config.js
import { defineConfig } from 'vite'
import vue from "@vitejs/plugin-vue"
import federtaion from "@originjs/vite-plugin-federation"

export default defineConfig({
    plugins: [
        vue(),
        federation({
            name: 'remote_app',
            filename: 'remoteEntry.js',
            exposes: {
                "./Button": "./src/components/Button.vue"
                "./App": "./src/App.vue",
                "./utils": "./src/utils.js"
            }

            shared: ['vue']
        })
    ],
    build: {
        target: "esnext"
    }
})
```

``` javascript
// 本地模块 host/vite.config.js
import { defineConfig } from 'vite'
import vue from "@vitejs/plugin-vue"
import federtaion from "@originjs/vite-plugin-federation"

export default defineConfig({
    plugins: [
        vue(),
        federation({
            remotes: {
                remote_app: "http://localhost:3001/assets/remoteEntry.js"
            },
            shared: ['vue']
        }
    ]
})
```

对远程模块进行打包
``` javascript
pnpm run build
// 运行
npx vite preview --port=3001 --strictPort

// 运行host项目
npm run dev
```
## 整体流程
1. 远程模块通过`exposes`到处已注册模块，本地通过`remotes`注册远程模块地址
2. 远程模块进行构建，并部署到云端
3. 本地通过`import '远程模块/xxx'`引入远程模块，实现运行时加载


## MF实现原理
实现模块联邦有三大主要因素
1. `Host`模块，即本地模块，用来消费远程模块
2. `Remote`模块，即远程模块，暴露`运行时容器`供本地模块消费
3. `shared`，共享依赖，用来在本地模块和远程模块共享第三方依赖

1. `import RemoteApp from "remote_app/App"`看看被编译成了什么
``` javascript
const __federation_var_remote_appApp = await __federation_method_getRemote(
  "remote_app",
  "./App"
);
let RemoteApp = __federation_method_unwrapDefault(
  __federation_var_remote_appApp
);
```
`__federation_method_getRemote`主要是调用了`__federation_method_ensure`，主要是加载远程模块入口文件
``` javascript
const remotesMap = {
  remote_app: {
    url: "http://localhost:3001/assets/remoteEntry.js",
    format: "esm",
    from: "vite",
  },
};

async function __federation_method_ensure(remoteId) {
  const remote = remotesMap[remoteId];
  if (!remote.inited) {
    if ("var" === remote.format) {
      ...
    } else if (["esm", "systemjs"].includes(remote.format)) {
      // loading js with import(...)
      return new Promise((resolve, reject) => {
        const getUrl =
          typeof remote.url === "function"
            ? remote.url
            : () => Promise.resolve(remote.url);
        getUrl().then((url) => {
          __vitePreload(
            () => import(/* @vite-ignore */ url),
            true ? __vite__mapDeps([]) : void 0
          )
            .then((lib) => {
              if (!remote.inited) {
                const shareScope = wrapShareModule(remote.from);
                lib.init(shareScope);
                remote.lib = lib;
                remote.lib.init(shareScope);
                remote.inited = true;
              }
              resolve(remote.lib);
            })
            .catch(reject);
        });
      });
    }
  } else {
    return remote.lib;
  }
}
```
获取到远程模块入口文件后，通过`remote.lib.init`注册`globalThis.__federation_shared__`，例如:
![image](https://github.com/baiqiana/vite-study/assets/56482105/583b3fba-78d3-4d4e-902b-139c985493ef)
本地模块和远程模块都有`remotesMap`，通过方法`getSharedFromRuntime || getSharedFromLocal`获取依赖
执行远程模块代码时，判断`globalThis.__federation_shared__`是否存在获取该版本依赖的方法，如果存在，就从运行时获取依赖，该依赖来自本地依赖，如果不存在，则通过远程模块的`getSharedFromLocal`获取远程依赖
