from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.models import OrganizationRequestStatus, UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RegistrationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    password_confirmation: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty.")
        return normalized

    @model_validator(mode="after")
    def passwords_match(self) -> "RegistrationRequest":
        if self.password != self.password_confirmation:
            raise ValueError("Password confirmation does not match.")
        return self


class AccountUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    current_password: str | None = Field(default=None, min_length=1, max_length=128)
    new_password: str | None = Field(default=None, min_length=8, max_length=128)
    new_password_confirmation: str | None = Field(
        default=None, min_length=8, max_length=128
    )

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Name cannot be empty.")
        return normalized

    @model_validator(mode="after")
    def validate_password_change(self) -> "AccountUpdate":
        password_fields = (
            self.current_password,
            self.new_password,
            self.new_password_confirmation,
        )
        if any(value is not None for value in password_fields):
            if not all(value is not None for value in password_fields):
                raise ValueError(
                    "To change your password, provide the current password, "
                    "the new password, and its confirmation."
                )
            if self.new_password != self.new_password_confirmation:
                raise ValueError("Password confirmation does not match.")
        return self


class AccountDeactivationRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


class CurrentPasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


class APIModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    model_id: int
    name: str
    provider: str


class APIConfigurationOut(BaseModel):
    configuration_id: int
    model_id: int
    model_name: str
    provider: str
    endpoint: str | None
    temperature: Decimal | None
    max_tokens: int | None
    has_credentials: bool


class APIConfigurationCollectionOut(BaseModel):
    models: list[APIModelOut]
    configurations: list[APIConfigurationOut]


class APIConfigurationCreate(BaseModel):
    credentials: dict[str, Any]
    endpoint: str | None = Field(default=None, max_length=2048)
    temperature: Decimal | None = Field(default=None, ge=0, le=9.9999)
    max_tokens: int | None = Field(default=None, gt=0)

    @field_validator("credentials")
    @classmethod
    def require_credentials(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not value:
            raise ValueError("Provide at least one credential value.")
        return value


class APIConfigurationUpdate(BaseModel):
    credentials: dict[str, Any] | None = None
    endpoint: str | None = Field(default=None, max_length=2048)
    temperature: Decimal | None = Field(default=None, ge=0, le=9.9999)
    max_tokens: int | None = Field(default=None, gt=0)

    @field_validator("credentials")
    @classmethod
    def require_nonempty_replacement(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        if value is not None and not value:
            raise ValueError("Provide at least one credential value.")
        return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    org_id: int | None
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool


class OrganizationJoinRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    request_id: int
    organization_id: int
    organization_name: str
    status: OrganizationRequestStatus
    requested_at: datetime
    decided_at: datetime | None
    decided_by_user_id: int | None
    user: UserOut


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: int
    name: str
    description: str
    address: str
    logo_url: str | None
    is_active: bool
    members: list[UserOut]
    pending_requests: list[OrganizationJoinRequestOut] = Field(default_factory=list)


class OrganizationSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: int
    name: str
    description: str
    address: str
    logo_url: str | None
    is_active: bool


class OrganizationJoinRequestDecision(BaseModel):
    status: OrganizationRequestStatus

    @field_validator("status")
    @classmethod
    def require_final_status(
        cls, value: OrganizationRequestStatus
    ) -> OrganizationRequestStatus:
        if value not in {
            OrganizationRequestStatus.APPROVED,
            OrganizationRequestStatus.REJECTED,
        }:
            raise ValueError("The decision must approve or reject the request.")
        return value
