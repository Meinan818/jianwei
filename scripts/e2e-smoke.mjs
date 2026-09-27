/**
 * 真浏览器冒烟测试（用户要求：提交前必须"自己跑一遍"）
 *
 * 为什么需要它：2026-09-28 的两个 bug（商家端「商品管理」永远卡在加载、订单明细被重复写入）
 * tsc / eslint / 构建**全都发现不了**，只有在真实浏览器里点一遍才会暴露。
 *
 * 用法（在仓库根目录）：
 *   npm run smoke          # 先 build:standalone，再对三端各跑一遍冒烟
 *   node scripts/e2e-smoke.mjs   # 直接用已有的 dist/client 跑
 *
 * 它做的事：
 *   1) 把 scripts/e2e-smoke.html 复制进 dist/client，起一个本地预览服务（vite preview）；
 *   2) 用无头 Chrome（找不到就退到 Edge）分别以顾客/商家/骑手身份真实登录；
 *   3) 每个角色逐个打开主要页面，检查"错误兜底 / 卡加载 / 白屏"；
 *   4) 打印每页结果，末尾给出总判定；退出码 0 = 全通过，1 = 有异常。
 *
 * 注意：跑之前要先 `npm run build:standalone`（npm run smoke 已经包含这一步）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist', 'client')
// 可选：node scripts/e2e-smoke.mjs [其他测试页] [角色] —— 只跑指定页面/角色（用于单点回归，如商家拒单）
const harnessArg = process.argv[2]
const roleArg = process.argv[3] || 'customer'
const HARNESS_SRC = harnessArg ? path.resolve(ROOT, harnessArg) : path.join(ROOT, 'scripts', 'e2e-smoke.html')
const HARNESS_DST = path.join(DIST, '_e2e-smoke.html')
const PORT = Number(process.env.SMOKE_PORT || 4329)
const ROLES = ['customer', 'merchant', 'rider']
const ROLE_CN = { customer: '顾客端', merchant: '商家端', rider: '骑手端' }

const sleep = ms => new Promise(r => setTimeout(r, ms))

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

async function waitForServer(url, timeoutMs = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch (e) { /* not up yet */ }
    await sleep(300)
  }
  return false
}

function decodeLog(dom) {
  const m = /<pre id="log">([\s\S]*?)<\/pre>/.exec(dom)
  if (!m) return null
  return m[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function runRole(browser, role) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jw-smoke-' + role + '-'))
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + profile,
    '--virtual-time-budget=300000',
    '--dump-dom',
    'http://localhost:' + PORT + '/_e2e-smoke.html?_role=' + role,
  ]
  const res = spawnSync(browser, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const dom = (res.stdout || '') + (res.stderr || '')
  const text = decodeLog(dom)
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch (e) { /* ignore */ }
  if (!text) return { role, text: '(没能解析出测试输出)\n' + dom.slice(0, 800), pass: false }
  return { role, text, pass: text.includes('SMOKE_RESULT=PASS') }
}

async function main() {
  if (!fs.existsSync(HARNESS_SRC)) {
    console.error('✗ 找不到 ' + HARNESS_SRC)
    process.exit(1)
  }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('✗ 没有构建产物 dist/client/index.html —— 请先跑 npm run build:standalone')
    process.exit(1)
  }
  const browser = findBrowser()
  if (!browser) {
    console.error('✗ 找不到 Chrome / Edge，无法做浏览器冒烟。可设 CHROME_PATH 环境变量指定。')
    process.exit(1)
  }
  fs.copyFileSync(HARNESS_SRC, HARNESS_DST)
  console.log('浏览器: ' + browser)
  console.log('本地预览: http://localhost:' + PORT + '（vite preview）\n')

  const server = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' },
  )

  let failed = []
  try {
    const up = await waitForServer('http://localhost:' + PORT + '/_e2e-smoke.html')
    if (!up) {
      console.error('✗ 本地预览服务没起来（端口 ' + PORT + ' 被占用？可设 SMOKE_PORT 换端口）')
      process.exit(1)
    }
    const rolesToRun = harnessArg ? [roleArg] : ROLES
    for (const role of rolesToRun) {
      console.log('──────── ' + ROLE_CN[role] + ' ────────')
      const r = runRole(browser, role)
      console.log(r.text)
      console.log('')
      if (!r.pass) failed.push(ROLE_CN[role] || role)
    }
  } finally {
    try { server.kill() } catch (e) { /* ignore */ }
    try { fs.rmSync(HARNESS_DST, { force: true }) } catch (e) { /* ignore */ }
  }

  console.log('════════ 冒烟总结 ════════')
  if (failed.length === 0) {
    console.log('✅ 三端主要页面全部正常（无错误兜底 / 无卡加载 / 无白屏）')
    process.exit(0)
  }
  console.log('❌ 有问题的是：' + failed.join('、'))
  console.log('   看上面每个角色里标 ❌ 的那几页，页面文字片段能直接定位到问题。')
  process.exit(1)
}

main()