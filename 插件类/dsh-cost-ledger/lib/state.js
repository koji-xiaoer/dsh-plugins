/**
 * 费用账本的状态持久化。
 *
 * 落盘位置:$DSH_HOME/storages/cost-ledger/state.json
 * 写入方式:临时文件 + rename(原子),并在替换前把上一版留成 state.json.bak;
 * 价格表/汇率这类"账目性"变更额外写一份 backups/state-<时间>-<标签>.json,便于回看。
 */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** 默认状态。 */
export function defaultState() {
	const now = Date.now()
	return {
		version: 1,
		createdAt: now,
		updatedAt: now,
		/** 展示货币;价格原始货币见各 priceModel.currency。 */
		displayCurrency: 'CNY',
		currencies: ['CNY', 'USD'],
		/** 中国法定节假日(本地日 YYYY-MM-DD),命中按低谷价;留空 = 不排除节假日。 */
		holidays: [],
		peakWindowsUtc: [
			{ startMinute: 60, endMinute: 240 },
			{ startMinute: 360, endMinute: 600 },
		],
		/** 价格模型:键为官方模型名(canonical),segs 按档位保存版本化的价格时段。 */
		priceModels: {},
		/** 按请求计费的服务单价:搜索 / 抓取,官方每 1000 次成功请求 ¥5。 */
		servicePrices: {
			search: { currency: 'CNY', perRequest: 0.005, note: 'DeepSeek Search API:每 1000 次成功请求 ¥5' },
			fetch: { currency: 'CNY', perRequest: 0.005, note: 'DeepSeek Fetch API:每 1000 次成功请求 ¥5' },
		},
		/** 路由:provider/model -> { priceModel } | { mode: 'free' } | { mode: 'unpriced' }。 */
		routes: {
			'deepseek-official/deepseek-flash': { priceModel: 'deepseek-flash' },
			'deepseek-official/deepseek-v4-flash': { priceModel: 'deepseek-flash', note: '旧模型名,官方按 Flash 计价' },
			'deepseek-official/deepseek-v4-flash-vision-exp': { priceModel: 'deepseek-flash', note: '旧模型名,官方按 Flash 计价' },
			'deepseek-official/deepseek-v4-pro': { priceModel: 'deepseek-v4-pro' },
			'openrouter/ox-alpha': { mode: 'free', note: '本地配置为免费档' },
		},
		/** 汇率:state.fx['USD>CNY']['YYYY-MM-DD'] = { base, quote, rate, asOf, source, fetchedAt }。 */
		fx: {},
		/** 会话折叠缓存:会话 id -> 按日/路由/档位/价格段聚合的 token 桶 + 每轮归因。 */
		sessions: {},
		meta: {
			priceSourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
			lastPriceFetchAt: null,
			lastPriceFetchOk: null,
			lastPriceFetchError: null,
			lastFoldAt: null,
			lastFoldMs: null,
			lastFoldSessions: null,
			/** 折叠数据结构版本;升级后由引擎在下次全量折叠时更新。 */
			foldVersion: 0,
		},
	}
}

/** 数据目录。 */
export function dataDir() {
	const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
	return path.join(home, 'storages', 'cost-ledger')
}

export function statePath() {
	return path.join(dataDir(), 'state.json')
}

/** 读取状态;文件不存在或损坏时返回默认状态(损坏文件会被改名留档)。 */
export function loadState() {
	const file = statePath()
	let text
	try {
		text = fs.readFileSync(file, 'utf8')
	} catch (error) {
		if (error?.code === 'ENOENT') return defaultState()
		throw error
	}
	try {
		const parsed = JSON.parse(text)
		return migrateState(parsed)
	} catch (error) {
		const broken = `${file}.broken-${Date.now()}`
		try {
			fs.renameSync(file, broken)
		} catch {
			/* 留档失败也不阻塞启动 */
		}
		return defaultState()
	}
}

/** 兼容旧版本字段。 */
export function migrateState(state) {
	const defaults = defaultState()
	const merged = {
		...defaults,
		...state,
		peakWindowsUtc: Array.isArray(state.peakWindowsUtc) && state.peakWindowsUtc.length > 0 ? state.peakWindowsUtc : defaults.peakWindowsUtc,
		holidays: Array.isArray(state.holidays) ? state.holidays : [],
		priceModels: state.priceModels ?? {},
		routes: { ...defaults.routes, ...(state.routes ?? {}) },
		servicePrices: { ...defaults.servicePrices, ...(state.servicePrices ?? {}) },
		fx: state.fx ?? {},
		sessions: state.sessions ?? {},
		meta: { ...defaults.meta, ...(state.meta ?? {}) },
	}
	if (!merged.currencies.includes(merged.displayCurrency)) merged.displayCurrency = 'CNY'
	merged.updatedAt = Date.now()
	return merged
}

let writeChain = Promise.resolve()

/**
 * 保存状态(串行、原子、带备份)。
 *
 * @param state 状态对象。
 * @param options.backupTag 非空时把当前版本另存到 backups/ 下。
 */
export function saveState(state, { backupTag } = {}) {
	const run = async () => {
		const dir = dataDir()
		await fsp.mkdir(dir, { recursive: true })
		const file = statePath()
		const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
		state.updatedAt = Date.now()
		const text = JSON.stringify(state)
		await fsp.writeFile(tmp, text, 'utf8')
		if (backupTag !== undefined) {
			const backups = path.join(dir, 'backups')
			await fsp.mkdir(backups, { recursive: true })
			try {
				const previous = await fsp.readFile(file, 'utf8')
				const stamp = new Date().toISOString().replace(/[:.]/g, '-')
				await fsp.writeFile(path.join(backups, `state-${stamp}-${backupTag}.json`), previous, 'utf8')
				await pruneBackups(backups, 30)
			} catch (error) {
				if (error?.code !== 'ENOENT') throw error
			}
		}
		try {
			await fsp.copyFile(file, `${file}.bak`)
		} catch (error) {
			if (error?.code !== 'ENOENT') throw error
		}
		await fsp.rename(tmp, file)
	}
	const next = writeChain.then(run, run)
	writeChain = next.then(() => undefined, () => undefined)
	return next
}

/** 只保留最近 n 份备份。 */
async function pruneBackups(dir, n) {
	try {
		const entries = (await fsp.readdir(dir)).filter((name) => name.startsWith('state-') && name.endsWith('.json')).sort()
		while (entries.length > n) {
			const name = entries.shift()
			await fsp.rm(path.join(dir, name), { force: true })
		}
	} catch {
		/* 清理失败不影响主流程 */
	}
}
