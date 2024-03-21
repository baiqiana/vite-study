# 热更新实现

# 构建模块依赖图
为什么需要模块依赖图？

## 1. 初始化依赖图实例
当输入命令`vite run dev`时，命令会开启本地服务器，函数首先会创建模块依赖图，传入`pluginContainer`，主要有以下属性
1. `modules`，包含所有已解析模块的信息
2. `urlToModuleMap`，通过原始url关联对应模块对象
3. `idToModuleMap`，通过模块ID关联到对应的模块对象(`resolveId`解析的结果)
4. `fileToModulesMap`，通过文件路径关联到一组模块对象（`set`）
   
## 2. ensureEntryFromUrl创建ModuleNode
`ModuleNode`主要属性，`importers`引用模块和`importedModules`已导入对象  
1. 通过`pluginContainer`解析出`url`对应的`resolveId`
2. 创建`new ModuleNode`
3. 设置`urlToModuleMap`,`idToModuleMap`,`fileToModuleMap`，记录到`moduleGraph`中

## 3. 绑定模块依赖关系
在插件`importAnalysis`中，调用`es-module-lexer`可以解析出**当前模块导入导出**信息，通过对其解析，得到`importedModules`、`acceptedUrls`和`isSelfAccepting`属性  
调用`ModuleGraph.updateModuleInfo`更新模块依赖图，实现过程：
1. 遍历当前模块已导入模块，创建`moduleNode`，并通过`ensureEntryFromUrl`设置到`moduleGraph`中
2. 当前模块`moduleNode`的`importedModules`加入刚创建出来的依赖`moduleNode`
3. 创建出来的依赖`moduleNode`的`importers`添加当前模块的`moduleNode`
4. 当前模块`moduleNode`添加属性`acceptedModules`,值为`[接受更新的`moduleNode`]`
这样，模块就完成了依赖关联关系，主要通过`importedModules`和`importers`来实现


# 服务端收集更新模块
服务端主要通过**模块依赖图来收集更新模块**    
1. 启动`chokidar`，创建文件监听器，监听`change`修改，`add`新增，`unlink`删除文件操作   

## 1. 修改文件
1. 首先调用`moduleGraph.onFileChange`，再调用`invalidateModule`，对模块进行清除缓存，如`mod.transformResult = null`   
2. 接着触发`handleHMRUpdate`，收集更新模块，主要判断是什么文件修改了，   `restartServer`、`full-reload`、`type-update`
   1. 配置文件和环境变量改动`isConfig || isConfigDependency || isEnv`，`vite`重启服务器   
   2. 客户端注入的文件(`dist/client/client.mjs`)改动，`HTML文件修改`，`无法恢复的错误`，`HMR`会发送`full-reload`刷新页面   
   3. 普通文件，需要热更新的模块，然后对这些模块依次寻找热更新的边界，传递更新信息给客户端   
3. 调用`updateModules`查询热更新边界，边界就是**接受自身更新/子模块更新的模块**  
   1. 通过`moduleGraph.fileToModuleMap`查询到需要变更的模块集合
   2. 遍历`updateModules（moduleNode）`
   3. 调用`propagateUpdate（依赖moduleNode）`收集热更新边界
      1. 如果模块接受自身更新，那么该模块就是边界
      2. 入口模块直接发送`full-reload`
      3. 如果该模块不接受自身更新，遍历`moduleNode.importers`，判断它们的`acceptedHmrDeps`是否有该模块，如果有，`importer`则为更新的边界
      4. 还是找不到，继续往`importer.importers`上查找更新的边界，没有找到那么就`full-reload`
   4. 发送更新信息到客户端
``` javascript
[
    {
        type: 'js-update',
        timestamp: 125943012321,
        path: boundary.url,
        acceptedPath: updateModuleNode
    }
]
```


# 客户端派发更新
1. `vite`在开发阶段会注入一段客户端脚本   
`<script type="module" src="/@vite/client"></script>`   
2. 客户端与服务端建立`Websocket`连接，监听`socket`的`message`事件
3. 如果是`js-update`，调用`queueUpdate(fetchUpdate(update))`
4. `queueUpdate()`主要是批量任务处理，等待当前宏任务执行完成，统一更新
5. `fetchUpdate()`**派发热更新主要逻辑**   
   1.  通过`hotModuleMap`获取到更新模块
   2.  查找是当前模块更新或是子模块更新，放到`modulesToUpdate`-`set`中
   3.  遍历`hotModuleMap`获取到的模块，遍历找到需要执行的更新回调函数,`qualifiedCallbacks`
   4.  通过`动态import`拉取最新的模块信息
6.  `hotModuleMap`实现
    1.  在注入客户端的代码`createHotContext`中，会创建出`hotModuleMap`，主要完成记录依赖和其回调函数
    2.  当调用`import.meta.hot.accpet`时，会把`deps`和`callback`记录到`hotModuleMap`中，后续通过调用它来完成更新。
