#!/usr/bin/env bash
# ============================================================================
# check-secrets.sh — 提交前密钥扫描器 (secret scanner for commits)
#
# 用法:
#   scripts/check-secrets.sh            # 扫描暂存区 (git diff --cached)
#   scripts/check-secrets.sh --all      # 扫描全部已跟踪文件
#   scripts/check-secrets.sh --help
#
# 退出码:
#   0  干净（或无待扫描文件）
#   1  发现 CRITICAL 命中 — 禁止提交
#   2  发现 WARNING 命中 — 需人工逐条审查后方可提交
#
# 误报处理: 将 "相对路径:整行内容" 逐行追加到 scripts/secret-allowlist.txt，
#   并在该行上方用 # 写一句理由。CRITICAL 命中不接受豁免。
#   allowlist 文件本身不会被扫描。
# ============================================================================

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWLIST="${ALLOWLIST:-$ROOT/scripts/secret-allowlist.txt}"

# ---- CRITICAL: 确定的密钥，命中即禁止提交 ------------------------------------
# 已知平台 key 格式:
#   DeepSeek / OpenAI / Moonshot / Qwen / SiliconFlow 等: sk- 开头
#   智谱 GLM: <32位hex>.<密钥段>
#   JWT: eyJ 开头三段式
#   百度千帆: bce-v3/ALTAK- 前缀
#   腾讯云: AKID 前缀
#   GitHub / GitLab / Slack / AWS / Google / 硬编码 Authorization / URL 内嵌账号密码
CRITICAL_PATTERNS=(
  '-----BEGIN [A-Z0-9 ]*PRIVATE[[:space:]]KEY-----'
  '-----BEGIN OPENSSH[[:space:]]PRIVATE[[:space:]]KEY-----'
  '(ghp|gho|ghu|github_pat)_[A-Za-z0-9_]{15,}'
  'glpat-[A-Za-z0-9_-]{15,}'
  'sk-[A-Za-z0-9]{16,}'
  'xox[baprs]-[0-9A-Za-z-]{10,}'
  'AKIA[0-9A-Z]{16}'
  'AIza[0-9A-Za-z_-]{30,}'
  '\b[0-9a-fA-F]{32}\.[A-Za-z0-9+/=_-]{16,}\b'
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}'
  'bce-v3/ALTAK[A-Za-z0-9+/=_-]{10,}'
  'AKID[A-Za-z0-9]{13,}'
  "(Authorization|auth|token)[[:space:]]*[:=][[:space:]]*[\"']?(Bearer[[:space:]]+)?[A-Za-z0-9+/=_-]{20,}"
  '[a-zA-Z][a-zA-Z0-9+.-]*://[^/[:space:]]+:[^/@[:space:]]+@'
)

# ---- WARNING: 可能敏感，需人工审查 -------------------------------------------
WARNING_PATTERNS=(
  "(password|passwd|pass_word)[[:space:]]*[:=][[:space:]]*[\"']?[^[:space:]\"]{6,}"
  "(secret|api[_-]?key|apikey|access[_-]?key|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[\"'][^[:space:]\"]{6,}"
  '(Bearer|Basic)[[:space:]]+[A-Za-z0-9+/=_-]{16,}'
  '(mongodb(\+srv)?|redis|postgres|mysql)://[^[:space:]]+:[^/@[:space:]]+@'
  '\b[0-9a-fA-F]{32}\b'
  '\b[0-9a-fA-F]{40}\b'
  '\b[A-Za-z0-9+/]{40,}={0,2}\b'
)

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

is_allowlisted() {
  local rel="$1" content="$2"
  [[ -f "$ALLOWLIST" ]] || return 1
  grep -Fxq "${rel}:${content}" "$ALLOWLIST"
}

# 收集待扫描文件
MODE="staged"
if [[ "${1:-}" == "--all" ]]; then MODE="all"
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then usage; exit 0
fi

if [[ "$MODE" == "all" ]]; then
  mapfile -t FILES < <(cd "$ROOT" && git ls-files | grep -v '^scripts/secret-allowlist.txt$')
else
  mapfile -t FILES < <(cd "$ROOT" && git diff --cached --name-only --diff-filter=ACM | grep -v '^scripts/secret-allowlist.txt$')
fi

if (( ${#FILES[@]} == 0 )); then
  echo "没有待扫描的文件。"
  exit 0
fi

CRIT=0; WARN=0
declare -A SEEN

scan() {
  local level="$1"; shift
  local -a pats=("$@")
  local file rel pat line content lineno key
  for file in "${FILES[@]}"; do
    [[ -f "$file" ]] || continue
    rel="${file#$ROOT/}"
    for pat in "${pats[@]}"; do
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        lineno="${line%%:*}"
        content="${line#*:}"
        key="${rel}:${lineno}"
        [[ -n "${SEEN[$key]:-}" ]] && continue
        SEEN[$key]=1
        # WARNING 可豁免，CRITICAL 一律拦截
        if [[ "$level" == "WARNING" ]] && is_allowlisted "$rel" "$content"; then
          continue
        fi
        printf '[%s] %s:%s  %s\n' "$level" "$rel" "$lineno" "$(printf '%s' "$content" | cut -c1-90)"
        if [[ "$level" == "CRITICAL" ]]; then ((CRIT++)); else ((WARN++)); fi
      done < <(grep -Eni -- "$pat" "$file" 2>/dev/null || true)
    done
  done
}

echo "== dsh-plugins 提交密钥扫描 ($MODE) =="
scan "CRITICAL" "${CRITICAL_PATTERNS[@]}"
scan "WARNING" "${WARNING_PATTERNS[@]}"
echo "----------------------------------------"
echo "结果: $CRIT 个 CRITICAL, $WARN 个 WARNING"

if (( CRIT > 0 )); then
  echo "!! 发现确定的密钥，禁止提交。请将密钥替换为 <YOUR_XXX> 占位符。"
  exit 1
fi
if (( WARN > 0 )); then
  echo "!! 存在需要人工审查的命中。确认为误报的，请加入 scripts/secret-allowlist.txt。"
  exit 2
fi
echo "OK: 未发现密钥。"
exit 0
