const fs = require('node:fs')
const path = require('node:path')
const { exec } = require('node:child_process')

window.services = {
  // 执行命令
  execCommand (command) {
    return new Promise((resolve, reject) => {
      exec(command, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message || 'Command failed'))
          return
        }
        resolve({ stdout, stderr })
      })
    })
  },
  // 执行 nvm 命令
  execNvm (args) {
    const safeArgs = typeof args === 'string' ? args : ''
    const platform = process.platform
    let command = ''

    if (platform === 'win32') {
      command = `cmd /d /s /c "chcp 65001>nul && nvm ${safeArgs}"`
    } else {
      const nvmDir = process.env.NVM_DIR || '$HOME/.nvm'
      command = `bash -lc "source ${nvmDir}/nvm.sh >/dev/null 2>&1 && nvm ${safeArgs}"`
    }

    return new Promise((resolve, reject) => {
      exec(command, { windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message || 'Command failed'))
          return
        }
        resolve({ stdout, stderr })
      })
    })
  }
}
