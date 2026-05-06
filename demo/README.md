# Sunwise HDL Checker Web Demo

这是一个零依赖的静态前端原型，用来验证尽量贴近 `SunwiseHDLChecker` 现有桌面工具风格的 Web 工作台布局和主要交互。

## 使用方式

直接打开 [index.html](/C:/Users/Administrator/Desktop/前端/demo/index.html) 即可预览，或在该目录启动任意静态文件服务。

也可以在上一级目录双击 `start-demo.bat`，它会启动后端窗口并打开前端页面。

后端启动后，也可以直接访问后端根路径打开前端：

```text
http://localhost:18080/
```

如果 `18080` 已被占用，查看后端启动窗口里打印的实际端口，例如 `http://localhost:18081/`。

如果 `hdl-web-backend` 已启动，页面会自动进入后端模式；如果后端不可用，页面会保留原 mock demo 数据。

后端默认探测地址：

- `http://localhost:18080/api`
- `http://localhost:18081/api` 到 `http://localhost:18099/api`

如需指定后端地址，可在浏览器控制台设置：

```js
localStorage.setItem("hdlBackendUrl", "http://localhost:18081/api")
location.reload()
```

## Demo 覆盖内容

- 顶部菜单栏、工具栏、项目标签页、工作区标签页
- 左侧项目资源管理器和检查结果浏览树
- 中央分析报告、项目管理、规则集管理、状态机图
- 底部详细结果表、审计按钮、右键查看电路图弹窗
- 右侧帮助信息栏、模板选择、模拟执行检查
- 后端模式下接入工程创建、工程列表、规则集、真实检查任务、结果解析、HTML 报告、源码预览、电路图 JSON 和审查状态保存
- 后端模式下的新建工程已改为正式弹窗，包含工程名、服务器源码目录、语言、规则集和后端地址提示
- 后端任务中心可查看创建工程、运行检查、生成报告的任务历史、状态和完整日志

## 当前定位

这是可降级的前端 demo：后端可用时跑真实 API，后端不可用时继续展示 mock 数据。生产版还需要补齐登录权限、文件上传/服务器工作区选择、报告格式扩展和数据库存储。
