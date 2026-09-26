#!/usr/bin/env node
/**
 * 平台外独立构建（部署 Cloudflare Pages / 本地离线演示用）。
 *
 * 为什么不能直接 `npx vite build`：
 * 妙搭 Vite 预设（@lark-apaas/coding-preset-vite-react）在默认构建里注入了平台运行时才有的东西，
 * 脱离平台会全部变成脏数据或多余的可见元素：
 *   - HTML 里的 `{{appName}}` / `{{appAvatar}}` / `{{tenantId}}` 等 HBS 占位符（标签页标题会字面显示 "{{appName}}"）；
 *   - Slardar / Tea / performance 三个字节跳动外链脚本；
 *   - 右下角妙搭水印（z-index 2147483647，固定悬浮，作品集演示非常显眼）。
 *
 * 置 MIAODA_BUILD_TARGET=standalone 后，预设会：摘掉上述占位符、外链脚本与 polyfill，不再挂水印，
 * 并把 BrowserRouter 换成 HashRouter（刷新子路径不会 404），产出自包含的单文件 IIFE。
 *
 * 产物目录：dist/client（注意不是 dist/，平台预设的 outDir 就是这个）。
 * 构建前会清空 dist/，避免平台构建与独立构建的产物混在一起。
 */
import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const distDir = path.join(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });

const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, MIAODA_BUILD_TARGET: 'standalone' },
});

if (result.status !== 0) {
  console.error('✗ 独立构建失败');
  process.exit(result.status ?? 1);
}

console.log('✓ 独立构建完成，部署目录：dist/client');
