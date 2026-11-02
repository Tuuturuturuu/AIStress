import asyncio
from collections.abc import Iterator

import httpx
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import main, models
from app.database import Base, get_db
from app.passwords import verify_password


@pytest.fixture
def client() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    db = Session(engine)

    def override_get_db() -> Iterator[Session]:
        yield db

    main.app.dependency_overrides[get_db] = override_get_db
    try:
        yield db
    finally:
        main.app.dependency_overrides.pop(get_db, None)
        db.close()
        engine.dispose()


def post_registration(payload: dict[str, str]) -> httpx.Response:
    async def send_request() -> httpx.Response:
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as test_client:
            return await test_client.post("/api/auth/register", json=payload)

    return asyncio.run(send_request())


def registration_payload(**overrides: str) -> dict[str, str]:
    return {
        "name": "  Ada Lovelace  ",
        "email": "ADA@example.com",
        "password": "secure-password",
        "password_confirmation": "secure-password",
        **overrides,
    }


def test_registration_creates_user_without_organization_or_plaintext_password(
    client: Session,
) -> None:
    response = post_registration(registration_payload())

    assert response.status_code == 201
    result = response.json()
    assert result["name"] == "Ada Lovelace"
    assert result["email"] == "ada@example.com"
    assert result["role"] == "USER"
    assert result["org_id"] is None
    assert "password" not in result
    assert "password_hash" not in result

    user = client.scalar(
        select(models.User).where(models.User.email == "ada@example.com")
    )
    assert user is not None
    assert user.password_hash != "secure-password"
    assert user.password_hash.startswith("scrypt$")
    assert verify_password("secure-password", user.password_hash)
    assert user.org_id is None
    assert user.role == models.UserRole.USER


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"password": "short"},
        {"password_confirmation": "different-password"},
        {"name": "   "},
        {"role": "ADMIN"},
        {"org_id": "1"},
    ],
)
def test_registration_rejects_invalid_fields_without_creating_user(
    client: Session,
    overrides: dict[str, str],
) -> None:
    response = post_registration(registration_payload(**overrides))

    assert response.status_code == 422
    assert client.scalar(select(func.count()).select_from(models.User)) == 0


@pytest.mark.parametrize(
    "missing_field",
    ["name", "email", "password", "password_confirmation"],
)
def test_registration_requires_all_fields(
    client: Session,
    missing_field: str,
) -> None:
    payload = registration_payload()
    payload.pop(missing_field)

    response = post_registration(payload)

    assert response.status_code == 422
    assert client.scalar(select(func.count()).select_from(models.User)) == 0


def test_registration_rejects_duplicate_email_without_changing_database(
    client: Session,
) -> None:
    payload = registration_payload()

    first_response = post_registration(payload)
    duplicate_response = post_registration(payload)

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 409
    assert client.scalar(select(func.count()).select_from(models.User)) == 1
