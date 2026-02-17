<script lang="js" setup>
import { onMounted, ref } from 'vue';
import Main from './Main/index.vue'

const route = ref('')
const enterAction = ref({})

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    route.value = action.code
    enterAction.value = action
    if (action.code === 'nvm use') {
      handlerQuiackUse(action.payload)
    }
    if (action.code === 'mirror use') {
      handlerMirrorUse(action.payload)
    }
  })
  window.utools.onPluginOut((isKill) => {
    route.value = ''
  })
})

const hideMainWindow = () => {
  window.utools.outPlugin()
  window.utools.hideMainWindow()
}
  
const handlerQuiackUse = (payload) => {
  hideMainWindow();
  // 提取版本号 第一种类型 切换18 node18
  let match = payload?.match(/(?:切换|node)\s*(.*)/);
  const version = match ? match[1].trim() : '';
  if (!version) {
    window.utools.showNotification('请输入要切换的版本号');
    return;
  }
  console.log(version);
  window.services.execNvm(`use ${version}`).then(res => {
    console.log(res);
    window.utools.showNotification(res.stdout);
  }).catch(error => {
    window.utools.showNotification(error);
  })
}

const registryOptions = [
  { key: 'npm', label: 'npm', registry: 'https://registry.npmjs.org/' },
  { key: 'yarn', label: 'yarn', registry: 'https://registry.yarnpkg.com/' },
  { key: 'taobao', label: 'taobao', registry: 'https://registry.npmmirror.com/' },
  { key: 'tencent', label: 'tencent', registry: 'https://mirrors.tencent.com/npm/' },
  { key: 'cnpm', label: 'cnpm', registry: 'https://r.cnpmjs.org/' },
];

const getRegistry = (mirror) => {
  return registryOptions.find((item) => item.key === mirror)?.registry || '';
}

const handlerMirrorUse = (payload) => {
  hideMainWindow();
  // 提取参数 换源taobao npmtaobao
  const match = payload?.match(/(?:换源|npm)\s*(.*)/);
  const mirror = match ? match[1].trim() : '';
  console.log(mirror);
  
  if (!mirror) {
    window.utools.showNotification('请输入要切换的镜像源');
    return;
  }
  const registry = getRegistry(mirror);
  if (!registry) {
    window.utools.showNotification('镜像源不存在');
    return;
  }
  window.services.execCommand(`npm config set registry ${registry}`).then(res => {
    window.utools.showNotification(`镜像源「${mirror}」切换成功`);
  }).catch(error => {
    window.utools.showNotification(error);
  })
}
</script>

<template>
  <template v-if="route === 'nvm'">
    <Main :enterAction="enterAction"></Main>
  </template>
</template>
