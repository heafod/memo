#!/usr/bin/env bash
# verify-compose.sh —— R14 一键部署实测（001-plan PR-7，FRIDAY 验收 AC1–AC6）
#
# 在装有 docker（含 compose v2 插件）的机器上、仓库任意目录执行：
#   bash backend/scripts/verify-compose.sh
#
# 行为：
# - 以独立 compose 项目名（默认 memo-verify-<时间戳>）+ 自动生成的 env 文件驱动
#   仓库根 compose.yml（不叠加 compose.override.yml，避免占用宿主 5432/8000；
#   前端端口默认 18080，可用 VERIFY_PORT 覆盖）；不读写仓库根 .env；
# - 逐项打印 PASS / FAIL，任一 FAIL 退出码非零；
# - 结束（含中断）时对本脚本创建的项目执行 down -v 并删除临时目录。
# 注意：compose.yml 固定镜像名 backend:latest / frontend:latest，构建会覆盖本机同名镜像。
#
# 依赖：docker compose、curl、python3。
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${VERIFY_PROJECT:-memo-verify-$(date +%s)}"
PORT="${VERIFY_PORT:-18080}"
BASE="http://localhost:${PORT}"
WORK="${REPO}/.tmp/verify-compose/${PROJECT}"
ADMIN="verify-admin@example.com"
PW1="Verify-Passw0rd-1"
PW2="Verify-Passw0rd-2"
READY_TIMEOUT="${VERIFY_READY_TIMEOUT:-240}"

declare -a RESULTS=()
FAILED=0
PROJECTS_TO_CLEAN=()

say() { printf '%s\n' "$*"; }
pass() { RESULTS+=("PASS  $1"); say "PASS  $1"; }
fail() { RESULTS+=("FAIL  $1"); say "FAIL  $1"; FAILED=1; }
check() { # check <描述> <命令...>
  local desc="$1"; shift
  if "$@"; then pass "$desc"; else fail "$desc"; fi
}

for tool in docker curl python3; do
  command -v "$tool" >/dev/null 2>&1 || { say "缺少依赖：$tool"; exit 2; }
done
docker compose version >/dev/null 2>&1 || { say "缺少 docker compose v2 插件"; exit 2; }

mkdir -p "$WORK"

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
  local project="$1" env_file="$2"; shift 2
  docker compose -p "$project" -f "$REPO/compose.yml" --project-directory "$REPO" \
    --env-file "$env_file" "$@"
}
dc() { dc_p "$PROJECT" "$WORK/.env" "$@"; }

cleanup() {
  say "== 清理：down -v（${PROJECTS_TO_CLEAN[*]:-无}）"
  for entry in "${PROJECTS_TO_CLEAN[@]}"; do
    dc_p "${entry%%|*}" "${entry#*|}" down -v --remove-orphans >/dev/null 2>&1 || true
  done
  rm -rf "$WORK"
}
trap cleanup EXIT

json() { # json <python 表达式，变量 d 为解析后的 JSON> ；stdin 为 JSON
  python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"
}

wait_ready() {
  local deadline=$((SECONDS + READY_TIMEOUT)) code
  while ((SECONDS < deadline)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/users/me" || true)"
    [[ "$code" == "401" ]] && return 0
    sleep 3
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
container_exit_code() { # container_exit_code <项目> <env> <服务>
  local id
  id="$(dc_p "$1" "$2" ps -a -q "$3" | head -n1)"
  [[ -n "$id" ]] && docker inspect -f '{{.State.ExitCode}}' "$id"
}
wait_prestart_exited() { # 等待主项目 prestart 跑完（最多 120s）
  local deadline=$((SECONDS + 120))
  while ((SECONDS < deadline)); do
    service_running "$PROJECT" "$WORK/.env" prestart || return 0
    sleep 2
  done
  return 1
}
service_running() { # service_running <项目> <env> <服务>
  [[ -n "$(dc_p "$1" "$2" ps -q --status running "$3")" ]]
}

# ====================== AC1：干净环境 up --build ======================
say "== AC1：干净环境 docker compose up --build（项目 $PROJECT，端口 $PORT）"
write_env "$WORK/.env" "$ADMIN" "$PW1"
PROJECTS_TO_CLEAN+=("$PROJECT|$WORK/.env")
dc up -d --build
UP_RC=$?
check "AC1 compose up 成功（退出码 $UP_RC）" test "$UP_RC" -eq 0
check "AC1 prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
if wait_ready; then pass "AC1 服务就绪（经 frontend /api 反代）"; else fail "AC1 服务在 ${READY_TIMEOUT}s 内未就绪"; dc logs --tail 80; fi

code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/snapshot")"
check "AC1 未认证 GET /api/snapshot → 401（实际 $code）" test "$code" = "401"
code="$(login "$PW1")"
check "AC1 登录 → 200（实际 $code）" test "$code" = "200"
code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/snapshot")"
check "AC1 GET /api/snapshot → 200（实际 $code）" test "$code" = "200"
notifs="$(snapshot | json 'len(d["notifs"])')"
activity="$(snapshot | json 'len(d["activity"])')"
check "AC1 种子含 notifs（$notifs 条）与 activity（$activity 条）" test "${notifs:-0}" -gt 0 -a "${activity:-0}" -gt 0
page="$(curl -s "$BASE/some/spa/route")"
check "AC1 前端 SPA 回退返回占位页" grep -q "Memo" <<<"$page"
BASELINE="$(counts)"
say "   计数基线：$BASELINE"

# ====================== AC2：幂等（restart + 二次 up） ======================
say "== AC2：restart 与二次 up 幂等"
dc restart >/dev/null 2>&1
wait_prestart_exited
check "AC2 restart 后 prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
wait_ready || true
dc up -d
UP2_RC=$?
check "AC2 二次 up 成功（退出码 $UP2_RC）" test "$UP2_RC" -eq 0
wait_ready || true
check "AC2 二次 up 后 prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
login "$PW1" >/dev/null
AFTER="$(counts)"
check "AC2 实体计数不增（$AFTER）" test "$AFTER" = "$BASELINE"
current="$(dc run --rm --no-deps -T prestart alembic current 2>/dev/null | tr -d '\r')"
check "AC2 迁移停留 head（$(tail -n1 <<<"$current")）" grep -q "(head)" <<<"$current"

# ====================== AC6 准备：上传文件 ======================
login "$PW1" >/dev/null
PID="$(snapshot | json 'd["projects"][0]["id"]')"
printf 'verify-compose %s\n' "$PROJECT" >"$WORK/持久化校验.txt"
FILE_ID="$(curl -s -b "$COOKIE" -F "project_id=$PID" -F "file=@$WORK/持久化校验.txt" \
  "$BASE/api/files" | json 'd.get("id","")')"
check "AC6 上传文件成功（id=$FILE_ID）" test -n "$FILE_ID"

# ====================== AC5：改密后重启不覆盖 ======================
say "== AC5：API 改密 → 重启 → 新密码 200 / 旧密码拒绝，Owner 不重复"
code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" -H 'content-type: application/json' \
  -d "{\"old_password\":\"$PW1\",\"new_password\":\"$PW2\"}" "$BASE/api/auth/password")"
check "AC5 API 改密 → 200（实际 $code）" test "$code" = "200"
dc up -d --force-recreate prestart backend frontend >/dev/null 2>&1
wait_ready || true
check "AC5 重启后 prestart 退出码 0" test "$(container_exit_code "$PROJECT" "$WORK/.env" prestart)" = "0"
code="$(login "$PW2")"
check "AC5 新密码登录 → 200（实际 $code）" test "$code" = "200"
owners="$(snapshot | json 'sum(1 for m in d["members"] if m.get("role")=="Owner")')"
check "AC5 Owner 成员仅 1 条（实际 $owners）" test "$owners" = "1"
code="$(login "$PW1")"
# 登录失败码沿用 PR-3（R12）契约：400「用户名或密码错误」；未认证请求为 401
check "AC5 旧密码登录被拒（实际 $code，PR-3 契约为 400）" test "$code" != "200" -a "$code" -ge 400
code="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" "$BASE/api/auth/users/me")"
check "AC5 旧密码未获会话（/api/auth/users/me → 401，实际 $code）" test "$code" = "401"
login "$PW2" >/dev/null
check "AC5 实体计数不增" test "$(counts)" = "$BASELINE"

# ====================== AC6：down（不带 -v）后数据与文件仍在 ======================
say "== AC6：down（不带 -v）→ up，快照数据与上传文件仍在"
login "$PW2" >/dev/null
BEFORE_DOWN="$(counts)"
dc down >/dev/null 2>&1
dc up -d >/dev/null 2>&1
wait_ready || true
code="$(login "$PW2")"
check "AC6 重新 up 后登录 → 200（实际 $code）" test "$code" = "200"
check "AC6 快照计数与 down 前一致" test "$(counts)" = "$BEFORE_DOWN"
in_snap="$(snapshot | json "any(f['id']=='$FILE_ID' for f in d['files'])")"
check "AC6 快照仍含上传文件元数据" test "$in_snap" = "True"
curl -s -b "$COOKIE" -o "$WORK/download.txt" "$BASE/api/files/$FILE_ID/content"
check "AC6 上传文件内容字节一致（文件卷持久化）" cmp -s "$WORK/持久化校验.txt" "$WORK/download.txt"

# ====================== AC4：缺变量 / 弱密码 → prestart 非零、backend 不启动 ======================
run_bad_case() { # run_bad_case <标签> <管理员用户名> <管理员密码> <期望日志片段>
  local label="$1" project="${PROJECT}-$1" env_file="$WORK/.env.$1"
  write_env "$env_file" "$2" "$3"
  PROJECTS_TO_CLEAN+=("$project|$env_file")
  dc_p "$project" "$env_file" up -d >/dev/null 2>&1
  local rc=$?
  check "AC4[$label] compose up 失败（退出码 $rc）" test "$rc" -ne 0
  local exit_code
  exit_code="$(container_exit_code "$project" "$env_file" prestart)"
  check "AC4[$label] prestart 非零退出（实际 ${exit_code:-无}）" test -n "$exit_code" -a "${exit_code:-0}" != "0"
  if service_running "$project" "$env_file" backend; then
    fail "AC4[$label] backend 未启动"
  else
    pass "AC4[$label] backend 未启动"
  fi
  local logs
  logs="$(dc_p "$project" "$env_file" logs --no-color prestart 2>&1)"
  check "AC4[$label] 日志含中文原因「$4」" grep -q "$4" <<<"$logs"
  dc_p "$project" "$env_file" down -v --remove-orphans >/dev/null 2>&1
}
say "== AC4：配置错误时 prestart 非零退出、backend 不启动、中文原因"
# 坏例不需要对外端口：复用同一 FRONTEND_PORT 前先停主项目，避免端口冲突
dc down >/dev/null 2>&1
run_bad_case missing-admin "" "" "缺少环境变量 FIRST_SUPERUSER"
run_bad_case weak-password "$ADMIN" "short1" "不符合密码策略"

# ====================== 汇总 ======================
say ""
say "== 汇总（项目 $PROJECT）"
printf '%s\n' "${RESULTS[@]}"
if ((FAILED)); then
  say "RESULT: FAIL"
  exit 1
fi
say "RESULT: PASS（AC1–AC6）"
