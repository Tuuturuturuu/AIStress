from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SQLAlchemyEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    USER = "USER"
    MANAGER = "MANAGER"


class ModelCategory(str, Enum):
    AUDIO = "AUDIO"
    VIDEO = "VIDEO"
    IMAGE = "IMAGE"
    CONVERSACIONAL = "CONVERSACIONAL"
    OPEN_SOURCE = "OPEN_SOURCE"
    ESPECIALIZADO_EN_RAZONAMIENTO = "ESPECIALIZADO_EN_RAZONAMIENTO"


class EvaluationStatus(str, Enum):
    INACTIVA = "INACTIVA"
    EN_EJECUCION = "EN_EJECUCION"
    TERMINADA = "TERMINADA"


class OrganizationRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role != 'MANAGER' OR org_id IS NOT NULL",
            name="ck_manager_requires_organization",
        ),
        CheckConstraint(
            "role != 'ADMIN' OR org_id IS NULL",
            name="ck_admin_has_no_organization",
        ),
    )

    user_id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.org_id", ondelete="RESTRICT"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(
            UserRole, native_enum=False, create_constraint=True, length=7, name="user_role"
        ),
        default=UserRole.USER,
        nullable=False,
    )
    accessibility: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    privacy_data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    organization: Mapped["Organization | None"] = relationship(back_populates="members")
    organization_requests: Mapped[list["OrganizationJoinRequest"]] = relationship(
        back_populates="user", foreign_keys="OrganizationJoinRequest.user_id"
    )
    configurations: Mapped[list["Configuration"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="user")


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        Index(
            "uq_active_organization_name",
            "name",
            unique=True,
            postgresql_where=text("is_active = TRUE"),
            sqlite_where=text("is_active = 1"),
        ),
    )

    org_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    logo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    members: Mapped[list[User]] = relationship(back_populates="organization")
    join_requests: Mapped[list["OrganizationJoinRequest"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )

    @property
    def logo_url(self) -> str | None:
        if self.logo_path is None:
            return None
        return f"/media/{self.logo_path}"


class OrganizationJoinRequest(Base):
    __tablename__ = "organization_join_requests"
    __table_args__ = (
        Index(
            "uq_pending_organization_join_request",
            "organization_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
            sqlite_where=text("status = 'PENDING'"),
        ),
    )

    request_id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.org_id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[OrganizationRequestStatus] = mapped_column(
        SQLAlchemyEnum(
            OrganizationRequestStatus,
            native_enum=False,
            create_constraint=True,
            length=9,
            name="organization_request_status",
        ),
        default=OrganizationRequestStatus.PENDING,
        nullable=False,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )

    organization: Mapped[Organization] = relationship(back_populates="join_requests")
    user: Mapped[User] = relationship(
        back_populates="organization_requests", foreign_keys=[user_id]
    )
    decided_by: Mapped[User | None] = relationship(foreign_keys=[decided_by_user_id])


class AIModel(Base):
    __tablename__ = "models"

    model_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    version: Mapped[str] = mapped_column(String(80), nullable=False)
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    country: Mapped[str | None] = mapped_column(String(120), nullable=True)
    year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    category: Mapped[ModelCategory] = mapped_column(
        SQLAlchemyEnum(
            ModelCategory,
            native_enum=False,
            create_constraint=True,
            length=40,
            name="model_category",
        ),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    configurations: Mapped[list["Configuration"]] = relationship(back_populates="model")
    evaluations: Mapped[list["Evaluation"]] = relationship(back_populates="model")


class Configuration(Base):
    __tablename__ = "configurations"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True
    )
    model_id: Mapped[int] = mapped_column(
        ForeignKey("models.model_id", ondelete="CASCADE"), primary_key=True
    )
    credentials: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    endpoint: Mapped[str | None] = mapped_column(Text, nullable=True)
    temperature: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    max_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped[User] = relationship(back_populates="configurations")
    model: Mapped[AIModel] = relationship(back_populates="configurations")


class Dimension(Base):
    __tablename__ = "dimensions"

    dimension_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    tests: Mapped[list["TestCase"]] = relationship(back_populates="dimension")


class TestCase(Base):
    __tablename__ = "tests"

    test_id: Mapped[int] = mapped_column(primary_key=True)
    dimension_id: Mapped[int] = mapped_column(
        ForeignKey("dimensions.dimension_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    dimension: Mapped[Dimension] = relationship(back_populates="tests")
    executions: Mapped[list["Execution"]] = relationship(back_populates="test")


class Evaluation(Base):
    __tablename__ = "evaluations"

    eval_id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(
        ForeignKey("models.model_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[EvaluationStatus] = mapped_column(
        SQLAlchemyEnum(
            EvaluationStatus,
            native_enum=False,
            create_constraint=True,
            length=15,
            name="evaluation_status",
        ),
        default=EvaluationStatus.EN_EJECUCION,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    model: Mapped[AIModel] = relationship(back_populates="evaluations")
    user: Mapped[User] = relationship(back_populates="evaluations")
    executions: Mapped[list["Execution"]] = relationship(
        back_populates="evaluation", cascade="all, delete-orphan"
    )
    results: Mapped[list["Result"]] = relationship(
        back_populates="evaluation", cascade="all, delete-orphan"
    )


class Execution(Base):
    __tablename__ = "executions"

    exec_id: Mapped[int] = mapped_column(primary_key=True)
    eval_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.eval_id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_id: Mapped[int] = mapped_column(
        ForeignKey("tests.test_id", ondelete="RESTRICT"), nullable=False, index=True
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    parameters: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[EvaluationStatus] = mapped_column(
        SQLAlchemyEnum(
            EvaluationStatus,
            native_enum=False,
            create_constraint=True,
            length=15,
            name="evaluation_status",
        ),
        default=EvaluationStatus.EN_EJECUCION,
        nullable=False,
    )

    evaluation: Mapped[Evaluation] = relationship(back_populates="executions")
    test: Mapped[TestCase] = relationship(back_populates="executions")


class Result(Base):
    __tablename__ = "results"

    result_id: Mapped[int] = mapped_column(primary_key=True)
    eval_id: Mapped[int] = mapped_column(
        ForeignKey("evaluations.eval_id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    response_result: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    response_data: Mapped[Any | None] = mapped_column(JSON, nullable=True)

    evaluation: Mapped[Evaluation] = relationship(back_populates="results")
