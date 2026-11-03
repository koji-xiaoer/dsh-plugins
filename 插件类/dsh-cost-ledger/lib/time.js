/**
 * 时间口径:本地日(Asia/Shanghai)与官方峰谷时段判定。
 *
 * 官方价目页说明:高峰时段为 UTC 周一至周五 01:00-04:00 与 06:00-10:00,
 * 周末与中国法定节假日全天为低谷价。节假日列表保存在 state.holidays(本地日 YYYY-MM-DD)。
 */

/** 用户本地时区:所有"当日"口径、柱状图分日都按这个时区切。 */
export const LOCAL_TIME_ZONE = 'Asia/Shanghai'

const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
	timeZone: LOCAL_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
	timeZone: LOCAL_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
})

/** 官方默认峰时段(UTC 分钟数),[start, end)。 */
export const DEFAULT_PEAK_WINDOWS_UTC = [
	{ startMinute: 60, endMinute: 240 },
	{ startMinute: 360, endMinute: 600 },
]

/** 毫秒时间戳 -> 本地日 YYYY-MM-DD。 */
export function localDate(ts) {
	return DATE_FORMAT.format(new Date(ts))
}

/** 本地日 YYYY-MM-DD + 当前时刻 -> 毫秒时间戳(当天 00:00,本地时区)。 */
export function localDayStart(day) {
	return Date.parse(`${day}T00:00:00+08:00`)
}

/** 展示用:本地日期时间。 */
export function formatLocalDateTime(ts) {
	if (!Number.isFinite(ts)) return '—'
	return DATE_TIME_FORMAT.format(new Date(ts)).replace(/\//g, '-')
}

/** 从今天(本地)往前推 n-1 天的日期数组,升序。 */
export function recentDays(count, now = Date.now()) {
	const days = []
	for (let offset = count - 1; offset >= 0; offset -= 1) days.push(localDate(now - offset * 86400000))
	return days
}

/**
 * 判断某一时刻是否落在高峰价时段。
 *
 * @param ts 毫秒时间戳。
 * @param options.peakWindowsUtc 峰时段(UTC 分钟数),默认官方值。
 * @param options.holidays 本地日节假日列表(YYYY-MM-DD),命中即按低谷。
 */
export function isPeak(ts, { peakWindowsUtc = DEFAULT_PEAK_WINDOWS_UTC, holidays = [] } = {}) {
	const date = new Date(ts)
	const weekday = date.getUTCDay()
	if (weekday === 0 || weekday === 6) return false
	if (holidays.includes(localDate(ts))) return false
	const minute = date.getUTCHours() * 60 + date.getUTCMinutes()
	for (const window of peakWindowsUtc) {
		if (minute >= window.startMinute && minute < window.endMinute) return true
	}
	return false
}
