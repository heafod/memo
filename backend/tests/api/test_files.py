"""文件上传与下载验收测试（R4b；R8：错误 detail 中文；R12：端点须认证）。

覆盖（随 PR-6 进仓，来自 001-plan 批次 7「随 PR 测试：413 / 415 / 白名单 / 清洗」）：

- 上限：恰 10MB 通过、10MB+1 字节 413（中文 detail）；
- 白名单：规格枚举的全部扩展名均 201（大小写不敏感），白名单外 / 无扩展名 415；
- 清洗：路径分隔符、控制字符、双向覆盖符、首尾空格被去除；>200 截断且保留扩展名；
  清洗后为空 422；同项目重名追加序号 ``(1)``、``(2)``；
- 下载：``GET /api/files/{id}/content`` 字节一致、attachment + nosniff；
  不存在 404；种子文件（仅元数据）404；
- 快照：上传后 ``files`` 含元数据（name/type/size_bytes/by_id/task_id）；
- 任务关联：上传时 ``task_id`` 落库；任务须属同项目（422）；
- 认证：未认证上传 / 下载内容 401，detail 中文。

测试在自建项目 PR6F 内运行，模块结束删除项目（文件行随项目级联删除）。
"""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app.api.routes.files import (
    MAX_FILE_BYTES,
    dedupe_filename,
    sanitize_filename,
)
from app.main import app

WHITELIST = [
    "png", "jpg", "jpeg", "gif", "webp", "svg", "heic",
    "pdf", "doc", "docx", "txt", "md", "rtf",
    "xlsx", "xls", "csv",
    "ppt", "pptx", "key",
    "zip", "rar", "7z",
    "js", "ts", "json", "html", "css", "py",
    "fig",
]  # fmt: skip


@pytest.fixture(scope="module")
def project(authed_client: TestClient) -> Generator[dict]:
    resp = authed_client.post(
        "/api/projects", json={"key": "PR6F", "name": "PR-6 文件验收项目"}
    )
    assert resp.status_code == 201, resp.text
    proj = resp.json()
    yield proj
    assert authed_client.delete(f"/api/projects/{proj['id']}").status_code == 204


def _upload(
    client: TestClient,
    project_id: str,
    name: str,
    content: bytes = b"hello",
    task_id: str | None = None,
):
    data = {"project_id": project_id}
    if task_id is not None:
        data["task_id"] = task_id
    return client.post(
        "/api/files",
        data=data,
        files={"file": (name, content, "application/octet-stream")},
    )


def _snapshot_files(client: TestClient) -> dict[str, dict]:
    resp = client.get("/api/snapshot")
    assert resp.status_code == 200, resp.text
    return {f["id"]: f for f in resp.json()["files"]}


# ---------- 认证 ----------


def test_files_require_auth(
    authed_client: TestClient, project: dict
) -> None:  # R4b, R12, R8
    """未认证上传 / 下载内容均 401，detail 中文（独立 Cookie jar）。"""
    uploaded = _upload(authed_client, project["id"], "鉴权.txt")
    assert uploaded.status_code == 201, uploaded.text
    file_id = uploaded.json()["id"]
    with TestClient(app) as fresh:
        resp = _upload(fresh, project["id"], "匿名.txt")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "未认证"  # R8
        resp = fresh.get(f"/api/files/{file_id}/content")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "未认证"  # R8


# ---------- 413 上限 ----------


def test_upload_size_limit_413(authed_client: TestClient, project: dict) -> None:  # R4b
    assert MAX_FILE_BYTES == 10 * 1024 * 1024
    ok = _upload(
        authed_client, project["id"], "恰好10MB.bin.zip", b"\0" * MAX_FILE_BYTES
    )
    assert ok.status_code == 201, ok.text  # R4b：≤10MB 通过
    assert ok.json()["size_bytes"] == MAX_FILE_BYTES

    resp = _upload(
        authed_client, project["id"], "超限.zip", b"\0" * (MAX_FILE_BYTES + 1)
    )
    assert resp.status_code == 413  # R4b
    assert resp.json()["detail"] == "文件过大，单个文件不能超过 10MB"  # R8
    names = {f["name"] for f in _snapshot_files(authed_client).values()}
    assert "超限.zip" not in names  # 超限不落元数据


# ---------- 415 白名单 ----------


def test_upload_whitelist_accepts_all(
    authed_client: TestClient, project: dict
) -> None:  # R4b
    for ext in WHITELIST:
        resp = _upload(authed_client, project["id"], f"白名单样例.{ext}")
        assert resp.status_code == 201, (ext, resp.text)
    # 扩展名大小写不敏感
    resp = _upload(authed_client, project["id"], "大写扩展名.PNG")
    assert resp.status_code == 201, resp.text
    assert resp.json()["type"] == "img"


def test_upload_type_mapping(authed_client: TestClient, project: dict) -> None:  # R4b
    """展示分类对齐原型 fileType。"""
    expected = {
        "a.fig": "fig", "a.pdf": "pdf", "a.7z": "zip", "a.heic": "img",
        "a.csv": "sheet", "a.rtf": "doc", "a.py": "code", "a.key": "other",
    }  # fmt: skip
    for name, ftype in expected.items():
        resp = _upload(authed_client, project["id"], f"类型-{name}")
        assert resp.status_code == 201, resp.text
        assert resp.json()["type"] == ftype, name


@pytest.mark.parametrize(
    "name",
    ["恶意.exe", "脚本.sh", "无扩展名", "图片.png.exe", "苹果.numbers", "a.pages"],
)
def test_upload_outside_whitelist_415(
    authed_client: TestClient, project: dict, name: str
) -> None:  # R4b
    resp = _upload(authed_client, project["id"], name)
    assert resp.status_code == 415, resp.text  # R4b
    assert resp.json()["detail"] == "不支持的文件类型"  # R8


# ---------- 文件名清洗与重名序号 ----------


def test_sanitize_filename_rules() -> None:  # R4b
    assert sanitize_filename("../../etc/报告.pdf") == "....etc报告.pdf"
    assert sanitize_filename("C:\\Users\\me\\a.txt") == "C:Usersmea.txt"
    assert sanitize_filename("  前后空格.md \t") == "前后空格.md"
    assert sanitize_filename("控\x00制\x1f字\x7f符\n.txt") == "控制字符.txt"
    assert sanitize_filename("evil\u202egnp.js") == "evilgnp.js"
    long = sanitize_filename("长" * 300 + ".docx")
    assert len(long) == 200
    assert long.endswith(".docx")
    assert sanitize_filename(" / \\ \x00 ") == ""


def test_dedupe_filename_rules() -> None:  # R4b
    assert dedupe_filename("a.pdf", set()) == "a.pdf"
    assert dedupe_filename("a.pdf", {"a.pdf"}) == "a (1).pdf"
    assert dedupe_filename("a.pdf", {"a.pdf", "a (1).pdf"}) == "a (2).pdf"
    full = "长" * 196 + ".pdf"
    deduped = dedupe_filename(full, {full})
    assert len(deduped) <= 200
    assert deduped.endswith(" (1).pdf")


def test_upload_sanitizes_and_dedupes(
    authed_client: TestClient, project: dict
) -> None:  # R4b
    # 控制字符经 multipart 客户端会被百分号编码，端到端只断言分隔符与首尾空格；
    # 控制字符清洗由 test_sanitize_filename_rules 直接断言
    resp = _upload(authed_client, project["id"], "  ../子目录\\会议纪要.md  ")
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "..子目录会议纪要.md"  # R4b 清洗

    first = _upload(authed_client, project["id"], "重名.pdf")
    second = _upload(authed_client, project["id"], "重名.pdf")
    third = _upload(authed_client, project["id"], "重名.pdf")
    assert [r.status_code for r in (first, second, third)] == [201, 201, 201]
    assert first.json()["name"] == "重名.pdf"
    assert second.json()["name"] == "重名 (1).pdf"  # R4b 重名序号
    assert third.json()["name"] == "重名 (2).pdf"

    resp = _upload(authed_client, project["id"], "长" * 300 + ".txt")
    assert resp.status_code == 201, resp.text
    assert len(resp.json()["name"]) == 200
    assert resp.json()["name"].endswith(".txt")

    resp = _upload(authed_client, project["id"], " / \\ ")
    assert resp.status_code == 422
    assert resp.json()["detail"] == "文件名无效"  # R8


def test_dedupe_is_per_project(authed_client: TestClient, project: dict) -> None:  # R4b
    """重名判定按项目：种子 WEB 已有「导航梳理结论.pdf」，本项目同名不加序号。"""
    resp = _upload(authed_client, project["id"], "导航梳理结论.pdf")
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "导航梳理结论.pdf"


# ---------- 下载 / 快照 / 任务关联 ----------


def test_download_content_and_snapshot_metadata(
    authed_client: TestClient, project: dict
) -> None:  # R4b, R11
    payload = "下载内容校验\n".encode() * 100
    resp = _upload(authed_client, project["id"], "下载 测试.txt", payload)
    assert resp.status_code == 201, resp.text
    meta = resp.json()

    dl = authed_client.get(f"/api/files/{meta['id']}/content")
    assert dl.status_code == 200
    assert dl.content == payload  # R4b 字节一致
    assert dl.headers["content-disposition"].startswith("attachment;")
    assert dl.headers["x-content-type-options"] == "nosniff"
    assert dl.headers["content-type"].startswith("text/plain")

    files = _snapshot_files(authed_client)
    snap = files[meta["id"]]  # R4b 快照可见元数据
    assert snap["name"] == "下载 测试.txt"
    assert snap["type"] == "doc"
    assert snap["size_bytes"] == len(payload)
    assert snap["project_id"] == project["id"]
    assert snap["task_id"] is None
    assert snap["by_id"] is not None  # 管理员关联 Owner 成员


def test_download_missing_404(authed_client: TestClient) -> None:  # R4b, R8
    resp = authed_client.get(f"/api/files/{uuid.uuid4()}/content")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "文件不存在"
    # 种子文件仅有元数据、无卷内容
    seed = next(
        f
        for f in _snapshot_files(authed_client).values()
        if f["name"] == "首页线框图-v3.fig"
    )
    resp = authed_client.get(f"/api/files/{seed['id']}/content")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "文件内容不存在"


def test_upload_linked_to_task(authed_client: TestClient, project: dict) -> None:  # R4b
    resp = authed_client.post(
        "/api/tasks", json={"project_id": project["id"], "title": "PR-6 附件任务"}
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()

    resp = _upload(authed_client, project["id"], "任务附件.png", task_id=task["id"])
    assert resp.status_code == 201, resp.text
    assert resp.json()["task_id"] == task["id"]  # R4b 关联任务
    assert _snapshot_files(authed_client)[resp.json()["id"]]["task_id"] == task["id"]

    # 任务不属于该项目 / 不存在 / 项目不存在 → 422 中文
    web_task = next(
        t for t in authed_client.get("/api/snapshot").json()["tasks"]
        if t["key"] == "WEB-109"
    )  # fmt: skip
    resp = _upload(authed_client, project["id"], "跨项目.png", task_id=web_task["id"])
    assert resp.status_code == 422
    assert resp.json()["detail"] == "关联任务不属于该项目"  # R8
    resp = _upload(
        authed_client, project["id"], "无任务.png", task_id=str(uuid.uuid4())
    )
    assert resp.status_code == 422
    assert resp.json()["detail"] == "关联任务不存在"  # R8
    resp = _upload(authed_client, str(uuid.uuid4()), "无项目.png")
    assert resp.status_code == 422
    assert resp.json()["detail"] == "所属项目不存在"  # R8
