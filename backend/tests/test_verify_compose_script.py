"""verify-compose.sh 逻辑的 shim 测试（R14；无 docker 环境下验证脚本判定本身）。

以 ``tests/scripts/fake_docker.py`` 冒充 ``docker``、以桩 ``curl`` 冒充 HTTP，
``VERIFY_SOURCE_ONLY=1`` source 脚本后直接调用其函数，覆盖 EDITH 评审项：

- prestart 重跑证明：ID|StartedAt 变化 → PASS；未变化（模拟未重跑）→ FAIL；
- 等待超时不再被吞：wait_ready / wait_prestart_exited 超时 → 对应项 FAIL；
- env 隔离：调用方 shell 已 export 的 FIRST_SUPERUSER* 不覆盖 --env-file；
- AC5 计数基线：上传使 files +1 后，基线在上传之后重取 → 不误报 FAIL。
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
SCRIPT = BACKEND_DIR / "scripts" / "verify-compose.sh"
FAKE_DOCKER = BACKEND_DIR / "tests" / "scripts" / "fake_docker.py"
# AGENTS.md：临时文件只落仓库根 .tmp/
SHIM_ROOT = REPO_ROOT / ".tmp" / "verify-shim-tests"

FAKE_CURL = r'''#!/usr/bin/env python3
"""桩 curl：按 $CURL_STATE 的 JSON 响应；支持 -s -o -w -c -b -H -d -F 子集。"""
import json, os, sys
state_path = os.environ["CURL_STATE"]
state = json.load(open(state_path))
args = sys.argv[1:]
url = args[-1]
out = None; fmt = ""; method = "GET"; i = 0
while i < len(args) - 1:
    a = args[i]
    if a == "-o": out = args[i + 1]; i += 2; continue
    if a == "-w": fmt = args[i + 1]; i += 2; continue
    if a in ("-d", "-F"): method = "POST"; i += 2; continue
    if a in ("-c", "-b", "-H"): i += 2; continue
    i += 1
path = url.split("://", 1)[1].split("/", 1)[1]
path = "/" + path
if state.get("down"):
    code, body = "000", ""
elif path == "/api/snapshot":
    code, body = "200", json.dumps(state["snapshot"])
elif path == "/api/files" and method == "POST":
    state["snapshot"]["files"].append({"id": "f%d" % len(state["snapshot"]["files"])})
    code, body = "201", json.dumps({"id": state["snapshot"]["files"][-1]["id"]})
elif path == "/api/auth/users/me":
    code, body = "401", "{}"
else:
    code, body = "200", "{}"
json.dump(state, open(state_path, "w"))
if out: open(out, "w").write(body)
elif not fmt: sys.stdout.write(body)
sys.stdout.write(fmt.replace("%{http_code}", code).replace("%{content_type}", "application/json"))
'''


def _setup(
    name: str, snapshot: dict | None = None, curl_down: bool = False
) -> dict[str, str]:
    root = SHIM_ROOT / name
    subprocess.run(["rm", "-rf", str(root)], check=True)
    (root / "bin").mkdir(parents=True)
    (root / "state").mkdir()
    docker = root / "bin" / "docker"
    docker.write_text(f'#!/bin/sh\nexec python3 "{FAKE_DOCKER}" "$@"\n')
    curl = root / "bin" / "curl"
    curl.write_text(FAKE_CURL)
    for exe in (docker, curl):
        exe.chmod(0o755)
    (root / "curl.json").write_text(
        json.dumps({"snapshot": snapshot or {"files": []}, "down": curl_down})
    )
    env = {
        "PATH": f"{root / 'bin'}:{os.environ['PATH']}",
        "HOME": os.environ.get("HOME", "/"),
        "SHIM_STATE": str(root / "state"),
        "CURL_STATE": str(root / "curl.json"),
        "VERIFY_SOURCE_ONLY": "1",
        "VERIFY_PROJECT": "shimproj",
        "VERIFY_WORK": str(root / "work"),
        "VERIFY_READY_TIMEOUT": "2",
        "VERIFY_PRESTART_TIMEOUT": "2",
        "VERIFY_POLL_INTERVAL": "0.2",
    }
    return env


def _run(env: dict[str, str], body: str) -> subprocess.CompletedProcess:
    script = f"""
set -uo pipefail
source "{SCRIPT}"
mkdir -p "$WORK"
write_env "$WORK/.env" "$ADMIN" "$PW1"
{body}
printf '%s\\n' "${{RESULTS[@]}}"
echo "FAILED=$FAILED"
"""
    return subprocess.run(
        ["bash", "-c", script], env=env, capture_output=True, text=True, timeout=60
    )


def test_prestart_rerun_detected_when_startedat_changes() -> None:  # R14
    env = _setup("rerun-changed")
    proc = _run(
        env,
        """
dc up -d >/dev/null
before="$(prestart_fingerprint)"
dc restart >/dev/null
assert_prestart_reran "AC2[restart]" "$before"
""",
    )
    out = proc.stdout
    assert "PASS  AC2[restart] prestart 确已重跑" in out, out + proc.stderr
    assert "PASS  AC2[restart] prestart 退出码 0" in out
    assert "FAILED=0" in out


def test_prestart_rerun_fails_when_startedat_unchanged() -> None:  # R14
    env = _setup("rerun-unchanged")
    env["SHIM_FROZEN_STARTEDAT"] = "1"
    proc = _run(
        env,
        """
dc up -d >/dev/null
before="$(prestart_fingerprint)"
dc restart >/dev/null
assert_prestart_reran "AC2[restart]" "$before"
""",
    )
    out = proc.stdout
    assert "FAIL  AC2[restart] prestart 确已重跑" in out, out + proc.stderr
    assert "FAILED=1" in out


def test_prestart_rerun_fails_without_prior_container() -> None:  # R14
    env = _setup("rerun-no-before")
    proc = _run(env, 'assert_prestart_reran "AC5[重启]" ""')
    assert "FAIL  AC5[重启] prestart 确已重跑" in proc.stdout, proc.stdout
    assert "FAILED=1" in proc.stdout


def test_wait_timeouts_fail_checks() -> None:  # R14
    env = _setup("timeouts", curl_down=True)
    env["SHIM_PRESTART_HANG"] = "1"
    proc = _run(
        env,
        """
dc up -d >/dev/null
check "AC2[restart] 服务就绪" wait_ready
before="$(prestart_fingerprint)"
assert_prestart_reran "AC2[restart]" "$before"
""",
    )
    out = proc.stdout
    assert "FAIL  AC2[restart] 服务就绪" in out, out + proc.stderr
    assert "FAIL  AC2[restart] prestart 在 2s 内跑完" in out
    assert "FAILED=1" in out


def test_env_file_not_overridden_by_exported_vars() -> None:  # R14, R12
    env = _setup("env-isolation")
    env["FIRST_SUPERUSER"] = "exported-admin@evil.example"
    env["FIRST_SUPERUSER_PASSWORD"] = "Exported-Passw0rd"
    proc = _run(
        env,
        """
write_env "$WORK/.env.missing" "" ""
dc_p shimproj-missing "$WORK/.env.missing" up -d >/dev/null
# 对照：不经 dc_p 直接调用 docker，shell 变量会覆盖 env 文件（真实 compose 行为）
docker compose -p shimproj-raw -f x --project-directory y --env-file "$WORK/.env.missing" up -d >/dev/null
""",
    )
    state = Path(env["SHIM_STATE"])
    isolated = json.loads((state / "shimproj-missing.seen").read_text().splitlines()[0])
    raw = json.loads((state / "shimproj-raw.seen").read_text().splitlines()[0])
    assert isolated == {"FIRST_SUPERUSER": "", "FIRST_SUPERUSER_PASSWORD": ""}, (
        proc.stderr
    )
    assert raw["FIRST_SUPERUSER"] == "exported-admin@evil.example"


def test_ac5_baseline_taken_after_upload() -> None:  # R14
    """上传使 files +1；AC5 基线在上传后重取，计数项 PASS（旧逻辑会误报 FAIL）。"""
    env = _setup("baseline", snapshot={"files": [{"id": "seed"}], "notifs": [1]})
    proc = _run(
        env,
        """
dc up -d >/dev/null
OLD_BASELINE="$(counts)"
step_upload
step_ac5
NOW="$(counts)"
echo "OLD_BASELINE=$OLD_BASELINE NOW=$NOW"
""",
    )
    out = proc.stdout
    assert "PASS  AC6 上传文件成功" in out, out + proc.stderr
    assert "PASS  AC5 实体计数不增（files=2,notifs=1）" in out, out
    assert "PASS  AC5[重启] prestart 确已重跑" in out
    # 旧口径（上传前基线）与当前计数必然不等——即原 :197 的误报来源
    assert "OLD_BASELINE=files=1,notifs=1 NOW=files=2,notifs=1" in out


@pytest.mark.parametrize("tool", ["bash"])
def test_script_syntax(tool: str) -> None:  # R14
    assert subprocess.run([tool, "-n", str(SCRIPT)]).returncode == 0
