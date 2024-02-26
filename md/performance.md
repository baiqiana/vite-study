# Vite的性能优化
开发环境：注重项目构建性能
生产环境：注重运行时性能

常见的优化手段：
1. 网络优化，例如**HTTP2**、**dns-prefetch\preconnect**、**Preload、modulePreload**、prefetch、modulePrefetch
2. 资源优化，例如**构建产物分析**，**资源压缩**、**产物拆包**、**按需加载**等方式
3. 预渲染优化，例如`SSR`和`SSG`

## 网络优化
1. 开启HTTP2   
HTTP2优势：
   1.  二进制帧，将请求和响应分为多个二进制帧，由帧头和数据帧组成，带有流标识符，可以压缩头部信息，支持多路复用等
   2.  多路复用，通过流的概念，在一个TCP上同时进行多个请求和响应，接收方通过流的标识来组装请求或响应  
   3.  头部压缩，通过**HAPCK算法**，
       1.  使用**静态表**和**动态表**来记录头部字段和值，用较小的索引来代替完整的头部字段，减少传输字节数
       2.  使用**哈夫曼编码**，根据字符出现的频率来分配不同长度的二进制码，频率高使用短的码
   4. 服务器推送，缺点客户端已经缓存或者不需要该资源还是被推送过来，没什么用

2. DNS预解析
`dns-prefetach`页面加载之前解析其它域名对应的IP地址，减少DNS查询的时间。
`preconnect`提前建立TCP连接和TLS协商时间。（可能会抢占重要资源的TCP连接）
``` html
<link rel="dns-prefetch" href="//example.com" >
<link rel="preconnect" href="//example.com" crossorigin>
```
跟服务器推送一样的问题，IP地址页面不需要或者已经被DNS服务器缓存


3. preload和prefetch
对于重要的资源，我们使用`preload`来加载预先加载资源 
``` html
<link rel="preload" href="style.css" as="style">
<link rel="preload" href="main.js" as="script">
```

对于`ESModule`，我们可以使用`modulePreload`，与`preload`的区别   
1. `modulePreload`只能对`ES`模块使用，`preload`可以加载任意资源
2. `modulePreload`会解析模块和**加载依赖**，`preload`只会加载该资源
3. `modulePreload`存在模块缓存中，`preload`存在HTTP缓存中

``` html
<link rel="modulepreload" href="a.js">
```
只有70%左右的浏览器兼容，可以通过开启`Vite`的配置来注入`Polyfill`
``` javascript
export default {
    build: {
        polyfillModulePreload: true
    }
}
```
`prefetch`则是浏览器空闲时候去加载资源，需要确保资源用户大概率用上，否则会浪费资源。


## 资源优化
1. 产物报告分析
通过插件`rollup-plugin-visualizer`进行产物分析
``` JavaScript
import { visualizer } from "rollup-plugin-visualizer"

export default {
    plugins: [visualizer({
        open: true
    })]
}
```


2. 资源压缩
可以处理的几样资源，`JavaScript代码`、`CSS代码`和`图片`

``` JavaScript
export default {
    build: {
        // boolean | esbuild | terser
        minify: 'esbuild'
        // 产物目标环境
        target: 'modules'
        // minify: terser时可用
        terserOptions: {
        }
    }
}
```
`target`默认是`modules`，某些语法会转换为高级语法，导致低版本浏览器报错，建议设置为`target: 'es6'`


3. 图片压缩
`vite-plugin-imagemin`

4. 产物拆包
通过`manualChunks`对象或函数的形式拆包，注意循环依赖

5. 按需加载
通过异步路由或者动态加载的方式，把异步包打成单独的`chunk`


## 预渲染优化
即通过`SSR`或者`SSG`，提高首屏渲染速度
