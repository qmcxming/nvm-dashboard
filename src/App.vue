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
      console.log('执行切换');
      handlerQuiackUse(action.payload)
    }
  })
  window.utools.onPluginOut((isKill) => {
    route.value = ''
  })
})
  
const handlerQuiackUse = (payload) => {
  window.utools.outPlugin()
  window.utools.hideMainWindow();
  // 提取版本号
  const match = payload?.match(/切换\s*(.*)/);
  const version = match ? match[1].trim() : '';
  console.log(version);
  window.services.execNvm(`use ${version}`).then(res => {
    console.log(res);
    window.utools.showNotification(res.stdout);
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
