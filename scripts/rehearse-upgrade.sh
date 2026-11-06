#!/usr/bin/env bash
# ============================================================================
# rehearse-upgrade.sh — dsh 升级预演（升级前跑，零副作用）
#
# 背景：dsh 每次发版都可能重构包结构。历史教训：0.1.1 → 0.1.5 删除了整包
# （dsh-host-apiproxy / dsh-client-runtime），导致 8/10 补丁失效，而这些补丁
# 承载着费用预估/账单/余额/完成提醒等核心功能。升级完才发现坏，代价很大。
#
# 本脚本把「升级后救火」提前成「升级前预演」，做三件事：
#   1. 依赖面 diff —— 哪些 @deepseek-ai 包被删除/新增（最快最狠的破坏面信号）
#   2. 补丁 dry-run —— 在目标版本的原始包上逐个试打，报告 hunk 级失败明细
#   3. 锚点契约校验 —— 若补丁库登记了锚点，检查锚点串是否仍在上游代码中
#
# 全程只读生产环境：不碰全局 npm 前缀、不碰 ~/.dsh、不重启任何服务。
# 所有下载与试打都在临时目录内完成（默认 /tmp/dsh-rehearsal-<目标版本>）。
#
# 用法：
#   scripts/rehearse-upgrade.sh                 # 预演到 npm latest
#   scripts/rehearse-upgrade.sh --target 0.1.5-rc.1
#   scripts/rehearse-upgrade.sh --json          # 机器可读输出（供 CI / Agent 消费）
#   scripts/rehearse-upgrade.sh --keep          # 保留临时目录以便人工排查
#   scripts/rehearse-upgrade.sh --patch-dir DIR # 指定补丁目录（默认 ~/.dsh/patches）
#
# 退出码：0 = 无破坏点；1 = 存在破坏点（详见报告）；2 = 脚本自身出错
# ============================================================================
set -uo pipefail

PATCH_DIR="${DSH_PATCH_DIR:-$HOME/.dsh/patches}"
TARGET=""
JSON=0
KEEP=0
PKG_NAME="@deepseek-ai/dsh"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'
[ -t 1 ] || { GREEN=''; YELLOW=''; RED=''; BLUE=''; DIM=''; NC=''; }

while [ $# -gt 0 ]; do
  case "$1" in
    --target)     TARGET="${2:-}"; shift 2 ;;
    --target=*)   TARGET="${1#*=}"; shift ;;
    --patch-dir)  PATCH_DIR="${2:-}"; shift 2 ;;
    --patch-dir=*) PATCH_DIR="${1#*=}"; shift ;;
    --json)       JSON=1; shift ;;
    --keep)       KEEP=1; shift ;;
    -h|--help)    sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $1（--help 查看用法）" >&2; exit 2 ;;
  esac
done

say()  { [ "$JSON" -eq 1 ] || printf '%b\n' "$*"; }
fail() { printf '%b\n' "${RED}[✗]${NC} $*" >&2; exit 2; }

command -v npm  >/dev/null || fail "找不到 npm"
command -v node >/dev/null || fail "找不到 node"
[ -d "$PATCH_DIR" ] || fail "补丁目录不存在：$PATCH_DIR"

# ── 侦查当前环境 ────────────────────────────────────────────────────────────
DSH_BIN="$(command -v dsh || true)"
[ -n "$DSH_BIN" ] || fail "PATH 中找不到 dsh"
CUR_PKG="$(cd "$(dirname "$(readlink -f "$DSH_BIN")")/.." && pwd)"
CUR_VER="$(node -p "require('$CUR_PKG/package.json').version" 2>/dev/null || echo unknown)"

say "${BLUE}═══ dsh 升级预演 ═══${NC}"
say "  当前版本: ${CUR_VER}"
say "  补丁目录: ${PATCH_DIR}"

# 目标版本：默认取 latest
if [ -z "$TARGET" ]; then
  TARGET="$(timeout 60 npm view "$PKG_NAME" dist-tags.latest 2>/dev/null || true)"
  [ -n "$TARGET" ] || fail "无法从 npm 获取 latest 版本（网络？）"
fi
say "  目标版本: ${TARGET}"

if [ "$TARGET" = "$CUR_VER" ]; then
  say "  ${YELLOW}注意：目标版本与当前版本相同，预演结果反映的是「当前状态」。${NC}"
fi

WORK="/tmp/dsh-rehearsal-${TARGET}"
rm -rf "$WORK"; mkdir -p "$WORK" || fail "无法创建临时目录 $WORK"
cleanup() { [ "$KEEP" -eq 1 ] || rm -rf "$WORK"; }
trap cleanup EXIT

BREAKING=0

# ═══ 1. 依赖面 diff ═════════════════════════════════════════════════════════
say ""
say "${BLUE}── 1. 依赖面 diff ──${NC}"

# 两侧都用 node 解析 JSON，取 dependencies ∪ devDependencies。
# 不用字符串 grep：那样会把 devDependencies 误判成「被删除」，
# 也会让 @deepseek-ai/dsh 之类的前缀包含关系产生假命中。
node -e '
  const p = require(process.argv[1]);
  const keep = (o) => Object.keys(o || {}).filter((k) => k.startsWith("@deepseek-ai/"));
  const all = new Set([...keep(p.dependencies), ...keep(p.devDependencies)]);
  process.stdout.write([...all].map((s) => s.replace("@deepseek-ai/", "")).sort().join("\n") + "\n");
' "$CUR_PKG/package.json" 2>/dev/null | grep . > "$WORK/deps-current.txt"

timeout 90 npm view "$PKG_NAME@$TARGET" dependencies devDependencies --json 2>/dev/null \
  | node -e '
      let raw = "";
      process.stdin.on("data", (c) => { raw += c });
      process.stdin.on("end", () => {
        let p;
        try { p = JSON.parse(raw) } catch { return }
        const keep = (o) => Object.keys(o || {}).filter((k) => k.startsWith("@deepseek-ai/"));
        const all = new Set([...keep(p.dependencies), ...keep(p.devDependencies)]);
        process.stdout.write([...all].map((s) => s.replace("@deepseek-ai/", "")).sort().join("\n") + "\n");
      });
    ' | grep . > "$WORK/deps-target.txt"

if [ ! -s "$WORK/deps-target.txt" ]; then
  say "  ${RED}无法获取目标版本依赖列表（版本不存在？网络？）${NC}"
  BREAKING=1
else
  # comm 要求两侧同序，统一按 C locale 重排（node 的 sort() 与系统 locale 可能不一致）
  LC_ALL=C sort -o "$WORK/deps-current.txt" "$WORK/deps-current.txt"
  LC_ALL=C sort -o "$WORK/deps-target.txt" "$WORK/deps-target.txt"
  # comm 必须与 sort 用同一 locale，否则会静默给出错误差集
  LC_ALL=C comm -23 "$WORK/deps-current.txt" "$WORK/deps-target.txt" > "$WORK/deps-removed.txt"
  LC_ALL=C comm -13 "$WORK/deps-current.txt" "$WORK/deps-target.txt" > "$WORK/deps-added.txt"
  RM_N=$(wc -l < "$WORK/deps-removed.txt" | tr -d ' ')
  ADD_N=$(wc -l < "$WORK/deps-added.txt" | tr -d ' ')

  say "  包数: $(wc -l < "$WORK/deps-current.txt" | tr -d ' ') → $(wc -l < "$WORK/deps-target.txt" | tr -d ' ')"
  if [ "$RM_N" -gt 0 ]; then
    say "  ${RED}被删除的包（$RM_N）—— 任何指向它们的补丁必然失效：${NC}"
    while read -r p; do [ -n "$p" ] && say "    ${RED}✗${NC} $p"; done < "$WORK/deps-removed.txt"
    BREAKING=1
  else
    say "  ${GREEN}✓${NC} 无包被删除"
  fi
  [ "$ADD_N" -gt 0 ] && say "  ${DIM}新增 $ADD_N 个包（可能含替代品，人工确认新落点）${NC}"
fi

# ═══ 2. 补丁 dry-run ════════════════════════════════════════════════════════
say ""
say "${BLUE}── 2. 补丁 dry-run ──${NC}"

PATCH_FILES=()
while IFS= read -r f; do PATCH_FILES+=("$f"); done < <(ls "$PATCH_DIR"/*.patch 2>/dev/null | sort)
[ "${#PATCH_FILES[@]}" -gt 0 ] || fail "补丁目录里没有 .patch 文件：$PATCH_DIR"

# 从补丁头解析出目标包集合
: > "$WORK/patch-targets.tsv"
for f in "${PATCH_FILES[@]}"; do
  target_rel="$(grep -m1 '^+++ ' "$f" | sed 's/^+++ //' | awk '{print $1}')"
  [ -n "$target_rel" ] || continue
  pkg="$(printf '%s' "$target_rel" | sed -n 's|^node_modules/@deepseek-ai/\([^/]*\)/.*|\1|p')"
  [ -n "$pkg" ] && printf '%s\t%s\t%s\n' "$(basename "$f")" "$pkg" "$target_rel" >> "$WORK/patch-targets.tsv"
done
PKGS="$(cut -f2 "$WORK/patch-targets.tsv" | sort -u)"
PKG_N="$(printf '%s\n' "$PKGS" | grep -c . || true)"
say "  补丁 ${#PATCH_FILES[@]} 个，涉及 ${PKG_N} 个目标包"

# 下载目标版本的原始包（只读 npm，不安装）
say "  ${DIM}下载目标版本原始包...${NC}"
TREE="$WORK/tree/node_modules/@deepseek-ai"
mkdir -p "$TREE"
for p in $PKGS; do
  if ! timeout 90 npm view "@deepseek-ai/$p@$TARGET" version >/dev/null 2>&1; then
    printf '%s\t%s\n' "$p" "MISSING_AT_TARGET" >> "$WORK/pkg-status.tsv"
    continue
  fi
  ( cd "$WORK" && timeout 120 npm pack "@deepseek-ai/$p@$TARGET" >/dev/null 2>&1 )
  tgz="$(ls -t "$WORK"/*.tgz 2>/dev/null | head -1)"
  if [ -z "$tgz" ]; then
    printf '%s\t%s\n' "$p" "PACK_FAILED" >> "$WORK/pkg-status.tsv"
    continue
  fi
  mkdir -p "$TREE/$p"
  tar xzf "$tgz" -C "$TREE/$p" --strip-components=1 2>/dev/null \
    && printf '%s\t%s\n' "$p" "OK" >> "$WORK/pkg-status.tsv" \
    || printf '%s\t%s\n' "$p" "EXTRACT_FAILED" >> "$WORK/pkg-status.tsv"
  rm -f "$tgz"
done

# 逐个 dry-run；成功的真实应用，保证后续补丁上下文正确（补丁间可能有叠加）
: > "$WORK/patch-results.tsv"
while IFS=$'\t' read -r pf pkg rel; do
  [ -n "$pf" ] || continue
  status="$(awk -F'\t' -v p="$pkg" '$1==p{print $2}' "$WORK/pkg-status.tsv")"
  if [ "$status" = "MISSING_AT_TARGET" ]; then
    printf '%s\t%s\t%s\n' "$pf" "MISSING_PKG" "目标包 @deepseek-ai/$pkg 在 $TARGET 已不存在" >> "$WORK/patch-results.tsv"
    continue
  fi
  if [ ! -f "$WORK/tree/$rel" ]; then
    printf '%s\t%s\t%s\n' "$pf" "MISSING_FILE" "目标文件不存在：$rel" >> "$WORK/patch-results.tsv"
    continue
  fi
  out="$( cd "$WORK/tree" && patch -p0 --forward --dry-run < "$PATCH_DIR/$pf" 2>&1 )"; rc=$?
  if [ $rc -eq 0 ]; then
    detail=""
    printf '%s' "$out" | grep -qE 'with fuzz|offset' && detail="$(printf '%s' "$out" | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-140)"
    printf '%s\t%s\t%s\n' "$pf" "$( [ -n "$detail" ] && echo "OK_FUZZ" || echo "OK" )" "$detail" >> "$WORK/patch-results.tsv"
    ( cd "$WORK/tree" && patch -p0 --forward --quiet < "$PATCH_DIR/$pf" >/dev/null 2>&1 )
  elif printf '%s' "$out" | grep -q 'Reversed (or previously applied)'; then
    printf '%s\t%s\t%s\n' "$pf" "ALREADY" "内容已包含在前置补丁中（正常）" >> "$WORK/patch-results.tsv"
  else
    nfail="$(printf '%s' "$out" | grep -cE '^[0-9]+ out of [0-9]+ hunks? FAILED|hunks? FAILED')"
    printf '%s\t%s\t%s\n' "$pf" "FAIL" "$(printf '%s' "$out" | grep -E 'FAILED' | tr '\n' ';' | cut -c1-160)" >> "$WORK/patch-results.tsv"
  fi
done < "$WORK/patch-targets.tsv"

# 汇总输出
while IFS=$'\t' read -r pf st detail; do
  [ -n "$pf" ] || continue
  case "$st" in
    OK)           say "  ${GREEN}[通过]${NC}    $pf" ;;
    OK_FUZZ)      say "  ${YELLOW}[偏移]${NC}    $pf  ${DIM}$detail${NC}" ;;
    ALREADY)      say "  ${DIM}[已包含]  $pf${NC}" ;;
    MISSING_PKG)  say "  ${RED}[包已删除]${NC} $pf  ${DIM}$detail${NC}"; BREAKING=1 ;;
    MISSING_FILE) say "  ${RED}[文件消失]${NC} $pf  ${DIM}$detail${NC}"; BREAKING=1 ;;
    FAIL)         say "  ${RED}[失败]${NC}    $pf  ${DIM}$detail${NC}"; BREAKING=1 ;;
    *)            say "  ${RED}[未知:$st]${NC} $pf" ;;
  esac
done < "$WORK/patch-results.tsv"

# ═══ 3. 锚点契约校验 ════════════════════════════════════════════════════════
ANCHOR_FILE="$PATCH_DIR/anchors.tsv"
if [ -f "$ANCHOR_FILE" ]; then
  say ""
  say "${BLUE}── 3. 锚点契约校验 ──${NC}"
  miss=0; tot=0
  while IFS=$'\t' read -r name pkg anchor; do
    case "$name" in ''|\#*) continue ;; esac
    tot=$((tot+1))
    hits=0
    [ -d "$TREE/$pkg" ] && hits="$(grep -rlF -- "$anchor" "$TREE/$pkg" 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$hits" -gt 0 ]; then
      say "  ${GREEN}✓${NC} $name"
    else
      say "  ${RED}✗${NC} $name  ${DIM}锚点已消失: $anchor${NC}"; miss=$((miss+1))
    fi
  done < "$ANCHOR_FILE"
  [ "$miss" -gt 0 ] && BREAKING=1
  say "  ${DIM}锚点 $tot 个，失效 $miss 个${NC}"
else
  say ""
  say "${DIM}── 3. 锚点契约校验：跳过（$ANCHOR_FILE 不存在）──${NC}"
  say "${DIM}   提示：改用锚点注入可让补丁对上游重构免疫，见 skill dsh-upgrade-rehearsal${NC}"
fi

# ═══ 报告 ═══════════════════════════════════════════════════════════════════
say ""
say "${BLUE}═══ 结论 ═══${NC}"
if [ "$BREAKING" -eq 0 ]; then
  say "  ${GREEN}未发现破坏点，可以升级。${NC}"
  say "  ${DIM}提醒：静态预演覆盖不了运行时行为，升级后请按检查清单做验收。${NC}"
else
  say "  ${RED}存在破坏点，建议先处理再升级。${NC}"
fi
[ "$KEEP" -eq 1 ] && say "  ${DIM}临时目录已保留：$WORK${NC}"

if [ "$JSON" -eq 1 ]; then
  node -e '
    const fs=require("fs"),w=process.argv[1],t=process.argv[2],c=process.argv[3],b=process.argv[4];
    const rd=(f)=>{try{return fs.readFileSync(w+"/"+f,"utf8").trim().split("\n").filter(Boolean)}catch{return[]}};
    const out={
      currentVersion:c, targetVersion:t,
      removedPackages:rd("deps-removed.txt"),
      addedPackages:rd("deps-added.txt"),
      packages:rd("pkg-status.tsv").map(l=>{const[a,s]=l.split("\t");return{name:a,status:s}}),
      patches:rd("patch-results.tsv").map(l=>{const[f,s,d]=l.split("\t");return{file:f,status:s,detail:d||""}}),
      breaking: b==="1"
    };
    process.stdout.write(JSON.stringify(out,null,2)+"\n");
  ' "$WORK" "$TARGET" "$CUR_VER" "$BREAKING"
fi

exit "$BREAKING"
