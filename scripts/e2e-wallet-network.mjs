/**
 * 用真实时钟回归钱包断网和响应丢失问题，避免 Chrome virtual-time 跳过动画帧。
 * 用法：npm run build:standalone && node scripts/e2e-wallet-network.mjs
 * 断言失败以退出码 1 结束。
 * 日志和页面截图保存在被 Git 忽略的 logs/，不输出登录凭证。
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist/client')
const port = Number(process.env.SMOKE_PORT || 4333)
const harness = path.join(dist, '_e2e-wallet-network.html')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'jw-wallet-network-'))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const logDir = path.join(root, 'logs')
let server, browser, socket, passed = false
let nextId = 0
const pending = new Map()

async function waitFor(fn, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try { const value = await fn(); if (value) return value } catch { /* 尚未就绪 */ }
    await sleep(200)
  }
  throw new Error('启动浏览器或本地预览超时')
}
function cdp(method, params = {}) {
  const id = ++nextId
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP 超时: ' + method)) }, 15000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function stop(child) {
  if (!child || child.exitCode !== null) return
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 3000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    child.kill()
  })
}

try {
  let executable
  for (const candidate of [process.env.CHROME_PATH, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean)) {
    if (await fs.stat(candidate).catch(() => null)) { executable = candidate; break }
  }
  if (!executable) throw new Error('找不到 Chrome / Edge')
  await fs.copyFile(path.join(root, 'scripts/e2e-wallet-network.html'), harness)
  server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true })
  await waitFor(async () => (await fetch('http://localhost:' + port + '/_e2e-wallet-network.html')).ok)
  browser = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true })
  const debuggerPort = await waitFor(async () => Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]))
  const pages = await (await fetch('http://localhost:' + debuggerPort + '/json/list')).json()
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    const task = pending.get(message.id)
    if (!task) return
    pending.delete(message.id)
    clearTimeout(task.timer)
    if (message.error) task.reject(new Error(message.error.message))
    else task.resolve(message.result)
  })
  await cdp('Page.enable')
  await cdp('Page.navigate', { url: 'http://localhost:' + port + '/_e2e-wallet-network.html' })
  console.log('真实浏览器验证已启动：http://localhost:' + port)
  let output = '', printed = 0
  const start = Date.now()
  while (Date.now() - start < 240000) {
    const result = await cdp('Runtime.evaluate', { expression: "document.getElementById('log')?.textContent || ''", returnByValue: true })
    output = result.result.value || ''
    if (output.length > printed) { console.log(output.slice(printed).trim()); printed = output.length }
    if (output.includes('[done]')) break
    await sleep(1000)
  }
  passed = output.includes('SMOKE_RESULT=PASS')
  if (!output.includes('[done]')) output += '\nFAIL: 整体测试超时'
  await fs.mkdir(logDir, { recursive: true })
  await fs.writeFile(path.join(logDir, 'e2e-wallet-network-' + stamp + '.log'), output)
  const bounds = await cdp('Runtime.evaluate', { expression: "JSON.stringify(document.getElementById('app').getBoundingClientRect().toJSON())", returnByValue: true })
  const box = JSON.parse(bounds.result.value)
  const screenshot = await cdp('Page.captureScreenshot', { captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } })
  const screenshotPath = path.join(logDir, 'e2e-wallet-network-' + stamp + '.png')
  await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  console.log('截图：' + screenshotPath)
} catch (error) {
  console.error('验证失败：' + error.message)
} finally {
  socket?.close()
  await stop(browser)
  await stop(server)
  await fs.rm(harness, { force: true })
  const profileRelative = path.relative(os.tmpdir(), profile)
  if (!profileRelative.startsWith('..') && !path.isAbsolute(profileRelative) && path.basename(profile).startsWith('jw-wallet-network-')) {
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {})
  }
}
process.exitCode = passed ? 0 : 1
