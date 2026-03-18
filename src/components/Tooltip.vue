<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}>();

const isVisible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

const show = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    isVisible.value = true;
  }, 250); // slight delay to prevent flashing
};

const hide = () => {
  if (timer) clearTimeout(timer);
  isVisible.value = false;
};
</script>

<template>
  <div class="tooltip-wrapper" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <slot></slot>
    <transition name="tooltip-fade">
      <div v-if="isVisible && content" class="tooltip-content" :class="position || 'top'">
        {{ content }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.tooltip-content {
  position: absolute;
  z-index: 999;
  padding: 8px 12px;
  background-color: #1e293b;
  color: #f8fafc;
  font-size: 12px;
  border-radius: 5px;
  white-space: pre-wrap;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  font-family: inherit;
  line-height: 1.5;
  min-width: max-content;
  max-width: 280px;
  text-align: left;
}

/* Position adjustments */
.tooltip-content.top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-content.bottom {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-content.left {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.tooltip-content.right {
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

/* Caret Triangles */
.tooltip-content::after {
  content: '';
  position: absolute;
  border-style: solid;
}

.tooltip-content.top::after {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px;
  border-color: #1e293b transparent transparent transparent;
}

.tooltip-content.bottom::after {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px;
  border-color: transparent transparent #1e293b transparent;
}

.tooltip-content.left::after {
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  border-width: 5px;
  border-color: transparent transparent transparent #1e293b;
}

.tooltip-content.right::after {
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border-width: 5px;
  border-color: transparent #1e293b transparent transparent;
}

/* Animations */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}

.tooltip-content.top.tooltip-fade-enter-from, 
.tooltip-content.top.tooltip-fade-leave-to {
  transform: translate(-50%, 6px);
}

.tooltip-content.bottom.tooltip-fade-enter-from, 
.tooltip-content.bottom.tooltip-fade-leave-to {
  transform: translate(-50%, -6px);
}

.tooltip-content.left.tooltip-fade-enter-from, 
.tooltip-content.left.tooltip-fade-leave-to {
  transform: translate(6px, -50%);
}

.tooltip-content.right.tooltip-fade-enter-from, 
.tooltip-content.right.tooltip-fade-leave-to {
  transform: translate(-6px, -50%);
}
</style>
