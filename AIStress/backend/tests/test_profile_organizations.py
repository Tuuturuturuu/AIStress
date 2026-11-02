import asyncio
import json
from collections.abc import Iterator
from http.cookies import SimpleCookie

import httpx
import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from starlette.requests import Request

from app import main, models
from app.database import Base, get_db
from app.passwords import hash_password, verify_password


@pytest.fixture
def db_session(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Iterator[Session]:
    monkeypatch.setenv("AUTH_SESSION_SECRET", "test-profile-secret-012345678901234567890123")
    monkeypatch.setattr(
        main,
        "ORGANIZATION_UPLOAD_DIRECTORY",
        tmp_path / "organizations",
    )
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
    data: dict | None = None,
    files: dict | None = None,
    cookie: str | None = None,
) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=main.app)
        headers = {"Cookie": f"aistress_session={cookie}"} if cookie else {}
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as client:
            return await client.request(
                method,
                path,
                json=payload,
                data=data,
                files=files,
                headers=headers,
            )

    return asyncio.run(send())


def register_account(email: str, name: str = "Usuario") -> dict:
    response = api_call(
        "POST",
        "/api/auth/register",
        payload={
            "name": name,
            "email": email,
            "password": "secure-password",
            "password_confirmation": "secure-password",
        },
    )
    assert response.status_code == 201
    return response.json()


def login_cookie(email: str) -> str:
    response = api_call(
        "POST",
        "/api/auth/login",
        payload={"email": email, "password": "secure-password"},
    )
    assert response.status_code == 200
    cookie = SimpleCookie()
    cookie.load(response.headers["set-cookie"])
    return cookie["aistress_session"].value


def create_organization(cookie: str, name: str, *, logo: bool = False) -> httpx.Response:
    files = None
    if logo:
        files = {
            "logo": (
                "sample.png",
                b"\x89PNG\r\n\x1a\nvalid-test-png",
                "image/png",
            )
        }
    return api_call(
        "POST",
        "/api/profile/organization",
        data={
            "name": name,
            "description": "Equipo de investigación",
            "address": "Madrid",
        },
        files=files,
        cookie=cookie,
    )


def test_creator_becomes_manager_and_logo_is_stored_in_server_directory(
    db_session: Session,
) -> None:
    register_account("manager@example.com")
    cookie = login_cookie("manager@example.com")

    response = create_organization(cookie, "Laboratorio", logo=True)

    assert response.status_code == 201
    organization = response.json()
    assert organization["name"] == "Laboratorio"
    assert organization["description"] == "Equipo de investigación"
    assert organization["address"] == "Madrid"
    assert organization["logo_url"].startswith("/media/organizations/")
    creator = db_session.scalar(
        select(models.User).where(models.User.email == "manager@example.com")
    )
    assert creator is not None
    assert creator.role == models.UserRole.MANAGER
    assert creator.org_id == organization["org_id"]
    stored_logo = main.ORGANIZATION_UPLOAD_DIRECTORY / organization["logo_url"].split("/")[-1]
    assert stored_logo.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")


def test_invalid_logo_does_not_create_organization_or_assign_manager(
    db_session: Session,
) -> None:
    register_account("owner@example.com")
    cookie = login_cookie("owner@example.com")

    response = api_call(
        "POST",
        "/api/profile/organization",
        data={"name": "Sin logo", "description": "Descripción", "address": "Madrid"},
        files={"logo": ("not-image.png", b"not an image", "image/png")},
        cookie=cookie,
    )

    assert response.status_code == 415
    assert db_session.scalar(select(func.count()).select_from(models.Organization)) == 0
    owner = db_session.scalar(
        select(models.User).where(models.User.email == "owner@example.com")
    )
    assert owner is not None
    assert owner.org_id is None
    assert owner.role == models.UserRole.USER


def test_membership_requires_manager_approval_and_removes_personal_configurations(
    db_session: Session,
) -> None:
    manager_data = register_account("manager@example.com", "Manager")
    register_account("member@example.com", "Miembro")
    manager_cookie = login_cookie("manager@example.com")
    member_cookie = login_cookie("member@example.com")
    organization_response = create_organization(manager_cookie, "Grupo")
    organization_id = organization_response.json()["org_id"]

    model = models.AIModel(
        name="Modelo",
        version="1",
        provider="Proveedor",
        category=models.ModelCategory.AUDIO,
    )
    db_session.add(model)
    member = db_session.scalar(
        select(models.User).where(models.User.email == "member@example.com")
    )
    assert member is not None
    db_session.add(
        models.Configuration(
            user_id=member.user_id,
            model_id=model.model_id,
            credentials=b"encrypted-test-credentials",
        )
    )
    db_session.commit()

    search_response = api_call(
        "GET",
        "/api/profile/organization/search?q=Grpuo",
        cookie=member_cookie,
    )
    assert search_response.status_code == 200
    assert search_response.json()[0]["org_id"] == organization_id

    join_response = api_call(
        "POST",
        f"/api/profile/organization/requests/{organization_id}",
        cookie=member_cookie,
    )
    assert join_response.status_code == 201
    request_id = join_response.json()["request_id"]
    assert join_response.json()["status"] == "PENDING"
    assert member.org_id is None
    assert member.role == models.UserRole.USER

    duplicate_response = api_call(
        "POST",
        f"/api/profile/organization/requests/{organization_id}",
        cookie=member_cookie,
    )
    assert duplicate_response.status_code == 409

    manager_profile = api_call(
        "GET", "/api/profile/organization", cookie=manager_cookie
    )
    assert manager_profile.status_code == 200
    assert manager_profile.json()["pending_requests"][0]["request_id"] == request_id

    approval_response = api_call(
        "POST",
        f"/api/profile/organization/requests/{request_id}/decision",
        payload={"status": "APPROVED"},
        cookie=manager_cookie,
    )
    assert approval_response.status_code == 200
    assert approval_response.json()["status"] == "APPROVED"
    assert approval_response.json()["decided_by_user_id"] == manager_data["user_id"]
    assert member.org_id == organization_id
    assert member.role == models.UserRole.USER
    assert db_session.scalar(
        select(func.count()).select_from(models.Configuration)
    ) == 0


def test_missing_organization_returns_not_found_and_empty_search_results(
    db_session: Session,
) -> None:
    assert db_session.scalar(select(func.count()).select_from(models.Organization)) == 0
    register_account("applicant@example.com")
    applicant_cookie = login_cookie("applicant@example.com")

    search_response = api_call(
        "GET",
        "/api/profile/organization/search?q=Unknown+organization",
        cookie=applicant_cookie,
    )
    request_response = api_call(
        "POST",
        "/api/profile/organization/requests/999999",
        cookie=applicant_cookie,
    )

    assert search_response.status_code == 200
    assert search_response.json() == []
    assert request_response.status_code == 404
    assert request_response.json()["detail"] == "Organization was not found."


def test_database_schema_errors_are_not_reported_as_database_outages() -> None:
    request = Request(
        {"type": "http", "method": "GET", "path": "/", "headers": [], "query_string": b""}
    )
    schema_error = ProgrammingError("SELECT missing_column", {}, Exception("undefined"))
    connection_error = OperationalError("SELECT 1", {}, Exception("connection refused"))

    schema_response = main.database_error_handler(request, schema_error)
    connection_response = main.database_error_handler(request, connection_error)

    assert schema_response.status_code == 500
    assert json.loads(schema_response.body)["detail"] == (
        "A database operation failed. Please try again."
    )
    assert connection_response.status_code == 503


def test_manager_can_promote_multiple_members_and_admin_cannot_join(
    db_session: Session,
) -> None:
    register_account("manager@example.com")
    register_account("member-one@example.com")
    register_account("member-two@example.com")
    manager_cookie = login_cookie("manager@example.com")
    organization_id = create_organization(manager_cookie, "Equipo").json()["org_id"]

    for email in ("member-one@example.com", "member-two@example.com"):
        member_cookie = login_cookie(email)
        join_request = api_call(
            "POST",
            f"/api/profile/organization/requests/{organization_id}",
            cookie=member_cookie,
        )
        assert join_request.status_code == 201
        decision = api_call(
            "POST",
            f"/api/profile/organization/requests/{join_request.json()['request_id']}/decision",
            payload={"status": "APPROVED"},
            cookie=manager_cookie,
        )
        assert decision.status_code == 200

    members = db_session.scalars(
        select(models.User).where(models.User.org_id == organization_id)
    ).all()
    promoted = []
    for member in members:
        if member.role == models.UserRole.USER:
            response = api_call(
                "POST",
                f"/api/profile/organization/members/{member.user_id}/manager",
                cookie=manager_cookie,
            )
            assert response.status_code == 200
            promoted.append(response.json()["user_id"])
    assert len(promoted) == 2
    assert db_session.scalar(
        select(func.count()).select_from(models.User).where(
            models.User.org_id == organization_id,
            models.User.role == models.UserRole.MANAGER,
        )
    ) == 3

    admin = models.User(
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("secure-password"),
        role=models.UserRole.ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    admin_cookie = login_cookie("admin@example.com")
    admin_search = api_call(
        "GET",
        "/api/profile/organization/search?q=Equ",
        cookie=admin_cookie,
    )
    assert admin_search.status_code == 403
    assert admin.org_id is None


def test_approval_cancels_other_pending_requests_without_losing_history(
    db_session: Session,
) -> None:
    register_account("manager-one@example.com")
    register_account("manager-two@example.com")
    register_account("applicant@example.com")
    manager_one_cookie = login_cookie("manager-one@example.com")
    manager_two_cookie = login_cookie("manager-two@example.com")
    applicant_cookie = login_cookie("applicant@example.com")
    organization_one = create_organization(manager_one_cookie, "Grupo Uno").json()
    organization_two = create_organization(manager_two_cookie, "Grupo Dos").json()

    requests = []
    for organization in (organization_one, organization_two):
        response = api_call(
            "POST",
            f"/api/profile/organization/requests/{organization['org_id']}",
            cookie=applicant_cookie,
        )
        assert response.status_code == 201
        requests.append(response.json())

    approval = api_call(
        "POST",
        f"/api/profile/organization/requests/{requests[0]['request_id']}/decision",
        payload={"status": "APPROVED"},
        cookie=manager_one_cookie,
    )
    assert approval.status_code == 200
    history = api_call(
        "GET",
        "/api/profile/organization/requests",
        cookie=applicant_cookie,
    )
    assert history.status_code == 200
    statuses = {item["request_id"]: item["status"] for item in history.json()}
    assert statuses[requests[0]["request_id"]] == "APPROVED"
    assert statuses[requests[1]["request_id"]] == "CANCELLED"
    cancelled = db_session.get(
        models.OrganizationJoinRequest, requests[1]["request_id"]
    )
    assert cancelled is not None
    assert cancelled.decided_by_user_id is None
    assert cancelled.decided_at is not None


def test_only_organization_managers_can_decide_and_rejected_requests_are_retained(
    db_session: Session,
) -> None:
    register_account("manager@example.com")
    register_account("applicant@example.com")
    manager_cookie = login_cookie("manager@example.com")
    applicant_cookie = login_cookie("applicant@example.com")
    organization_id = create_organization(manager_cookie, "Grupo").json()["org_id"]
    join_request = api_call(
        "POST",
        f"/api/profile/organization/requests/{organization_id}",
        cookie=applicant_cookie,
    )
    request_id = join_request.json()["request_id"]

    unauthorized_decision = api_call(
        "POST",
        f"/api/profile/organization/requests/{request_id}/decision",
        payload={"status": "APPROVED"},
        cookie=applicant_cookie,
    )
    assert unauthorized_decision.status_code == 403

    rejected = api_call(
        "POST",
        f"/api/profile/organization/requests/{request_id}/decision",
        payload={"status": "REJECTED"},
        cookie=manager_cookie,
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert rejected.json()["decided_at"] is not None
    assert rejected.json()["decided_by_user_id"] is not None
    applicant = db_session.scalar(
        select(models.User).where(models.User.email == "applicant@example.com")
    )
    assert applicant is not None
    assert applicant.org_id is None
    assert applicant.role == models.UserRole.USER


def test_account_update_requires_current_password_and_applies_registration_rules(
    db_session: Session,
) -> None:
    register_account("account@example.com")
    cookie = login_cookie("account@example.com")

    wrong_password = api_call(
        "PUT",
        "/api/profile/account",
        payload={
            "name": "Nuevo Nombre",
            "email": "account@example.com",
            "current_password": "wrong-password",
            "new_password": "updated-password",
            "new_password_confirmation": "updated-password",
        },
        cookie=cookie,
    )
    assert wrong_password.status_code == 400

    invalid_password = api_call(
        "PUT",
        "/api/profile/account",
        payload={
            "name": "Nuevo Nombre",
            "email": "account@example.com",
            "current_password": "secure-password",
            "new_password": "short",
            "new_password_confirmation": "short",
        },
        cookie=cookie,
    )
    assert invalid_password.status_code == 422

    updated = api_call(
        "PUT",
        "/api/profile/account",
        payload={
            "name": "Nuevo Nombre",
            "email": "account@example.com",
            "current_password": "secure-password",
            "new_password": "updated-password",
            "new_password_confirmation": "updated-password",
        },
        cookie=cookie,
    )
    assert updated.status_code == 200
    user = db_session.scalar(
        select(models.User).where(models.User.email == "account@example.com")
    )
    assert user is not None
    assert user.name == "Nuevo Nombre"
    assert verify_password("updated-password", user.password_hash)
    assert not verify_password("secure-password", user.password_hash)


def test_admin_panel_lists_global_users_and_organizations_read_only(
    db_session: Session,
) -> None:
    register_account("manager@example.com")
    manager_cookie = login_cookie("manager@example.com")
    organization = create_organization(manager_cookie, "Grupo").json()
    admin = models.User(
        name="Admin",
        email="admin@example.com",
        password_hash=hash_password("secure-password"),
        role=models.UserRole.ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    admin_cookie = login_cookie("admin@example.com")

    users_response = api_call("GET", "/api/users", cookie=admin_cookie)
    organizations_response = api_call("GET", "/api/organizations", cookie=admin_cookie)

    assert users_response.status_code == 200
    assert {user["role"] for user in users_response.json()} == {"ADMIN", "MANAGER"}
    assert organizations_response.status_code == 200
    assert organizations_response.json()[0]["org_id"] == organization["org_id"]
    assert organizations_response.json()[0]["members"][0]["role"] == "MANAGER"

    users_create = {route.path: route for route in main.app.routes}
    assert not any(
        getattr(route, "path", None) == "/api/users"
        and "POST" in getattr(route, "methods", set())
        for route in users_create.values()
    )
    assert not any(
        getattr(route, "path", None) == "/api/organizations"
        and "POST" in getattr(route, "methods", set())
        for route in users_create.values()
    )
