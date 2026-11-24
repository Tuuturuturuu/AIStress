import asyncio
from collections.abc import Iterator
from http.cookies import SimpleCookie

import httpx
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import main, models
from app.database import Base, get_db


@pytest.fixture
def db_session(monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    monkeypatch.setenv("AUTH_SESSION_SECRET", "test-models-secret-012345678901234567890123")
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


def api_call(
    method: str,
    path: str,
    *,
    payload: dict | None = None,
    cookie: str | None = None,
    admin_key: str | None = None,
) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=main.app)
        headers = {"Cookie": f"aistress_session={cookie}"} if cookie else {}
        if admin_key:
            headers["X-Admin-Key"] = admin_key
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.request(
                method,
                path,
                json=payload,
                headers=headers,
            )

    return asyncio.run(send())


def create_account(email: str) -> str:
    registration = api_call(
        "POST",
        "/api/auth/register",
        payload={
            "name": email.split("@")[0],
            "email": email,
            "password": "secure-password",
            "password_confirmation": "secure-password",
        },
    )
    assert registration.status_code == 201
    login = api_call(
        "POST",
        "/api/auth/login",
        payload={"email": email, "password": "secure-password"},
    )
    assert login.status_code == 200
    parsed_cookie = SimpleCookie()
    parsed_cookie.load(login.headers["set-cookie"])
    return parsed_cookie["aistress_session"].value


def add_admin(db: Session) -> str:
    cookie = create_account("admin@example.com")
    admin = db.scalar(select(models.User).where(models.User.email == "admin@example.com"))
    assert admin is not None
    admin.role = models.UserRole.ADMIN
    db.commit()
    return cookie


def test_public_catalog_filters_only_active_models(db_session: Session) -> None:
    active = models.AIModel(
        name="Hosted Qwen",
        version="latest",
        provider="qwen",
        runtime="OPENAI",
        description="A conversational model",
        family="qwen",
        parameter_size="7B",
        model_format="gguf",
        capabilities=["completion", "tools"],
        category=models.ModelCategory.CONVERSACIONAL,
    )
    inactive = models.AIModel(
        name="Inactive Qwen",
        version="1",
        provider="qwen",
        runtime="OPENAI",
        family="qwen",
        parameter_size="3B",
        model_format="gguf",
        capabilities=["completion"],
        category=models.ModelCategory.CONVERSACIONAL,
        is_active=False,
    )
    db_session.add_all([active, inactive])
    db_session.commit()

    public_list = api_call("GET", "/api/models")
    filtered = api_call(
        "GET",
        "/api/models?provider=qwen&parameter_size=7B&capability=tools",
    )
    hidden_detail = api_call("GET", f"/api/models/{inactive.model_id}")

    assert public_list.status_code == 200
    assert [item["name"] for item in public_list.json()] == ["Hosted Qwen"]
    assert filtered.status_code == 200
    assert [item["model_id"] for item in filtered.json()] == [active.model_id]
    assert hidden_detail.status_code == 404


def test_user_can_discover_and_register_private_ollama_model(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_cookie = create_account("ollama-owner@example.com")
    owner = db_session.scalar(
        select(models.User).where(models.User.email == "ollama-owner@example.com")
    )
    assert owner is not None
    server_url = "http://192.168.10.5:11434"
    monkeypatch.setattr(
        main,
        "ollama_models",
        lambda *, base_url: [
            {
                "name": "llama3.2:1b",
                "size": 1_000,
                "modified_at": "2026-01-01T00:00:00Z",
                "digest": "0123456789abcdef",
                "details": {
                    "family": "llama",
                    "parameter_size": "1B",
                    "format": "gguf",
                    "quantization_level": "Q4_K_M",
                },
            }
        ] if base_url == server_url else [],
    )
    monkeypatch.setattr(
        main,
        "ollama_model_details",
        lambda _, *, base_url: {
            "details": {
                "family": "llama",
                "parameter_size": "1B",
                "format": "gguf",
                "quantization_level": "Q4_K_M",
            },
            "capabilities": ["text", "tools"],
        } if base_url == server_url else {},
    )

    discovery = api_call(
        "POST",
        "/api/profile/ollama/discover",
        payload={"base_url": server_url},
        cookie=user_cookie,
    )
    registered = api_call(
        "POST",
        "/api/profile/ollama/models",
        payload={
            "name": "llama3.2:1b",
            "description": "Small local conversational model.",
            "base_url": server_url,
        },
        cookie=user_cookie,
    )

    assert discovery.status_code == 200
    assert discovery.json()[0]["family"] == "llama"
    assert registered.status_code == 201
    result = registered.json()
    assert result["runtime"] == "OLLAMA"
    assert result["provider"] == "llama"
    assert result["parameter_size"] == "1B"
    assert result["model_format"] == "gguf"
    assert result["quantization"] == "Q4_K_M"
    assert result["capabilities"] == ["text", "tools"]
    assert result["category"] == "CONVERSACIONAL"
    registered_model = db_session.get(models.AIModel, result["model_id"])
    assert registered_model is not None
    assert registered_model.ollama_user_id == owner.user_id
    assert registered_model.ollama_base_url == server_url

    owned_models = api_call(
        "GET",
        "/api/profile/ollama/models",
        cookie=user_cookie,
    )
    public_list = api_call("GET", "/api/models", cookie=user_cookie)
    anonymous_list = api_call("GET", "/api/models")
    assert [item["model_id"] for item in owned_models.json()] == [result["model_id"]]
    assert [item["model_id"] for item in public_list.json()] == [result["model_id"]]
    assert anonymous_list.json() == []

    duplicate = api_call(
        "POST",
        "/api/profile/ollama/models",
        payload={
            "name": "llama3.2:1b",
            "description": "Duplicate",
            "base_url": server_url,
        },
        cookie=user_cookie,
    )
    assert duplicate.status_code == 409

    another_user = create_account("other-ollama@example.com")
    assert api_call("GET", "/api/models", cookie=another_user).json() == []
    assert api_call(
        "GET",
        f"/api/models/{result['model_id']}",
        cookie=another_user,
    ).status_code == 404

    deactivated = api_call(
        "PATCH",
        f"/api/profile/ollama/models/{result['model_id']}",
        payload={"is_active": False},
        cookie=user_cookie,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    assert api_call("GET", "/api/models", cookie=user_cookie).json() == []

    reactivated = api_call(
        "PATCH",
        f"/api/profile/ollama/models/{result['model_id']}",
        payload={"is_active": True},
        cookie=user_cookie,
    )
    assert reactivated.status_code == 200


def test_model_management_requires_admin_and_external_category_is_manual(
    db_session: Session,
) -> None:
    user_cookie = create_account("user@example.com")
    denied = api_call("GET", "/api/admin/models", cookie=user_cookie)
    denied_create = api_call(
        "POST",
        "/api/admin/models",
        payload={
            "name": "External",
            "version": "1",
            "provider": "OpenAI",
            "runtime": "OPENAI",
            "category": "CONVERSACIONAL",
            "description": "Hosted model",
        },
        cookie=user_cookie,
    )
    assert denied.status_code == 403
    assert denied_create.status_code == 403

    admin_cookie = add_admin(db_session)
    created = api_call(
        "POST",
        "/api/admin/models",
        payload={
            "name": "Hosted model",
            "version": "1",
            "provider": "OpenAI",
            "runtime": "OPENAI",
            "category": "CONVERSACIONAL",
            "description": "Hosted conversational model",
            "capabilities": ["text", "tools"],
        },
        cookie=admin_cookie,
    )
    assert created.status_code == 201
    updated = api_call(
        "PATCH",
        f"/api/admin/models/{created.json()['model_id']}",
        payload={"description": "Updated description"},
        cookie=admin_cookie,
    )
    assert updated.status_code == 200
    assert updated.json()["description"] == "Updated description"
    deactivated = api_call(
        "DELETE",
        f"/api/admin/models/{created.json()['model_id']}",
        cookie=admin_cookie,
    )
    assert deactivated.status_code == 204
    assert db_session.get(models.AIModel, created.json()["model_id"]).is_active is False


def test_admin_panel_key_authorizes_admin_routes_without_a_user_account(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ADMIN_PANEL_KEY", "a-test-admin-panel-key")
    users = api_call(
        "GET",
        "/api/users",
        admin_key="a-test-admin-panel-key",
    )
    catalog = api_call(
        "GET",
        "/api/admin/models",
        admin_key="a-test-admin-panel-key",
    )
    invalid_key = api_call(
        "GET",
        "/api/admin/models",
        admin_key="incorrect-key",
    )
    assert users.status_code == 200
    assert catalog.status_code == 200
    assert invalid_key.status_code == 401


def test_admin_model_catalog_excludes_user_managed_ollama_models(
    db_session: Session,
) -> None:
    admin_cookie = add_admin(db_session)
    owner = models.User(
        name="Owner",
        email="owner@example.com",
        password_hash=main.hash_password("secure-password"),
        role=models.UserRole.USER,
    )
    db_session.add(owner)
    db_session.flush()
    ollama_model = models.AIModel(
        name="Private model",
        version="latest",
        provider="local",
        runtime="OLLAMA",
        runtime_model_name="local:latest",
        ollama_base_url="http://127.0.0.1:11434",
        ollama_user_id=owner.user_id,
        category=models.ModelCategory.CONVERSACIONAL,
    )
    external = models.AIModel(
        name="External model",
        version="1",
        provider="external",
        runtime="OPENAI",
        category=models.ModelCategory.CONVERSACIONAL,
    )
    db_session.add_all([ollama_model, external])
    db_session.commit()
    catalog = api_call("GET", "/api/admin/models", cookie=admin_cookie)
    assert catalog.status_code == 200
    assert [item["model_id"] for item in catalog.json()] == [external.model_id]


def test_ollama_status_requires_login_and_reports_server_failures(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cookie = create_account("viewer@example.com")
    viewer = db_session.scalar(
        select(models.User).where(models.User.email == "viewer@example.com")
    )
    assert viewer is not None
    db_session.add(
        models.AIModel(
            name="Installed model",
            version="latest",
            provider="llama",
            runtime="OLLAMA",
            runtime_model_name="llama:latest",
            ollama_base_url="http://127.0.0.1:11434",
            ollama_user_id=viewer.user_id,
            category=models.ModelCategory.CONVERSACIONAL,
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        main,
        "ollama_models",
        lambda *, base_url: [{"name": "llama:latest"}],
    )
    available = api_call(
        "GET",
        "/api/models/status/ollama",
        cookie=cookie,
    )
    assert available.status_code == 200
    assert available.json()["server_available"] is True
    assert available.json()["models"][0]["available"] is True

    monkeypatch.setattr(
        main,
        "ollama_models",
        lambda *, base_url: (_ for _ in ()).throw(main.OllamaUnavailableError("offline")),
    )
    offline = api_call(
        "GET",
        "/api/models/status/ollama",
        cookie=cookie,
    )
    anonymous = api_call("GET", "/api/models/status/ollama")
    assert offline.status_code == 200
    assert offline.json()["server_available"] is False
    assert offline.json()["models"][0]["available"] is False
    assert anonymous.status_code == 401


def test_ollama_models_are_visible_but_do_not_accept_api_configurations(
    db_session: Session,
) -> None:
    cookie = create_account("ollama-user@example.com")
    owner = db_session.scalar(
        select(models.User).where(models.User.email == "ollama-user@example.com")
    )
    assert owner is not None
    model = models.AIModel(
        name="qwen3:latest",
        version="latest",
        provider="qwen3",
        runtime="OLLAMA",
        runtime_model_name="qwen3:latest",
        ollama_base_url="http://127.0.0.1:11434",
        ollama_user_id=owner.user_id,
        category=models.ModelCategory.CONVERSACIONAL,
    )
    db_session.add(model)
    db_session.commit()

    visible = api_call(
        "GET",
        "/api/profile/api-configurations",
        cookie=cookie,
    )
    rejected = api_call(
        "POST",
        f"/api/profile/api-configurations/{model.model_id}",
        payload={},
        cookie=cookie,
    )
    assert visible.status_code == 200
    assert [item["model_id"] for item in visible.json()["models"]] == [model.model_id]
    assert visible.json()["configurations"] == []
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "Ollama models do not require API configurations."
    saved = db_session.scalar(
        select(models.Configuration).where(
            models.Configuration.user_id.is_not(None),
            models.Configuration.model_id == model.model_id,
        )
    )
    assert saved is None
