#  为什么要代码分割
1、如果所有模块打入同一个包，应用首屏会加载所有模块，包括没有用到的模块，**即无按需加载**  
2、一行代码修改，整个包会重新加载，**缓存利用率低**

在前端项目中，`chunk`分为`Initial Chunk`、`Async Chunk`，

# Vite的默认分包策略
1. `CSS`文件会进行代码分割，即打包出`a.js`和`a.css`
   
2. 基于`manualChunks`分包
   1. 把业务代码和第三方包分别打入`index.js`和`vendor.js`中
   2. `Async Chunk`单独打包

# 自定义拆包
在`vite.config.js`中配置`build.rollupOptions.output.manualChunks`
1. 对象形式
``` javascript
export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': ['vue', 'vue-router', 'vuex'],
                    'library': ['axios', 'lodash-es']
                }
            }
        }
    }
}
```

2. 函数形式
``` javascript
export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks(id, {  getModuleInfo }) {
                    if(id.includes('node_modules')) {
                        return 'vendor'
                    }
                    if(id.includes('react')) {
                        return 'library'
                    }
                }
            }
        }
    }
}
```

## 循环引用问题
问题： 
1. 当`a.js`导入`b.js`，此时加载`b.js`文件
2. 此时`b.js`又导入`a.js`时，此时`a.js`已经加载过，所以不会再次加载，而此时`b.js`从中获取的变量是`undefined`，此时`b.js`会报错，导致项目无法运行
```
CommonJS是对值的拷贝（require两次值可能不一样）
ESM是对值的引用（用到了再去模块取，例如导入一个Number类型的值，前后两次可能不一样）
```

解决方案：在一个`chunk`中，把所有的依赖或者间接依赖都打入该分包   

通过`manualChunks`的函数形式，参数中可以获取到`getModuleInfo`函数，调用此函数获取`moduleInfo`，再通过`moduleInfo.importers`递归查找该模块的依赖，如果依赖的依赖打包进了该分包，则将该依赖也打入该分包中

### vite-plugin-chunk-split
通过插件的形式来解决循环依赖
``` JavaScript
import { chunkSplitPlugin } from 'vite-plugin-chunk-split'

export default {
    chunkSplitPlugin({
        customSpliting: {
            'react-vendor': ['react', 'react-dom'],
            // 支持填写正则
            'component-util': [/src\/components/, /src\/utils/]
        }
    })
}
```
