#!/usr/bin/env node
// 文件行数棘轮：只允许下降，不允许新增超限文件
//
// 用法：
//   node scripts/check-file-size.mjs            # 检查
//   node scripts/check-file-size.mjs --update   # 用当前状态重写基线（只在明确缩小时使用）
//
// 范围：src 下的 .ts / .tsx。插件与 Rust 源码暂不纳入，避免一次性引入过多基线。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FILE_SIZE_LIMIT, countLines, evaluateFileSizes } from './file-size-core.mjs';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const scanRoot = path.join(rootDir, 'src');
const baselinePath = path.join(rootDir, 'scripts', 'file-size-baseline.json');

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, files);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function currentCounts() {
  const counts = {};
  for (const file of collectFiles(scanRoot)) {
    const relative = path.relative(rootDir, file).split(path.sep).join('/');
    counts[relative] = countLines(fs.readFileSync(file, 'utf8'));
  }
  return counts;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return { limit: FILE_SIZE_LIMIT, files: {} };
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function writeBaseline(counts) {
  const files = {};
  for (const key of Object.keys(counts).sort()) {
    if (counts[key] > FILE_SIZE_LIMIT) files[key] = counts[key];
  }
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify({ limit: FILE_SIZE_LIMIT, files }, null, 2)}\n`,
    'utf8',
  );
  return Object.keys(files).length;
}

function main() {
  const counts = currentCounts();
  const overLimit = Object.values(counts).filter((lines) => lines > FILE_SIZE_LIMIT).length;

  if (process.argv.includes('--update')) {
    const written = writeBaseline(counts);
    console.log(`已写入基线：${written} 个文件超过 ${FILE_SIZE_LIMIT} 行`);
    return;
  }

  const baseline = readBaseline();
  const violations = evaluateFileSizes(counts, baseline.files ?? {}, baseline.limit ?? FILE_SIZE_LIMIT);
  console.log(`扫描 ${Object.keys(counts).length} 个文件，超限 ${overLimit} 个，基线 ${Object.keys(baseline.files ?? {}).length} 个`);

  if (violations.length > 0) {
    console.error(`\n❌ 文件行数门禁未通过（${violations.length} 项）：`);
    for (const violation of violations) console.error(`   - ${violation}`);
    process.exit(1);
  }
  console.log('✅ 文件行数棘轮通过');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
