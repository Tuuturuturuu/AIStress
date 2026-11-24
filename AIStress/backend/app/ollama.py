import ipaddress
import json
import socket
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class OllamaUnavailableError(RuntimeError):
    pass


def validate_ollama_base_url(value: str) -> str:
    value = value.strip().rstrip("/")
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise OllamaUnavailableError(
            "The Ollama URL must be an HTTP(S) address without credentials or query parameters."
        )

    try:
        addresses = {ipaddress.ip_address(parsed.hostname)}
    except ValueError:
        if parsed.hostname.casefold() == "localhost":
            addresses = {ipaddress.ip_address("127.0.0.1")}
        else:
            try:
                addresses = {
                    ipaddress.ip_address(result[4][0])
                    for result in socket.getaddrinfo(parsed.hostname, parsed.port or 11434)
                }
            except (OSError, ValueError) as exc:
                raise OllamaUnavailableError(
                    "The Ollama host could not be resolved."
                ) from exc

    if not addresses or any(
        not (address.is_private or address.is_loopback or address.is_link_local)
        for address in addresses
    ):
        raise OllamaUnavailableError(
            "The Ollama URL must point to a local or private network host."
        )
    return value


def ollama_request(
    path: str,
    payload: dict[str, Any] | None = None,
    *,
    base_url: str,
) -> dict[str, Any]:
    validated_base_url = validate_ollama_base_url(base_url)
    url = f"{validated_base_url}{path}"
    headers = {"Accept": "application/json"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers=headers)
    try:
        with urlopen(request, timeout=8) as response:
            result = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise OllamaUnavailableError("Could not reach the Ollama server.") from exc
    if not isinstance(result, dict):
        raise OllamaUnavailableError("Ollama returned an invalid response.")
    return result


def ollama_models(*, base_url: str) -> list[dict[str, Any]]:
    response = ollama_request("/api/tags", base_url=base_url)
    items = response.get("models")
    if not isinstance(items, list):
        raise OllamaUnavailableError("Ollama returned an invalid model list.")
    return [item for item in items if isinstance(item, dict)]


def ollama_model_details(name: str, *, base_url: str) -> dict[str, Any]:
    return ollama_request("/api/show", {"model": name}, base_url=base_url)
