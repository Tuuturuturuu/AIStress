import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from uuid import uuid4

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import (
    DBAPIError,
    IntegrityError,
    InterfaceError,
    OperationalError,
    SQLAlchemyError,
)
from sqlalchemy.orm import Session, selectinload
from starlette.responses import JSONResponse

from app import models
from app.auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    create_session_token,
    get_session_user_id,
)
from app.database import Base, engine, get_db, install_database_constraints
from app.passwords import hash_password, verify_password
from app.schemas import (
    AccountUpdate,
    LoginRequest,
    OrganizationJoinRequestDecision,
    OrganizationJoinRequestOut,
    OrganizationOut,
    OrganizationSummaryOut,
    RegistrationRequest,
    UserOut,
)

logger = logging.getLogger(__name__)
DUMMY_PASSWORD_HASH = hash_password("invalid-login-timing-check")
UPLOAD_DIRECTORY = Path(__file__).resolve().parents[1] / "uploads"
ORGANIZATION_UPLOAD_DIRECTORY = UPLOAD_DIRECTORY / "organizations"
MAX_ORGANIZATION_LOGO_BYTES = 5 * 1024 * 1024
ALLOWED_LOGO_FORMATS = {
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/webp": (
        ".webp",
        lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
    ),
}


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> models.User:
    try:
        user_id = get_session_user_id(request.cookies.get(SESSION_COOKIE_NAME))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503, detail="Authentication is not configured."
        ) from exc
    if user_id is None:
        raise HTTPException(status_code=401, detail="The session is invalid.")
    user = db.get(models.User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="The session is invalid.")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="You are not allowed to access this resource."
        )
    return user


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None, None]:
    """Create starter tables when the API starts."""
    try:
        Base.metadata.create_all(bind=engine)
        install_database_constraints()
    except SQLAlchemyError:
        logger.warning(
            "PostgreSQL is unavailable during startup. Check DATABASE_URL in backend/.env; "
            "the API will start in degraded mode."
        )
    yield


app = FastAPI(title="AIStress API", version="0.1.0", lifespan=lifespan)
app.mount(
    "/media",
    StaticFiles(directory=str(UPLOAD_DIRECTORY), check_dir=False),
    name="media",
)


@app.exception_handler(SQLAlchemyError)
def database_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    original = exc.orig if isinstance(exc, DBAPIError) else None
    sqlstate = (
        getattr(original, "sqlstate", None)
        or getattr(original, "pgcode", None)
    )
    unavailable = (
        isinstance(exc, (OperationalError, InterfaceError))
        or bool(getattr(exc, "connection_invalidated", False))
        or (sqlstate is not None and sqlstate.startswith("08"))
    )
    logger.error(
        "Database operation failed (%s; SQLSTATE %s)",
        type(exc).__name__,
        sqlstate or "unknown",
    )
    if unavailable:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": "PostgreSQL is unavailable. Check DATABASE_URL in backend/.env."
            },
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database operation failed. Please try again."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
def health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    """Report API and database availability."""
    try:
        db.execute(text("SELECT 1"))
        database_status = "connected"
    except SQLAlchemyError:
        database_status = "disconnected"
    return {"status": "ok", "database": database_status}


@app.post(
    "/api/auth/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["authentication"],
)
def register(payload: RegistrationRequest, db: Session = Depends(get_db)) -> models.User:
    user = models.User(
        name=payload.name,
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        role=models.UserRole.USER,
        organization=None,
        accessibility={},
        privacy_data={},
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The account could not be created. Check the details and try again.",
        ) from exc
    return user


@app.post("/api/auth/login", response_model=UserOut, tags=["authentication"])
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> models.User:
    email = str(payload.email).lower()
    user = db.scalar(select(models.User).where(models.User.email == email))
    stored_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(payload.password, stored_hash)
    if user is None or not user.is_active or not password_is_valid:
        raise HTTPException(
            status_code=401, detail="The email or password is incorrect."
        )
    try:
        token = create_session_token(user.user_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503, detail="Authentication is not configured."
        ) from exc
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )
    return user


@app.get("/api/auth/me", response_model=UserOut, tags=["authentication"])
def read_current_user(
    user: models.User = Depends(get_current_user),
) -> models.User:
    return user


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT, tags=["authentication"])
def logout(request: Request, response: Response) -> Response:
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        path="/",
    )
    return response


def organization_request_out(
    request: models.OrganizationJoinRequest,
) -> OrganizationJoinRequestOut:
    return OrganizationJoinRequestOut(
        request_id=request.request_id,
        organization_id=request.organization_id,
        organization_name=request.organization.name,
        status=request.status,
        requested_at=request.requested_at,
        decided_at=request.decided_at,
        decided_by_user_id=request.decided_by_user_id,
        user=request.user,
    )


async def store_organization_logo(logo: UploadFile | None) -> tuple[str, Path] | None:
    if logo is None:
        return None

    content = await logo.read(MAX_ORGANIZATION_LOGO_BYTES + 1)
    await logo.close()
    if len(content) > MAX_ORGANIZATION_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="The logo cannot exceed 5 MiB.")
    if not content:
        raise HTTPException(status_code=422, detail="The logo file is empty.")

    format_details = ALLOWED_LOGO_FORMATS.get(logo.content_type or "")
    if format_details is None or not format_details[1](content):
        raise HTTPException(
            status_code=415,
            detail="The logo must be a valid PNG, JPEG, or WebP image.",
        )

    extension = format_details[0]
    filename = f"{uuid4().hex}{extension}"
    relative_path = f"organizations/{filename}"
    file_path = ORGANIZATION_UPLOAD_DIRECTORY / filename
    try:
        ORGANIZATION_UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(content)
    except OSError as exc:
        raise HTTPException(
            status_code=503, detail="The logo file could not be saved."
        ) from exc
    return relative_path, file_path


def remove_stored_logo(file_path: Path | None) -> None:
    if file_path is None:
        return
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not remove an uncommitted organization logo.")


@app.put("/api/profile/account", response_model=UserOut, tags=["profile"])
def update_account(
    payload: AccountUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if payload.new_password is not None and not verify_password(
        payload.current_password or "", user.password_hash
    ):
        raise HTTPException(status_code=400, detail="The current password is incorrect.")

    user.name = payload.name
    user.email = str(payload.email).lower()
    if payload.new_password is not None:
        user.password_hash = hash_password(payload.new_password)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="That email address is already in use."
        ) from exc
    return user


@app.get(
    "/api/users",
    response_model=list[UserOut],
    tags=["users"],
    dependencies=[Depends(require_admin)],
)
def list_users(db: Session = Depends(get_db)) -> list[models.User]:
    return list(
        db.scalars(select(models.User).order_by(models.User.name, models.User.user_id)).all()
    )


@app.get(
    "/api/organizations",
    response_model=list[OrganizationOut],
    tags=["organizations"],
    dependencies=[Depends(require_admin)],
)
def list_organizations(db: Session = Depends(get_db)) -> list[models.Organization]:
    statement = (
        select(models.Organization)
        .options(selectinload(models.Organization.members))
        .order_by(models.Organization.name, models.Organization.org_id)
    )
    return list(db.scalars(statement).all())


@app.get(
    "/api/profile/organization",
    response_model=OrganizationOut | None,
    tags=["profile"],
)
def read_profile_organization(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut | None:
    if user.org_id is None:
        return None
    organization = db.scalar(
        select(models.Organization)
        .where(models.Organization.org_id == user.org_id)
        .options(selectinload(models.Organization.members))
    )
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    result = OrganizationOut.model_validate(organization)
    if user.role == models.UserRole.MANAGER:
        pending = db.scalars(
            select(models.OrganizationJoinRequest)
            .where(
                models.OrganizationJoinRequest.organization_id == organization.org_id,
                models.OrganizationJoinRequest.status
                == models.OrganizationRequestStatus.PENDING,
            )
            .options(
                selectinload(models.OrganizationJoinRequest.user),
                selectinload(models.OrganizationJoinRequest.organization),
            )
            .order_by(models.OrganizationJoinRequest.requested_at)
        ).all()
        result.pending_requests = [organization_request_out(item) for item in pending]
    return result


@app.get(
    "/api/profile/organization/requests",
    response_model=list[OrganizationJoinRequestOut],
    tags=["profile"],
)
def list_my_organization_requests(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrganizationJoinRequestOut]:
    requests = db.scalars(
        select(models.OrganizationJoinRequest)
        .where(models.OrganizationJoinRequest.user_id == user.user_id)
        .options(
            selectinload(models.OrganizationJoinRequest.user),
            selectinload(models.OrganizationJoinRequest.organization),
        )
        .order_by(models.OrganizationJoinRequest.requested_at.desc())
    ).all()
    return [organization_request_out(item) for item in requests]


@app.get(
    "/api/profile/organization/search",
    response_model=list[OrganizationSummaryOut],
    tags=["profile"],
)
def search_profile_organizations(
    q: str = Query(min_length=2, max_length=160),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[models.Organization]:
    if user.role == models.UserRole.ADMIN:
        raise HTTPException(
            status_code=403, detail="ADMIN accounts cannot belong to organizations."
        )
    if user.org_id is not None:
        raise HTTPException(
            status_code=409, detail="You already belong to an organization."
        )
    query = q.strip()
    if len(query) < 2:
        raise HTTPException(
            status_code=422, detail="Enter at least two characters to search."
        )
    organizations = db.scalars(
        select(models.Organization).where(models.Organization.is_active.is_(True))
    ).all()
    normalized_query = query.casefold()
    ranked_results = []
    for organization in organizations:
        normalized_name = organization.name.casefold()
        similarity = SequenceMatcher(None, normalized_query, normalized_name).ratio()
        if normalized_query in normalized_name or similarity >= 0.35:
            ranked_results.append(
                (organization, normalized_query in normalized_name, similarity)
            )
    ranked_results.sort(
        key=lambda item: (not item[1], -item[2], item[0].name.casefold())
    )
    return [item[0] for item in ranked_results[:10]]


@app.post(
    "/api/profile/organization",
    response_model=OrganizationOut,
    status_code=status.HTTP_201_CREATED,
    tags=["profile"],
)
async def create_profile_organization(
    name: str = Form(min_length=1, max_length=160),
    description: str = Form(min_length=1),
    address: str = Form(min_length=1),
    logo: UploadFile | None = File(default=None),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationOut:
    if user.role != models.UserRole.USER or user.org_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Only a user without an organization can create one.",
        )
    name, description, address = name.strip(), description.strip(), address.strip()
    if not name or not description or not address:
        raise HTTPException(
            status_code=422,
            detail="Name, description, and address are required.",
        )

    stored_logo = await store_organization_logo(logo)
    relative_logo_path, logo_file_path = stored_logo or (None, None)
    organization = models.Organization(
        name=name,
        description=description,
        address=address,
        logo_path=relative_logo_path,
    )
    db.add(organization)
    try:
        db.flush()
        user.organization = organization
        user.role = models.UserRole.MANAGER
        db.commit()
        db.refresh(organization)
    except IntegrityError as exc:
        db.rollback()
        remove_stored_logo(logo_file_path)
        raise HTTPException(
            status_code=409,
            detail="An organization with that name already exists.",
        ) from exc
    except SQLAlchemyError:
        db.rollback()
        remove_stored_logo(logo_file_path)
        raise
    return OrganizationOut.model_validate(organization)


@app.post(
    "/api/profile/organization/requests/{organization_id}",
    response_model=OrganizationJoinRequestOut,
    status_code=status.HTTP_201_CREATED,
    tags=["profile"],
)
def request_organization_membership(
    organization_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationJoinRequestOut:
    if user.role != models.UserRole.USER or user.org_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Only a user without an organization can request to join one.",
        )
    organization = db.get(models.Organization, organization_id)
    if organization is None or not organization.is_active:
        raise HTTPException(status_code=404, detail="Organization was not found.")
    pending = db.scalar(
        select(models.OrganizationJoinRequest.request_id).where(
            models.OrganizationJoinRequest.organization_id == organization_id,
            models.OrganizationJoinRequest.user_id == user.user_id,
            models.OrganizationJoinRequest.status
            == models.OrganizationRequestStatus.PENDING,
        )
    )
    if pending is not None:
        raise HTTPException(
            status_code=409, detail="You already have a pending request."
        )

    join_request = models.OrganizationJoinRequest(
        organization_id=organization_id,
        user_id=user.user_id,
    )
    db.add(join_request)
    try:
        db.commit()
        db.refresh(join_request)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="The join request could not be created."
        ) from exc
    return organization_request_out(join_request)


@app.post(
    "/api/profile/organization/requests/{request_id}/decision",
    response_model=OrganizationJoinRequestOut,
    tags=["profile"],
)
def decide_organization_request(
    request_id: int,
    payload: OrganizationJoinRequestDecision,
    manager: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrganizationJoinRequestOut:
    if manager.role != models.UserRole.MANAGER or manager.org_id is None:
        raise HTTPException(
            status_code=403,
            detail="Only organization managers can decide on join requests.",
        )
    join_request = db.scalar(
        select(models.OrganizationJoinRequest)
        .where(models.OrganizationJoinRequest.request_id == request_id)
        .with_for_update()
        .options(
            selectinload(models.OrganizationJoinRequest.user),
            selectinload(models.OrganizationJoinRequest.organization),
        )
    )
    if join_request is None or join_request.organization_id != manager.org_id:
        raise HTTPException(status_code=404, detail="Join request was not found.")
    if join_request.status != models.OrganizationRequestStatus.PENDING:
        raise HTTPException(status_code=409, detail="The join request has already been resolved.")

    if payload.status == models.OrganizationRequestStatus.APPROVED:
        requester = db.scalar(
            select(models.User)
            .where(models.User.user_id == join_request.user_id)
            .with_for_update()
        )
        if (
            requester is None
            or not requester.is_active
            or requester.role != models.UserRole.USER
            or requester.org_id is not None
        ):
            raise HTTPException(
                status_code=409,
                detail="The user can no longer join this organization.",
            )
        db.execute(
            delete(models.Configuration).where(
                models.Configuration.user_id == requester.user_id
            )
        )
        requester.organization = join_request.organization
        requester.role = models.UserRole.USER

    decided_at = datetime.now(timezone.utc)
    join_request.status = payload.status
    join_request.decided_at = decided_at
    join_request.decided_by_user_id = manager.user_id
    if payload.status == models.OrganizationRequestStatus.APPROVED:
        db.execute(
            update(models.OrganizationJoinRequest)
            .where(
                models.OrganizationJoinRequest.user_id == join_request.user_id,
                models.OrganizationJoinRequest.request_id != join_request.request_id,
                models.OrganizationJoinRequest.status
                == models.OrganizationRequestStatus.PENDING,
            )
            .values(
                status=models.OrganizationRequestStatus.CANCELLED,
                decided_at=decided_at,
                decided_by_user_id=None,
            )
        )
    try:
        db.commit()
        db.refresh(join_request)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The join request could not be resolved.",
        ) from exc
    return organization_request_out(join_request)


@app.post(
    "/api/profile/organization/members/{user_id}/manager",
    response_model=UserOut,
    tags=["profile"],
)
def promote_organization_manager(
    user_id: int,
    manager: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if manager.role != models.UserRole.MANAGER or manager.org_id is None:
        raise HTTPException(
            status_code=403,
            detail="Only organization managers can promote members.",
        )
    member = db.scalar(
        select(models.User)
        .where(models.User.user_id == user_id)
        .with_for_update()
    )
    if member is None or member.org_id != manager.org_id:
        raise HTTPException(status_code=404, detail="Member was not found.")
    if member.role == models.UserRole.MANAGER:
        raise HTTPException(status_code=409, detail="The user is already a manager.")
    if member.role != models.UserRole.USER or not member.is_active:
        raise HTTPException(
            status_code=409, detail="Only active users can be promoted."
        )

    member.role = models.UserRole.MANAGER
    try:
        db.commit()
        db.refresh(member)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="The member could not be promoted to manager."
        ) from exc
    return member
