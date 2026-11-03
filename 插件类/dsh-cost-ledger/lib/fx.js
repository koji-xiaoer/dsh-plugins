/**
 * 汇率采集:按"费用产生当日"取当日汇率并持久化。
 *
 * 数据源用 frankfurter(ECB 参考汇率,免费、无需 key):
 *   https://api.frankfurter.dev/v1/<YYYY-MM-DD>?from=USD&to=CNY
 * 非交易日返回最近一个交易日的汇率;当天(或数据尚未发布时)该端点会 301,
 * 此时回退到 /latest,并把响应里的实际生效日记进 asOf,便于核对。
 *
 * 规则(与用户约定一致):
 *  - 只有产生了费用的日子才会请求汇率,没有对话的日子不采集;
 *  - state.fx 里已经有的日子不重复采集;
 *  - 采集失败不落盘,下次再试。
 */

export const FX_SOURCE = 'frankfurter'

async function requestJson(url, timeoutMs) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(timeoutMs),
		redirect: 'follow',
		headers: { accept: 'application/json', 'user-agent': 'dsh-cost-ledger/0.1 (+local)' },
	})
	if (!response.ok) throw new Error(`HTTP ${response.status}`)
	return await response.json()
}

/** 取某天的汇率;当天数据不可得时回退到 latest。返回 rate 与 asOf。 */
export async function fetchFxRate({ base, quote, date, timeoutMs = 20000 }) {
	if (base === quote) return { rate: 1, asOf: date, source: FX_SOURCE }
	const qs = `from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`
	if (date !== undefined && date !== null) {
		try {
			const payload = await requestJson(`https://api.frankfurter.dev/v1/${encodeURIComponent(date)}?${qs}`, timeoutMs)
			const rate = payload?.rates?.[quote]
			if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
				return { rate, asOf: typeof payload.date === 'string' ? payload.date : date, source: FX_SOURCE }
			}
		} catch {
			/* 当天/未来日期会 301,回退 latest */
		}
	}
	const payload = await requestJson(`https://api.frankfurter.dev/v1/latest?${qs}`, timeoutMs)
	const rate = payload?.rates?.[quote]
	if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
		throw new Error(`汇率响应里没有 ${base}->${quote} 的数值`)
	}
	return { rate, asOf: typeof payload.date === 'string' ? payload.date : date, source: FX_SOURCE }
}
