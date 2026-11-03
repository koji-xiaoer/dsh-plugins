/**
 * DeepSeek 官方价目页解析与抓取。
 *
 * 价目页(英文版)的结构是一张 HTML 表格:MODEL 行给出模型列,
 * 之后三组价格行(缓存命中/缓存未命中/输出),每组含 OFF-PEAK 与 PEAK 两行,
 * 每行按模型列依次给出该模型的价格(单位:美元 / 百万 tokens)。
 *
 * 本模块只做纯解析,不做任何持久化;抓取失败由调用方决定如何降级。
 */

/** 官方价目页(英文),价格以美元计。 */
export const PRICING_URL = 'https://api-docs.deepseek.com/quick_start/pricing'

/** 文档写明的高峰时段(UTC,周一到周五):01:00-04:00 与 06:00-10:00。 */
export const DEFAULT_PEAK_WINDOWS_UTC = [
	{ startMinute: 60, endMinute: 240 },
	{ startMinute: 360, endMinute: 600 },
]

const ENTITIES = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&nbsp;': ' ',
}

/** 去掉标签、解码常见实体、压缩空白。 */
export function cellText(html) {
	const noTags = String(html).replace(/<[^>]*>/g, ' ')
	const decoded = noTags.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? ' ')
	return decoded.replace(/\s+/g, ' ').trim()
}

/** 从整页 HTML 中切出包含模型与价格的那张表(第一张表)。 */
export function findPricingTable(html) {
	const tables = String(html).match(/<table[\s\S]*?<\/table>/gi) ?? []
	if (tables.length === 0) throw new Error('价目页里没有找到 <table>')
	return tables[0]
}

/** 把一张表拆成二维单元格文本。 */
export function parseTableRows(tableHtml) {
	const rows = []
	const rowMatches = String(tableHtml).match(/<tr[\s\S]*?<\/tr>/gi) ?? []
	for (const row of rowMatches) {
		const cells = []
		const cellMatches = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []
		for (const cell of cellMatches) cells.push(cellText(cell))
		rows.push(cells)
	}
	return rows
}

/** 价格单元格:"$0.003" -> 0.003。 */
function parseMoney(text) {
	const match = /^\$\s*([0-9]+(?:\.[0-9]+)?)$/.exec(String(text).trim())
	return match === null ? undefined : Number(match[1])
}

/**
 * 解析官方价目页。
 *
 * @param html 整页 HTML。
 * @returns {{currency: string, models: Array<{id: string, version?: string, hit: {offpeak: number, peak: number}, miss: {offpeak: number, peak: number}, output: {offpeak: number, peak: number}}>, peakWindowsUtc: Array<{startMinute: number, endMinute: number}>, sourceUrl: string}}
 */
export function parsePricingHtml(html) {
	const rows = parseTableRows(findPricingTable(html))

	// 1) 模型列:第一行形如 ["MODEL", "deepseek-flash (1)", "deepseek-v4-pro"]。
	const modelRow = rows.find((cells) => cells.length > 1 && /^MODEL$/i.test(cells[0]))
	if (modelRow === undefined) throw new Error('价目表里没有 MODEL 行')
	const models = modelRow.slice(1)
		.map((cell) => cell.replace(/\(\d+\)/g, '').trim())
		.filter((cell) => cell !== '')
	if (models.length === 0) throw new Error('MODEL 行里没有模型名')

	// 2) 版本行(可选,只用于展示)。
	const versionRow = rows.find((cells) => cells.length > 1 && /MODEL VERSION/i.test(cells[0]))
	const versions = versionRow === undefined ? [] : versionRow.slice(1)

	// 3) 价格行:按顺序识别 桶(命中/未命中/输出) 与 档位(峰/谷)。
	const buckets = []
	let currentBucket
	for (const cells of rows) {
		const joined = cells.join(' ')
		if (/CACHE HIT/i.test(joined)) currentBucket = 'hit'
		else if (/CACHE MISS/i.test(joined)) currentBucket = 'miss'
		else if (/1M OUTPUT TOKENS/i.test(joined)) currentBucket = 'output'
		if (currentBucket === undefined) continue
		let tier
		if (/OFF-PEAK/i.test(joined)) tier = 'offpeak'
		else if (/\bPEAK\b/i.test(joined)) tier = 'peak'
		if (tier === undefined) continue
		const values = cells.map(parseMoney).filter((value) => value !== undefined)
		if (values.length !== models.length) {
			throw new Error(`价格行模型数不匹配(桶 ${currentBucket} / ${tier}):期望 ${models.length} 个价格,实际 ${values.length}`)
		}
		buckets.push({ bucket: currentBucket, tier, values })
	}

	const result = {
		currency: 'USD',
		models: models.map((id, index) => {
			const entry = { id }
			if (versions[index] !== undefined && versions[index] !== '') entry.version = versions[index]
			for (const { bucket, tier, values } of buckets) {
				entry[bucket] ??= {}
				entry[bucket][tier] = values[index]
			}
			return entry
		}),
		peakWindowsUtc: parsePeakWindows(html) ?? DEFAULT_PEAK_WINDOWS_UTC,
		sourceUrl: PRICING_URL,
	}

	const missing = []
	for (const model of result.models) {
		for (const bucket of ['hit', 'miss', 'output']) {
			if (model[bucket]?.offpeak === undefined || model[bucket]?.peak === undefined) missing.push(`${model.id}.${bucket}`)
		}
	}
	if (missing.length > 0) throw new Error(`价目表缺少价格:${missing.join(', ')}`)
	return result
}

/** 从页面文字里解析"Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC"。 */
export function parsePeakWindows(html) {
	const text = cellText(String(html).replace(/<script[\s\S]*?<\/script>/gi, ' '))
	const match = /Peak hours are\s+(.+?)\s+UTC/i.exec(text)
	if (match === null) return undefined
	const windows = []
	const re = /([0-2]\d):([0-5]\d)\s*-\s*([0-2]\d):([0-5]\d)/g
	let hit
	while ((hit = re.exec(match[1])) !== null) {
		const startMinute = Number(hit[1]) * 60 + Number(hit[2])
		const endMinute = Number(hit[3]) * 60 + Number(hit[4])
		if (endMinute > startMinute) windows.push({ startMinute, endMinute })
	}
	return windows.length === 0 ? undefined : windows
}

/** 抓取并解析官方价目页;失败抛错(调用方保留旧价并提示)。 */
export async function fetchDeepSeekPricing({ timeoutMs = 20000 } = {}) {
	const response = await fetch(PRICING_URL, {
		signal: AbortSignal.timeout(timeoutMs),
		headers: { 'user-agent': 'dsh-cost-ledger/0.1 (+local)' },
	})
	if (!response.ok) throw new Error(`价目页请求失败:HTTP ${response.status}`)
	const html = await response.text()
	return { ...parsePricingHtml(html), fetchedAt: Date.now() }
}
