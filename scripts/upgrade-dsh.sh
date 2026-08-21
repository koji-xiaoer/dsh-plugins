#!/usr/bin/env bash
# ============================================================
# upgrade-dsh.sh — 一键升级 dsh 并恢复全部自定义增强
#
# 处理链(与手工操作一一对应,避免升级后启动不起来):
#   1. npm 全局安装目标版本 dsh
#   2. 重放 ~/.dsh/patches/ 的全部补丁(reapply-dsh-mods.sh,8 个,幂等)
#   3. 同步裁剪版 host 插件进 web profile(覆盖 git 安装的旧版,去掉图片中继)
#   4. 重启 dsh-web 服务(systemd user 服务)
#
# 用法:
#   bash scripts/upgrade-dsh.sh               # 默认升级到 0.1.1-rc.1
#   bash scripts/upgrade-dsh.sh 0.1.1-rc.1    # 指定版本
#   bash scripts/upgrade-dsh.sh --check       # 只检查当前状态,不改动
# ============================================================
set -euo pipefail

TARGET="${1:-0.1.1-rc.1}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
REAPPLY="$REPO_DIR/scripts/reapply-dsh-mods.sh"
REAPPLY_HOME="$DSH_HOME/scripts/reapply-dsh-mods.sh"
PLUGIN_SRC="$REPO_DIR/插件类/dsh-mods-enhanced/lib/index.js"
PLUGIN_DST="$PROFILE_DIR/node_modules/dsh-mods-enhanced/插件类/dsh-mods-enhanced/lib/index.js"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die() { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

check_only() {
  local rc=0
  echo "== dsh 版本 =="
  node -p "require('$(npm root -g)/@deepseek-ai/dsh/package.json').version" 2>/dev/null || echo "未安装"
  echo "== 补丁状态 =="
  if [ -f "$REAPPLY_HOME" ]; then bash "$REAPPLY_HOME" --check || rc=1; fi
  echo "== profile host 插件 =="
  if [ -f "$PLUGIN_DST" ]; then
    if grep -q "relayImage" "$PLUGIN_DST" 2>/dev/null; then warn "仍是旧版(含图片中继),升级后需同步"; else info "裁剪版(无图片中继)"; fi
  else
    warn "profile 中未找到 dsh-mods-enhanced"
  fi
  echo "== 模型选择插件接口兼容性 =="
  if [ -f "$REPO_DIR/scripts/install-model-select.sh" ] || [ -f "$HOME/.dsh/scripts/install-model-select.sh" ]; then
    if bash "$( [ -f "$REPO_DIR/scripts/install-model-select.sh" ] && echo "$REPO_DIR/scripts/install-model-select.sh" || echo "$HOME/.dsh/scripts/install-model-select.sh" )" --check >/dev/null 2>&1; then info "兼容"; else warn "存在缺失项(见上方明细)"; rc=1; fi
  else
    warn "未找到 install-model-select.sh"
  fi
  echo "== 服务 =="
  systemctl --user is-active dsh-web 2>/dev/null || echo "dsh-web 未运行"
  return $rc
}

if [ "${TARGET}" = "--check" ]; then check_only; exit $?; fi

echo "============================================================"
echo " dsh 一键升级 → ${TARGET}"
echo "============================================================"

# ---------- 1. npm 全局安装 ----------
info "安装 @deepseek-ai/dsh@${TARGET} ..."
npm i -g "@deepseek-ai/dsh@${TARGET}" || die "dsh 安装失败"

# ---------- 2. 重放补丁 ----------
info "重放自定义补丁 ..."
if [ -f "$REAPPLY" ]; then bash "$REAPPLY" || die "补丁重放失败(见上方 !! 提示)"
elif [ -f "$REAPPLY_HOME" ]; then bash "$REAPPLY_HOME" || die "补丁重放失败"
else die "找不到 reapply-dsh-mods.sh"
fi

# ---------- 3. 兼容性检测(模型选择插件接口,适配新旧版本布局) ----------
if [ -f "$REPO_DIR/scripts/install-model-select.sh" ] || [ -f "$HOME/.dsh/scripts/install-model-select.sh" ]; then
  info "模型选择插件接口兼容性检测 ..."
  if bash "$( [ -f "$REPO_DIR/scripts/install-model-select.sh" ] && echo "$REPO_DIR/scripts/install-model-select.sh" || echo "$HOME/.dsh/scripts/install-model-select.sh" )" --check >/dev/null 2>&1; then
    info "兼容性检测通过"
  else
    warn "兼容性检测未完全通过(不影响升级本身;可稍后手动处理 model-select 插件)"
  fi
else
  warn "未找到 install-model-select.sh,跳过兼容性检测"
fi

# ---------- 4. 同步 host 插件进 profile ----------
if [ -d "$(dirname "$PLUGIN_DST")" ]; then
  info "同步 host 插件(裁剪版,去图片中继) → profile ..."
  cp "$PLUGIN_SRC" "$PLUGIN_DST"
  node --check "$PLUGIN_DST" || die "同步后的 host 插件语法检查失败"
  if grep -q "relayImage" "$PLUGIN_DST" 2>/dev/null; then warn "同步后仍含 relayImage(来源仓库未裁剪?)"; else info "host 插件已裁剪(无图片中继)"; fi
else
  warn "profile 中无 dsh-mods-enhanced,跳过插件同步(若使用 git 安装请先 pnpm update)"
fi

# ---------- 5. 重启服务 ----------
info "重启 dsh-web ..."
if systemctl --user restart dsh-web 2>/dev/null; then
  sleep 4
  systemctl --user is-active dsh-web >/dev/null 2>&1 && info "dsh-web 已重启并运行" || die "dsh-web 重启后未运行,请查看: journalctl --user -u dsh-web -n 50"
else
  warn "systemd 服务不可用,请手动重启: dsh web --port 3080"
fi

echo "============================================================"
echo " 升级完成。刷新浏览器即可看到新版本 UI(账单/余额/用量/提醒保留,折叠与图片中继已移除)"
echo "============================================================"
