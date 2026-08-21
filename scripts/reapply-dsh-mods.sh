#!/usr/bin/env bash
# reapply-dsh-mods.sh — 一键重放 dsh 自定义改动（升级后丢失时恢复）
#
# 背景：费用预估/CostMeter/账单 等功能都是对安装包内文件的直接修改。
# dsh 升级（npm 整体替换目录）会静默覆盖这些文件，功能全部丢失。
# 本脚本把改动以补丁形式保存（~/.dsh/patches/），升级后一键重放。
#
# 2026-08 适配 0.1.1-rc.1：ui-conversation / host-apiproxy 补丁已按新版本重建
# （折叠功能与粘贴图片转文字已随裁剪移除；llm-deepseek 补丁不再需要）。
# 升级步骤：npm i -g @deepseek-ai/dsh@0.1.1-rc.1 → bash reapply-dsh-mods.sh → systemctl --user restart dsh-web
#
# 界面改动规范：后续所有网页 UI 改动请先阅读 ~/.dsh/UI-GUIDE.md
# （现代卡片设计语言、令牌用法、修改/HMR/补丁工作流），改完记得 --capture。
#
# 用法：
#   reapply-dsh-mods.sh          应用全部补丁（已应用的自动跳过，幂等）
#   reapply-dsh-mods.sh --check  只检查状态
#   reapply-dsh-mods.sh --revert 撤销全部补丁（回到官方原版）
#   reapply-dsh-mods.sh --capture 重新从当前文件生成补丁（改了新功能后刷新补丁库）
#
# 重放后需重启服务：systemctl --user restart dsh-web
set -u

DSH_BIN="$(command -v dsh)"
if [ -z "$DSH_BIN" ]; then echo "ERROR: dsh not found in PATH"; exit 1; fi
# dsh bin 真实路径: .../@deepseek-ai/dsh/lib/bin.js → 包根 = 上一级
DSH_PKG="$(cd "$(dirname "$(readlink -f "$DSH_BIN")")/.." && pwd)"
if [ ! -d "$DSH_PKG/node_modules/@deepseek-ai" ]; then
  echo "ERROR: 无法定位 dsh 包根（$DSH_PKG）"; exit 1
fi
PATCH_DIR="${DSH_PATCH_DIR:-$HOME/.dsh/patches}"
MODE="${1:-apply}"

# 每个补丁：目标文件(相对 DSH_PKG) | 原始备份名 | 幂等标记
# 目标文件内的"原始备份"是各类备份留下的官方原版（paste 补丁的 .orig.js、我的 .bak-cost.js）
readonly PATCHES=(
  "node_modules/@deepseek-ai/dsh-token-meter/lib/index.js|node_modules/@deepseek-ai/dsh-token-meter/lib/index.bak-cost.js|tokenUsageByModelProjectionDefinition|dsh-token-meter.patch"
  "node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js|node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js.orig|billing-backend|dsh-host-apiproxy.patch"
  "node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js|node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.orig.js|ESTIMATED_PRICES|dsh-client-ui-conversation.patch"
  "node_modules/@deepseek-ai/dsh-client-connection/lib/client.js|node_modules/@deepseek-ai/dsh-client-connection/lib/client.js.orig-balance|hostBalanceValueSchema|dsh-client-connection.patch"
  "node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/sessions.schema.js|node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/sessions.schema.js.orig-usageonly|usageOnly|dsh-session-schema.patch"
  "node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/host.schema.js|node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/api/host.schema.js.orig-balance|hostBalanceValueSchema|dsh-host-schema.patch"
  "node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/fetch/client.js|node_modules/@deepseek-ai/dsh-host-apiproxy/lib/types/fetch/client.js.orig-balance|hostBalanceValueSchema|dsh-fetch-client.patch"
  "node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js|node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js.orig-notify|dshNotify|dsh-client-runtime-notify.patch"
)

apply_one() {
  local rel="$1" orig="$2" marker="$3" name="$4" target="$DSH_PKG/$rel"
  if [ ! -f "$target" ]; then echo "  !! 目标不存在（升级后结构变了？）：$rel"; return 1; fi
  if grep -qF "$marker" "$target" 2>/dev/null; then
    echo "  [skip] $name — 已应用"
    return 0
  fi
  local patchfile="$PATCH_DIR/$name"
  if [ ! -f "$patchfile" ]; then echo "  !! 缺补丁文件：$patchfile（先 --capture）"; return 1; fi
  echo "  [apply] $name"
  ( cd "$DSH_PKG" && patch -p0 --forward --quiet < "$patchfile" ) || { echo "  !! 补丁应用失败（上游代码可能已变化，需手动合并）：$name"; return 1; }
  if ! grep -qF "$marker" "$target"; then echo "  !! 应用后标记未出现，异常：$name"; return 1; fi
  if ! node --check "$target" 2>/dev/null; then echo "  !! 应用后语法检查失败：$name"; return 1; fi
  echo "  [ok] $name"
  return 0
}

check_one() {
  local rel="$1" marker="$3" name="$4" target="$DSH_PKG/$rel"
  if [ -f "$target" ] && grep -qF "$marker" "$target" 2>/dev/null; then
    echo "  [applied] $name"
  else
    echo "  [missing] $name"
  fi
}

revert_one() {
  local rel="$1" marker="$3" name="$4" target="$DSH_PKG/$rel" patchfile="$PATCH_DIR/$4"
  if [ ! -f "$target" ] || ! grep -qF "$marker" "$target" 2>/dev/null; then
    echo "  [skip] $name — 未应用"
    return 0
  fi
  if [ ! -f "$patchfile" ]; then echo "  !! 缺补丁文件：$patchfile"; return 1; fi
  echo "  [revert] $name"
  ( cd "$DSH_PKG" && patch -R -p0 --forward --quiet < "$patchfile" ) || { echo "  !! 回滚失败：$name"; return 1; }
  echo "  [ok] $name"
  return 0
}

capture_one() {
  local rel="$1" orig="$2" name="$4" target="$DSH_PKG/$rel"
  local orig_abs="$DSH_PKG/$orig" target_abs="$DSH_PKG/$rel"
  if [ ! -f "$orig_abs" ]; then echo "  !! 缺原始备份，无法生成补丁：$orig"; return 1; fi
  diff -u --label "$rel" --label "$rel" "$orig_abs" "$target_abs" > "$PATCH_DIR/$name" || [ $? -eq 1 ]
  echo "  [captured] $name ($(wc -l < "$PATCH_DIR/$name") 行)"
  return 0
}

echo "dsh 包根: $DSH_PKG"
echo "补丁目录: $PATCH_DIR"
mkdir -p "$PATCH_DIR"

rc=0
case "$MODE" in
  --capture)
    for p in "${PATCHES[@]}"; do IFS='|' read -r rel orig marker name <<< "$p"; capture_one "$rel" "$orig" "$marker" "$name" || rc=1; done
    ;;
  --check)
    for p in "${PATCHES[@]}"; do IFS='|' read -r rel orig marker name <<< "$p"; check_one "$rel" "$orig" "$marker" "$name"; done
    ;;
  --revert)
    for p in "${PATCHES[@]}"; do IFS='|' read -r rel orig marker name <<< "$p"; revert_one "$rel" "$orig" "$marker" "$name" || rc=1; done
    echo "回滚完成。服务重启后即回官方原版。"
    ;;
  *)
    for p in "${PATCHES[@]}"; do IFS='|' read -r rel orig marker name <<< "$p"; apply_one "$rel" "$orig" "$marker" "$name" || rc=1; done
    if [ "$rc" -eq 0 ]; then
      echo "全部补丁就绪。重启服务生效：systemctl --user restart dsh-web"
    else
      echo "存在失败的补丁，请检查上面的 !! 提示。"
    fi
    ;;
esac
exit "$rc"
