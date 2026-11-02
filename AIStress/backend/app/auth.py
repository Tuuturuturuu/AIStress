import base64
import hashlib
import hmac
import os
import time


SESSION_COOKIE_NAME = "aistress_session"
SESSION_MAX_AGE_SECONDS = 8 * 60 * 60


def _session_secret() -> bytes:
    secret = os.getenv("AUTH_SESSION_SECRET")
    if secret is None or len(secret.encode("utf-8")) < 32:
        raise RuntimeError(
            "Set AUTH_SESSION_SECRET to a random value of at least 32 characters."
        )
    return secret.encode("utf-8")


def create_session_token(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time()) + SESSION_MAX_AGE_SECONDS}".encode("ascii")
    encoded_payload = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    signature = hmac.new(_session_secret(), encoded_payload.encode("ascii"), hashlib.sha256)
    encoded_signature = base64.urlsafe_b64encode(signature.digest()).decode("ascii").rstrip("=")
    return f"{encoded_payload}.{encoded_signature}"


def get_session_user_id(token: str | None) -> int | None:
    if token is None:
        return None
    try:
        encoded_payload, encoded_signature = token.split(".", maxsplit=1)
        expected_signature = hmac.new(
            _session_secret(), encoded_payload.encode("ascii"), hashlib.sha256
        ).digest()
        provided_signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(expected_signature, provided_signature):
            return None
        payload = base64.urlsafe_b64decode(
            encoded_payload + "=" * (-len(encoded_payload) % 4)
        ).decode("ascii")
        raw_user_id, raw_expiration = payload.split(":", maxsplit=1)
        user_id = int(raw_user_id)
        expiration = int(raw_expiration)
    except (ValueError, UnicodeError):
        return None

    if user_id <= 0 or expiration <= int(time.time()):
        return None
    return user_id
