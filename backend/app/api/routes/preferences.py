"""偏好路由（R7：per-user 服务端持久化；管理员行 data 含 ``workspace`` 键，单例语义）。

JSONB 整体读写（不新增表、不做 schema 校验——取舍记入 PR 描述风险评估）。
"""

from fastapi import APIRouter

from app import crud_domain
from app.api.deps import CurrentUser, SessionDep
from app.models import Preference
from app.schemas import PreferencesPublic, PreferencesUpdate

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=PreferencesPublic)
def get_preferences(
    session: SessionDep, current_user: CurrentUser
) -> PreferencesPublic:
    """当前用户偏好（R7）；无记录返回空对象（前端以内置默认值合并）。"""
    pref = crud_domain.get_preference(session, current_user.id)
    return PreferencesPublic(data=pref.data if pref else {})


@router.put("", response_model=PreferencesPublic)
def put_preferences(
    payload: PreferencesUpdate, session: SessionDep, current_user: CurrentUser
) -> PreferencesPublic:
    """整体覆盖当前用户偏好（R7，含 ``workspace`` 键的读写）。"""
    pref = crud_domain.get_preference(session, current_user.id)
    if pref is None:
        pref = Preference(user_id=current_user.id, data=payload.data)
    else:
        pref.data = payload.data
    session.add(pref)
    session.commit()
    session.refresh(pref)
    return PreferencesPublic(data=pref.data)
