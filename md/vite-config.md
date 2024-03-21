# Vite的配置解析
## 1. 查找配置文件
首先查找配置文件`vite.config.js`或者`vite.config.ts`等等，如果`package.json`中`type="module"`，则打上`isESM``isTs`等标记   
如果是`ESM`的配置文件，通过`esBuild`打包配置文件，在写入一个临时文件，在读取出来，最后删掉临时文件


## 2. 解析用户插件
通过`apply`插件参数过滤插件，调用插件的`config`钩子，最终合并配置   
解析`root`参数，默认取`process.pwd()`  
处理`alias`   
## 3. 加载环境变量
1. 遍历`process.env`，寻找以`VITE_`（默认）开头的属性，挂载到`env`对象中
2. 遍历`.env`文件，寻找以特定前缀开头的属性，如果有`NODE_ENV`属性，则会挂载到`process.env.VITE_USER_NODE_ENV`上，优先级高，判断是开发环境还是生产环境
   1. .env.mode.local
   2. .env.mode
   3. .env.local
   4. .env
3. 处理`base URL`
4. 处理`cacheDir`，一般在`.git`目录下
5. 处理`assetsInclude`，什么后缀的资源是静态资源，不会作为模块导入
``` javascript
export default {
  assetsInclude(file) {
      return /\.(pdf)$/.test(file)
  }
}
``` 
