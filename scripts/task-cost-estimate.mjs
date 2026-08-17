#!/usr/bin/env node
/**
 * dsh 任务花费预估器
 * 基于历史会话的真实完成消耗量(每步/每轮/每会话分布 + 相似历史任务轮均成本)
 * 对"一系列任务"给出每任务与总计的乐观/基准/悲观预估区间。
 *
 * 用法:
 *   node task-cost-estimate.mjs --profile                 # 输出历史画像(校准数据)
 *   node task-cost-estimate.mjs --tasks "任务1 | 任务2 | ..."
 *   node task-cost-estimate.mjs --tasks "任务1" "任务2"     # 或按参数逐项给
 */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/claude/.dsh/sessions/--home-claude--";

// ── 价表(与 GUI/服务端 ESTIMATED_PRICES 同步,¥/百万 token) ──
const PRICES = {
	"deepseek-v4-flash": {
		current: { cacheRead: 0.02, cacheMiss: 1, output: 2 },
		peak: { cacheRead: 0.1, cacheMiss: 3, output: 9 },
		offpeak: { cacheRead: 0.05, cacheMiss: 1.5, output: 4.5 },
	},
};
const PEAK_SINCE = Date.parse("2026-08-16T16:00:00Z");
function period(now) {
	if (now < PEAK_SINCE) return "current";
	const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Shanghai" }).format(now));
	return (h >= 9 && h < 12) || (h >= 14 && h < 18) ? "peak" : "offpeak";
}
const costOf = (b, at) => {
	const p = PRICES["deepseek-v4-flash"][period(at)];
	return ((b.input + b.write) * p.cacheMiss + b.read * p.cacheRead + b.output * p.output) / 1e6;
};

// ── 历史数据加载:每步费用、每轮费用、每会话画像(含标题) ──
function loadHistory() {
	const steps = [];
	const turns = [];
	const sessionProfiles = [];
	for (const d of readdirSync(ROOT, { withFileTypes: true }).filter((x) => x.isDirectory())) {
		const p = join(ROOT, d.name, "session.jsonl.zstd");
		if (!existsSync(p)) continue;
		const raw = execFileSync("unzstd", ["-c", p], { maxBuffer: 1 << 30, encoding: "utf8" });
		let title = null;
		let sCost = 0;
		let sSteps = 0;
		const turnCosts = new Map();
		for (const line of raw.split("\n")) {
			if (!line.trim()) continue;
			const ev = JSON.parse(line);
			if (ev.type === "session" && title === null) title = d.name;
			// session/title 会有 fallback(截断)与 provider(LLM 最终)两次事件,取最后一个
			if (ev.type === "session/title" && typeof ev.data?.title === "string") title = ev.data.title;
			if (ev.type !== "assistant/message" || ev.data?.usage === void 0) continue;
			const u = ev.data.usage;
			const b = { input: u.inputTokens ?? 0, read: u.cacheReadTokens ?? 0, write: u.cacheWriteTokens ?? 0, output: u.outputTokens ?? 0 };
			const c = costOf(b, ev.time ?? 0);
			steps.push(c);
			sCost += c;
			sSteps += 1;
			const t = turnCosts.get(ev.data.turn) ?? 0;
			turnCosts.set(ev.data.turn, t + c);
		}
		for (const [, c] of turnCosts) turns.push(c);
		if (sSteps > 0) sessionProfiles.push({ id: d.name, title, cost: sCost, steps: sSteps, turns: turnCosts.size, avgTurnCost: sCost / Math.max(1, turnCosts.size) });
	}
	return { steps, turns, sessionProfiles };
}

const q = (arr, pct) => {
	const s = [...arr].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(s.length * pct))];
};
const mean = (arr) => arr.reduce((s, x) => s + x, 0) / Math.max(1, arr.length);

// ── 任务复杂度 → 预估轮数(启发式,可在对话中按实际描述修正) ──
// 排障/修复类任务历史轮数显著偏高(多轮迭代定位),单独分档。
const TROUBLESHOOT = /排查|排障|修复|定位|偏差|不一致|失败|错误|问题|调试|异常|核对|审计|查.*原因|为什么/;
const COMPLEX = /重构|迁移|架构|系统|调研|开发|设计|上线|部署|整合|从零|框架|服务化|全面|报告|方案/;
const SIMPLE = /简单|小|快速|单文件|查一下|确认|检查一下|看一下|改一个|一条|贴一下|替换|删除|更新.*仓库|推送/;
function estimateTurns(task) {
	const len = task.length;
	if (TROUBLESHOOT.test(task)) return { lo: 6, mid: 10, hi: 20 };
	if (COMPLEX.test(task) || len > 80) return { lo: 5, mid: 8, hi: 16 };
	if (SIMPLE.test(task) || len < 15) return { lo: 1, mid: 2, hi: 4 };
	return { lo: 3, mid: 5, hi: 10 };
}

// ── 相似历史任务:中文 2-gram 字符匹配(中文无空格分词,子串 ngram 最稳) ──
function ngrams(text, n = 2) {
	const set = new Set();
	const t = text.replace(/\s+/g, "");
	for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n));
	return set;
}
function similarSessions(task, profiles, k = 3) {
	const taskGrams = ngrams(task);
	if (taskGrams.size === 0) return [];
	const scored = profiles
		.map((s) => {
			const t = s.title ?? s.id;
			const titleGrams = ngrams(t);
			let overlap = 0;
			for (const g of taskGrams) if (titleGrams.has(g)) overlap += 1;
			if (overlap === 0) return null;
			return { ...s, score: overlap / taskGrams.size, overlap };
		})
		.filter((s) => s !== null)
		.sort((a, b) => b.score - a.score);
	return scored.slice(0, k);
}

function formatYuan(v) {
	if (v >= 1) return `¥${v.toFixed(2)}`;
	if (v >= 0.01) return `¥${v.toFixed(3)}`;
	return `¥${v.toFixed(4)}`;
}

// ── 主逻辑 ──
const args = process.argv.slice(2);
const profIdx = args.indexOf("--profile");
const tasksIdx = args.indexOf("--tasks");
if (profIdx !== -1) {
	const { steps, turns, sessionProfiles } = loadHistory();
	console.log(`=== 历史成本画像(${steps.length} 步 / ${turns.length} 轮 / ${sessionProfiles.length} 会话) ===`);
	console.log(`[每步] 费用: 均值 ${formatYuan(mean(steps))} | 中位 ${formatYuan(q(steps, .5))} | P90 ${formatYuan(q(steps, .9))}`);
	console.log(`[每轮] 费用: 均值 ${formatYuan(mean(turns))} | 中位 ${formatYuan(q(turns, .5))} | P90 ${formatYuan(q(turns, .9))} | P95 ${formatYuan(q(turns, .95))}`);
	console.log(`[会话] 费用: 均值 ${formatYuan(mean(sessionProfiles.map((s) => s.cost)))} | 中位 ${formatYuan(q(sessionProfiles.map((s) => s.cost), .5))} | P90 ${formatYuan(q(sessionProfiles.map((s) => s.cost), .9))}`);
	console.log(`[会话] 轮数: 均值 ${mean(sessionProfiles.map((s) => s.turns)).toFixed(1)} | 中位 ${q(sessionProfiles.map((s) => s.turns), .5).toFixed(1)} | P90 ${q(sessionProfiles.map((s) => s.turns), .9).toFixed(1)}`);
	process.exit(0);
}

let tasks = [];
if (tasksIdx !== -1) {
	const raw = args.slice(tasksIdx + 1).join(" ");
	tasks = raw.split("|").map((t) => t.trim()).filter(Boolean);
	if (tasks.length === 0 && args[tasksIdx + 1]) tasks = args.slice(tasksIdx + 1);
}
if (tasks.length === 0) {
	console.error("用法: node task-cost-estimate.mjs --tasks \"任务1 | 任务2 | ...\"  或  --profile");
	process.exit(1);
}

const { steps, turns, sessionProfiles } = loadHistory();
const turnMid = q(turns, .5);
const turnMean = mean(turns);
const turnP90 = q(turns, .9);
const stepMean = mean(steps);

console.log(`预估任务数: ${tasks.length} 个(历史校准: ${steps.length} 步 / ${turns.length} 轮)`);
console.log("");
let tLo = 0, tMid = 0, tHi = 0;
let tSteps = 0;
tasks.forEach((task, i) => {
	const sims = similarSessions(task, sessionProfiles);
	// 有任何 2-gram 重叠即视为可参考历史(中文任务与标题的匹配通常只有 1-2 个公共 ngram)
	const strong = sims.length > 0;
	let turnsEst;
	let lo, mid, hi;
	let note = "";
	if (strong) {
		// 相似历史任务:直接用其真实消耗区间做基准(历史完成量综合评估)
		const simCosts = sims.map((s) => s.cost);
		const simTurns = sims.map((s) => s.turns);
		turnsEst = { lo: Math.max(1, Math.round(Math.min(...simTurns) * 0.8)), mid: Math.round(mean(simTurns)), hi: Math.round(Math.max(...simTurns) * 1.3) };
		lo = Math.min(...simCosts) * 0.7;
		mid = mean(simCosts);
		hi = Math.max(...simCosts) * 1.3;
		note = ` | 相似历史(实际消耗): ${sims.map((s) => `${s.title ?? s.id.slice(0, 20)} ¥${s.cost.toFixed(2)}/${s.turns}轮`).join("、")}`;
	} else {
		turnsEst = estimateTurns(task);
		lo = turnsEst.lo * turnMid;
		mid = turnsEst.mid * turnMean;
		hi = turnsEst.hi * turnP90;
		note = " | 无相似历史,按复杂度分档×历史轮均";
	}
	tLo += lo; tMid += mid; tHi += hi;
	tSteps += turnsEst.mid * 17; // 每轮历史平均约 17 步
	console.log(`${i + 1}. ${task.slice(0, 50)}`);
	console.log(`   预估 ${turnsEst.lo}-${turnsEst.hi} 轮 ≈ ${Math.round(turnsEst.mid * 17)} 步`);
	console.log(`   费用 ${formatYuan(lo)} ~ ${formatYuan(mid)} ~ ${formatYuan(hi)}(乐观/基准/悲观)${note}`);
	console.log("");
});
console.log(`=== 总计 ===`);
console.log(`预估总步数: ~${Math.round(tSteps)} 步`);
console.log(`费用区间:   ${formatYuan(tLo)} ~ ${formatYuan(tMid)} ~ ${formatYuan(tHi)}(乐观/基准/悲观)`);
console.log(`说明: 基准=轮数×历史轮均;同会话连续任务缓存命中 99%+,实际常低于基准;新会话起步成本更高。`);
