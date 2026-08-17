#!/usr/bin/env python3
"""
回填 session_projcache.json:为没有缓存记录的会话补 title 投影行。

背景:2026-08-14 22:06 起 dsh-token-meter 的 tokenUsageByModel 投影单元
状态含 Map,导致投影缓存所有写路径失败(fail-soft),缓存冻结在 17:22。
本脚本直接从各会话日志(zstd)折叠标题,按缓存记录格式写入
{identity, rows:{title:{ver:1, seq, val}}},只补 title 一行
(其余投影键缺省=冷读回退,安全)。

用法:python3 backfill-projcache.py [--dry-run]
"""
import json
import os
import subprocess
import sys
import tempfile

SESSIONS_DIR = os.path.expanduser("~/.dsh/sessions")
CACHE_PATH = os.path.expanduser("~/.dsh/storages/session_projcache.json")
TITLE_VER = 1
DRY_RUN = "--dry-run" in sys.argv


def zstd_lines(path):
    out = subprocess.run(["zstd", "-dc", path], capture_output=True, check=True)
    return out.stdout.decode("utf-8", errors="replace").splitlines()


def fold_session(dirpath):
    """Return (identity, title_row) or None if the log has no title event."""
    log = os.path.join(dirpath, "session.jsonl.zstd")
    lines = zstd_lines(log)
    if not lines:
        return None
    header = json.loads(lines[0])
    if header.get("type") != "session":
        return None
    identity = {"createdAt": header["createdAt"]}
    if header.get("cwd") is not None:
        identity["cwd"] = header["cwd"]
    last_title = None
    for line in lines[1:]:
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("type") == "session/title":
            last_title = (e.get("seq"), (e.get("data") or {}).get("title"))
    if last_title is None:
        return None
    seq, title = last_title
    row = {"ver": TITLE_VER, "seq": seq, "val": title}
    return identity, row


def main():
    with open(CACHE_PATH) as f:
        cache = json.load(f)
    sessions = cache.setdefault("tables", {}).setdefault("sessions", {})
    added = []
    refreshed = []
    for root, dirs, _files in os.walk(SESSIONS_DIR):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for entry in dirs:
            dirpath = os.path.join(root, entry)
            if not entry.startswith("session-"):
                continue
            folded = fold_session(dirpath)
            if folded is None:
                continue
            identity, row = folded
            if entry not in sessions:
                sessions[entry] = {"identity": identity, "rows": {"title": row}}
                added.append(entry)
                print(f"  add  {entry}  title={row['val']!r} seq={row['seq']}")
                continue
            old = sessions[entry].get("rows", {}).get("title")
            if old is None or old.get("val") != row["val"] or old.get("seq") != row["seq"]:
                sessions[entry].setdefault("rows", {})["title"] = row
                refreshed.append(entry)
                print(f"  refr {entry}  title={row['val']!r} seq={row['seq']} (was {old})")

    if DRY_RUN:
        print(f"[dry-run] would add {len(added)} and refresh {len(refreshed)}; file not written")
        return
    if not added and not refreshed:
        print("nothing to do")
        return
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(CACHE_PATH), prefix=".projcache-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CACHE_PATH)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    print(f"[ok] wrote {len(added)} records to {CACHE_PATH}")


if __name__ == "__main__":
    main()
