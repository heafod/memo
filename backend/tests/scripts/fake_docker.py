"""verify-compose.sh 的 docker 替身（shim）：模拟 compose / inspect 的最小行为面。

仅供 ``tests/test_verify_compose_script.py`` 与本地端到端演练使用，不进镜像。
状态存于 ``$SHIM_STATE/<项目>.json``；compose 变量优先级按真实 compose：
**进程环境 > --env-file**（故脚本须 ``env -u`` 剥离同名变量）。

环境开关：
- ``SHIM_STATE``：状态目录（必填）；
- ``SHIM_PRESTART_CMD``：设置时 prestart 真实执行该 bash 命令（端到端演练）；
  否则按 ``SHIM_PRESTART_EXIT``（默认 0）模拟；
- ``SHIM_DATABASE_URL``：真实执行 prestart / alembic 时注入的 DATABASE_URL；
- ``SHIM_FROZEN_STARTEDAT=1``：restart / up 不刷新 StartedAt、不换容器（模拟「未重跑」）；
- ``SHIM_PRESTART_HANG=1``：prestart 永远处于 running（模拟等待超时）；
- ``SHIM_ALEMBIC_CMD``：``run ... alembic current`` 时真实执行该命令。
"""

import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

STATE_DIR = Path(os.environ["SHIM_STATE"])
SERVICES = ["db", "prestart", "backend", "frontend"]


def _out(text: object) -> None:
    sys.stdout.write(f"{text}\n")


def _load(project: str) -> dict:
    path = STATE_DIR / f"{project}.json"
    return json.loads(path.read_text()) if path.exists() else {"running": []}


def _save(project: str, state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    (STATE_DIR / f"{project}.json").write_text(json.dumps(state, ensure_ascii=False))


def _env_file(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in Path(path).read_text().splitlines():
        if "=" in raw and not raw.lstrip().startswith("#"):
            key, _, value = raw.partition("=")
            values[key.strip()] = value.strip()
    # 真实 compose：shell 环境中的同名变量优先于 --env-file
    for key in list(values):
        if key in os.environ:
            values[key] = os.environ[key]
    return values


def _run_prestart(
    project: str, state: dict, env: dict[str, str], recreate: bool
) -> int:
    with (STATE_DIR / f"{project}.seen").open("a") as seen:
        seen.write(
            json.dumps(
                {k: env.get(k) for k in ("FIRST_SUPERUSER", "FIRST_SUPERUSER_PASSWORD")}
            )
            + "\n"
        )
    pre = state.get("prestart")
    frozen = os.environ.get("SHIM_FROZEN_STARTEDAT") == "1"
    if pre is None or (recreate and not frozen):
        pre = {"id": uuid.uuid4().hex[:12], "started_at": None}
    if not frozen or pre["started_at"] is None:
        pre["started_at"] = f"{time.time_ns()}"
    cmd = os.environ.get("SHIM_PRESTART_CMD")
    if cmd:
        run_env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/")}
        run_env.update({k: v for k, v in env.items() if v != ""})
        run_env["DATABASE_URL"] = os.environ.get("SHIM_DATABASE_URL", "")
        proc = subprocess.run(
            ["bash", "-c", cmd], env=run_env, capture_output=True, text=True
        )
        pre["exit_code"], pre["logs"] = proc.returncode, proc.stdout + proc.stderr
    else:
        pre["exit_code"] = int(os.environ.get("SHIM_PRESTART_EXIT", "0"))
        pre["logs"] = os.environ.get("SHIM_PRESTART_LOGS", "")
    state["prestart"] = pre
    return pre["exit_code"]


def compose(argv: list[str]) -> int:
    if argv[:1] == ["version"]:
        _out("Docker Compose version v2-shim")
        return 0
    opts: dict[str, str] = {}
    while argv and argv[0].startswith("-"):
        opts[argv[0]] = argv[1]
        argv = argv[2:]
    project, env = opts["-p"], _env_file(opts["--env-file"])
    state = _load(project)
    cmd, rest = argv[0], argv[1:]
    rc = 0
    if cmd in ("up", "restart"):
        rc = _run_prestart(project, state, env, recreate="--force-recreate" in rest)
        state["running"] = ["db"] + (["backend", "frontend"] if rc == 0 else [])
        rc = 0 if (cmd == "restart" or rc == 0) else 1
    elif cmd == "down":
        state["running"] = []
    elif cmd == "ps":
        svc = rest[-1]
        pre = state.get("prestart")
        if "--status" in rest:
            alive = svc in state["running"] or (
                svc == "prestart" and os.environ.get("SHIM_PRESTART_HANG") == "1"
            )
            if alive:
                _out(pre["id"] if svc == "prestart" and pre else f"{svc}-id")
        elif svc == "prestart" and pre:
            _out(pre["id"])
        elif svc in state["running"]:
            _out(f"{svc}-id")
    elif cmd == "logs":
        _out(state.get("prestart", {}).get("logs", ""))
    elif cmd == "run":
        alembic = os.environ.get("SHIM_ALEMBIC_CMD")
        if alembic:
            run_env = {"PATH": os.environ["PATH"], "HOME": os.environ.get("HOME", "/")}
            run_env.update({k: v for k, v in env.items() if v != ""})
            run_env["DATABASE_URL"] = os.environ.get("SHIM_DATABASE_URL", "")
            rc = subprocess.run(["bash", "-c", alembic], env=run_env).returncode
        else:
            _out("53e615ae0aa6 (head)")
    _save(project, state)
    return rc


def inspect(argv: list[str]) -> int:
    fmt, cid = argv[1], argv[2]
    for path in STATE_DIR.glob("*.json"):
        pre = json.loads(path.read_text()).get("prestart")
        if pre and pre["id"] == cid:
            _out(pre["exit_code"] if "ExitCode" in fmt else pre["started_at"])
            return 0
    return 1


def main() -> int:
    argv = sys.argv[1:]
    if argv[:1] == ["compose"]:
        return compose(argv[1:])
    if argv[:1] == ["inspect"]:
        return inspect(argv[1:])
    return 0


if __name__ == "__main__":
    sys.exit(main())
