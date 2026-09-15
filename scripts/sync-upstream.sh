#!/usr/bin/env bash
# =============================================================================
# mibi-api fork 同步脚本 —— 把本地 main 与 GitHub fork 同步到上游最新
#
# 架构约定：
#   upstream  = QuantumNous/new-api   （只读，fetch 走 gh-proxy 镜像加速）
#   origin    = tanhao0068/new-api    （你的 fork，SSH 可写）
#   main      = 纯净镜像上游，禁止直接 commit
#   定制功能  = 在 feature 分支上开发，定期 rebase 到更新后的 main
#
# 用法：bash scripts/sync-upstream.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [0/4] 前置检查"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "!! 工作区有未提交改动，请先处理（commit 或 stash），避免污染 main"
  exit 1
fi
git checkout main >/dev/null 2>&1 || { echo "!! 无法切到 main，当前分支：$(git branch --show-current)"; exit 1; }

echo "==> [1/4] 拉取上游（gh-proxy 镜像）"
git fetch upstream main

echo "==> [2/4] 拉取本 fork"
git fetch origin main

echo "==> [3/4] fast-forward 本地 main → 上游最新（--ff-only 保护，有分叉会失败）"
git merge --ff-only upstream/main

echo "==> [4/4] 推送 main → 本 fork（GitHub）"
git push origin main

echo ""
echo "==> 同步完成，当前 main："
git log --oneline -1
echo "   fork 落后上游：$(git rev-list --count origin/main..upstream/main 2>/dev/null || echo '?') 提交"