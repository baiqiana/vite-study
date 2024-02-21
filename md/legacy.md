# Vite能否兼容旧版本浏览器
能，通过插件`@vitejs/plugin-legacy`的`target`可以配置目标浏览器，底层通过`@babel/preset-env`编译

# 怎么兼容旧版本浏览器
主要分为两部分
1. 语法降级，例如`ES6`语法转为`ES5`语法，箭头函数，let、const，扩展运算符等
2. polyfill，即垫片，提供旧版本不支持的API，例如`Promise`,`Array.from`，`Array.of`等API的实现

`Vite`中也是借助前端编译工具链来兼容旧版本浏览器，`babel`相关以及`corejs`和`regenerator-runtime`(提供异步函数的实现，以及generator等)来支持

# babel转译
主要借助以下的包来实现
1. `@babel/core`，babel核心包，负责调用其它插件的API，完成转译工作并输出结果
2. `@babel/parser`，将源码转换成AST
3. `@babel/traverse`，遍历AST，通过注册对应AST节点的钩子函数，对AST进行增删改操作
4. `@babel/generator`，将AST转换成目标代码

其它：`@babel/cli`，通过命令行的方式转译文件

``` javascript
// .babelrc.json
{
    "target": {
        "ie": 11
    },
    "corejs": 3,
    "useBuiltIns": "usage",
    "modules": false
}

// 命令行
npx babel src --out-dir dist
```
当`useBuiltIns`值为`entry`时，需要在入口文件`import 'corejs'`，全量引入`polyfill`，不推荐
一般设置为`usage`，需要时才会引入`polyfill`

# @babel/plugin-transform-runtime
优势：
1. 避免重复引入，`babel`会重复定义`helper`函数，导致大量重复代码，`@babel/plugin-transform-runtime`会将这些重复的`helper`函数提取出来，在需要时再引入
2. 避免污染全局变量，假如重写了全局的Promise，那可能会对项目中其它代码造成影响，该插件会将polyfill从统一地方引入，隔离了全局对象


# @vitejs/plugin-legacy
``` javascript
import legacy from "@vitejs/plugin-legacy";
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        legacy({
            targets: ['ie >= 11']
        })
    ]
})
```
该操作会打包出`SystemJS`格式的`legacy`产物，插入`HTML`的`<sciprt nomodule />`中，旧版本浏览器会忽略`<script module />`标签，加载`legacy`产物

# 插件原理
1. 配置`output`，添加`legacy`相关配置，命名文件为`xxx-legacy.js`文件
2. 生成代码时，如果是`legacy`产物，则通过`@babel/preset-env`做语法转换，记录`polyfill`集合，方便后续提取 
3. 将`polyfill`打包到一个`Chunk`中
4. 把`legacy`产物注入到`HTML`文件中
