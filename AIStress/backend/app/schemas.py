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

from app.models import MODEL_CAPABILITIES, OrganizationRequestStatus, UserRole


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
    runtime: str


class ModelCatalogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    model_id: int
    name: str
    version: str
    provider: str
    runtime: str
    runtime_model_name: str | None
    ollama_base_url: str | None = None
    description: str | None
    family: str | None
    parameter_size: str | None
    model_format: str | None
    capabilities: list[str]
    quantization: str | None
    category: str
    is_active: bool


class OllamaDiscoveredModelOut(BaseModel):
    name: str
    size: int | None
    modified_at: str | None
    digest: str | None
    family: str | None
    parameter_size: str | None
    model_format: str | None
    quantization: str | None


class OllamaDiscoverRequest(BaseModel):
    base_url: str = Field(min_length=1, max_length=512)


class OllamaModelRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    base_url: str = Field(min_length=1, max_length=512)

    @field_validator("name", "description")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field cannot be empty.")
        return normalized


class ExternalModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    version: str = Field(min_length=1, max_length=80)
    provider: str = Field(min_length=1, max_length=120)
    runtime: str = Field(min_length=1, max_length=32)
    category: str
    description: str = Field(min_length=1, max_length=2000)
    capabilities: list[str] = Field(default_factory=list)

    @field_validator("name", "version", "provider", "runtime", "description")
    @classmethod
    def strip_model_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field cannot be empty.")
        return normalized

    @field_validator("runtime")
    @classmethod
    def supported_external_runtime(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"OPENAI", "ANTHROPIC", "OTHER"}:
            raise ValueError("Choose OPENAI, ANTHROPIC, or OTHER.")
        return normalized

    @field_validator("capabilities")
    @classmethod
    def supported_capabilities(cls, value: list[str]) -> list[str]:
        normalized = [item.strip().lower() for item in value]
        if any(item not in MODEL_CAPABILITIES for item in normalized):
            raise ValueError("Capabilities must be selected from the supported catalog.")
        return list(dict.fromkeys(normalized))


class ModelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    version: str | None = Field(default=None, min_length=1, max_length=80)
    provider: str | None = Field(default=None, min_length=1, max_length=120)
    category: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    capabilities: list[str] | None = None
    is_active: bool | None = None

    @field_validator("name", "version", "provider", "category", "is_active")
    @classmethod
    def reject_null_required_changes(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("This field cannot be null.")
        return value

    @field_validator("name", "version", "provider")
    @classmethod
    def strip_optional_model_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field cannot be empty.")
        return normalized

    @field_validator("capabilities")
    @classmethod
    def supported_optional_capabilities(
        cls, value: list[str] | None
    ) -> list[str] | None:
        if value is None:
            return None
        normalized = [item.strip().lower() for item in value]
        if any(item not in MODEL_CAPABILITIES for item in normalized):
            raise ValueError("Capabilities must be selected from the supported catalog.")
        return list(dict.fromkeys(normalized))


class APIConfigurationOut(BaseModel):
    configuration_id: int
    model_id: int
    model_name: str
    provider: str
    runtime: str
    endpoint: str | None
    temperature: Decimal | None
    max_tokens: int | None
    has_credentials: bool


class APIConfigurationCollectionOut(BaseModel):
    models: list[APIModelOut]
    configurations: list[APIConfigurationOut]


class APIConfigurationCreate(BaseModel):
    credentials: dict[str, Any] | None = None
    endpoint: str | None = Field(default=None, max_length=2048)
    temperature: Decimal | None = Field(default=None, ge=0, le=9.9999)
    max_tokens: int | None = Field(default=None, gt=0)

    @field_validator("credentials")
    @classmethod
    def require_credentials(
        cls, value: dict[str, Any] | None
    ) -> dict[str, Any] | None:
        if value is not None and not value:
            raise ValueError("Credential values cannot be empty.")
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
