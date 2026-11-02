from datetime import datetime

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
