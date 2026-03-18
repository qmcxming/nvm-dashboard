<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import Tooltip from '../components/Tooltip.vue';

defineProps({
  enterAction: {
    type: Object,
    required: true,
  },
});

/**
 * 已安装的版本
 */
type AvailableVersion = {
  version: string;
  label: string;
};

/**
 * 命令执行结果
 */
type CommandResult = {
  stdout: string;
  stderr: string;
};

/**
 * 镜像源
 */
type RegistryOption = {
  key: string;
  label: string;
  registry: string;
};

const availableVersions = ref<AvailableVersion[]>([]);
const installedVersions = ref<string[]>([]);
const nvmInstalled = ref<boolean>(false);
const nvmVersion = ref<string>('');
const currentNodeVersion = ref<string>('--');
const currentNodeNumber = computed(() => {
  const match = currentNodeVersion.value.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : '';
});
const loadingAvailable = ref<boolean>(false);
const loadingInstalled = ref<boolean>(false);
const loadingAll = ref<boolean>(false);
const loadingCustomInstalled = ref<boolean>(false);
const installingVersion = ref<string>('');
const uninstallingVersion = ref<string>('');
const switchingVersion = ref<string>('');
const errorMessage = ref<string>('');
const drawerOpen = ref<boolean>(false);
const showInstructions = ref<boolean>(false);
const viewMode = ref<'available' | 'installed' | 'registry'>('installed');
const toasts = ref<{ id: number; message: string; type: 'error' | 'info' }[]>(
  [],
);
let toastSeed = 0;
const customVersion = ref<string>('');
const commandTip = ref<string[]>([]);
const currentRegistry = ref<string>('--');
const loadingRegistry = ref<boolean>(false);
const settingRegistry = ref<string>('');

const registryOptions: RegistryOption[] = [
  { key: 'npm', label: 'npm', registry: 'https://registry.npmjs.org/' },
  { key: 'yarn', label: 'yarn', registry: 'https://registry.yarnpkg.com/' },
  { key: 'taobao', label: 'taobao', registry: 'https://registry.npmmirror.com/' },
  { key: 'tencent', label: 'tencent', registry: 'https://mirrors.tencent.com/npm/' },
  { key: 'cnpm', label: 'cnpm', registry: 'https://r.cnpmjs.org/' },
];

const currentRegistryLabel = computed(() => {
  return registryOptions.find(item => item.registry === currentRegistry.value)?.label;
})

const normalizeRegistry = (value: string) => value.trim().replace(/\/+$/g, '/');

const pushCommand = (command: string) => {
  // 去重并限制最大长度为 5
  const filterCommand = commandTip.value.filter(item => item !== command);
  commandTip.value = [command, ...filterCommand].slice(0, 5);
}

const execNvm = (args: string) => {
  const services = (window as any).services;
  if (!services?.execNvm) {
    return Promise.reject(new Error('当前环境未注入命令执行能力。'));
  }
  pushCommand(`nvm ${args}`)
  return services.execNvm(args) as Promise<CommandResult>;
};

const execCommand = (command: string) => {
  const services = (window as any).services;
  pushCommand(command);
  return services.execCommand(command) as Promise<CommandResult>;
};

const pushToast = (message: string, type: 'error' | 'info' = 'info') => {
  const id = toastSeed++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id);
  }, 3200);
};

const setError = (message: string) => {
  errorMessage.value = message;
  pushToast(message, 'error');
};

const setInfo = (message: string) => {
  pushToast(message, 'info');
};

const parseVersions = (output: string) => {
  const versions = new Set<string>();
  const matches = output.match(/\d+\.\d+\.\d+/g) || [];
  matches.forEach((version) => versions.add(version));
  return Array.from(versions).sort((a, b) => {
    const parse = (v: string) => v.split('.').map((item) => Number(item));
    const [a1, a2, a3] = parse(a);
    const [b1, b2, b3] = parse(b);
    if (a1 !== b1) return b1 - a1;
    if (a2 !== b2) return b2 - a2;
    return b3 - a3;
  });
};

const parseAvailableVersions = (output: string) => {
  const lines = output.split(/\r?\n/);
  const items: AvailableVersion[] = [];
  const seen = new Set<string>();
  let headers: string[] = [];

  const toLabel = (value: string) => value.trim().toUpperCase();

  lines.forEach((line) => {
    if (!line.includes('|')) return;
    const rawCells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
    if (rawCells.length === 0) return;

    const isSeparator = rawCells.every((cell) => /^-+$/.test(cell));
    if (isSeparator) return;

    if (
      headers.length === 0 &&
      rawCells.some((cell) => /current|lts|old/i.test(cell))
    ) {
      headers = rawCells.map((cell) => toLabel(cell));
      return;
    }

    if (headers.length === 0) return;

    rawCells.forEach((cell, index) => {
      const versionMatch = cell.match(/\d+\.\d+\.\d+/);
      if (!versionMatch) return;
      const version = versionMatch[0];
      if (seen.has(version)) return;
      const label = headers[index] || '';
      items.push({ version, label });
      seen.add(version);
    });
  });

  const order = ['CURRENT', 'LTS', 'OLD STABLE', 'OLD UNSTABLE'];
  const labelRank = (label: string) => {
    const index = order.indexOf(label);
    return index === -1 ? order.length : index;
  };

  return items.sort((a, b) => {
    const rankDiff = labelRank(a.label) - labelRank(b.label);
    if (rankDiff !== 0) return rankDiff;
    const parse = (v: string) => v.split('.').map((item) => Number(item));
    const [a1, a2, a3] = parse(a.version);
    const [b1, b2, b3] = parse(b.version);
    if (a1 !== b1) return b1 - a1;
    if (a2 !== b2) return b2 - a2;
    return b3 - a3;
  });
};

const refreshAvailable = async () => {
  loadingAvailable.value = true;
  try {
    const result = await execNvm('list available');
    availableVersions.value = parseAvailableVersions(result.stdout);
  } catch (error: any) {
    availableVersions.value = [];
    setError(error.message || '获取可用版本失败。');
  } finally {
    loadingAvailable.value = false;
  }
};

const refreshInstalled = async () => {
  loadingInstalled.value = true;
  try {
    const result = await execNvm('list');
    installedVersions.value = parseVersions(result.stdout);
  } catch (error: any) {
    installedVersions.value = [];
    setError(error.message || '获取已安装版本失败。');
  } finally {
    loadingInstalled.value = false;
  }
};

const refreshCurrentNode = async () => {
  try {
    const result = await execNvm('current');
    currentNodeVersion.value = result.stdout.trim() || '--';
  } catch {
    currentNodeVersion.value = '--';
  }
};

const checkNvm = async () => {
  errorMessage.value = '';
  try {
    const result = await execNvm('-v');
    nvmInstalled.value = true;
    nvmVersion.value = result.stdout.trim();
  } catch (error: any) {
    nvmInstalled.value = false;
    nvmVersion.value = '';
    errorMessage.value = '';
  }
};

const refreshAll = async () => {
  loadingAll.value = true;
  try {
    await checkNvm();
    if (!nvmInstalled.value) {
      availableVersions.value = [];
      installedVersions.value = [];
      currentNodeVersion.value = '--';
      return;
    }
    await Promise.all([
      refreshAvailable(),
      refreshInstalled(),
      refreshCurrentNode(),
    ]);
  } finally {
    loadingAll.value = false;
  }
};

const refreshRegistry = async () => {
  loadingRegistry.value = true;
  try {
    const result = await execCommand('npm config get registry');
    currentRegistry.value = result.stdout.trim() || '--';
  } catch (error: any) {
    currentRegistry.value = '--';
    setError(error.message || '获取失败，请稍后重试');
  } finally {
    loadingRegistry.value = false;
  }
};

const handleSetRegistry = async (option: RegistryOption) => {
  settingRegistry.value = option.registry;
  try {
    await execCommand(`npm config set registry ${option.registry}`);
    await refreshRegistry();
    setInfo(`镜像源「${option.label}」切换成功`);
  } catch (error: any) {
    setError(error.message || '设置失败');
  } finally {
    settingRegistry.value = '';
  }
};

const handleInstall = async (version: string) => {
  installingVersion.value = version;
  errorMessage.value = '';
  try {
    const result = await execNvm(`install ${version}`);
    await refreshInstalled();
    if (!installedVersions.value.includes(version)) {
      const message = (result.stderr || result.stdout || '').trim();
      setError(message || '安装后未检测到该版本。');
    } else {
      setInfo(`已安装 ${version}`);
    }
  } catch (error: any) {
    setError(error.message || '安装失败。');
  } finally {
    installingVersion.value = '';
  }
};

const handleCustomInstall = async () => {
  const version = customVersion.value.trim();
  if (!version) {
    setError('请输入要安装的版本号。');
    return;
  }
  customVersion.value = '';
  loadingCustomInstalled.value = true;
  await handleInstall(version);
  loadingCustomInstalled.value = false;
};

const handleUninstall = async (version: string) => {
  uninstallingVersion.value = version;
  errorMessage.value = '';
  try {
    const result = await execNvm(`uninstall ${version}`);
    await refreshInstalled();
    if (installedVersions.value.includes(version)) {
      const message = (result.stderr || result.stdout || '').trim();
      setError(message || '卸载后仍检测到该版本。');
    } else {
      setInfo(`已卸载 ${version}`);
    }
  } catch (error: any) {
    setError(error.message || '卸载失败。');
  } finally {
    uninstallingVersion.value = '';
  }
};

const handleUse = async (version: string) => {
  switchingVersion.value = version;
  errorMessage.value = '';
  try {
    const result = await execNvm(`use ${version}`);
    await refreshCurrentNode();
    const message = (result.stderr || result.stdout || '').trim();
    if (message) {
      setInfo(message);
    } else {
      setInfo(`已切换到 ${version}`);
    }
  } catch (error: any) {
    setError(error.message || '切换版本失败。');
  } finally {
    switchingVersion.value = '';
  }
};

const setNvmMirrors = async () => {
  try {
    await execNvm('node_mirror https://npmmirror.com/mirrors/node/');
    await execNvm('npm_mirror https://npmmirror.com/mirrors/npm/');
    setInfo('已成功配置 NVM 淘宝镜像。');
  } catch (error: any) {
    setError(error.message || '配置 NVM 镜像失败。');
  }
};

const openDownload = () => {
  if ((window as any).utools?.shellOpenExternal) {
    (window as any).utools.shellOpenExternal(
      'https://github.com/coreybutler/nvm-windows/releases',
    );
  }
};

const openPreviousReleases = () => {
  if ((window as any).utools?.shellOpenExternal) {
    (window as any).utools.shellOpenExternal(
      'https://nodejs.org/zh-cn/about/previous-releases',
    );
  }
};

onMounted(() => {
  loadingAll.value = true;
  checkNvm().then(() => {
    if (!nvmInstalled.value) return;
    refreshInstalled();
    refreshCurrentNode();
    refreshRegistry();
  }).finally(() => {
    loadingAll.value = false;
  });
});
</script>

<template>
  <div class="main">
    <transition name="global-loading">
      <div v-if="loadingAll" class="global-loading" aria-live="polite">
        <div class="loading-card">
          <span class="spinner" aria-hidden="true"></span>
          <span>正在刷新数据…</span>
        </div>
      </div>
    </transition>
    <header class="topbar">
      <Tooltip :content="currentNodeNumber ? `当前 Node 版本: v${currentNodeNumber}` : currentNodeVersion" position="right" style="display: block;">
        <div class="current-node">
          <!-- <p class="eyebrow">当前 Node 版本</p> -->
          <div class="version-badge">
            <span class="version-dot"></span>
            <h1>{{ currentNodeNumber ? `v${currentNodeNumber}` : currentNodeVersion }}</h1>
          </div>
        </div>
      </Tooltip>
      <nav class="menu" aria-label="视图切换">
        <div class="menu-slider" :class="viewMode"></div>
        <button
          class="menu-item"
          :class="{ active: viewMode === 'installed' }"
          @click="viewMode = 'installed'"
        >
          已安装
        </button>
        <button
          class="menu-item"
          :class="{ active: viewMode === 'available' }"
          @click="viewMode = 'available'"
        >
          可用版本
        </button>
        <button
          class="menu-item"
          :class="{ active: viewMode === 'registry' }"
          @click="viewMode = 'registry'"
        >
          镜像源
        </button>
      </nav>
      <div class="actions">
        <Tooltip content="刷新全部" position="left">
          <button
            class="ghost"
            :disabled="loadingAvailable || loadingInstalled"
            @click="refreshAll"
          >
            <span class="icon" aria-hidden="true">
              <svg
                viewBox="0 0 1024 1024"
              >
                <path
                  d="M168 504.2c1-43.7 10-86.1 26.9-126 17.3-41 42.1-77.7 73.7-109.4S337 212.3 378 195c42.4-17.9 87.4-27 133.9-27s91.5 9.1 133.8 27c40.9 17.3 77.7 42.1 109.3 73.8 9.9 9.9 19.2 20.4 27.8 31.4l-60.2 47c-5.3 4.1-3.5 12.5 3 14.1l175.7 43c5 1.2 9.9-2.6 9.9-7.7l0.8-180.9c0-6.7-7.7-10.5-12.9-6.3l-56.4 44.1C765.8 155.1 646.2 92 511.8 92 282.7 92 96.3 275.6 92 503.8c-0.1 4.5 3.5 8.2 8 8.2h60c4.4 0 7.9-3.5 8-7.8zM924 512h-60c-4.4 0-7.9 3.5-8 7.8-1 43.7-10 86.1-26.9 126-17.3 41-42.1 77.8-73.7 109.4S687 811.7 646 829c-42.4 17.9-87.4 27-133.9 27s-91.5-9.1-133.9-27c-40.9-17.3-77.7-42.1-109.3-73.8-9.9-9.9-19.2-20.4-27.8-31.4l60.2-47c5.3-4.1 3.5-12.5-3-14.1l-175.7-43c-5-1.2-9.9 2.6-9.9 7.7l-0.7 181c0 6.7 7.7 10.5 12.9 6.3l56.4-44.1C258.2 868.9 377.8 932 512.2 932c229.2 0 415.5-183.7 419.8-411.8 0.1-4.5-3.5-8.2-8-8.2z"
                  p-id="8853"
                ></path>
              </svg>
            </span>
            刷新
          </button>
        </Tooltip>
        <button class="ghost" @click="drawerOpen = true" aria-label="打开设置">
          <span class="icon" aria-hidden="true">
            <svg
              viewBox="0 0 1024 1024"
            >
              <path
                d="M924.8 625.7l-65.5-56c3.1-19 4.7-38.4 4.7-57.8s-1.6-38.8-4.7-57.8l65.5-56c10.1-8.6 13.8-22.6 9.3-35.2l-0.9-2.6c-18.1-50.5-44.9-96.9-79.7-137.9l-1.8-2.1c-8.6-10.1-22.5-13.9-35.1-9.5l-81.3 28.9c-30-24.6-63.5-44-99.7-57.6l-15.7-85c-2.4-13.1-12.7-23.3-25.8-25.7l-2.7-0.5c-52.1-9.4-106.9-9.4-159 0l-2.7 0.5c-13.1 2.4-23.4 12.6-25.8 25.7l-15.8 85.4c-35.9 13.6-69.2 32.9-99 57.4l-81.9-29.1c-12.5-4.4-26.5-0.7-35.1 9.5l-1.8 2.1c-34.8 41.1-61.6 87.5-79.7 137.9l-0.9 2.6c-4.5 12.5-0.8 26.5 9.3 35.2l66.3 56.6c-3.1 18.8-4.6 38-4.6 57.1 0 19.2 1.5 38.4 4.6 57.1L99 625.5c-10.1 8.6-13.8 22.6-9.3 35.2l0.9 2.6c18.1 50.4 44.9 96.9 79.7 137.9l1.8 2.1c8.6 10.1 22.5 13.9 35.1 9.5l81.9-29.1c29.8 24.5 63.1 43.9 99 57.4l15.8 85.4c2.4 13.1 12.7 23.3 25.8 25.7l2.7 0.5c26.1 4.7 52.8 7.1 79.5 7.1 26.7 0 53.5-2.4 79.5-7.1l2.7-0.5c13.1-2.4 23.4-12.6 25.8-25.7l15.7-85c36.2-13.6 69.7-32.9 99.7-57.6l81.3 28.9c12.5 4.4 26.5 0.7 35.1-9.5l1.8-2.1c34.8-41.1 61.6-87.5 79.7-137.9l0.9-2.6c4.5-12.3 0.8-26.3-9.3-35zM788.3 465.9c2.5 15.1 3.8 30.6 3.8 46.1s-1.3 31-3.8 46.1l-6.6 40.1 74.7 63.9c-11.3 26.1-25.6 50.7-42.6 73.6L721 702.8l-31.4 25.8c-23.9 19.6-50.5 35-79.3 45.8l-38.1 14.3-17.9 97c-28.1 3.2-56.8 3.2-85 0l-17.9-97.2-37.8-14.5c-28.5-10.8-55-26.2-78.7-45.7l-31.4-25.9-93.4 33.2c-17-22.9-31.2-47.6-42.6-73.6l75.5-64.5-6.5-40c-2.4-14.9-3.7-30.3-3.7-45.5 0-15.3 1.2-30.6 3.7-45.5l6.5-40-75.5-64.5c11.3-26.1 25.6-50.7 42.6-73.6l93.4 33.2 31.4-25.9c23.7-19.5 50.2-34.9 78.7-45.7l37.9-14.3 17.9-97.2c28.1-3.2 56.8-3.2 85 0l17.9 97 38.1 14.3c28.7 10.8 55.4 26.2 79.3 45.8l31.4 25.8 92.8-32.9c17 22.9 31.2 47.6 42.6 73.6L781.8 426l6.5 39.9z"
                p-id="8639"
              ></path>
              <path
                d="M512 326c-97.2 0-176 78.8-176 176s78.8 176 176 176 176-78.8 176-176-78.8-176-176-176z m79.2 255.2C570 602.3 541.9 614 512 614c-29.9 0-58-11.7-79.2-32.8C411.7 560 400 531.9 400 502c0-29.9 11.7-58 32.8-79.2C454 401.6 482.1 390 512 390c29.9 0 58 11.6 79.2 32.8C612.3 444 624 472.1 624 502c0 29.9-11.7 58-32.8 79.2z"
                p-id="8640"
              ></path>
            </svg>
          </span>
          设置
        </button>
      </div>
    </header>

    <section v-if="!nvmInstalled" class="banner warning">
      <div>
        <h3>未检测到 NVM</h3>
        <p>请先安装 NVM for Windows，然后点击刷新获取版本列表。</p>
      </div>
      <button class="primary" @click="openDownload">下载 NVM</button>
    </section>

    <div class="grid" v-if="nvmInstalled || viewMode === 'registry'">
      <section class="card" v-if="viewMode === 'available'">
        <div class="card-header">
          <div>
            <p class="card-title">
              可用版本
              <span class="more-version" @click="openPreviousReleases" title="跳转 https://nodejs.org/zh-cn/about/previous-releases">
                更多版本
              </span>
            </p>
            <p class="card-subtitle">来自「nvm list available」</p>
          </div>
          <Tooltip content="刷新" position="left">
            <span class="icon refresh-icon" aria-hidden="true" @click="refreshAvailable">
              <svg
                viewBox="0 0 1024 1024"
              >
                <path
                  d="M168 504.2c1-43.7 10-86.1 26.9-126 17.3-41 42.1-77.7 73.7-109.4S337 212.3 378 195c42.4-17.9 87.4-27 133.9-27s91.5 9.1 133.8 27c40.9 17.3 77.7 42.1 109.3 73.8 9.9 9.9 19.2 20.4 27.8 31.4l-60.2 47c-5.3 4.1-3.5 12.5 3 14.1l175.7 43c5 1.2 9.9-2.6 9.9-7.7l0.8-180.9c0-6.7-7.7-10.5-12.9-6.3l-56.4 44.1C765.8 155.1 646.2 92 511.8 92 282.7 92 96.3 275.6 92 503.8c-0.1 4.5 3.5 8.2 8 8.2h60c4.4 0 7.9-3.5 8-7.8zM924 512h-60c-4.4 0-7.9 3.5-8 7.8-1 43.7-10 86.1-26.9 126-17.3 41-42.1 77.8-73.7 109.4S687 811.7 646 829c-42.4 17.9-87.4 27-133.9 27s-91.5-9.1-133.9-27c-40.9-17.3-77.7-42.1-109.3-73.8-9.9-9.9-19.2-20.4-27.8-31.4l60.2-47c5.3-4.1 3.5-12.5-3-14.1l-175.7-43c-5-1.2-9.9 2.6-9.9 7.7l-0.7 181c0 6.7 7.7 10.5 12.9 6.3l56.4-44.1C258.2 868.9 377.8 932 512.2 932c229.2 0 415.5-183.7 419.8-411.8 0.1-4.5-3.5-8.2-8-8.2z"
                  p-id="8853"
                ></path>
              </svg>
            </span>
          </Tooltip>
        </div>
        <div class="custom-install">
          <input
            v-model="customVersion"
            class="input"
            placeholder="输入版本号，例如 20.10.0"
          />
          <button
            class="primary small"
            style="height: 100%"
            :disabled="!customVersion.trim() || installingVersion !== ''"
            @click="handleCustomInstall"
          >
            <span v-if="loadingCustomInstalled">正在安装中...</span>
            <span v-else>安装指定版本</span>
          </button>
        </div>
        <div class="table-scroll">
          <div class="table">
            <div class="table-row header triple">
              <span>版本</span>
              <span>标记</span>
              <span>操作</span>
            </div>
            <div v-if="availableVersions.length === 0" class="table-row empty">
              <span v-if="loadingAvailable">加载中...</span>
              <span v-else @click="refreshAvailable">暂无可用版本(点此刷新)</span>
            </div>
            <div
              v-for="item in availableVersions"
              :key="`available-${item.version}`"
              class="table-row triple"
              :class="{ current: item.version === currentNodeNumber }"
            >
              <span class="mono">{{ item.version }}</span>
              <span class="tag" :class="{ muted: !item.label }">{{
                item.label || '--'
              }}</span>
              <button
                class="primary small"
                :disabled="installingVersion === item.version"
                @click="handleInstall(item.version)"
              >
                <span v-if="installingVersion === item.version">安装中...</span>
                <span v-else>安装</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card" v-if="viewMode === 'installed'">
        <div class="card-header">
          <div>
            <p class="card-title">已安装版本</p>
            <p class="card-subtitle">来自「nvm list」</p>
          </div>
          <span class="icon refresh-icon" aria-hidden="true" @click="refreshInstalled" title="刷新">
            <svg
              viewBox="0 0 1024 1024"
            >
              <path
                d="M168 504.2c1-43.7 10-86.1 26.9-126 17.3-41 42.1-77.7 73.7-109.4S337 212.3 378 195c42.4-17.9 87.4-27 133.9-27s91.5 9.1 133.8 27c40.9 17.3 77.7 42.1 109.3 73.8 9.9 9.9 19.2 20.4 27.8 31.4l-60.2 47c-5.3 4.1-3.5 12.5 3 14.1l175.7 43c5 1.2 9.9-2.6 9.9-7.7l0.8-180.9c0-6.7-7.7-10.5-12.9-6.3l-56.4 44.1C765.8 155.1 646.2 92 511.8 92 282.7 92 96.3 275.6 92 503.8c-0.1 4.5 3.5 8.2 8 8.2h60c4.4 0 7.9-3.5 8-7.8zM924 512h-60c-4.4 0-7.9 3.5-8 7.8-1 43.7-10 86.1-26.9 126-17.3 41-42.1 77.8-73.7 109.4S687 811.7 646 829c-42.4 17.9-87.4 27-133.9 27s-91.5-9.1-133.9-27c-40.9-17.3-77.7-42.1-109.3-73.8-9.9-9.9-19.2-20.4-27.8-31.4l60.2-47c5.3-4.1 3.5-12.5-3-14.1l-175.7-43c-5-1.2-9.9 2.6-9.9 7.7l-0.7 181c0 6.7 7.7 10.5 12.9 6.3l56.4-44.1C258.2 868.9 377.8 932 512.2 932c229.2 0 415.5-183.7 419.8-411.8 0.1-4.5-3.5-8.2-8-8.2z"
                p-id="8853"
              ></path>
            </svg>
          </span>
        </div>
        <div class="table-scroll">
          <div class="table">
            <div class="table-row header quad">
              <span>版本</span>
              <span>状态</span>
              <span>切换</span>
              <span>操作</span>
            </div>
            <div v-if="installedVersions.length === 0" class="table-row empty">
              <span v-if="loadingInstalled">加载中...</span>
              <span v-else @click="refreshInstalled">暂无已安装版本</span>
            </div>
            <div
              v-for="version in installedVersions"
              :key="`installed-${version}`"
              class="table-row quad"
              :class="{ current: version === currentNodeNumber }"
            >
              <span class="mono">{{ version }}</span>
              <span
                class="pill"
                :class="{ 'pill-current': version === currentNodeNumber }"
              >
                {{ version === currentNodeNumber ? '当前' : '已安装' }}
              </span>
              <button
                class="ghost small"
                :disabled="
                  switchingVersion === version || version === currentNodeNumber
                "
                @click="handleUse(version)"
              >
                <span v-if="switchingVersion === version">切换中...</span>
                <span v-else>使用</span>
              </button>
              <button
                class="ghost small danger"
                :disabled="uninstallingVersion === version"
                @click="handleUninstall(version)"
              >
                <span v-if="uninstallingVersion === version">卸载中...</span>
                <span v-else>卸载</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card" v-if="viewMode === 'registry'">
        <div class="card-header">
          <div>
            <p class="card-title">npm 镜像源</p>
            <p class="card-subtitle">当前「{{ currentRegistryLabel }}」</p>
          </div>
          <span
            class="icon refresh-icon"
            aria-hidden="true"
            @click="refreshRegistry"
            title="刷新"
          >
            <svg
              viewBox="0 0 1024 1024"
            >
              <path
                d="M168 504.2c1-43.7 10-86.1 26.9-126 17.3-41 42.1-77.7 73.7-109.4S337 212.3 378 195c42.4-17.9 87.4-27 133.9-27s91.5 9.1 133.8 27c40.9 17.3 77.7 42.1 109.3 73.8 9.9 9.9 19.2 20.4 27.8 31.4l-60.2 47c-5.3 4.1-3.5 12.5 3 14.1l175.7 43c5 1.2 9.9-2.6 9.9-7.7l0.8-180.9c0-6.7-7.7-10.5-12.9-6.3l-56.4 44.1C765.8 155.1 646.2 92 511.8 92 282.7 92 96.3 275.6 92 503.8c-0.1 4.5 3.5 8.2 8 8.2h60c4.4 0 7.9-3.5 8-7.8zM924 512h-60c-4.4 0-7.9 3.5-8 7.8-1 43.7-10 86.1-26.9 126-17.3 41-42.1 77.8-73.7 109.4S687 811.7 646 829c-42.4 17.9-87.4 27-133.9 27s-91.5-9.1-133.9-27c-40.9-17.3-77.7-42.1-109.3-73.8-9.9-9.9-19.2-20.4-27.8-31.4l60.2-47c5.3-4.1 3.5-12.5-3-14.1l-175.7-43c-5-1.2-9.9 2.6-9.9 7.7l-0.7 181c0 6.7 7.7 10.5 12.9 6.3l56.4-44.1C258.2 868.9 377.8 932 512.2 932c229.2 0 415.5-183.7 419.8-411.8 0.1-4.5-3.5-8.2-8-8.2z"
                p-id="8853"
              ></path>
            </svg>
          </span>
        </div>
        <div class="table-scroll">
          <div class="table">
            <div class="table-row header registry-header">
              <span>名称</span>
              <span>地址</span>
              <span>操作</span>
            </div>
            <div
              v-for="item in registryOptions"
              :key="item.key"
              class="table-row registry-row"
              :class="{ current: normalizeRegistry(item.registry) === normalizeRegistry(currentRegistry) }"
            >
              <span class="mono">{{ item.label }}</span>
              <span class="registry">{{
                item.registry || '--'
              }}</span>
              <button
                class="primary small"
                :disabled="settingRegistry === item.registry || normalizeRegistry(item.registry) === normalizeRegistry(currentRegistry)"
                @click="handleSetRegistry(item)"
              >
                <span v-if="settingRegistry === item.registry">切换中...</span>
                <span v-else>切换</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div class="command-tip" aria-live="polite">
      <span class="label">当前命令</span>
      <Tooltip v-for="(item, index) in commandTip" :key="index" :content="item" position="top">
        <span class="mono">{{ item }}</span>
      </Tooltip>
      <span class="mono" v-if="commandTip.length === 0">等待执行命令</span>
    </div>

    <transition name="drawer-mask">
      <div
        v-if="drawerOpen"
        class="drawer-backdrop"
        @click.self="drawerOpen = false"
      >
        <transition name="drawer-panel">
          <aside v-if="drawerOpen" class="drawer">
            <header>
              <h2>设置</h2>
              <button class="btn-close" @click="drawerOpen = false">×</button>
            </header>
            <div class="drawer-body">
              <div class="setting-row">
                <span>是否检测到 NVM</span>
                <span :class="['pill', nvmInstalled ? 'pill-ok' : 'pill-warn']">
                  {{ nvmInstalled ? '是' : '否' }}
                </span>
              </div>
              <div class="setting-row">
                <span>NVM 版本</span>
                <span class="mono">{{ nvmVersion || '--' }}</span>
              </div>
              <div class="setting-row">
                <span>快捷操作</span>
                <div style="display: flex; gap: 8px;">
                  <Tooltip content="一键配置 NVM 镜像
nvm node_mirror https://npmmirror.com/mirrors/node/
nvm npm_mirror https://npmmirror.com/mirrors/npm/" position="left">
                    <button class="ghost small" @click="setNvmMirrors">
                      NVM 镜像
                    </button>
                  </Tooltip>
                  <Tooltip content="重新检测 NVM" position="left">
                    <button class="primary small" @click="refreshAll">
                      重新检测
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div class="setting-row">
                <span>快速上手</span>
                <button
                  class="ghost small inline"
                  @click="showInstructions = !showInstructions"
                  :aria-expanded="showInstructions"
                >
                  <span v-if="showInstructions">收起</span>
                  <span v-else>展开</span>
                </button>
              </div>
              <transition name="collapse">
                <div v-show="showInstructions" class="collapse-body">
                  <ol style="margin:0 0 0 18px;padding:0">
                    <li>若未检测到 NVM，请先安装 NVM for Windows。</li>
                    <li>在<b>“可用版本”</b>中选择版本并点击<b>“安装”</b>。</li>
                    <li>在<b>“已安装”</b>中切换或卸载已安装的版本。</li>
                    <li>您也可以自行安装指定版本，即输入版本号，然后点击<b>“安装”</b>按钮。</li>
                  </ol>
                </div>
              </transition>
            </div>
          </aside>
        </transition>
      </div>
    </transition>

    <div class="toast-stack">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="toast.type"
      >
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main {
  padding: 15px;
  font-family: 'IBM Plex Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  color: #1f1f1f;
  background: #F8FAFC;
  min-height: calc(100vh - 30px);
  /* 字体 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
  
  /* 开启更平滑的字体抗锯齿表现（非常有必要） */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
}

.current-node {
  display: flex;
  flex-direction: column;
  gap: 6px;
  user-select: none;
}

.eyebrow {
  margin: 0;
  color: #8c8c8c;
  font-size: 12px;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 16px 4px 12px;
  background: linear-gradient(145deg, #f0fdf4, #dcfce7);
  border: 1px solid #bbf7d0;
  border-radius: 50px;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.version-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(22, 163, 74, 0.15);
}

.version-dot {
  width: 8px;
  height: 8px;
  background: #16a34a;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.2);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
  100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.version-badge h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #15803d;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, Menlo, monospace;
  letter-spacing: -0.5px;
}

.actions {
  display: flex;
  gap: 12px;
}

.menu {
  display: inline-flex;
  position: relative;
  align-items: center;
  padding: 4px;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  z-index: 1;
}

.menu-slider {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: calc((100% - 8px) / 3);
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: -1;
}

.menu-slider.installed { transform: translateX(0); }
.menu-slider.available { transform: translateX(100%); }
.menu-slider.registry { transform: translateX(200%); }

.menu-item {
  flex: 1;
  min-width: 80px;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.3s ease;
}

.menu-item.active {
  background: transparent;
  box-shadow: none;
  color: #0f172a;
  font-weight: 600;
}

.ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 5px;
  background: #fff;
  color: #262626;
  transition: all 0.2s ease;
}

.ghost:disabled {
  opacity: 0.6;
}

.ghost:not(:disabled):hover {
  border-color: #1677ff;
  color: #1677ff;
}

.icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
}

.icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 5px;
  background: #1677ff;
  color: #fff;
  font-weight: 500;
  transition: all 0.2s ease;
}

.primary:not(:disabled):hover {
  background: #4096ff;
}

.primary:disabled {
  background: rgba(0, 0, 0, 0.04);
  color: #595959;
}

.primary.small {
  padding: 6px 12px;
  font-size: 12px;
}

.ghost.small {
  padding: 6px 12px;
  font-size: 12px;
}

.ghost.small.inline {
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 11px;
}

.ghost.danger {
  border-color: #f2c0c0;
  color: #b42318;
}

.ghost.danger:not(:disabled):hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid;
  margin-bottom: 20px;
  background: #fff;
}

.banner h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.banner p {
  margin: 0;
  color: #595959;
}

.banner.warning {
  border-color: #ffe1b0;
  background: #fff8e8;
}

.grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 16px 18px 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.custom-install {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 5px;
  border: 1px solid #e6e6e6;
  background: #fafafa;
  margin-bottom: 12px;
}

.input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border-radius: 5px;
  border: 1.5px solid #d9d9d9;
  outline: none;
  font-size: 13px;
  background: #fff;
  color: #1f1f1f;
  transition: all 0.2s ease;
}

.input:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.15);
}

.input:hover {
  border-color: #1677ff;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.more-version {
  display: inline-flex;
  font-size: 10px;
  cursor: pointer;
  transition: opacity 0.2s ease;
  transform: translateY(1.5px);
}

.more-version:hover {
  opacity: 0.8;
}

.card-subtitle {
  margin: 4px 0 0;
  color: #8c8c8c;
  font-size: 12px;
}

.refresh-icon {
  font-size: 12px;
  color: #8c8c8c;
  cursor: pointer;
  transition: color 0.2s ease;
}

.refresh-icon:hover {
  color: #000;
}

.table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.table-scroll {
  overflow: auto;
  padding-right: 4px;
}

.table-row.header {
  position: sticky;
  top: 0;
  z-index: 1;
  border-radius: 0;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 10px 12px;
  border-radius: 5px;
  background: #fafafa;
}

.table-row.triple {
  grid-template-columns: 1fr minmax(80px, 120px) auto;
  gap: 10px;
}

.table-row.quad {
  grid-template-columns: 1fr minmax(70px, 110px) minmax(80px, 120px) auto;
  gap: 10px;
}

.registry-header, .registry-row {
  grid-template-columns: minmax(80px, 120px) 1fr auto;
  gap: 10px;
}

.registry-row .registry {
  color: #8c8c8c;
  font-size: 12px;
}

.table-row.triple > *:nth-child(2),
.table-row.triple > *:nth-child(3) {
  justify-self: start;
}

.table-row.quad > *:nth-child(2),
.table-row.quad > *:nth-child(3),
.table-row.quad > *:nth-child(4) {
  justify-self: start;
}

.table-row.current {
  background: #f1f7ff;
  border: 1px solid #d6e4ff;
}

.table-row.header {
  background: #f5f5f5;
  font-weight: 600;
  color: #262626;
}

.table-row.header span {
  padding: 0 12px;
}

.table-row.empty {
  grid-template-columns: 1fr;
  color: #8c8c8c;
  background: #fafafa;
  text-align: center;
  cursor: pointer;
}

.mono {
  font-family:
    'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo,
    monospace;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  background: #e6f4ff;
  color: #1677ff;
}

.tag.muted {
  background: #f0f0f0;
  color: #8c8c8c;
}

.pill {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 12px;
  background: #e6f4ff;
  color: #1677ff;
}

.pill-ok {
  background: #e5f6ed;
  color: #1a7f37;
}

.pill-warn {
  background: #fff1d6;
  color: #9a6a00;
}

.pill-current {
  background: #e6f0ff;
  color: #1d4ed8;
}

.empty-state {
  margin-top: 24px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #d4d4d4;
  text-align: center;
}

.command-tip {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px dashed #d0d7de;
  color: #595959;
  font-size: 12px;
}

.command-tip .label {
  font-size: 10px;
  color: #8c8c8c;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.command-tip .mono {
  max-width: 100px;
  padding: 4px 10px;
  border-radius: 5px;
  background: #f5f5f5;
  color: #262626;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
  z-index: 10;
}

.drawer {
  width: 320px;
  height: 100%;
  background: #fff;
  padding: 20px;
  box-shadow: -12px 0 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 16px;
  transform-origin: right center;
}

.global-loading {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  backdrop-filter: blur(2px);
}

.loading-card {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #f0f0f0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: #1f1f1f;
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #d9d9d9;
  border-top-color: #1677ff;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.global-loading-enter-active,
.global-loading-leave-active {
  transition: opacity 0.2s ease;
}

.global-loading-enter-from,
.global-loading-leave-to {
  opacity: 0;
}

.global-loading-enter-to,
.global-loading-leave-from {
  opacity: 1;
}

.drawer-mask-enter-active,
.drawer-mask-leave-active {
  transition: opacity 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-mask-enter-from,
.drawer-mask-leave-to {
  opacity: 0;
}

.drawer-mask-leave-from {
  opacity: 1;
}

.drawer-panel-enter-active,
.drawer-panel-leave-active {
  transition: transform 0.25s ease;
}

.drawer-panel-enter-from,
.drawer-panel-leave-to {
  transform: translateX(100%) scale(0.98);
}

.drawer-panel-enter-to,
.drawer-panel-leave-from {
  transform: translateX(0) scale(1);
}

.drawer header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer h2 {
  margin: 0;
  font-size: 18px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-close {
  color: #94a3b8;
  width: 20px;
  height: 20px;
  padding: 5px;
  border-radius: 50%;
  transition: color 0.2s, background-color 0.2s;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.btn-close:hover {
  color: #475569;
  background-color: #f3f4f6;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f7f7;
  border-radius: 8px;
}

.mirror-url {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 11px;
  color: #8c8c8c;
}

.collapse-body {
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 8px;
  margin-top: 0px;
  color: #444;
  font-size: 13px;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.18s ease;
}
.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}
.collapse-enter-to,
.collapse-leave-from {
  max-height: 400px;
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 680px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .actions {
    width: 100%;
    justify-content: flex-start;
  }

  .menu {
    width: 100%;
    justify-content: space-between;
  }

  .drawer {
    width: 100%;
  }
}
</style>
