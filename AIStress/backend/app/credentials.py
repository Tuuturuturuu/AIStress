import json
import os
from typing import Any

from cryptography.fernet import Fernet, InvalidToken


def _cipher() -> Fernet:
    key = os.getenv("CREDENTIALS_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "Set CREDENTIALS_ENCRYPTION_KEY to encrypt or decrypt credentials."
        )
    try:
        return Fernet(key.encode("ascii"))
    except (UnicodeEncodeError, ValueError) as exc:
        raise RuntimeError("CREDENTIALS_ENCRYPTION_KEY is not a valid Fernet key.") from exc


def encrypt_credentials(credentials: dict[str, Any]) -> bytes:
    serialized = json.dumps(
        credentials, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return _cipher().encrypt(serialized)


def decrypt_credentials(encrypted_credentials: bytes) -> dict[str, Any]:
    try:
        serialized = _cipher().decrypt(encrypted_credentials)
    except InvalidToken as exc:
        raise ValueError(
            "Credentials could not be decrypted; check the configured key."
        ) from exc
    credentials = json.loads(serialized)
    if not isinstance(credentials, dict):
        raise ValueError("The decrypted credentials are not a JSON object.")
    return credentials
