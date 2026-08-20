#!/usr/bin/env bash
# ============================================================
# dsh-model-select-provider-label 一键安装脚本
#
# 将模型选择器增强插件安装到 dsh web profile:
#   1. 复制插件源码 → ~/.dsh/profiles/web/plugins/
#   2. 拷贝运行副本 → ~/.dsh/profiles/web/node_modules/(file: 依赖的实际加载副本)
#   3. 幂等更新 profile package.json 的 dependencies
#   4. 幂等追加 cordis.patch.yml 的 insert 行
#   5. 可选执行 pnpm install 安装 profile 依赖
#
# 幂等:重复执行不会重复写入,已就位的内容自动跳过。
#
# 用法:
#   bash install-model-select.sh            # 安装
#   bash install-model-select.sh --check    # 只检查状态,不改动
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_SRC="$REPO_DIR/插件类/dsh-model-select-provider-label"
PLUGIN_ID="dsh-model-select-provider-label"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
MODE="${1:-install}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die() { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

echo "============================================================"
echo " dsh-model-select-provider-label 安装 (mode: ${MODE})"
echo "============================================================"

# ---------- 0. 前置检查 ----------
[ -f "$PLUGIN_SRC/package.json" ] || die "找不到插件源码: $PLUGIN_SRC"
[ -f "$PLUGIN_SRC/lib/client.js" ] || die "找不到 client.js: $PLUGIN_SRC/lib/client.js"
if [ ! -d "$PROFILE_DIR" ]; then
  die "未找到 web profile: $PROFILE_DIR (请先运行一次 'dsh web' 生成目录)"
fi

PLUGIN_DST="$PROFILE_DIR/plugins/$PLUGIN_ID"
NODE_MOD_DST="$PROFILE_DIR/node_modules/$PLUGIN_ID"

# 比较部署必需文件(README 等文档不入 profile,不参与一致性判断)
deployed_identical() {
  local src="$1" dst="$2" f
  for f in "package.json" "lib/client.js" "lib/index.js"; do
    if ! cmp -s "$src/$f" "$dst/$f" 2>/dev/null; then return 1; fi
  done
  return 0
}

# ---------- 1. 复制插件源码到 profile/plugins ----------
if deployed_identical "$PLUGIN_SRC" "$PLUGIN_DST"; then
  info "plugins/$PLUGIN_ID 已就位且一致,跳过"
else
  [ "$MODE" = "install" ] || die "--check: 插件源码未就位($PLUGIN_DST)"
  rm -rf "$PLUGIN_DST"
  mkdir -p "$PLUGIN_DST"
  cp -r "$PLUGIN_SRC/lib" "$PLUGIN_DST/"
  cp "$PLUGIN_SRC/package.json" "$PLUGIN_DST/"
  info "已复制插件源码 → plugins/$PLUGIN_ID"
fi

# ---------- 2. 拷贝运行副本到 node_modules ----------
if deployed_identical "$PLUGIN_SRC" "$NODE_MOD_DST"; then
  info "node_modules/$PLUGIN_ID 已就位且一致,跳过"
else
  [ "$MODE" = "install" ] || die "--check: node_modules 运行副本未就位($NODE_MOD_DST)"
  rm -rf "$NODE_MOD_DST"
  mkdir -p "$NODE_MOD_DST"
  cp -r "$PLUGIN_SRC/lib" "$NODE_MOD_DST/"
  cp "$PLUGIN_SRC/package.json" "$NODE_MOD_DST/"
  info "已拷贝运行副本 → node_modules/$PLUGIN_ID"
fi

# ---------- 3. 幂等更新 profile package.json ----------
PKG_FILE="$PROFILE_DIR/package.json"
if [ -f "$PKG_FILE" ] && grep -q "\"$PLUGIN_ID\"" "$PKG_FILE" 2>/dev/null; then
  info "package.json 已包含 $PLUGIN_ID,跳过"
else
  [ "$MODE" = "install" ] || die "--check: package.json 缺少依赖 $PLUGIN_ID"
  node -e '
const fs = require("fs");
const p = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["'$PLUGIN_ID'"] = "file:plugins/'$PLUGIN_ID'";
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$PKG_FILE"
  info "package.json 已添加依赖 $PLUGIN_ID"
fi

# ---------- 4. 幂等追加 cordis.patch.yml ----------
CORDIS="$PROFILE_DIR/cordis.patch.yml"
if [ -f "$CORDIS" ] && grep -q "$PLUGIN_ID" "$CORDIS" 2>/dev/null; then
  info "cordis.patch.yml 已包含 $PLUGIN_ID,跳过"
else
  [ "$MODE" = "install" ] || die "--check: cordis.patch.yml 缺少 $PLUGIN_ID insert"
  cat >> "$CORDIS" <<EOF
- insert:
    - id: $PLUGIN_ID
      name: '$PLUGIN_ID'
EOF
  info "cordis.patch.yml 已追加 $PLUGIN_ID insert"
fi

# ---------- 5. 语法校验 ----------
node --check "$PLUGIN_DST/lib/client.js" 2>/dev/null && info "client.js 语法校验通过" || die "client.js 语法错误"
node --check "$PLUGIN_DST/lib/index.js" 2>/dev/null && info "index.js 语法校验通过" || die "index.js 语法错误"

# ---------- 6. 可选安装 profile 依赖 ----------
if [ "$MODE" = "install" ] && command -v pnpm >/dev/null 2>&1; then
  (cd "$PROFILE_DIR" && pnpm install --silent) || warn "pnpm install 失败,可稍后手动执行: cd $PROFILE_DIR && pnpm install"
  info "profile 依赖已安装"
elif [ "$MODE" = "install" ]; then
  warn "未检测到 pnpm(可运行 'npm install -g pnpm'),依赖暂未安装"
  warn "可稍后执行: cd $PROFILE_DIR && pnpm install"
fi

# ---------- 7. 完成 ----------
echo ""
echo "============================================================"
echo " 安装完成!"
echo "============================================================"
echo " 下一步:"
echo "   1. 重启 dsh web:  bash ~/.dsh/scripts/restart-dsh-web.sh"
echo "   2. 浏览器强制刷新: http://127.0.0.1:3080"
echo " 验证:"
echo "   触发按钮应显示 '提供商 · 模型' (如 DeepSeek · DeepSeek-V4-Flash)"
echo "============================================================"
