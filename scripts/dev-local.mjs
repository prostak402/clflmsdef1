import { spawn } from 'node:child_process'
import process from 'node:process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const apiBaseUrl = process.env.VITE_API_BASE_URL || 'http://localhost:8787'
const backendPort = process.env.PORT || '8787'
const frontendPort = process.env.FRONTEND_PORT || '5173'
const localStorageRoot = process.env.LOCAL_STORAGE_ROOT || '.clipflow-storage'

const children = []
let shuttingDown = false

function startProcess(command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  children.push(child)
  child.on('exit', (code) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    for (const currentChild of children) {
      if (!currentChild.killed) {
        currentChild.kill('SIGTERM')
      }
    }

    process.exit(code === null ? 1 : code)
  })

  return child
}

function shutdown(signal) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  process.exit(signal ? 0 : 1)
}

function startNpmScript(scriptName, scriptArgs = [], extraEnv = {}) {
  const args = ['run', scriptName]
  if (scriptArgs.length > 0) {
    args.push('--', ...scriptArgs)
  }

  if (process.platform === 'win32') {
    return startProcess('cmd.exe', ['/d', '/s', '/c', `${npmCommand} ${args.join(' ')}`], extraEnv)
  }

  return startProcess(npmCommand, args, extraEnv)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

startProcess('node', ['backend-server.mjs'], {
  PORT: backendPort,
  CORS_ALLOWED_ORIGINS:
    process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173',
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  LOCAL_STORAGE_ROOT: localStorageRoot,
})

startNpmScript('dev:frontend', ['--port', frontendPort, '--strictPort'], {
  VITE_API_BASE_URL: apiBaseUrl,
})
