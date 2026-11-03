#!/usr/bin/env bash
# install-session-notify.sh — 把 dsh-session-notify(会话完成提醒)装进当前 dsh 的 web profile
#
# 幂等;动任何文件前先备份 profile 的 package.json 与 cordis.patch.yml。
# 用法:
#   DSH_HOME=/tmp/xxx bash .../install-session-notify.sh            # 装到隔离 home(建议先这样试)
#   bash .../install-session-notify.sh --production                 # 显式确认:装到 ~/.dsh
# 回滚:
#   把打印出来的 .bak-<时间戳> 覆盖回去,并删除 <profile>/{plugins,node_modules}/dsh-session-notify
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/插件类/dsh-session-notify"

HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
PROFILE="${DSH_PROFILE:-web}"
P="$HOME_DIR/profiles/$PROFILE"
PROD_P="$HOME/.dsh/profiles/$PROFILE"
STAMP="$(date +%Y%m%d-%H%M%S)"

# 安全闸:目标解析成生产 profile 时,必须显式带 --production
# (教训 2026-10-17:harness 会把 DSH_HOME=/home/claude/.dsh 导出到 shell,
#  只判断"DSH_HOME 是否为空"根本拦不住,必须比较解析后的路径)
if [ "$P" = "$PROD_P" ] && [ "${1:-}" != "--production" ]; then
  cat >&2 <<EOF
拒绝执行:目标解析到生产 profile($PROD_P)。

  试装(隔离 home):  DSH_HOME=/tmp/dsh-try bash install-session-notify.sh
  装到生产 profile:  bash install-session-notify.sh --production

提示:本 shell 里 DSH_HOME=${DSH_HOME:-<未设置>},它会覆盖默认值。
EOF
  exit 2
fi

info() { printf '  %s\n' "$*"; }
die() { printf '错误:%s\n' "$*" >&2; exit 1; }

[ -f "$SRC/lib/index.js" ] || die "找不到插件源码:$SRC"
[ -d "$P" ] || die "找不到 profile 目录:$P(先运行一次 dsh web 生成)"

echo "═══ 安装 dsh-session-notify ═══"
info "来源:$SRC"
info "目标:$P"

# ---------- 1. 备份(动之前必须先能回退)----------
cp -a "$P/cordis.patch.yml" "$P/cordis.patch.yml.bak-$STAMP"
cp -a "$P/package.json" "$P/package.json.bak-$STAMP"
info "已备份: cordis.patch.yml.bak-$STAMP / package.json.bak-$STAMP"

# ---------- 2. 复制插件(源目录 + node_modules 副本,两处都要)----------
rm -rf "$P/plugins/dsh-session-notify" "$P/node_modules/dsh-session-notify"
mkdir -p "$P/plugins" "$P/node_modules"
cp -a "$SRC" "$P/plugins/dsh-session-notify"
cp -a "$SRC" "$P/node_modules/dsh-session-notify"
info "已复制到 plugins/ 与 node_modules/(实际加载的是 node_modules 那份)"

# ---------- 3. profile package.json 加依赖 ----------
node -e '
const fs = require("fs");
const p = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["dsh-session-notify"] = "file:plugins/dsh-session-notify";
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$P/package.json"
info "package.json 已声明依赖"

# ---------- 4. cordis.patch.yml 追加挂载行 ----------
if grep -q "dsh-session-notify" "$P/cordis.patch.yml" 2>/dev/null; then
  info "cordis.patch.yml 已含挂载行,跳过"
else
  cat >> "$P/cordis.patch.yml" <<'EOF'
- insert:
    - id: dsh-session-notify
      name: 'dsh-session-notify'
EOF
  info "cordis.patch.yml 已追加挂载行"
fi

# ---------- 5. peer 闸门:确认没有会被 0.2.0 拦下的 peer ----------
if node -e '
const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const bad=Object.keys(j.peerDependencies||{}).filter(n=>n==="@deepseek-ai/dsh"||n.startsWith("@deepseek-ai/dsh-"));
process.exit(bad.length?1:0);
' "$SRC/package.json"; then
  info "peer 声明安全(只依赖 cordis,不会被 0.2.0 的 peer 闸门拦下)"
else
  printf '  警告:peer 里含 @deepseek-ai/dsh-*,0.2.0 可能禁用本插件\n' >&2
fi

echo ""
echo "完成。下一步:"
echo "  1. 重启 dsh web(按你当前的启动方式)"
echo "  2. 验证宿主路由:curl -s http://127.0.0.1:3080/dsnf/state   # 期望 {\"ok\":true,...}"
echo "  3. 打开 设置 → 通用,应出现「会话完成提醒」卡"
echo ""
echo "回滚:"
echo "  cp -a $P/cordis.patch.yml.bak-$STAMP $P/cordis.patch.yml"
echo "  cp -a $P/package.json.bak-$STAMP $P/package.json"
echo "  rm -rf $P/plugins/dsh-session-notify $P/node_modules/dsh-session-notify"
