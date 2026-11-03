/**
 * 旧格式会话兼容层。
 *
 * dsh 0.2.0 的持久化只认 `session.v4.jsonl.zstd`;更早的 dsh 写的是
 * `session.jsonl.zstd`(header version 0),这些会话在 UI 里已经不显示,
 * 但日志里同样有 usage 与模型路由 —— 算“总消耗”不能把它们漏掉。
 *
 * 这里用系统自带的 zstd 命令解压(文件是追加写的多帧 zstd,Node 内置的
 * zstd 解压只解第一帧),解析出事件后交给折叠器。
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 会话文件命名:`session.jsonl.zstd`(旧)或 `session.vN.jsonl.zstd`(新)。 */
const SESSION_FILE_RE = /^session(?:\.[a-z0-9]+)?\.jsonl\.zstd$/

function sessionsRoot() {
	const home = process.env.DSH_HOME ?? path.join(process.env.HOME ?? '~', '.dsh')
	return path.join(home, 'sessions')
}

/**
 * 扫描全部会话文件,返回 id -> { file, mtimeMs, size, legacy }。
 * 同一个会话目录里出现多个版本文件时,取最新修改的那个。
 */
export function scanSessionFiles() {
	const index = new Map()
	let projects
	try {
		projects = fs.readdirSync(sessionsRoot(), { withFileTypes: true })
	} catch {
		return index
	}
	for (const project of projects) {
		if (!project.isDirectory()) continue
		let entries
		try {
			entries = fs.readdirSync(path.join(sessionsRoot(), project.name), { withFileTypes: true })
		} catch {
			continue
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue
			const id = entry.name
			let files
			try {
				files = fs.readdirSync(path.join(sessionsRoot(), project.name, entry.name), { withFileTypes: true })
			} catch {
				continue
			}
			let best
			for (const file of files) {
				if (!file.isFile() || !SESSION_FILE_RE.test(file.name)) continue
				const full = path.join(sessionsRoot(), project.name, entry.name, file.name)
				let stat
				try {
					stat = fs.statSync(full)
				} catch {
					continue
				}
				const legacy = file.name === 'session.jsonl.zstd'
				const candidate = { file: full, mtimeMs: stat.mtimeMs, size: stat.size, legacy }
				if (best === undefined || candidate.mtimeMs > best.mtimeMs) best = candidate
			}
			if (best !== undefined) index.set(id, best)
		}
	}
	return index
}

const legacyCache = new Map()

/** 解压并解析一个旧格式会话(按 mtime/size 缓存,缓存上限 4 个)。 */
export async function readLegacyEvents(id, fileInfo, { timeoutMs = 120000 } = {}) {
	const key = `${id}|${fileInfo.mtimeMs}|${fileInfo.size}`
	const cached = legacyCache.get(key)
	if (cached !== undefined) return cached
	const { stdout } = await execFileAsync('zstd', ['-dc', fileInfo.file], {
		maxBuffer: 1024 * 1024 * 1024,
		encoding: 'utf8',
		timeout: timeoutMs,
	})
	const events = []
	for (const line of stdout.split('\n')) {
		if (line.trim() === '') continue
		try {
			events.push(JSON.parse(line))
		} catch {
			/* 跳过损坏行 */
		}
	}
	if (legacyCache.size >= 4) {
		const first = legacyCache.keys().next().value
		if (first !== undefined) legacyCache.delete(first)
	}
	legacyCache.set(key, events)
	return events
}
