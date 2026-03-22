## NVM Dashboard

> 这是一个基于NVM和uTools的可视化node版本管理应用。

- [GitHub](https://github.com/qmcxming/nvm-dashboard)
- [uTools](https://u.tools/plugins/detail/NVM+Dashboard/?c=hj9li3rqmo)

![nvm1.png](https://s3.bmp.ovh/2026/03/22/OvcECO5y.png)

### 1、项目介绍

使用uTools官方模板和Codex开发的uTools插件。

在v1.0.1版本中，使用Gemini优化部分UI样式以及动画效果。

本插件依赖于[nvm-windows](https://github.com/coreybutler/nvm-windows)，对于其他平台，虽然已进行底层兼容性处理，但在非Windows平台上的稳定性尚未经过充分验证。

[nvm-windows](https://github.com/coreybutler/nvm-windows)推荐使用1.1.11版本或1.2.x以上版本，否则可能会出现`NVM for Windows should be run from a terminal such as CMD or PowerShell`问题。

### 2、功能介绍

1. **Node版本管理**
   - 查看当前Node版本
   - 查看可用Node版本
   - 查看已安装Node版本
   - 切换Node版本
   - 删除指定Node版本
   - 安装指定Node版本
   - 一键设置NVM镜像配置

2. **快速切换功能**
   - **Node版本快速切换**：在uTools输入“切换18”或“切换x.x.x”，或“node 18”或“node x.x.x”
   - **npm源快速切换**：在uTools输入“换源taobao”或“npm taobao”

3. **npm源管理**
   - 支持查看、切换npm、yarn、taobao、tencent、cnpm等源。

### 3、所用指令

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