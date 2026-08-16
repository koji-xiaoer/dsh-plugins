#!/usr/bin/env node
/**
 * atomic-publish.mjs — 原子发布客户端 bundle，避免运行中服务下发"编辑中间态"。
 *
 * 问题：dsh web 服务实时读取磁盘上的 client bundle 文件下发到浏览器。
 * 直接原地编辑（编辑工具/编辑器）会让文件处于语法中间态，此刻任何页面刷新
 * 都会拉到坏 bundle → "Failed to load plugins ... loaded without registering"。
 *
 * 方案：先在副本上编辑 → 语法检查通过 → mv 原子替换（POSIX rename 原子性保证
 * 读者只会看到"旧完整文件"或"新完整文件"，绝不会看到半个文件）。
 *
 * 用法：
 *   1) cp <target> <target>.editing
 *   2) 用编辑工具修改 <target>.editing（可多次编辑）
 *   3) node --check <target>.editing
 *   4) node atomic-publish.mjs <target>.editing <target>
 *      —— 先对 candidate 做 node --check，通过后备份旧文件并 mv 原子替换
 *
 * 环境变量：
 *   PUBLISH_BACKUP_DIR  备份目录（默认同目录，后缀 .bak-published-<ts>）
 *   PUBLISH_NO_BACKUP   设为 1 跳过备份
 */
import { execFileSync } from "node:child_process";
import { existsSync, copyFileSync, renameSync } from "node:fs";
import { dirname, basename, join } from "node:path";

const [candidate, target] = process.argv.slice(2);
if (!candidate || !target) {
  console.error("usage: node atomic-publish.mjs <candidate> <target>");
  process.exit(2);
}
if (!existsSync(candidate)) {
  console.error(`candidate not found: ${candidate}`);
  process.exit(1);
}
try {
  execFileSync(process.execPath, ["--check", candidate], { stdio: "inherit" });
} catch {
  console.error(`syntax check FAILED — NOT publishing ${basename(target)}`);
  process.exit(1);
}
if (process.env.PUBLISH_NO_BACKUP !== "1" && existsSync(target)) {
  const backupDir = process.env.PUBLISH_BACKUP_DIR || dirname(target);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = join(backupDir, `${basename(target)}.bak-published-${ts}`);
  copyFileSync(target, backup);
  console.log(`backed up ${target} -> ${backup}`);
}
renameSync(candidate, target);
console.log(`published ${basename(target)} (atomic rename OK)`);
