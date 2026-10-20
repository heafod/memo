#!/usr/bin/env bash
# verify-compose.sh —— R14 一键部署实测（001-plan PR-7，FRIDAY 验收 AC1–AC6 + 413）
#
# 在装有 docker（含 compose v2 插件）的机器上、仓库任意目录执行：
#   bash backend/scripts/verify-compose.sh
#
# 行为：
# - 以独立 compose 项目名（默认 memo-verify-<时间戳>）+ 自动生成的 env 文件驱动
#   仓库根 compose.yml（不叠加 compose.override.yml，避免占用宿主 5432/8000；
#   前端端口默认 18080，可用 VERIFY_PORT 覆盖）；不读写仓库根 .env；
# - compose 调用一律经 `env -u` 剥离调用方 shell 中同名变量（compose 中 shell
#   环境优先于 --env-file），保证只用本脚本生成的 env 文件；
# - 逐项打印 PASS / FAIL，任一 FAIL 退出码非零；等待超时即判该项 FAIL；
# - 结束（含中断）时对本脚本创建的项目执行 down -v 并删除临时目录。
# 注意：compose.yml 固定镜像名 backend:latest / frontend:latest，构建会覆盖本机同名镜像。
#
# 依赖：docker compose、curl、python3。
# 测试钩子：VERIFY_SOURCE_ONLY=1 时只定义函数不执行（供 backend/tests 的 shim 测试 source）。
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${VERIFY_PROJECT:-memo-verify-$(date +%s)}"
PORT="${VERIFY_PORT:-18080}"
BASE="http://localhost:${PORT}"
WORK="${VERIFY_WORK:-${REPO}/.tmp/verify-compose/${PROJECT}}"
ADMIN="verify-admin@example.com"
PW1="Verify-Passw0rd-1"
PW2="Verify-Passw0rd-2"
READY_TIMEOUT="${VERIFY_READY_TIMEOUT:-240}"
PRESTART_TIMEOUT="${VERIFY_PRESTART_TIMEOUT:-180}"
POLL_INTERVAL="${VERIFY_POLL_INTERVAL:-3}"
# env 文件中的全部变量：compose 调用前从进程环境剥离
ENV_FILE_VARS=(PROJECT_NAME SECRET_KEY POSTGRES_PASSWORD FIRST_SUPERUSER FIRST_SUPERUSER_PASSWORD FRONTEND_PORT FASTAPI_ENV DATABASE_URL)

declare -a RESULTS=()
FAILED=0
PROJECTS_TO_CLEAN=()

say() { printf '%s\n' "$*"; }
pass() { RESULTS+=("PASS  $1"); say "PASS  $1"; }
fail() { RESULTS+=("FAIL  $1"); say "FAIL  $1"; FAILED=1; }
check() { # check <描述> <命令...>
  local desc="$1"
  shift
  if "$@"; then pass "$desc"; else fail "$desc"; fi
}

write_env() { # write_env <文件> <管理员用户名> <管理员密码>
  cat >"$1" <<ENV
PROJECT_NAME=Memo
SECRET_KEY=$(python3 -c 'import secrets;print(secrets.token_urlsafe(32))')
POSTGRES_PASSWORD=$(python3 -c 'import secrets;print(secrets.token_urlsafe(16))')
FIRST_SUPERUSER=$2
FIRST_SUPERUSER_PASSWORD=$3
FRONTEND_PORT=${PORT}
ENV
}

dc_p() { # dc_p <项目> <env 文件> <compose 参数...>
  local project="$1" env_file="$2" unset_args=() var
  shift 2
  for var in "${ENV_FILE_VARS[@]}"; do unset_args+=(-u "$var"); done
  env "${unset_args[@]}" docker compose -p "$project" -f "$REPO/compose.yml" \
    --project-directory "$REPO" --env-file "$env_file" "$@"
}
dc() { dc_p "$PROJECT" "$WORK/.env" "$@"; }

cleanup() {
  say "== 清理：down -v（${PROJECTS_TO_CLEAN[*]:-无}）"
  local entry
  for entry in "${PROJECTS_TO_CLEAN[@]}"; do
    dc_p "${entry%%|*}" "${entry#*|}" down -v --remove-orphans >/dev/null 2>&1 || true
  done
  rm -rf "$WORK"
}

json() { # json <python 表达式，变量 d 为解析后的 JSON> ；stdin 为 JSON
  python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"
}

wait_ready() { # 经 frontend 的 /api 返回 401 即就绪；超时返回 1（调用方判 FAIL）
  local deadline=$((SECONDS + READY_TIMEOUT)) code
  while ((SECONDS < deadline)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/users/me" || true)"
    [[ "$code" == "401" ]] && return 0
    sleep "$POLL_INTERVAL"
  done
  return 1
}

COOKIE="$WORK/cookie.txt"
login() { # login <密码> → 打印 HTTP 状态码（成功时写 cookie）
  rm -f "$COOKIE"
  curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE" -H 'content-type: application/json' \
    -d "{\"username\":\"$ADMIN\",\"password\":\"$1\"}" "$BASE/api/auth/login"
}
snapshot() { curl -s -b "$COOKIE" "$BASE/api/snapshot"; }
counts() { # 实体计数指纹
  snapshot | json '",".join(f"{k}={len(v)}" for k,v in sorted(d.items()) if isinstance(v,list))'
}

container_id() { # container_id <项目> <env> <服务>
  dc_p "$1" "$2" ps -a -q "$3" | head -n1
}
container_exit_code() { # container_exit_code <项目> <env> <服务>
  local id
  id="$(container_id "$1" "$2" "$3")"
  [[ -n "$id" ]] && docker inspect -f '{{.State.ExitCode}}' "$id"
}
prestart_fingerprint() { # 主项目 prestart 的「容器 ID|StartedAt」，用于证明重跑
  local id
  id="$(container_id "$PROJECT" "$WORK/.env" prestart)"
  [[ -n "$id" ]] || return 1
  printf '%s|%s\n' "$id" "$(docker inspect -f '{{.State.StartedAt}}' "$id")"
}
spa_ok() { # 构建后的登录页入口（PR-8）：200 + SPA 挂载点 + Vite 构建产物脚本
  [[ "$1" == "200" && "$2" == *'<div id="root"></div>'* && "$2" == *'/assets/index-'* ]]
}
service_running() { # service_running <项目> <env> <服务>
  [[ -n "$(dc_p "$1" "$2" ps -q --status running "$3")" ]]
}
wait_prestart_exited() { # 等待主项目 prestart 跑完；超时返回 1（调用方判 FAIL）
  local deadline=$((SECONDS + PRESTART_TIMEOUT))
  while ((SECONDS < deadline)); do
    service_running "$PROJECT" "$WORK/.env" prestart || return 0
    sleep "$POLL_INTERVAL"
  done
  return 1
}
assert_prestart_reran() { # assert_prestart_reran <标签> <之前的指纹>
  local label="$1" before="$2" after
  check "$label prestart 在 ${PRESTART_TIMEOUT}s 内跑完" wait_prestart_exited
  after="$(prestart_fingerprint || true)"
  check "$label prestart 确已重跑（ID|StartedAt 变化：${before:-无} → ${after:-无}）" \
    test -n "$before" -a -n "$after" -a "$after" != "$before"
  check "$label prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
}

# ====================== AC1：干净环境 up --build ======================
step_ac1() {
  say "== AC1：干净环境 docker compose up --build（项目 $PROJECT，端口 $PORT）"
  write_env "$WORK/.env" "$ADMIN" "$PW1"
  PROJECTS_TO_CLEAN+=("$PROJECT|$WORK/.env")
  dc up -d --build
  local rc=$? code page
  check "AC1 compose up 成功（退出码 $rc）" test "$rc" -eq 0
  check "AC1 prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
  if wait_ready; then pass "AC1 服务就绪（经 frontend /api 反代）"; else
    fail "AC1 服务在 ${READY_TIMEOUT}s 内未就绪"
    dc logs --tail 80
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/snapshot")"
  check "AC1 未认证 GET /api/snapshot → 401（实际 $code）" test "$code" = "401"
  code="$(login "$PW1")"
  check "AC1 登录 → 200（实际 $code）" test "$code" = "200"
  code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/snapshot")"
  check "AC1 GET /api/snapshot → 200（实际 $code）" test "$code" = "200"
  local notifs activity
  notifs="$(snapshot | json 'len(d["notifs"])')"
  activity="$(snapshot | json 'len(d["activity"])')"
  check "AC1 种子含 notifs（$notifs 条）与 activity（$activity 条）" test "${notifs:-0}" -gt 0 -a "${activity:-0}" -gt 0
  code="$(curl -s -o "$WORK/spa.html" -w '%{http_code}' "$BASE/some/spa/route")"
  page="$(cat "$WORK/spa.html" 2>/dev/null)"
  check "AC1 前端 SPA 回退：状态 200（实际 $code）且返回构建后的登录页入口" spa_ok "$code" "$page"
}

# ====================== AC2：幂等（restart + 二次 up） ======================
step_ac2() {
  say "== AC2：restart 与二次 up 幂等（证明 prestart 确已重跑）"
  local baseline before rc current
  login "$PW1" >/dev/null
  baseline="$(counts)"
  say "   计数基线（AC2）：$baseline"

  before="$(prestart_fingerprint || true)"
  dc restart >/dev/null 2>&1
  rc=$?
  check "AC2 compose restart 成功（退出码 $rc）" test "$rc" -eq 0
  assert_prestart_reran "AC2[restart]" "$before"
  check "AC2[restart] 服务在 ${READY_TIMEOUT}s 内就绪" wait_ready

  before="$(prestart_fingerprint || true)"
  dc up -d >/dev/null 2>&1
  rc=$?
  check "AC2 二次 up 成功（退出码 $rc）" test "$rc" -eq 0
  assert_prestart_reran "AC2[二次 up]" "$before"
  check "AC2[二次 up] 服务在 ${READY_TIMEOUT}s 内就绪" wait_ready

  login "$PW1" >/dev/null
  local after
  after="$(counts)"
  check "AC2 实体计数不增（$after）" test -n "$after" -a "$after" = "$baseline"
  current="$(dc run --rm --no-deps -T prestart alembic current 2>/dev/null | tr -d '\r')"
  check "AC2 迁移停留 head（$(tail -n1 <<<"$current")）" grep -q "(head)" <<<"$current"
}

# ====================== AC6 准备：上传文件 ======================
step_upload() {
  login "$PW1" >/dev/null
  PID="$(snapshot | json 'd["projects"][0]["id"]')"
  printf 'verify-compose %s\n' "$PROJECT" >"$WORK/持久化校验.txt"
  FILE_ID="$(curl -s -b "$COOKIE" -F "project_id=$PID" -F "file=@$WORK/持久化校验.txt" \
    "$BASE/api/files" | json 'd.get("id","")')"
  check "AC6 上传文件成功（id=$FILE_ID）" test -n "$FILE_ID"
}

# ====================== 413：nginx 层 JSON 与后端透传 ======================
TOO_LARGE_BODY='{"detail":"文件过大，单个文件不能超过 10MB"}'
step_413() {
  say "== 413：经 nginx 上传 12MB → nginx JSON；10.5MB → 后端 413 原样透传（两层 detail 逐字节一致）"
  local resp body
  head -c $((12 * 1024 * 1024)) /dev/zero >"$WORK/big-12mb.zip"
  head -c $((10 * 1024 * 1024 + 512 * 1024)) /dev/zero >"$WORK/mid-10_5mb.zip"
  resp="$(curl -s -b "$COOKIE" -o "$WORK/413.body" -w '%{http_code}|%{content_type}' \
    -F "project_id=$PID" -F "file=@$WORK/big-12mb.zip" "$BASE/api/files")"
  body="$(cat "$WORK/413.body" 2>/dev/null)"
  check "413 nginx 拒绝 12MB：状态 413、Content-Type application/json、体为 $TOO_LARGE_BODY（实际 $resp $body）" \
    test "${resp%%|*}" = "413" -a "${resp#*|}" = "application/json; charset=utf-8" -a "$body" = "$TOO_LARGE_BODY"
  resp="$(curl -s -b "$COOKIE" -o "$WORK/413b.body" -w '%{http_code}' \
    -F "project_id=$PID" -F "file=@$WORK/mid-10_5mb.zip" "$BASE/api/files")"
  body="$(cat "$WORK/413b.body" 2>/dev/null)"
  check "413 后端透传 10.5MB：状态 413、体为后端 detail（实际 $resp $body）" \
    test "$resp" = "413" -a "$body" = "$TOO_LARGE_BODY"
}

# ====================== AC5：改密后重启不覆盖 ======================
step_ac5() {
  say "== AC5：API 改密 → 重启 → 新密码 200 / 旧密码 400，Owner 不重复"
  local code baseline before rc owners
  # 计数基线在上传之后、重启之前重新取（上传使 files +1，413 用例不落库）
  baseline="$(counts)"
  say "   计数基线（AC5，上传后）：$baseline"
  code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" -H 'content-type: application/json' \
    -d "{\"old_password\":\"$PW1\",\"new_password\":\"$PW2\"}" "$BASE/api/auth/password")"
  check "AC5 API 改密 → 200（实际 $code）" test "$code" = "200"
  before="$(prestart_fingerprint || true)"
  dc up -d --force-recreate prestart backend frontend >/dev/null 2>&1
  rc=$?
  check "AC5 重启（up --force-recreate）成功（退出码 $rc）" test "$rc" -eq 0
  assert_prestart_reran "AC5[重启]" "$before"
  check "AC5[重启] 服务在 ${READY_TIMEOUT}s 内就绪" wait_ready
  code="$(login "$PW2")"
  check "AC5 新密码登录 → 200（实际 $code）" test "$code" = "200"
  owners="$(snapshot | json 'sum(1 for m in d["members"] if m.get("role")=="Owner")')"
  check "AC5 Owner 成员仅 1 条（实际 $owners）" test "$owners" = "1"
  code="$(login "$PW1")"
  # 登录失败码沿用 PR-3（R12）契约：400「用户名或密码错误」（FRIDAY 裁定，不改认证契约）
  check "AC5 旧密码登录 → 400（实际 $code）" test "$code" = "400"
  code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/auth/users/me")"
  check "AC5 旧密码未获会话：/api/auth/users/me → 401（实际 $code）" test "$code" = "401"
  login "$PW2" >/dev/null
  local after
  after="$(counts)"
  check "AC5 实体计数不增（$after）" test -n "$after" -a "$after" = "$baseline"
}

# ====================== AC6：down（不带 -v）后数据与文件仍在 ======================
step_ac6() {
  say "== AC6：down（不带 -v）→ up，快照数据与上传文件仍在"
  local before code rc in_snap
  login "$PW2" >/dev/null
  before="$(counts)"
  dc down >/dev/null 2>&1
  rc=$?
  check "AC6 down（不带 -v）成功（退出码 $rc）" test "$rc" -eq 0
  dc up -d >/dev/null 2>&1
  rc=$?
  check "AC6 重新 up 成功（退出码 $rc）" test "$rc" -eq 0
  check "AC6 服务在 ${READY_TIMEOUT}s 内就绪" wait_ready
  code="$(login "$PW2")"
  check "AC6 重新 up 后登录 → 200（实际 $code）" test "$code" = "200"
  check "AC6 快照计数与 down 前一致" test -n "$before" -a "$(counts)" = "$before"
  in_snap="$(snapshot | json "any(f['id']=='$FILE_ID' for f in d['files'])")"
  check "AC6 快照仍含上传文件元数据" test "$in_snap" = "True"
  curl -s -b "$COOKIE" -o "$WORK/download.txt" "$BASE/api/files/$FILE_ID/content"
  check "AC6 上传文件内容字节一致（文件卷持久化）" cmp -s "$WORK/持久化校验.txt" "$WORK/download.txt"
}

# ====================== AC4：缺变量 / 弱密码 → prestart 非零、backend 不启动 ======================
run_bad_case() { # run_bad_case <标签> <管理员用户名> <管理员密码> <期望日志片段>
  local label="$1" project="${PROJECT}-$1" env_file="$WORK/.env.$1" rc exit_code logs
  write_env "$env_file" "$2" "$3"
  PROJECTS_TO_CLEAN+=("$project|$env_file")
  dc_p "$project" "$env_file" up -d >/dev/null 2>&1
  rc=$?
  check "AC4[$label] compose up 失败（退出码 $rc）" test "$rc" -ne 0
  exit_code="$(container_exit_code "$project" "$env_file" prestart)"
  check "AC4[$label] prestart 非零退出（实际 ${exit_code:-无}）" test -n "$exit_code" -a "${exit_code:-0}" != "0"
  if service_running "$project" "$env_file" backend; then
    fail "AC4[$label] backend 未启动"
  else
    pass "AC4[$label] backend 未启动"
  fi
  logs="$(dc_p "$project" "$env_file" logs --no-color prestart 2>&1)"
  check "AC4[$label] 日志含中文原因「$4」" grep -q "$4" <<<"$logs"
  dc_p "$project" "$env_file" down -v --remove-orphans >/dev/null 2>&1
}
step_ac4() {
  say "== AC4：配置错误时 prestart 非零退出、backend 不启动、中文原因"
  # 复用同一 FRONTEND_PORT：先停主项目，避免端口冲突
  dc down >/dev/null 2>&1
  run_bad_case missing-admin "" "" "缺少环境变量 FIRST_SUPERUSER"
  run_bad_case weak-password "$ADMIN" "short1" "不符合密码策略"
}

main() {
  local tool
  for tool in docker curl python3; do
    command -v "$tool" >/dev/null 2>&1 || {
      say "缺少依赖：$tool"
      exit 2
    }
  done
  docker compose version >/dev/null 2>&1 || {
    say "缺少 docker compose v2 插件"
    exit 2
  }
  mkdir -p "$WORK"
  trap cleanup EXIT

  step_ac1
  step_ac2
  step_upload
  step_413
  step_ac5
  step_ac6
  step_ac4

  say ""
  say "== 汇总（项目 $PROJECT）"
  printf '%s\n' "${RESULTS[@]}"
  if ((FAILED)); then
    say "RESULT: FAIL"
    exit 1
  fi
  say "RESULT: PASS（AC1–AC6 + 413）"
}

if [[ "${VERIFY_SOURCE_ONLY:-0}" != "1" ]]; then
  main "$@"
fi
