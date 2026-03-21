## NVM Dashboard

> 这是一个基于NVM和uTools的可视化node版本管理应用。

### 1、简述

使用uTools官方模板和Codex创建的项目，半AI半人工🤣。

### 2、使用

- 本项目依托于nvm windows版，使用前请先安装nvm
- 运行项目
```sh
# 安装依赖
npm install
# 运行项目
npm run dev
# 打包项目
npm run build
```

### 3、功能介绍

1. **Node版本管理**
   - 查看当前Node版本
   - 查看可用Node版本
   - 查看已安装Node版本
   - 切换Node版本
   - 删除指定Node版本
   - 安装指定Node版本

2. **快速切换功能**
   - **Node版本快速切换**：在uTools输入“切换18”或“切换x.x.x”，或“node 18”或“node x.x.x”
   - **npm源快速切换**：在uTools输入“换源taobao”或“npm taobao”

3. **npm源管理**
   - 支持查看、切换npm、yarn、taobao、tencent、cnpm等源。

![QQ_1771293658626.png](https://s3.bmp.ovh/2026/02/17/yrWkLTQb.png)

### 4、所用指令

```sh
nvm current
nvm list available
nvm list
nvm use
nvm uninstall x.x.x
nvm install x.x.x
nvm -v
npm config get registry
npm config set registry https://registry.npmjs.org/
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/
```