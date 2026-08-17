#!/usr/bin/env bash
# restart-dsh-web.sh — 重启 3080 端口的 dsh web 服务（与现有进程同命令）。
# 用法：bash restart-dsh-web.sh [delay_seconds]
set -u

DELAY="${1:-0}"
[ "$DELAY" -gt 0 ] 2>/dev/null && { echo "等待 ${DELAY}s 后重启（让当前回合消息先落盘）..."; sleep "$DELAY"; }

DSH_NODE=/home/claude/.nvm/versions/node/v24.19.0/bin/node
DSH_BIN=/home/claude/.nvm/versions/node/v24.19.0/lib/node_modules/@deepseek-ai/dsh/lib/bin.js
LOG_DIR=/home/claude/.dsh/logs
mkdir -p "$LOG_DIR"

# 1. 找到并停止现有 dsh web 进程
OLD_PID=$(pgrep -f "dsh/lib/bin.js web --host 127.0.0.1 --port 3080" | head -1)
if [ -n "${OLD_PID:-}" ]; then
  echo "停止旧进程 PID=$OLD_PID ..."
  kill "$OLD_PID"
  for _ in $(seq 1 30); do
    kill -0 "$OLD_PID" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "超时未退出，强制 SIGKILL"
    kill -9 "$OLD_PID"
  fi
else
  echo "未找到运行中的 dsh web 进程"
fi

# 2. 以同样命令拉起（setsid 脱离会话，重启后本脚本退出不影响服务）
echo "启动新进程：$DSH_NODE $DSH_BIN web --host 127.0.0.1 --port 3080"
cd /home/claude
setsid nohup "$DSH_NODE" "$DSH_BIN" web --host 127.0.0.1 --port 3080 >> "$LOG_DIR/web.log" 2>&1 &
NEW_PID=$!
echo "新进程 PID=$NEW_PID，日志：$LOG_DIR/web.log"

# 3. 等待端口就绪
for i in $(seq 1 60); do
  if curl -s -o /dev/null -m 2 http://127.0.0.1:3080/; then
    echo "端口 3080 就绪（${i}s）"
    exit 0
  fi
  sleep 1
done
echo "!! 60s 内端口未就绪，请检查 $LOG_DIR/web.log"
exit 1
