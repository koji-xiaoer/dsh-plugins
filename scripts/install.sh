#!/usr/bin/env bash
# ============================================================
# dsh-plugins 一键安装脚本
# 安装 dsh-mods-enhanced 插件 + ui-conversation 增强补丁
#
# 前置条件:
#   - Node.js >= 20(含 npm)
#   - 联网(npm 安装 dsh)
#
# 用法:
#   bash install.sh
# ============================================================
set -euo pipefail

DSH_VERSION="0.1.1-rc.1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PATCH_FILE="$REPO_DIR/patches/ui-conversation.patch"
PLUGIN_SRC="$REPO_DIR/插件类/dsh-mods-enhanced"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die() { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }

echo "============================================================"
echo " dsh-plugins 一键安装"
echo "============================================================"

# ---------- 1. 环境检查 ----------
command -v node >/dev/null 2>&1 || die "需要 Node.js >= 20,请先安装"
command -v npm  >/dev/null 2>&1 || die "需要 npm"
info "Node.js $(node --version) / npm $(npm --version)"

# ---------- 2. 安装 dsh + 版本检测 ----------
if command -v dsh >/dev/null 2>&1; then
  DSH_ACTUAL="$(dsh --version 2>/dev/null || echo 'unknown')"
else
  info "安装 dsh@${DSH_VERSION} ..."
  npm install -g "@deepseek-ai/dsh@${DSH_VERSION}" || die "dsh 安装失败"
  DSH_ACTUAL="$(dsh --version 2>/dev/null || echo 'unknown')"
fi
info "dsh 版本: ${DSH_ACTUAL}"

# 版本检测:ui-conversation 补丁按 DSH_VERSION 制作,版本不符时 client.js 内容不同,补丁会失效
if [ "${DSH_ACTUAL}" != "${DSH_VERSION}" ]; then
  warn "dsh 版本 ${DSH_ACTUAL} 与补丁适用版本 ${DSH_VERSION} 不一致!"
  warn "ui-conversation 补丁按 ${DSH_VERSION} 制作,版本不符时补丁很可能应用失败"
  warn "建议先执行: npm install -g @deepseek-ai/dsh@${DSH_VERSION}"
  read -r -p "是否仍继续尝试?(y/N): " choice || true
  case "${choice:-N}" in
    y|Y) warn "继续尝试,若补丁失败请先安装正确版本" ;;
    *) die "已中止,请安装 dsh@${DSH_VERSION} 后重试" ;;
  esac
fi

# ---------- 3. 定位 ui-conversation ----------
NPM_ROOT="$(npm root -g)"
UI_CONV_DIR="${NPM_ROOT}/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib"
[ -f "$UI_CONV_DIR/client.js" ] || die "找不到 ui-conversation 的 client.js: $UI_CONV_DIR"
info "ui-conversation 定位成功"

# ---------- 4. 应用 ui-conversation 增强补丁 ----------
[ -f "$PATCH_FILE" ] || die "找不到补丁: $PATCH_FILE"
cd "$UI_CONV_DIR"
# 已应用特征: 补丁里的 formatPrice 定义 + 后端计价注释
if grep -q "function formatPrice" client.js 2>/dev/null && grep -q "billing-backend" client.js 2>/dev/null; then
  info "ui-conversation 补丁已应用,跳过"
else
  # 幂等: 仅首次备份原始 client.js
  [ -f client.orig.js ] || cp client.js client.orig.js
  patch -s client.orig.js < "$PATCH_FILE" || die "补丁应用失败(dsh 版本必须是 ${DSH_VERSION})"
  cp client.orig.js client.js
  info "ui-conversation 补丁已应用"
fi

# ---------- 5. 安装 dsh-mods-enhanced 插件 ----------
[ -f "$PLUGIN_SRC/package.json" ] || die "找不到插件源码: $PLUGIN_SRC"

# 初始化 web profile(首次需运行一次 dsh web 生成目录)
if [ ! -d "$PROFILE_DIR" ]; then
  warn "初始化 web profile ..."
  timeout 20 dsh web --port 0 >/dev/null 2>&1 || true
  [ -d "$PROFILE_DIR" ] || die "web profile 初始化失败,请先手动运行 'dsh web' 一次后再执行本脚本"
fi

# 复制插件
mkdir -p "$PROFILE_DIR/plugins/dsh-mods-enhanced"
cp -r "$PLUGIN_SRC/lib" "$PROFILE_DIR/plugins/dsh-mods-enhanced/"
cp "$PLUGIN_SRC/package.json" "$PROFILE_DIR/plugins/dsh-mods-enhanced/"
info "dsh-mods-enhanced 已复制到 profile"

# 修改 profile 的 package.json(幂等添加 dependency)
node -e '
const fs = require("fs");
const p = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["dsh-mods-enhanced"] = "file:plugins/dsh-mods-enhanced";
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$PROFILE_DIR/package.json"
info "profile package.json 已更新"

# 修改 cordis.patch.yml(幂等添加 insert)
CORDIS="$PROFILE_DIR/cordis.patch.yml"
if [ -f "$CORDIS" ] && grep -q "dsh-mods-enhanced" "$CORDIS" 2>/dev/null; then
  info "cordis.patch.yml 已包含 dsh-mods-enhanced,跳过"
else
  cat >> "$CORDIS" <<'EOF'
- insert:
    - id: dsh-mods-enhanced
      name: 'dsh-mods-enhanced'
EOF
  info "cordis.patch.yml 已追加 dsh-mods-enhanced insert"
fi

# ---------- 6. 安装 profile 依赖 ----------
if command -v pnpm >/dev/null 2>&1; then
  (cd "$PROFILE_DIR" && pnpm install --silent) || warn "pnpm install 失败,可稍后手动执行"
  info "profile 依赖已安装"
else
  warn "未检测到 pnpm(可运行 'npm install -g pnpm'),插件依赖暂未安装"
  warn "可稍后执行: cd $PROFILE_DIR && pnpm install"
fi

# ---------- 7. 完成 ----------
echo ""
echo "============================================================"
echo " 安装完成!"
echo "============================================================"
echo " 下一步:"
echo "   1. 重启 dsh:  dsh web --port 3080  (或你的端口)"
echo "   2. 打开浏览器: http://127.0.0.1:3080"
echo ""
echo " 注意:"
echo "   - 图片转文字需配置智谱 API: 环境变量 ZHIPU_API_KEY"
echo "   - 余额查询需配置 DeepSeek:  环境变量 DEEPSEEK_API_KEY"
echo "============================================================"
