#!/usr/bin/env bash
# check-pr-subset.sh —— PR 变更文件 ⊆ plan「变更的文件」清单
#
# 基准：最近一次 accepted 的 plan（PLAN_REF 指向的版本，默认 = BASE_REF），
# 而非 PR 内改后的清单——把关标准不可由被把关的一方在同一变更中修改。
# 清单来源：plan 中「## 变更的文件」节下第一个 ``` 代码块，逐行一个 glob。
# 白名单（intent/README.md「PR⊆plan 检查」）：.tmp/、锁文件、生成物放行。
#
# 两处硬化（PR-2，intent/001-plan.md 批次 3）：
#   ① 保护路径（.github/**、根 compose*.yml、pyproject.toml、uv.lock、
#      frontend/package.json、Dockerfile）改动单独标记，且必须出现在 PR 描述
#      的「## 保护路径变更」节内（逐条列明路径），否则失败；
#   ② 清单外变更：修改 / 删除既有文件 = 子集违规，直接失败；新增文件 ≤3 且不在
#      保护路径、不处于新顶级目录时，须在 PR 描述「## 实施中新增（逐条理由）」
#      节内逐条列明；>3、命中保护路径、或出现基线中不存在的新顶级目录 → 转人评
#      （失败并提示 plan 回 in-review 重批）。
#
# 环境变量：
#   BASE_REF  基线的 git ref（默认 origin/main），与 HEAD_REF 求 merge-base
#   PLAN_REF  读基线 plan 的 ref（默认 = BASE_REF）
#   HEAD_REF  被检查的 git ref（默认 HEAD；CI 中为检出的 PR 合并提交）
#   PR_BODY   PR 描述原文（CI 传 github.event.pull_request.body；本地可省略）
#
# 本地等价运行（在仓库内任意子目录）：
#   BASE_REF=origin/main HEAD_REF=001/pr-2 PR_BODY="$(cat .tmp/pr-2-pr-body.md)" \
#     bash .github/scripts/check-pr-subset.sh
set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"
PLAN_REF="${PLAN_REF:-$BASE_REF}"
HEAD_REF="${HEAD_REF:-HEAD}"
PLAN_PATH="${PLAN_PATH:-intent/001-plan.md}"
PR_BODY="${PR_BODY:-}"

say() { printf '%s\n' "$*"; }
say_err() { printf '%s\n' "$*" >&2; }

print_list() {
  local line
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    printf '  - %s\n' "$line"
  done <<<"$1"
}

cd "$(git rev-parse --show-toplevel)"

# ---------- 1. 取基线 plan 清单 ----------
if ! git cat-file -e "$PLAN_REF:$PLAN_PATH" 2>/dev/null; then
  say_err "FAIL：基线 ref 中不存在 $PLAN_PATH（PLAN_REF=$PLAN_REF）——无法核对子集"
  exit 1
fi

plan_list="$(git show "$PLAN_REF:$PLAN_PATH" | awk '
  /^## 变更的文件/ { sec = 1; next }
  sec && /^```/ { if (fence) exit; fence = 1; next }
  sec && fence { print }
')"

if [[ -z "${plan_list//[$' \t\n']/}" ]]; then
  say_err "FAIL：无法从 $PLAN_REF:$PLAN_PATH 解析「变更的文件」清单（期望 ## 变更的文件 节后跟围栏代码块，逐行一个 glob）"
  exit 1
fi

# ---------- 2. 取变更文件 ----------
merge_base="$(git merge-base "$BASE_REF" "$HEAD_REF")"
changed="$(git diff --name-only --no-renames "$merge_base" "$HEAD_REF")"
added="$(git diff --diff-filter=A --name-only --no-renames "$merge_base" "$HEAD_REF")"
baseline_roots="$(git ls-tree --name-only "$BASE_REF" | sed 's#/$##')"

matches_plan() {
  local path="$1" pattern
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # shellcheck disable=SC2254 # 刻意让 plan 清单里的 glob 按模式匹配（如 backend/**）
    case "$path" in
      $pattern) return 0 ;;
    esac
  done <<<"$plan_list"
  return 1
}

is_whitelisted() {
  case "$1" in
    .tmp/* | *.lock | *package-lock.json | *.lockb | */dist/* | dist/* | */htmlcov/* | */node_modules/*)
      return 0
      ;;
  esac
  return 1
}

is_protected() {
  case "$1" in
    .github/*) return 0 ;;
    compose*.yml) return 0 ;;
    pyproject.toml | */pyproject.toml) return 0 ;;
    uv.lock | */uv.lock) return 0 ;;
    frontend/package.json) return 0 ;;
    Dockerfile | */Dockerfile) return 0 ;;
  esac
  return 1
}

is_in_list() {
  local needle="$1" line
  while IFS= read -r line; do
    [[ "$line" == "$needle" ]] && return 0
  done <<<"$2"
  return 1
}

in_plan_count=0
out_modified=""   # 清单外修改 / 删除（子集违规）
out_added=""      # 清单外新增（≤3 可随评，需 PR 描述列明）
out_added_protected=""
protected_hits="" # 全部保护路径改动（含清单内）
new_dirs=""

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if matches_plan "$path"; then
    in_plan_count=$((in_plan_count + 1))
  elif ! is_whitelisted "$path"; then
    if is_in_list "$path" "$added"; then
      out_added="$out_added$path"$'\n'
      if is_protected "$path"; then
        out_added_protected="$out_added_protected$path"$'\n'
      fi
    else
      out_modified="$out_modified$path"$'\n'
    fi
  fi
  if is_protected "$path"; then
    protected_hits="$protected_hits$path"$'\n'
  fi
done <<<"$changed"

while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  matches_plan "$path" && continue
  is_whitelisted "$path" && continue
  case "$path" in
    */*) seg="${path%%/*}" ;;
    *) continue ;;
  esac
  if ! grep -qxF "$seg" <<<"$baseline_roots"; then
    new_dirs="$new_dirs$path（新顶级目录 $seg/）"$'\n'
  fi
done <<<"$out_added"

out_added_count="$(grep -c . <<<"$out_added" || true)"
out_modified_count="$(grep -c . <<<"$out_modified" || true)"

# ---------- 3. 输出与判定 ----------
say "== PR⊆plan 检查（基准：$PLAN_REF:$PLAN_PATH）=="
say "变更文件 $in_plan_count 个在清单内；清单外：新增 ${out_added_count:-0} 个、修改/删除 ${out_modified_count:-0} 个（白名单未计）"

if [[ -n "$protected_hits" ]]; then
  say ""
  say "[保护路径] 以下改动高风险，须人工复核（CI／基础设施／依赖面）："
  print_list "$protected_hits"
fi

# ② 硬失败：清单外修改 / 删除，或新增转人评条件
if [[ -n "$out_modified" ]]; then
  say ""
  say "FAIL（子集违规）：以下文件既不在 plan 清单内，也不是新增文件（修改/删除既有文件）："
  print_list "$out_modified"
  say "      按 intent/README.md，变更文件须为基线 plan 清单子集；请还原这些文件，或先修订并接受 plan"
  say "      （plan 修订须独立成 commit：docs(plan): 实施偏离更新）。"
  exit 1
fi

if [[ $out_added_count -gt 3 || -n "$new_dirs" || -n "$out_added_protected" ]]; then
  say ""
  [[ $out_added_count -gt 3 ]] && { say "清单外新增文件 $out_added_count 个（>3）："; print_list "$out_added"; }
  [[ -n "$new_dirs" ]] && { say "出现基线中不存在的新顶级目录："; print_list "$new_dirs"; }
  [[ -n "$out_added_protected" ]] && { say "清单外新增命中保护路径："; print_list "$out_added_protected"; }
  say ""
  say "FAIL：本 PR 变更超出自律范围——转人评。按 intent/README.md，实质性扩圈须 plan 回 in-review"
  say "      重批后方可合并；请拆分本 PR 或先修订 plan（独立成 commit）。"
  exit 1
fi

problems=0

if [[ -n "$out_added" ]]; then
  if [[ "$PR_BODY" != *"实施中新增"* ]]; then
    problems=1
    say ""
    say "FAIL：存在 plan 清单外的新增文件（≤3），PR 描述缺少「## 实施中新增（逐条理由）」节。"
    say "      请在 PR 描述中补充："
    printf '        ## 实施中新增（逐条理由）\n        - <路径>：<理由>\n'
    printf '      须逐条列明：\n'
    print_list "$out_added"
  else
    while IFS= read -r path; do
      [[ -z "$path" ]] && continue
      if [[ "$PR_BODY" != *"$path"* ]]; then
        problems=1
        say "FAIL：PR 描述「实施中新增」节未列明清单外新增文件：$path"
      fi
    done <<<"$out_added"
  fi
fi

if [[ -n "$protected_hits" ]]; then
  if [[ "$PR_BODY" != *"保护路径变更"* ]]; then
    problems=1
    say ""
    say "FAIL：本 PR 改动保护路径，PR 描述缺少「## 保护路径变更」节。请在 PR 描述中补充："
    printf '        ## 保护路径变更\n'
    printf '        - <路径>：<改动与复核要点>\n'
  else
    while IFS= read -r path; do
      [[ -z "$path" ]] && continue
      if [[ "$PR_BODY" != *"$path"* ]]; then
        problems=1
        say "FAIL：PR 描述「保护路径变更」节未列明：$path"
      fi
    done <<<"$protected_hits"
  fi
fi

if [[ $problems -eq 1 ]]; then
  say ""
  say "（提示：更新 PR 描述后本关卡会自动重跑——工作流监听 edited 事件。）"
  exit 1
fi

say ""
say "PASS：变更文件均在 plan 清单内（白名单与保护路径按规则处理）"
