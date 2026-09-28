import { spawn } from 'node:child_process'

const vite = spawn('npm', ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  shell: true,
  stdio: 'inherit',
})

let electron = null
const serverUrl = 'http://127.0.0.1:5174'

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(serverUrl)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Vite dev server did not start in time.')
}

try {
  await waitForServer()
  electron = spawn('npm', ['exec', 'electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: serverUrl,
    },
  })
} catch (error) {
  console.error(error.message)
  vite.kill()
  process.exit(1)
}

function shutdown() {
  electron?.kill()
  vite.kill()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
