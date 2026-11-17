"""Account-private durable creation endpoints; legacy project POST stays compatible."""

from fastapi import APIRouter

from app import project_creation
from app.api.deps import CurrentUser, SessionDep
from app.core.db import engine
from app.schemas import CreationOrderInput, CreationResult, ProjectCreationInput

router = APIRouter(prefix="/project-creations", tags=["project-creations"])


@router.post("/{intent_id}", response_model=CreationResult)
def create(
    intent_id: str,
    payload: ProjectCreationInput,
    session: SessionDep,
    current_user: CurrentUser,
) -> CreationResult:
    session.expunge(current_user)
    session.rollback()
    return project_creation.create_or_retry(engine, current_user, intent_id, payload)


@router.get("/{intent_id}", response_model=CreationResult)
def read(
    intent_id: str, session: SessionDep, current_user: CurrentUser
) -> CreationResult:
    return project_creation.read_creation(session, current_user, intent_id)


@router.patch("/{intent_id}/order", status_code=204)
def order(
    intent_id: str,
    payload: CreationOrderInput,
    session: SessionDep,
    current_user: CurrentUser,
) -> None:
    session.expunge(current_user)
    session.rollback()
    project_creation.order_creation(engine, current_user, intent_id, payload)
