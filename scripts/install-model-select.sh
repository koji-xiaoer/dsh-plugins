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
# 回滚支持:
#   - 安装前自动备份 profile 相关文件到 $BACKUP_DIR(固定位置,每次覆盖)
#   - 安装中任一步失败 → 自动回滚到备份状态
#   - 手动回滚: bash install-model-select.sh --rollback
#
# 用法:
#   bash install-model-select.sh            # 安装(失败自动回滚)
#   bash install-model-select.sh --check    # 只检查状态,不改动
#   bash install-model-select.sh --rollback # 用最近一次备份回滚安装
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
# 兼容从 ~/.dsh/scripts/ 等外部目录运行时(脚本被复制出去但插件源码留在仓库):
# 依次尝试:脚本同级的仓库根 → 常见仓库位置 → ~/.dsh/scripts 同级的仓库根
find_plugin_src() {
  local candidates=(
    "$REPO_DIR/插件类/dsh-model-select-provider-label"
    "$HOME/dsh-plugins/插件类/dsh-model-select-provider-label"
    "$HOME/.dsh/scripts/../dsh-plugins/插件类/dsh-model-select-provider-label"
  )
  for c in "${candidates[@]}"; do
    if [ -f "$c/package.json" ]; then echo "$c"; return 0; fi
  done
  return 1
}
PLUGIN_SRC="$(find_plugin_src || echo "$REPO_DIR/插件类/dsh-model-select-provider-label")"
PLUGIN_ID="dsh-model-select-provider-label"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
MODE="${1:-install}"
BACKUP_DIR="$DSH_HOME/profiles/web/.install-backup-$PLUGIN_ID"
# 目标路径(需在 --rollback 分支之前定义)
PLUGIN_DST="$PROFILE_DIR/plugins/$PLUGIN_ID"
NODE_MOD_DST="$PROFILE_DIR/node_modules/$PLUGIN_ID"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die() {
  echo -e "${RED}[✗]${NC} $*" >&2
  if [ "${BACKUP_ACTIVE:-0}" = "1" ]; then
    rollback
  fi
  exit 1
}

# 安装前快照:备份所有会被修改的 profile 文件,并记录哪些原本存在
create_backup() {
  rm -rf "$BACKUP_DIR"
  mkdir -p "$BACKUP_DIR"
  : > "$BACKUP_DIR/manifest"
  local f
  for f in "package.json" "cordis.patch.yml"; do
    if [ -f "$PROFILE_DIR/$f" ]; then
      cp "$PROFILE_DIR/$f" "$BACKUP_DIR/$f"
      echo "$f" >> "$BACKUP_DIR/manifest"
    fi
  done
  if [ -d "$PLUGIN_DST" ]; then
    cp -r "$PLUGIN_DST" "$BACKUP_DIR/plugins-dst"
    echo "plugins-dst" >> "$BACKUP_DIR/manifest"
  fi
  if [ -d "$NODE_MOD_DST" ]; then
    cp -r "$NODE_MOD_DST" "$BACKUP_DIR/node-mod-dst"
    echo "node-mod-dst" >> "$BACKUP_DIR/manifest"
  fi
  BACKUP_ACTIVE=1
  info "已创建安装前备份 → $BACKUP_DIR"
}

# 回滚:删除当前安装产物,从备份恢复(备份缺失的文件恢复为"不存在"状态)
rollback() {
  warn "回滚到安装前状态 ..."
  # 先移除当前安装产物
  rm -rf "$PLUGIN_DST" "$NODE_MOD_DST"
  # 从备份恢复(manifest 里列出的项)
  if [ -f "$BACKUP_DIR/manifest" ]; then
    while IFS= read -r f; do
      case "$f" in
        package.json|cordis.patch.yml)
          [ -f "$BACKUP_DIR/$f" ] && cp "$BACKUP_DIR/$f" "$PROFILE_DIR/$f"
          ;;
        plugins-dst)
          [ -d "$BACKUP_DIR/plugins-dst" ] && cp -r "$BACKUP_DIR/plugins-dst" "$PLUGIN_DST"
          ;;
        node-mod-dst)
          [ -d "$BACKUP_DIR/node-mod-dst" ] && cp -r "$BACKUP_DIR/node-mod-dst" "$NODE_MOD_DST"
          ;;
      esac
    done < "$BACKUP_DIR/manifest"
  fi
  BACKUP_ACTIVE=0
  rm -rf "$BACKUP_DIR"
  info "回滚完成"
}

# --rollback 模式:直接回滚并退出(无需其他检查)
if [ "$MODE" = "--rollback" ]; then
  if [ -f "$BACKUP_DIR/manifest" ]; then
    info "发现备份,开始回滚"
    rollback
    echo ""
    echo " 回滚完成。如需重新安装: bash install-model-select.sh"
    echo " 然后重启 dsh web: bash ~/.dsh/scripts/restart-dsh-web.sh"
    exit 0
  else
    warn "未找到备份($BACKUP_DIR),无法回滚(可能从未安装过)"
    exit 1
  fi
fi

echo "============================================================"
echo " dsh-model-select-provider-label 安装 (mode: ${MODE})"
echo "============================================================"

# ---------- 0. 前置检查 ----------
[ -f "$PLUGIN_SRC/package.json" ] || die "找不到插件源码: $PLUGIN_SRC"
[ -f "$PLUGIN_SRC/lib/client.js" ] || die "找不到 client.js: $PLUGIN_SRC/lib/client.js"
if [ ! -d "$PROFILE_DIR" ]; then
  die "未找到 web profile: $PROFILE_DIR (请先运行一次 'dsh web' 生成目录)"
fi

# ============================================================
# 版本检查 + 兼容性检查
#
# 本插件适配的 dsh 版本。版本一致时直接安装;
# 版本不一致时,先做接口级兼容性检查——本插件依赖的全部
# 关键符号都在目标 dsh 安装中可用才允许继续,否则中止。
# ============================================================
REQUIRED_DSH_VERSION="${REQUIRED_DSH_VERSION:-0.1.1-rc.1}"

# 定位全局 dsh 包根(兼容 npm/pnpm 布局;可用 DSH_PKG 环境变量显式指定)
locate_dsh_pkg() {
  if [ -n "${DSH_PKG:-}" ] && [ -f "$DSH_PKG/package.json" ]; then
    echo "$DSH_PKG"
    return 0
  fi
  if command -v dsh >/dev/null 2>&1; then
    local bin; bin="$(command -v dsh)"
    local real; real="$(readlink -f "$bin" 2>/dev/null || echo "$bin")"
    local dir; dir="$(dirname "$real")"
    # bin.js 上一级为包根
    echo "$(cd "$dir/.." && pwd)"
  elif [ -n "${NODE_PATH:-}" ]; then
    echo "${NODE_PATH%%:*}@deepseek-ai/dsh"
  else
    echo ""
  fi
}

DSH_PKG="$(locate_dsh_pkg)"
if [ -z "$DSH_PKG" ] || [ ! -f "$DSH_PKG/package.json" ]; then
  die "无法定位 dsh 包根(未安装 dsh? 请先 npm install -g @deepseek-ai/dsh)"
fi

ACTUAL_DSH_VERSION="$(node -p "require('$DSH_PKG/package.json').version" 2>/dev/null || echo 'unknown')"
info "dsh 版本: ${ACTUAL_DSH_VERSION} (插件适配: ${REQUIRED_DSH_VERSION})"

# 兼容性检查:逐项验证插件依赖的接口符号在目标 dsh 中可用
check_compat() {
  local ok=1 item file pat
  check_sym() { # item, file, pattern
    item="$1"; file="$2"; pat="$3"
    if [ -f "$file" ] && grep -qE "$pat" "$file" 2>/dev/null; then
      info "  [兼容] $item"
    else
      warn "  [缺失] $item (未在 $file 中找到 $pat)"
      ok=0
    fi
  }
  # check_sym_any: 多个候选文件任一命中即视为兼容(适配不同版本布局)
  check_sym_any() { # item, pattern, file...
    item="$1"; pat="$2"; shift 2
    for f in "$@"; do
      if [ -f "$f" ] && grep -qE "$pat" "$f" 2>/dev/null; then
        info "  [兼容] $item"
        return 0
      fi
    done
    warn "  [缺失] $item (候选文件均未找到 $pat: $*)"
    ok=0
  }
  local NM="$DSH_PKG/node_modules/@deepseek-ai"
  echo "── 接口级兼容性检查 ──"
  check_sym "modelDirectories 会话服务" "$NM/dsh-client-ui-model-selection/lib/client.js" "modelDirectories"
  check_sym "conversation.input.model seat" "$NM/dsh-client-ui-model-selection/lib/client.js" "conversation\.input\.model"
  # slots 服务:rc.6 为独立包 dsh-client-ui-slots;0.1.1 起并入 dsh-client-runtime(前端 bundle 平台模块)
  check_sym_any "slots.register 的 priority 语义" "priority" \
    "$NM/dsh-client-ui-slots/lib/index.js" \
    "$NM/dsh-client-runtime/lib/client.js"
  check_sym "ModelDirectory store(createSnapshotStore)" "$NM/dsh-client-ui-model-selection/lib/client.js" "createSnapshotStore"
  check_sym "session.models 目录 RPC" "$NM/dsh-client-connection/lib/client.js" "\.models\b"
  check_sym "locale active 快照字段" "$NM/dsh-client-locale/lib/client.js" "active"
  check_sym "__ModuleLoader__ 加载机制" "$NM/dsh-client-ui-model-selection/lib/client.js" "__ModuleLoader__"
  check_sym "dsh-client-runtime(静态插件注入链)" "$NM/dsh-client-runtime/lib/index.js" "apply|inject"
  check_sym "dsh-client-ui-conversation(composer.bar 宿主)" "$NM/dsh-client-ui-conversation/lib/client.js" "conversation\.composer\.bar|composer\.bar"
  [ "$ok" = "1" ] && { info "兼容性检查全部通过"; return 0; }
  warn "存在缺失项,建议升级/降级到适配版本 ${REQUIRED_DSH_VERSION} 后再安装"
  return 1
}

if [ "$ACTUAL_DSH_VERSION" = "$REQUIRED_DSH_VERSION" ]; then
  info "版本一致,直接安装"
else
  warn "版本不一致: 当前 ${ACTUAL_DSH_VERSION} ≠ 适配 ${REQUIRED_DSH_VERSION}"
  if [ "$MODE" = "install" ]; then
    if check_compat; then
      echo ""
      warn "接口兼容性检查通过,继续安装"
    else
      echo ""
      die "接口兼容性检查未通过:插件依赖的接口在当前 dsh 版本中不可用,拒绝安装"
    fi
  else
    # --check 模式:报告但不停(由最终汇总决定)
    check_compat || true
  fi
fi

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
  create_backup
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
  [ "${BACKUP_ACTIVE:-0}" = "1" ] || create_backup
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
  [ "${BACKUP_ACTIVE:-0}" = "1" ] || create_backup
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
  [ "${BACKUP_ACTIVE:-0}" = "1" ] || create_backup
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
if [ -d "$BACKUP_DIR" ]; then
  echo ""
  echo " 回滚:"
  echo "   如需撤销本次安装: bash install-model-select.sh --rollback"
  echo "   (备份位于: $BACKUP_DIR)"
fi
echo "============================================================"
