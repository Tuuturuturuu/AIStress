import base64
import hashlib
import hmac
import secrets


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"scrypt$16384$8$1${encoded_salt}${encoded_digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, n, r, p, encoded_salt, encoded_digest = password_hash.split("$")
        if algorithm != "scrypt" or (int(n), int(r), int(p)) != (2**14, 8, 1):
            return False
        salt = base64.urlsafe_b64decode(encoded_salt)
        expected_digest = base64.urlsafe_b64decode(encoded_digest)
        actual_digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=len(expected_digest),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual_digest, expected_digest)
