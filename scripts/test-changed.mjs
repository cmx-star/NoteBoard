#!/usr/bin/env node
// 只跑与当前改动相关的测试
//
// 变更来源：与基线分支的提交差异 + 工作区改动 + 未跟踪文件。
// 测试选择：
//   1. 改动过的测试文件直接执行
//   2. 改动过的源码交给 `vitest related` 按导入图反查
//
// 用法：node scripts/test-changed.mjs
// 环境变量：NB_CHANGED_BASE（默认 origin/dev）

import { spawnSync } from 'node:child_process';

const BASE = process.env.NB_CHANGED_BASE ?? 'origin/dev';
const CHUNK_SIZE = 40;

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
}

function lines(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** 收集所有可能与本仓库相关的改动文件 */
function collectChangedFiles() {
  const files = new Set();

  const mergeBase = git(['merge-base', BASE, 'HEAD']).trim();
  const diffBase = mergeBase || 'HEAD';
  for (const file of lines(git(['diff', '--name-only', diffBase]))) files.add(file);

  for (const file of lines(git(['ls-files', '--others', '--exclude-standard']))) files.add(file);
  return [...files];
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function runVitest(args) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['exec', 'vitest', ...args], { stdio: 'inherit' });
  if (result.error) {
    console.error(`无法启动 vitest：${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

const changed = collectChangedFiles().filter(
  (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts') && !file.includes('node_modules/'),
);

const testFiles = changed.filter((file) => file.startsWith('test/') && /\.test\.tsx?$/.test(file));
// scripts/ 下的门禁核心文件也交给导入图反查（test/scripts 里的用例直接 import 它们）
const sourceFiles = changed.filter(
  (file) => file.startsWith('src/') || file.startsWith('scripts/'),
);

if (testFiles.length === 0 && sourceFiles.length === 0) {
  console.log(`没有检测到相关的 TS/TSX 改动（基线 ${BASE}）`);
  process.exit(0);
}

console.log(`基线 ${BASE}：${testFiles.length} 个测试文件、${sourceFiles.length} 个源码文件`);

let exitCode = 0;

for (const group of chunk(testFiles, CHUNK_SIZE)) {
  exitCode = runVitest(['run', '--passWithNoTests', ...group]) || exitCode;
}

for (const group of chunk(sourceFiles, CHUNK_SIZE)) {
  exitCode = runVitest(['related', '--run', '--passWithNoTests', ...group]) || exitCode;
}

process.exit(exitCode);
