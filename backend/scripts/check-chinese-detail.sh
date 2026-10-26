#!/usr/bin/env bash
# check-chinese-detail.sh —— 扫描 backend/app 中模板英文固定串（R8 / PR-12）
#
# 命中 FastAPI / 模板常见英文 detail（如 "not found"、"Incorrect"）即失败。
# 只扫 .py 源码中的字符串字面量语境；校验 type 键名（extra_forbidden 等）不在此列。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT/backend/app"

# 模板 / 框架常见英文 detail 固定串（大小写不敏感整词或常见短语）
PATTERNS=(
  'not found'
  'Incorrect'
  'Unauthorized'
  'Forbidden'
  'Internal Server Error'
  'Method Not Allowed'
  'Could not validate'
  'Not authenticated'
  'Invalid credentials'
  'Bad Request'
  'Conflict'
  'Unprocessable'
  'File too large'
  'Unsupported'
)

say() { printf '%s\n' "$*"; }
say_err() { printf '%s\n' "$*" >&2; }

if [[ ! -d "$APP" ]]; then
  say_err "FAIL：找不到 $APP"
  exit 2
fi

hits=0
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for pat in "${PATTERNS[@]}"; do
  # -n 行号；-i 忽略大小写；限定字符串字面量里出现（粗筛：两侧有引号）
  if grep -RIn --include='*.py' -E "['\"][^'\"]*${pat}[^'\"]*['\"]" "$APP" >"$tmp" 2>/dev/null; then
    while IFS= read -r line; do
      # 跳过注释行（行首可选空白 + #）
      code="${line#*:}"
      code="${code#*:}"
      if [[ "$code" =~ ^[[:space:]]*# ]]; then
        continue
      fi
      # 跳过校验 type 键映射表左侧的英文字符串（"extra_forbidden": "中文"）
      # 以及纯键名赋值；保留 detail= / HTTPException / raise 语境与裸英文 detail
      if [[ "$code" =~ \"[a-z_]+\"[[:space:]]*:[[:space:]]*\"[^\"]*[\u4e00-\u9fff] ]]; then
        continue
      fi
      say_err "HIT: $line"
      hits=$((hits + 1))
    done <"$tmp"
  fi
done

if ((hits > 0)); then
  say_err "FAIL：backend/app 发现 $hits 处模板英文固定串（R8 要求 detail 中文）"
  exit 1
fi

say "PASS：backend/app 无模板英文固定串（扫描 ${#PATTERNS[@]} 类短语）"
