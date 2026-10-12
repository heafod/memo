#!/usr/bin/env bash
# check-r-refs.sh —— 测试标注的 R# 须在对应 spec 中存在
#
# 定义来源：SPEC_REF（默认 = BASE_REF = origin/main）上 intent/NNN-spec.md 中
#   行首的需求定义行（形如 `- R10. …`、`- R4b. …`）。取基线 ref 而非工作区，
#   防止同一变更既改标准又自证（intent/README.md 反作弊不变量）。
# 标注来源：backend/ 与 frontend/ 下的测试文件（*/tests/*、*/__tests__/*、
#   test_*.py、*.test.*、*.spec.*）。
# 规则：跨链引用 `NNN/R#` 须在该链 spec 中存在；裸 `R#` 须在至少一个 spec
#   中存在（单链现状下等价于「对应 spec」，多链并行后按需收紧）。
#
# 环境变量：
#   BASE_REF  基线 ref（默认 origin/main）
#   SPEC_REF  读 spec 定义的 ref（默认 = BASE_REF）
#
# 本地等价运行（在仓库内任意子目录）：
#   BASE_REF=origin/main bash .github/scripts/check-r-refs.sh
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
SPEC_REF="${SPEC_REF:-$BASE_REF}"
ANNOTATION_ROOTS="backend frontend"

say() { printf '%s\n' "$*"; }
say_err() { printf '%s\n' "$*" >&2; }

cd "$(git rev-parse --show-toplevel)"

# ---------- 1. 收集 spec 定义：defs 每行 "NNN Rn" ----------
spec_files="$(git ls-tree -r --name-only "$SPEC_REF" -- intent | grep -E '^intent/[0-9]{3}-spec\.md$' || true)"
if [[ -z "$spec_files" ]]; then
  say_err "FAIL：$SPEC_REF 上未找到 intent/NNN-spec.md——无法执行 R# 存在性检查"
  exit 1
fi

defs=""
chains=""
while IFS= read -r spec; do
  [[ -z "$spec" ]] && continue
  base_name="${spec##*/}"
  chain="${base_name%-spec.md}"
  chains="$chains $chain"
  rs="$(git show "$SPEC_REF:$spec" |
    grep -oE '^[[:space:]]*[-*]?[[:space:]]*R[0-9]+[a-z]?\.' |
    grep -oE 'R[0-9]+[a-z]?' || true)"
  while IFS= read -r r; do
    [[ -z "$r" ]] && continue
    defs="$defs$chain $r"$'\n'
  done <<<"$rs"
done <<<"$spec_files"

has_any_r() { grep -q " $1\$" <<<"$defs"; }
has_chain_r() { grep -qx "$1 $2" <<<"$defs"; }

# ---------- 2. 收集测试文件的 R# 标注 ----------
files="$({ for root in $ANNOTATION_ROOTS; do
  [[ -d "$root" ]] || continue
  find "$root" -type f \
    \( -path '*/tests/*' -o -path '*/__tests__/*' \
    -o -name 'test_*.py' -o -name '*_test.py' \
    -o -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.js' -o -name '*.test.jsx' \
    -o -name '*.spec.ts' -o -name '*.spec.tsx' -o -name '*.spec.js' -o -name '*.spec.jsx' \) \
    -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/dist/*' \
    -not -path '*/__pycache__/*' -not -path '*/.pytest_cache/*' \
    -not -name '*.pyc' -not -name '*.pyo'
done; } | sort)"

say "== R# 存在性检查（定义源：${SPEC_REF} 上的 spec；标注源：${ANNOTATION_ROOTS}）=="

if [[ -z "$files" ]]; then
  say "PASS：未发现测试文件，无 R# 标注需核对"
  exit 0
fi

total=0
violations=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue

  # 跨链引用 NNN/R#
  cross="$(grep -oE '[0-9]{3}/R[0-9]+[a-z]?' "$f" || true)"
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    total=$((total + 1))
    chain="${ref%%/*}"
    r="${ref#*/}"
    if ! has_chain_r "$chain" "$r"; then
      violations="${violations}${f}: ${ref}（${chain}-spec 未定义该需求）"$'\n'
    fi
  done <<<"$cross"

  # 裸 R#（排除跨链引用的 R 部分：R 前不得是 / 或字母数字）
  # 不用 sed：BSD sed 在非 UTF-8 locale 下对多字节输入报 "illegal byte sequence"
  bare="$(grep -oE '(^|[^0-9A-Za-z_/])R[0-9]+[a-z]?' "$f" |
    grep -oE 'R[0-9]+[a-z]?' || true)"
  while IFS= read -r r; do
    [[ -z "$r" ]] && continue
    total=$((total + 1))
    if ! has_any_r "$r"; then
      violations="${violations}${f}: ${r}（任何 spec 均未定义该需求）"$'\n'
    fi
  done <<<"$bare"
done <<<"$files"

file_count="$(printf '%s\n' "$files" | grep -c . || true)"
say "扫描 $file_count 个测试文件、$total 条 R# 标注；已定义链：$chains"

if [[ -n "$violations" ]]; then
  say ""
  say "FAIL：以下标注的 R# 在对应 spec 中不存在（须先修订 spec 并接受，再引用）："
  printf '%s' "$violations" | sort -u | while IFS= read -r line; do
    [[ -n "$line" ]] && say "  - $line"
  done
  exit 1
fi

say "PASS：全部标注的 R# 均在对应 spec 中存在"
