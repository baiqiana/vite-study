# 为什么需要HMR
如果在文件更新后立即刷新页面，则需要重新加载所有资源，且状态不能保持，即`局部更新`和`状态保持`无法满足前端需求，`HMR`则是解决这些问题

# Vite HMR
`Vite HMR`是基于ESM模块规范实现的，即通过`import.meta.hot`注入热更新相关的属性和方法，正式环境则不会注入`import.meta.hot`，所以需要添加条件守卫。      
达到毫秒级更新速度(此处还未与其它HMR方法比较，后续补充)
```
if(import.meta.hot) {
  ... 热更新逻辑
}
```

##  API
### 1. `import.meta.hot.accept`
该方法表示该模块接受更新，分为三种情况   
1、`import.meta.hot.accept()`，不传入任何参数，此时文件更新，模块hash值修改，浏览器会重新加载并执行该模块   
2、`import.meta.hot.accept(m => m.render())`，传入一个回调函数，参数为`新模块内容`，可以获取到该模块`export`的内容   
3、`import.meta.hot.accept('./a.js', (aNewModule) => {})`，接受子模块·a.js·的更新，参数也为`新模块内容`  
4、`import.meta.hot.accept(['./a.js', './b.js'], ([aNewModule, bNewModule]) => {})`，接受多个子模块更新


### 2. `import.meta.hot.dispose`
该方法为模块更新或者卸载时清除副作用，，例如某个模块`interval`定时器，那么在该模块被卸载后，需要清除掉定时器
```
let timer
let count = 0
timer = setInterval(() => {
  count++
}, 1000)

if(import.meta.hot) {
  import.meta.hot.dispose(() => {
    timer && clearInterval(timer)
  })
}
```

### 3. `import.meta.hot.data`
热更新中共享数据的作用，例如定时器中此时`count = 20`，那么在模块更新后，`count`需要被赋值为20，而不是初始值
```
// 伪代码
let data = import.meta.hot?.data || { count: 0 };
import.meta.hot!.data.count = data.count + 1;
element!.innerText = data.count + "";
```

### 4. `import.meta.hot.prune`
模块被销毁时执行的回调函数

### 5. `import.meta.hot.invalidate`
等同于`location.reload`，刷新页面

### 6. `import.meta.hot.on`
监听事件，能够监听到上述事件发生前，能够做一些初始化工作
```
import.meta.hot.on('vite:beforeUpdate', () => {}) 
```
还能在`vite插件`的`handleHotUpdate`钩子，通过`server.ws`发送自定义事件，在客户端接收该事件
