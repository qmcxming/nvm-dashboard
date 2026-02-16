<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { execNvm } from '../../utils/common';

const props = defineProps({
  payload: {
    type: String,
    required: true,
    default: '',
  },
});

watch(() => props.payload, (newVal) => {
  console.log('payload changed:', newVal);
  
  // utools.hideMainWindow();
  // utools.outPlugin();
  // utools.showNotification('正在切换中...');
  // try {
  //   await execNvm(`use ${newVal}`);
  //   utools.showNotification('切换成功');
  // } catch (error) {
  //   console.error(error);
  //   utools.showNotification('切换失败');
  // }
}, { immediate: true })
</script>

<template>
  <div>
    nvm use {{ payload || '未检测到版本号' }}
  </div>
</template>

<style scoped></style>