"""文件上传与下载路由（R4b：multipart 上传存服务端卷，元数据入库）。

- ``POST /api/files``（multipart：``file`` + ``project_id`` + 可选 ``task_id``）：
  单文件上限 10MB（超限 413）；扩展名白名单外 415；文件名清洗——去除路径分隔符、
  控制字符（含 Unicode 双向控制符）与首尾空格，长度 ≤200（截断保留扩展名）；
  同项目内重名（按清洗后名称、大小写敏感）在扩展名前追加序号 ``名称 (n).ext``；
  每请求仅 1 个文件（多文件 422）；
- ``GET /api/files/{id}/content``：内容下载（``Content-Disposition: attachment``
  + ``nosniff``，防 svg/html 被同源内联执行；``<img>`` 预览不受 attachment 影响）；
- 元数据读面由快照 ``files`` 承载（不设列表 GET，沿 PR-5 先例）；
- 内容存卷 ``settings.FILES_DIR``（compose 卷 ``/data/files``），盘上文件名为记录
  UUID，与用户文件名解耦；任务关联在上传时经 ``task_id`` 指定，须存在且属同项目
  （否则 422），不提供上传后改挂；
- 不产生 activity / 通知；删除项目经 ``file.project_id`` 外键 ``ON DELETE CASCADE``
  级联删除元数据行（卷内容不清理，孤儿文件留后续）。
"""

import mimetypes
import unicodedata
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import select
from starlette.datastructures import UploadFile as StarletteUploadFile

from app import crud_domain
from app.api import serializers
from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import File as FileRecord
from app.schemas import FilePublic

router = APIRouter(prefix="/files", tags=["files"])

MAX_FILE_BYTES = 10 * 1024 * 1024  # R4b：单文件 ≤10MB
MAX_NAME_LENGTH = 200  # R4b：文件名长度 ≤200（与 file.name 列宽一致）
_CHUNK = 1024 * 1024

# R4b 扩展名白名单（逐字规格枚举）→ 展示分类（对齐原型 helpers.js fileType）
_EXT_TYPES: dict[str, str] = {
    **dict.fromkeys(("png", "jpg", "jpeg", "gif", "webp", "svg", "heic"), "img"),
    "pdf": "pdf",
    **dict.fromkeys(("doc", "docx", "txt", "md", "rtf"), "doc"),
    **dict.fromkeys(("xlsx", "xls", "csv"), "sheet"),
    **dict.fromkeys(("ppt", "pptx", "key"), "other"),
    **dict.fromkeys(("zip", "rar", "7z"), "zip"),
    **dict.fromkeys(("js", "ts", "json", "html", "css", "py"), "code"),
    "fig": "fig",
}
ALLOWED_EXTENSIONS = frozenset(_EXT_TYPES)

# Unicode 双向控制符（ALM、LRM/RLM、嵌入/覆盖、隔离；可伪装扩展名，如
# "evil\u202egnp.js"），按控制字符一并去除：U+061C、U+200E、U+200F、U+202A–202E、
# U+2066–2069
BIDI_CONTROLS = frozenset(
    "\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
)


def _split_ext(name: str) -> tuple[str, str]:
    stem, dot, ext = name.rpartition(".")
    if not dot:
        return name, ""
    return stem, ext


def sanitize_filename(raw: str) -> str:
    """清洗文件名（R4b）：去路径分隔符与控制字符、去首尾空格、截断至 ≤200 保留扩展名。"""
    cleaned = "".join(
        ch
        for ch in raw
        if ch not in "/\\"
        and unicodedata.category(ch) != "Cc"
        and ch not in BIDI_CONTROLS
    ).strip()
    if len(cleaned) > MAX_NAME_LENGTH:
        stem, ext = _split_ext(cleaned)
        if ext and len(ext) < MAX_NAME_LENGTH - 1:
            cleaned = f"{stem[: MAX_NAME_LENGTH - len(ext) - 1].rstrip()}.{ext}"
        else:
            cleaned = cleaned[:MAX_NAME_LENGTH].rstrip()
    return cleaned


def file_extension(name: str) -> str:
    return _split_ext(name)[1].lower()


def dedupe_filename(name: str, existing: set[str]) -> str:
    """重名追加序号（R4b）：``报告.pdf`` → ``报告 (1).pdf`` → ``报告 (2).pdf``，总长仍 ≤200。"""
    if name not in existing:
        return name
    stem, ext = _split_ext(name)
    suffix_ext = f".{ext}" if ext else ""
    n = 1
    while True:
        tag = f" ({n})"
        room = MAX_NAME_LENGTH - len(tag) - len(suffix_ext)
        candidate = f"{stem[:room].rstrip()}{tag}{suffix_ext}"
        if candidate not in existing:
            return candidate
        n += 1


def _content_path(file_id: uuid.UUID) -> Path:
    return Path(settings.FILES_DIR) / str(file_id)


async def _require_single_file(request: Request) -> None:
    """每请求仅 1 个文件（R4b 单文件口径）：统计原始表单中**所有键**的文件部件。

    FastAPI 的单 ``UploadFile`` 参数对同名重复字段只取最后一个、对其他键名的文件
    部件直接忽略——两种情况都会静默丢文件，故在原始 multipart 表单上计数。
    """
    form = await request.form()  # Starlette 缓存解析结果，与端点参数共用
    count = sum(
        1 for _, value in form.multi_items() if isinstance(value, StarletteUploadFile)
    )
    if count > 1:
        raise HTTPException(status_code=422, detail="一次只能上传一个文件")


@router.post("", response_model=FilePublic, status_code=201)
def upload_file(
    session: SessionDep,
    current_user: CurrentUser,
    _single: Annotated[None, Depends(_require_single_file)],
    file: Annotated[UploadFile, File(description="上传文件（每请求仅 1 个，≤10MB）")],
    project_id: Annotated[uuid.UUID, Form()],
    task_id: Annotated[uuid.UUID | None, Form()] = None,
) -> FilePublic:
    upload = file
    if crud_domain.get_project(session, project_id) is None:
        raise HTTPException(status_code=422, detail="所属项目不存在")
    if task_id is not None:
        task = crud_domain.get_task(session, task_id)
        if task is None:
            raise HTTPException(status_code=422, detail="关联任务不存在")
        if task.project_id != project_id:
            raise HTTPException(status_code=422, detail="关联任务不属于该项目")

    name = sanitize_filename(upload.filename or "")
    if not name:
        raise HTTPException(status_code=422, detail="文件名无效")
    ext = file_extension(name)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="不支持的文件类型")

    record_id = uuid.uuid4()
    target = _content_path(record_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(f"{record_id}.part")
    size = 0
    try:
        with partial.open("wb") as out:
            while chunk := upload.file.read(_CHUNK):
                size += len(chunk)
                if size > MAX_FILE_BYTES:
                    raise HTTPException(
                        status_code=413, detail="文件过大，单个文件不能超过 10MB"
                    )
                out.write(chunk)
        existing = set(
            session.exec(
                select(FileRecord.name).where(FileRecord.project_id == project_id)
            ).all()
        )
        record = FileRecord(
            id=record_id,
            project_id=project_id,
            task_id=task_id,
            name=dedupe_filename(name, existing),
            type=_EXT_TYPES[ext],
            size_bytes=size,
            by_id=current_user.owner_member_id,
        )
        partial.replace(target)
        session.add(record)
        session.commit()
    except BaseException:
        partial.unlink(missing_ok=True)
        target.unlink(missing_ok=True)
        raise
    session.refresh(record)
    return serializers.file_public(record)


@router.get("/{file_id}/content", response_class=FileResponse)
def download_file(
    file_id: uuid.UUID, session: SessionDep, _current_user: CurrentUser
) -> FileResponse:
    record = session.get(FileRecord, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    path = _content_path(record.id)
    if not path.is_file():
        # 种子文件仅有元数据、无内容（seed_data 说明）
        raise HTTPException(status_code=404, detail="文件内容不存在")
    media_type = mimetypes.guess_type(record.name)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        filename=record.name,
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )
