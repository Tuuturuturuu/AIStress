import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload
from starlette.responses import JSONResponse

from app.database import Base, engine, get_db
from app import models
from app.schemas import OrganizationCreate, OrganizationOut, UserCreate, UserOut

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None, None]:
    """Create starter tables when the API starts."""
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError:
        logger.warning(
            "PostgreSQL is unavailable during startup. Check DATABASE_URL in backend/.env; "
            "the API will start in degraded mode."
        )
    yield


app = FastAPI(title="AIStress API", version="0.1.0", lifespan=lifespan)


@app.exception_handler(SQLAlchemyError)
def database_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error("Database operation failed (%s)", type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": "PostgreSQL no está disponible. Comprueba DATABASE_URL en backend/.env."
        },
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


@app.get("/api/users", response_model=list[UserOut], tags=["users"])
def list_users(db: Session = Depends(get_db)) -> list[models.User]:
    return list(db.scalars(select(models.User).order_by(models.User.name)).all())


@app.post(
    "/api/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["users"],
)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> models.User:
    user = models.User(name=payload.name.strip(), email=str(payload.email).lower())
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email.") from exc
    return user


@app.get(
    "/api/organizations",
    response_model=list[OrganizationOut],
    tags=["organizations"],
)
def list_organizations(db: Session = Depends(get_db)) -> list[models.Organization]:
    statement = (
        select(models.Organization)
        .options(selectinload(models.Organization.members))
        .order_by(models.Organization.name)
    )
    return list(db.scalars(statement).all())


@app.post(
    "/api/organizations",
    response_model=OrganizationOut,
    status_code=status.HTTP_201_CREATED,
    tags=["organizations"],
)
def create_organization(
    payload: OrganizationCreate, db: Session = Depends(get_db)
) -> models.Organization:
    organization = models.Organization(
        name=payload.name.strip(), description=payload.description
    )
    db.add(organization)
    try:
        db.commit()
        db.refresh(organization)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una organización con ese nombre.") from exc
    return organization


@app.post(
    "/api/organizations/{organization_id}/members/{user_id}",
    response_model=OrganizationOut,
    tags=["organizations"],
)
def add_organization_member(
    organization_id: int,
    user_id: int,
    db: Session = Depends(get_db),
) -> models.Organization:
    organization = db.scalar(
        select(models.Organization)
        .where(models.Organization.id == organization_id)
        .options(selectinload(models.Organization.members))
    )
    user = db.get(models.User, user_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user not in organization.members:
        organization.members.append(user)
        db.commit()
        db.refresh(organization)
    return organization
