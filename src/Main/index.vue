<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'

defineProps({
  enterAction: {
    type: Object,
    required: true
  }
})

type AvailableVersion = {
  version: string
  label: string
}

type CommandResult = {
  stdout: string
  stderr: string
}

const availableVersions = ref<AvailableVersion[]>([])
const installedVersions = ref<string[]>([])
const nvmInstalled = ref<boolean>(false)
const nvmVersion = ref<string>('')
const currentNodeVersion = ref<string>('--')
const currentNodeNumber = computed(() => {
  const match = currentNodeVersion.value.match(/\d+\.\d+\.\d+/)
  return match ? match[0] : ''
})
const loadingAvailable = ref<boolean>(false)
const loadingInstalled = ref<boolean>(false)
const installingVersion = ref<string>('')
const uninstallingVersion = ref<string>('')
const switchingVersion = ref<string>('')
const errorMessage = ref<string>('')
const drawerOpen = ref<boolean>(false)
const viewMode = ref<'available' | 'installed'>('available')
const toasts = ref<{ id: number; message: string; type: 'error' | 'info' }[]>([])
let toastSeed = 0
const customVersion = ref<string>('')

const currentHasList = computed(() => {
  if (viewMode.value === 'available') return availableVersions.value.length > 0
  return installedVersions.value.length > 0
})
const currentEmptyText = computed(() => {
  if (viewMode.value === 'available') return '暂无可用版本。'
  return '暂无已安装版本。'
})

const execNvm = (args: string) => {
  const services = (window as any).services
  if (!services?.execNvm) {
    return Promise.reject(new Error('当前环境未注入命令执行能力。'))
  }
  return services.execNvm(args) as Promise<CommandResult>
}

const pushToast = (message: string, type: 'error' | 'info' = 'info') => {
  const id = toastSeed++
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((item) => item.id !== id)
  }, 3200)
}

const setError = (message: string) => {
  errorMessage.value = message
  pushToast(message, 'error')
}

const setInfo = (message: string) => {
  pushToast(message, 'info')
}

const parseVersions = (output: string) => {
  const versions = new Set<string>()
  const matches = output.match(/\d+\.\d+\.\d+/g) || []
  matches.forEach((version) => versions.add(version))
  return Array.from(versions).sort((a, b) => {
    const parse = (v: string) => v.split('.').map((item) => Number(item))
    const [a1, a2, a3] = parse(a)
    const [b1, b2, b3] = parse(b)
    if (a1 !== b1) return b1 - a1
    if (a2 !== b2) return b2 - a2
    return b3 - a3
  })
}

const parseAvailableVersions = (output: string) => {
  const lines = output.split(/\r?\n/)
  const items: AvailableVersion[] = []
  const seen = new Set<string>()
  let headers: string[] = []

  const toLabel = (value: string) => value.trim().toUpperCase()

  lines.forEach((line) => {
    if (!line.includes('|')) return
    const rawCells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)
    if (rawCells.length === 0) return

    const isSeparator = rawCells.every((cell) => /^-+$/.test(cell))
    if (isSeparator) return

    if (headers.length === 0 && rawCells.some((cell) => /current|lts|old/i.test(cell))) {
      headers = rawCells.map((cell) => toLabel(cell))
      return
    }

    if (headers.length === 0) return

    rawCells.forEach((cell, index) => {
      const versionMatch = cell.match(/\d+\.\d+\.\d+/)
      if (!versionMatch) return
      const version = versionMatch[0]
      if (seen.has(version)) return
      const label = headers[index] || ''
      items.push({ version, label })
      seen.add(version)
    })
  })

  const order = ['CURRENT', 'LTS', 'OLD STABLE', 'OLD UNSTABLE']
  const labelRank = (label: string) => {
    const index = order.indexOf(label)
    return index === -1 ? order.length : index
  }

  return items.sort((a, b) => {
    const rankDiff = labelRank(a.label) - labelRank(b.label)
    if (rankDiff !== 0) return rankDiff
    const parse = (v: string) => v.split('.').map((item) => Number(item))
    const [a1, a2, a3] = parse(a.version)
    const [b1, b2, b3] = parse(b.version)
    if (a1 !== b1) return b1 - a1
    if (a2 !== b2) return b2 - a2
    return b3 - a3
  })
}

const refreshAvailable = async () => {
  loadingAvailable.value = true
  try {
    const result = await execNvm('list available')
    availableVersions.value = parseAvailableVersions(result.stdout)
  } catch (error: any) {
    availableVersions.value = []
    setError(error.message || '获取可用版本失败。')
  } finally {
    loadingAvailable.value = false
  }
}

const refreshInstalled = async () => {
  loadingInstalled.value = true
  try {
    const result = await execNvm('list')
    installedVersions.value = parseVersions(result.stdout)
  } catch (error: any) {
    installedVersions.value = []
    setError(error.message || '获取已安装版本失败。')
  } finally {
    loadingInstalled.value = false
  }
}

const refreshCurrentNode = async () => {
  try {
    const result = await execNvm('current')
    currentNodeVersion.value = result.stdout.trim() || '--'
  } catch {
    currentNodeVersion.value = '--'
  }
}

const checkNvm = async () => {
  errorMessage.value = ''
  try {
    const result = await execNvm('-v')
    nvmInstalled.value = true
    nvmVersion.value = result.stdout.trim()
  } catch (error: any) {
    nvmInstalled.value = false
    nvmVersion.value = ''
    errorMessage.value = ''
  }
}

const refreshAll = async () => {
  await checkNvm()
  if (!nvmInstalled.value) {
    availableVersions.value = []
    installedVersions.value = []
    currentNodeVersion.value = '--'
    return
  }
  await Promise.all([refreshAvailable(), refreshInstalled(), refreshCurrentNode()])
}

const handleInstall = async (version: string) => {
  installingVersion.value = version
  errorMessage.value = ''
  try {
    const result = await execNvm(`install ${version}`)
    await refreshInstalled()
    if (!installedVersions.value.includes(version)) {
      const message = (result.stderr || result.stdout || '').trim()
      setError(message || '安装后未检测到该版本。')
    } else {
      setInfo(`已安装 ${version}`)
    }
  } catch (error: any) {
    setError(error.message || '安装失败。')
  } finally {
    installingVersion.value = ''
  }
}

const handleCustomInstall = async () => {
  const version = customVersion.value.trim()
  if (!version) {
    setError('请输入要安装的版本号。')
    return
  }
  customVersion.value = ''
  await handleInstall(version)
}

const handleUninstall = async (version: string) => {
  uninstallingVersion.value = version
  errorMessage.value = ''
  try {
    const result = await execNvm(`uninstall ${version}`)
    await refreshInstalled()
    if (installedVersions.value.includes(version)) {
      const message = (result.stderr || result.stdout || '').trim()
      setError(message || '卸载后仍检测到该版本。')
    } else {
      setInfo(`已卸载 ${version}`)
    }
  } catch (error: any) {
    setError(error.message || '卸载失败。')
  } finally {
    uninstallingVersion.value = ''
  }
}

const handleUse = async (version: string) => {
  switchingVersion.value = version
  errorMessage.value = ''
  try {
    const result = await execNvm(`use ${version}`)
    await refreshCurrentNode()
    const message = (result.stderr || result.stdout || '').trim()
    if (message) {
      setInfo(message)
    } else {
      setInfo(`已切换到 ${version}`)
    }
  } catch (error: any) {
    setError(error.message || '切换版本失败。')
  } finally {
    switchingVersion.value = ''
  }
}

const openDownload = () => {
  if ((window as any).utools?.shellOpenExternal) {
    ;(window as any).utools.shellOpenExternal('https://github.com/coreybutler/nvm-windows/releases')
  }
}

onMounted(() => {
  refreshAll()
})
</script>

<template>
  <div class="main">
    <header class="topbar">
      <div class="current-node">
        <!-- <p class="eyebrow">当前 Node 版本</p> -->
        <h1>{{ currentNodeNumber ? `v${currentNodeNumber}` : currentNodeVersion }}</h1>
      </div>
      <nav class="menu" aria-label="视图切换">
        <button
          class="menu-item"
          :class="{ active: viewMode === 'available' }"
          @click="viewMode = 'available'"
        >
          可用版本
        </button>
        <button
          class="menu-item"
          :class="{ active: viewMode === 'installed' }"
          @click="viewMode = 'installed'"
        >
          已安装
        </button>
      </nav>
      <div class="actions">
        <button class="ghost" :disabled="loadingAvailable || loadingInstalled" @click="refreshAll">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M4.5 12a7.5 7.5 0 0 1 12.6-5.4L19 4v6h-6l2.2-2.2A5.5 5.5 0 1 0 17.5 12h2A7.5 7.5 0 0 1 4.5 12Z"
              />
            </svg>
          </span>
          刷新
        </button>
        <button class="ghost" @click="drawerOpen = true" aria-label="打开设置">
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M12 8.9a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Zm7.4 2.6-.9-.2a6.3 6.3 0 0 0-.7-1.6l.5-.8a.7.7 0 0 0-.1-.9l-1.2-1.2a.7.7 0 0 0-.9-.1l-.8.5a6.1 6.1 0 0 0-1.6-.7l-.2-.9a.7.7 0 0 0-.7-.5h-1.7a.7.7 0 0 0-.7.5l-.2.9a6.1 6.1 0 0 0-1.6.7l-.8-.5a.7.7 0 0 0-.9.1L5 7.9a.7.7 0 0 0-.1.9l.5.8a6.3 6.3 0 0 0-.7 1.6l-.9.2a.7.7 0 0 0-.5.7v1.7c0 .3.2.6.5.7l.9.2c.1.6.3 1.1.7 1.6l-.5.8a.7.7 0 0 0 .1.9l1.2 1.2c.3.3.6.3.9.1l.8-.5c.5.3 1 .6 1.6.7l.2.9c.1.3.4.5.7.5h1.7c.3 0 .6-.2.7-.5l.2-.9c.6-.1 1.1-.3 1.6-.7l.8.5c.3.2.6.2.9-.1l1.2-1.2c.3-.3.3-.6.1-.9l-.5-.8c.3-.5.6-1 .7-1.6l.9-.2c.3-.1.5-.4.5-.7v-1.7a.7.7 0 0 0-.5-.7Z"
              />
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

    <div class="grid" v-if="nvmInstalled">
      <section class="card" v-if="viewMode === 'available'">
        <div class="card-header">
          <div>
            <p class="card-title">可用版本</p>
            <p class="card-subtitle">来自 `nvm list available`</p>
          </div>
          <span class="status" v-if="loadingAvailable">加载中...</span>
        </div>
        <div class="custom-install">
          <input
            v-model="customVersion"
            class="input"
            placeholder="输入版本号，例如 20.10.0"
          />
          <button
            class="primary small"
            style="height: 100%;"
            :disabled="!customVersion.trim() || installingVersion !== ''"
            @click="handleCustomInstall"
          >
            安装指定版本
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
            <span>暂无可用版本。</span>
          </div>
          <div
            v-for="item in availableVersions"
            :key="`available-${item.version}`"
            class="table-row triple"
          >
            <span class="mono">{{ item.version }}</span>
            <span class="tag" :class="{ muted: !item.label }">{{ item.label || '--' }}</span>
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
            <p class="card-subtitle">来自 `nvm list`</p>
          </div>
          <span class="status" v-if="loadingInstalled">加载中...</span>
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
            <span>暂无已安装版本。</span>
          </div>
          <div
            v-for="version in installedVersions"
            :key="`installed-${version}`"
            class="table-row quad"
            :class="{ current: version === currentNodeNumber }"
          >
            <span class="mono">{{ version }}</span>
            <span class="pill" :class="{ 'pill-current': version === currentNodeNumber }">
              {{ version === currentNodeNumber ? '当前' : '已安装' }}
            </span>
            <button
              class="ghost small"
              :disabled="switchingVersion === version || version === currentNodeNumber"
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
    </div>

    <section v-if="!currentHasList && nvmInstalled" class="empty-state">
      <h3>暂无数据</h3>
      <p>{{ currentEmptyText }}</p>
    </section>

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
              <button class="ghost" @click="drawerOpen = false">关闭</button>
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
                <button class="primary small" @click="refreshAll">重新检测</button>
              </div>
            </div>
          </aside>
        </transition>
      </div>
    </transition>

    <div class="toast-stack">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main {
  padding: 15px;
  font-family: "IBM Plex Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  color: #1f1f1f;
  background: #f5f5f5;
  min-height: calc(100vh - 30px);
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
  gap: 4px;
}

.eyebrow {
  margin: 0;
  color: #8c8c8c;
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 12px;
}

.menu {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid #f0f0f0;
}

.menu-item {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #595959;
  font-weight: 500;
}

.menu-item.active {
  background: #e6f4ff;
  color: #1677ff;
  box-shadow: none;
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
  width: 18px;
  height: 18px;
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

.primary.small {
  padding: 6px 12px;
  font-size: 12px;
}

.ghost.small {
  padding: 6px 12px;
  font-size: 12px;
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
  border-radius: 14px;
  padding: 16px 18px 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 140px);
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
  border: 1px solid #d9d9d9;
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

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.card-subtitle {
  margin: 4px 0 0;
  color: #8c8c8c;
  font-size: 12px;
}

.status {
  font-size: 12px;
  color: #8c8c8c;
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
  grid-template-columns: 1fr minmax(80px, 120px) minmax(90px, 140px);
  gap: 10px;
}

.table-row.quad {
  grid-template-columns: 1fr minmax(70px, 110px) minmax(80px, 120px) minmax(80px, 120px);
  gap: 10px;
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
  padding: 0 9px;
}

.table-row.empty {
  grid-template-columns: 1fr;
  color: #8c8c8c;
  background: #fafafa;
}

.mono {
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 100px;
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
  padding: 2px 10px;
  border-radius: 999px;
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

.drawer-mask-enter-active,
.drawer-mask-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-mask-enter-from,
.drawer-mask-leave-to {
  opacity: 0;
}

.drawer-mask-enter-to,
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

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f7f7;
  border-radius: 8px;
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
