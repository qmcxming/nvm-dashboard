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
- 获取当前node版本 (nvm current)
- 获取所有可用node版本 (nvm list available)
- 获取所有已安装的node版本 (nvm list)
- 切换node版本 (nvm use)
- 删除node版本 (nvm uninstall x.x.x)
- 安装node版本 (nvm install x.x.x)
- 获取node版本信息 (nvm nodeinfo)
- 获取nvm 版本信息 (nvm -v)
- node版本快速切换：直接在uTools中输入 切换18或x.x.x